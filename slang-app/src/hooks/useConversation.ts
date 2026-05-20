import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationMessage, HintCard, Situation, SpeechFeedback, TurnState, VoiceAccent } from '../types';
import {
  generateOpeningMessage,
  generateTurnResponse,
  generateSilenceIntervention,
  analyzeSpeech,
  evaluateUserResponse,
} from '../agent/agentEngine';

export type { TurnState };

// ── Public state shape ─────────────────────────────────────────────
export interface ConversationState {
  messages: ConversationMessage[];
  turnState: TurnState;
  interimText: string;
  silenceSec: number;
  hasSpeechApi: boolean;
}

export interface UseConversationOptions {
  onSilenceIntervention?: () => void;
  onWrongAnswer?: (card: HintCard) => void;
  accent?: VoiceAccent;
}

// ── Constants ──────────────────────────────────────────────────────
const SILENCE_THRESHOLD_SEC = 15;

const hasSpeechApi =
  typeof window !== 'undefined' &&
  !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);

const INITIAL: ConversationState = {
  messages: [],
  turnState: 'idle',
  interimText: '',
  silenceSec: 0,
  hasSpeechApi,
};

let _msgId = 0;
const newMsgId = () => `msg_${++_msgId}`;

// ── Hook ───────────────────────────────────────────────────────────
export function useConversation(
  situation: Situation | null,
  options: UseConversationOptions = {}
) {
  const [convState, setConvState] = useState<ConversationState>(INITIAL);

  // ── Single mutable ref — safe to access inside async closures ───
  const r = useRef({
    situation: null as Situation | null,
    messages: [] as ConversationMessage[],
    isActive: false,
    recognition: null as SpeechRecognition | null,
    silenceInterval: null as ReturnType<typeof setInterval> | null,
    silenceCount: 0,
    pendingTranscript: '',
    onSilenceIntervention: options.onSilenceIntervention as (() => void) | undefined,
    onWrongAnswer: options.onWrongAnswer as ((card: HintCard) => void) | undefined,
    // True after a silence-intervention fires, cleared when user next speaks.
    // Used to: (1) skip analyzeSpeech on the recovery turn, (2) not double-count in scripts.
    justIntervened: false,
    // Incremented each time STT is aborted — callbacks capture their gen and bail if stale.
    recognitionGen: 0,
    accent: (options.accent ?? 'en-US') as VoiceAccent,
  });

  useEffect(() => { r.current.situation = situation; }, [situation]);
  useEffect(() => { r.current.onSilenceIntervention = options.onSilenceIntervention; }, [options.onSilenceIntervention]);
  useEffect(() => { r.current.onWrongAnswer = options.onWrongAnswer; }, [options.onWrongAnswer]);
  useEffect(() => { r.current.accent = options.accent ?? 'en-US'; }, [options.accent]);

  // ── UI updater (setConvState is stable, safe to call from closures) ─
  function patch(partial: Partial<ConversationState>) {
    setConvState(prev => ({ ...prev, ...partial }));
  }

  function pushMessage(
    role: ConversationMessage['role'],
    text: string,
    extra?: { feedbackData?: SpeechFeedback; isIntervention?: boolean }
  ): ConversationMessage {
    const msg: ConversationMessage = {
      id: newMsgId(),
      role,
      text,
      timestampMs: performance.now(),
      ...extra,
    };
    r.current.messages = [...r.current.messages, msg];
    setConvState(prev => ({ ...prev, messages: r.current.messages }));
    return msg;
  }

  // ── STT abort helper — increments gen so stale callbacks self-discard ──
  function abortSTT() {
    r.current.recognitionGen += 1;
    r.current.recognition?.abort();
    r.current.recognition = null;
    r.current.pendingTranscript = '';
  }

  // ── Silence timer ──────────────────────────────────────────────
  function stopSilenceTimer() {
    if (r.current.silenceInterval !== null) {
      clearInterval(r.current.silenceInterval);
      r.current.silenceInterval = null;
    }
    r.current.silenceCount = 0;
  }

  // ── TTS ────────────────────────────────────────────────────────
  // lang overrides r.current.accent; pass 'ko-KR' for Korean coaching nudges
  function speakText(text: string, lang?: string): Promise<void> {
    const effectiveLang = lang ?? r.current.accent;
    return new Promise(resolve => {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = effectiveLang;
      utter.rate = effectiveLang.startsWith('ko') ? 0.88 : 0.92;
      utter.pitch = effectiveLang.startsWith('ko') ? 1.0 : 1.05;

      function loadAndSpeak() {
        const voices = window.speechSynthesis.getVoices();
        let preferred: SpeechSynthesisVoice | undefined;
        if (effectiveLang.startsWith('ko')) {
          preferred = voices.find(v => /ko/i.test(v.lang));
        } else if (effectiveLang === 'en-GB') {
          preferred =
            voices.find(v => /en.?GB/i.test(v.lang) && /google|daniel|kate|serena/i.test(v.name)) ??
            voices.find(v => /en.?GB/i.test(v.lang));
        } else if (effectiveLang === 'en-AU') {
          preferred =
            voices.find(v => /en.?AU/i.test(v.lang) && /google|karen|lee/i.test(v.name)) ??
            voices.find(v => /en.?AU/i.test(v.lang));
        } else {
          preferred =
            voices.find(v => /en.?US/i.test(v.lang) && /google|samantha|karen|daniel|alex/i.test(v.name)) ??
            voices.find(v => /en.?US/i.test(v.lang)) ??
            voices.find(v => /^en/i.test(v.lang));
        }
        if (preferred) utter.voice = preferred;
        utter.onend = () => resolve();
        utter.onerror = () => resolve();
        window.speechSynthesis.speak(utter);
      }

      if (window.speechSynthesis.getVoices().length > 0) {
        loadAndSpeak();
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.onvoiceschanged = null;
          loadAndSpeak();
        };
      }
    });
  }

  // ── Conversation loop (all functions stored in a ref so they can
  //    call each other without circular useCallback deps) ──────────
  const loop = useRef({
    afterAgentSpeaks() {
      if (!r.current.isActive) return;
      // Brief pause lets TTS audio dissipate before STT starts (prevents echo capture)
      setTimeout(() => {
        if (!r.current.isActive) return;
        loop.current.startSilenceTimer();
        loop.current.startListening();
      }, 450);
    },

    async agentRespond(
      text: string,
      lang?: string,
      extra?: { isIntervention?: boolean }
    ) {
      if (!r.current.isActive) return;

      // ── Stop STT BEFORE speaking to prevent echo ─────────────────
      abortSTT();

      patch({ turnState: 'agent_speaking' });
      pushMessage('agent', text, extra);
      await speakText(text, lang);
      if (r.current.isActive) loop.current.afterAgentSpeaks();
    },

    async handleUserSpeech(transcript: string) {
      stopSilenceTimer();
      abortSTT();

      const sit = r.current.situation;
      if (!sit) return;

      // ── Evaluate before adding to history ────────────────────────
      // Catches single-word dead-ends ("No", "Yes", "I don't know") and
      // intervenes immediately without waiting for the 15 s silence timer.
      const evaluation = evaluateUserResponse(transcript, sit);
      if (!evaluation.appropriate && evaluation.coaching && evaluation.hint) {
        patch({ turnState: 'intervening', interimText: '', silenceSec: 0 });
        // Bad answer does NOT enter history — the turn is not consumed.
        // Skip speech feedback on the recovery turn too.
        r.current.justIntervened = true;

        // Refresh hint card in the right panel
        r.current.onWrongAnswer?.({
          id: `wrong_${Date.now()}`,
          type: 'phrase',
          title: '이렇게 말해봐요! 💡',
          body: '실제 상황에서 바로 쓸 수 있는 원어민 표현이에요.',
          phrase: evaluation.hint.phrase,
          phonetic: evaluation.hint.phonetic,
          translation: evaluation.hint.translation,
          urgency: 'high',
        });

        await speakText(evaluation.coaching, 'ko-KR');
        if (!r.current.isActive) return;
        loop.current.afterAgentSpeaks(); // restart STT so user can try again
        return;
      }

      // ── Appropriate answer — commit to history and continue ───────
      patch({ turnState: 'agent_thinking', interimText: '', silenceSec: 0 });
      pushMessage('user', transcript);

      // ── Immediate speech feedback ─────────────────────────────────
      // Skip feedback on the first turn after a silence intervention:
      // the user was just trying out the suggested phrase, so correcting
      // it immediately would feel jarring. Encourage first, correct next.
      const wasJustIntervened = r.current.justIntervened;
      r.current.justIntervened = false;

      if (!wasJustIntervened) {
        // Production: replace analyzeSpeech() with Claude API structured output
        const feedback = analyzeSpeech(transcript, sit);
        if (feedback) {
          pushMessage('feedback', feedback.explanation, { feedbackData: feedback });
          const ttsText = `${feedback.explanation} 그러니까 "${feedback.suggestion}" 이렇게 말해보면 훨씬 좋아요!`;
          await speakText(ttsText, 'ko-KR');
          if (!r.current.isActive) return;
        }
      }

      // ── Regular English conversation response ─────────────────────
      const response = await generateTurnResponse(transcript, sit, r.current.messages);
      await loop.current.agentRespond(response);
    },

    async silenceIntervention() {
      if (!r.current.isActive) return;

      // Stop STT immediately — prevents it capturing the Korean TTS as user speech
      abortSTT();

      r.current.onSilenceIntervention?.();

      const sit = r.current.situation;
      if (!sit) return;

      // Flag: the next user turn is a recovery, not a normal conversational turn.
      // This prevents: (1) double-counting in script index, (2) jarring feedback.
      r.current.justIntervened = true;

      patch({ turnState: 'intervening' });
      const text = generateSilenceIntervention(sit, r.current.messages);
      // Mark isIntervention so generateTurnResponse excludes it from agent-turn count
      await loop.current.agentRespond(text, 'ko-KR', { isIntervention: true });
    },

    startSilenceTimer() {
      stopSilenceTimer();
      r.current.silenceCount = 0;
      setConvState(prev => ({ ...prev, silenceSec: 0 }));

      r.current.silenceInterval = setInterval(() => {
        r.current.silenceCount += 1;
        setConvState(prev => ({ ...prev, silenceSec: r.current.silenceCount }));

        if (r.current.silenceCount >= SILENCE_THRESHOLD_SEC) {
          stopSilenceTimer();
          void loop.current.silenceIntervention();
        }
      }, 1000);
    },

    startListening() {
      if (!r.current.isActive) return;

      const SR: (new () => SpeechRecognition) | undefined =
        window.SpeechRecognition ?? window.webkitSpeechRecognition;

      if (!SR) {
        console.warn('[Conv] Web Speech API not available — STT disabled');
        return;
      }

      abortSTT();
      const thisGen = r.current.recognitionGen;

      const rec = new SR();
      r.current.recognition = rec;
      rec.lang = 'en-US';
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      patch({ turnState: 'waiting' });

      rec.onresult = (evt: SpeechRecognitionEvent) => {
        if (r.current.recognitionGen !== thisGen) return;
        let interim = '';
        let final = '';
        for (let i = evt.resultIndex; i < evt.results.length; i++) {
          if (evt.results[i].isFinal) final += evt.results[i][0].transcript;
          else interim += evt.results[i][0].transcript;
        }
        const display = final || interim;
        if (final) r.current.pendingTranscript = final;

        if (display.trim()) {
          stopSilenceTimer();
          patch({ interimText: display, turnState: 'user_speaking', silenceSec: 0 });
        }
      };

      rec.onend = () => {
        if (r.current.recognitionGen !== thisGen) return;
        if (!r.current.isActive) return;
        const transcript = r.current.pendingTranscript.trim();
        r.current.pendingTranscript = '';
        patch({ interimText: '' });

        if (transcript) {
          void loop.current.handleUserSpeech(transcript);
        } else {
          // Nothing captured — restart listening after a brief pause.
          // 500 ms gives TTS reverb time to fade so we don't immediately
          // re-capture our own TTS audio on the next recognition session.
          setTimeout(() => {
            if (r.current.isActive) loop.current.startListening();
          }, 500);
        }
      };

      rec.onerror = (evt: SpeechRecognitionErrorEvent) => {
        if (r.current.recognitionGen !== thisGen) return;
        console.warn('[Conv] STT error:', evt.error);
        if (!r.current.isActive) return;
        if (evt.error === 'aborted') return;
        setTimeout(() => {
          if (r.current.isActive) loop.current.startListening();
        }, 500);
      };

      try {
        rec.start();
      } catch {
        // ignore — may already be starting
      }
    },
  });

  // ── Public API ─────────────────────────────────────────────────
  const startConversation = useCallback(async () => {
    const sit = r.current.situation;
    if (!sit) return;

    r.current.isActive = true;
    r.current.messages = [];
    r.current.pendingTranscript = '';
    r.current.silenceCount = 0;
    setConvState({ ...INITIAL, turnState: 'agent_speaking' });

    const opening = generateOpeningMessage(sit);
    await loop.current.agentRespond(opening);
  }, []);

  const stopConversation = useCallback(() => {
    r.current.isActive = false;
    stopSilenceTimer();
    r.current.recognition?.abort();
    r.current.recognition = null;
    window.speechSynthesis.cancel();
    setConvState(prev => ({ ...prev, turnState: 'idle', interimText: '', silenceSec: 0 }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      r.current.isActive = false;
      stopSilenceTimer();
      r.current.recognition?.abort();
      window.speechSynthesis.cancel();
    };
  }, []);

  return { convState, startConversation, stopConversation };
}
