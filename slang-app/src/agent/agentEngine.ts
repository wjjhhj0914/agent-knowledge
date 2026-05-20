/**
 * Agent Engine — maps perception events to tool calls.
 *
 * Architecture note:
 *   This module contains the decision logic that would be handled by Claude API
 *   in production. The `processEvent()` function is the single swap point:
 *   replace the local rules with a real API call (streaming tool_use) and the
 *   rest of the system (hooks, UI) remains unchanged.
 *
 * Production integration:
 *   const response = await anthropic.messages.create({
 *     model: 'claude-opus-4-7',
 *     tools: TOOL_SCHEMAS,
 *     messages: buildConversation(event, situation, agentState),
 *   });
 *   // parse response.content for tool_use blocks → ToolCall[]
 */

import type { AgentEvent, ConversationMessage, Situation, SituationId, SpeechFeedback, ToolCall } from '../types';
import { TOOL_SCHEMAS } from './tools';

export { TOOL_SCHEMAS };

let callId = 0;
function nextId() { return `call_${++callId}`; }

export function processEvent(event: AgentEvent, situation: Situation): ToolCall[] {
  const hints = situation.hints;
  const pick = (i: number) => hints[i % hints.length];

  switch (event.type) {

    case 'session_started':
      return [
        {
          id: nextId(),
          name: 'change_agent_reaction',
          args: {
            mood: 'listening',
            message: '잘 들을게요. 언제든 시작하세요 😊',
          },
        },
      ];

    case 'silence_detected': {
      const sec = (event.payload['silenceSec'] as number) ?? 0;
      const h = pick(0);
      if (sec >= 30) {
        // Long silence → direct phrase suggestion
        return [
          {
            id: nextId(),
            name: 'change_agent_reaction',
            args: { mood: 'alert', message: '막혔나요? 이 표현으로 시작해보세요 👇' },
          },
          {
            id: nextId(),
            name: 'show_hint_card',
            args: {
              type: 'phrase',
              title: '바로 써볼 수 있는 표현',
              body: `${sec}초 침묵이에요. 이 한 마디로 시작해보세요!`,
              phrase: h.phrase,
              phonetic: h.phonetic,
              translation: h.translation,
              urgency: 'high',
            },
          },
        ];
      }
      // Medium silence → gentle nudge
      return [
        {
          id: nextId(),
          name: 'change_agent_reaction',
          args: { mood: 'encouraging', message: '괜찮아요, 천천히 생각해보세요 🤔' },
        },
        {
          id: nextId(),
          name: 'show_hint_card',
          args: {
            type: 'tip',
            title: '시간 벌기 표현',
            body: '이 한마디로 생각할 시간을 벌어보세요.',
            phrase: "Let me think about that for a moment.",
            phonetic: '/lɛt miː θɪŋk əˈbaʊt ðæt/',
            translation: '잠깐 생각해볼게요.',
            urgency: 'medium',
          },
        },
      ];
    }

    case 'expression_frozen': {
      const h = pick(1);
      return [
        {
          id: nextId(),
          name: 'change_agent_reaction',
          args: { mood: 'encouraging', message: '긴장했나요? 잠깐 숨을 고르세요 🧘' },
        },
        {
          id: nextId(),
          name: 'show_hint_card',
          args: {
            type: 'breathe',
            title: '잠깐, 호흡하세요',
            body: '4초 들이쉬고, 4초 내쉬기. 표정이 굳으면 말도 막혀요.',
            phrase: h.phrase,
            phonetic: h.phonetic,
            translation: h.translation,
            urgency: 'medium',
          },
        },
      ];
    }

    case 'gaze_away':
      return [
        {
          id: nextId(),
          name: 'change_agent_reaction',
          args: { mood: 'alert', message: '카메라를 봐주세요 — 아이컨택이 중요해요 👁️' },
        },
        {
          id: nextId(),
          name: 'show_hint_card',
          args: {
            type: 'tip',
            title: '아이 컨택',
            body: '카메라 렌즈를 상대방의 눈이라 생각하고 바라보세요. 자신감이 전달됩니다.',
            urgency: 'low',
          },
        },
      ];

    case 'hesitation_peak': {
      const h = pick(2);
      return [
        {
          id: nextId(),
          name: 'change_agent_reaction',
          args: { mood: 'alert', message: '많이 막히셨군요 — 이 표현 하나로 돌파하세요!' },
        },
        {
          id: nextId(),
          name: 'show_hint_card',
          args: {
            type: 'phrase',
            title: '즉시 쓸 수 있는 표현',
            body: '긴장과 침묵이 동시에 왔어요. 이 한 마디로 재시동하세요.',
            phrase: h.phrase,
            phonetic: h.phonetic,
            translation: h.translation,
            urgency: 'high',
          },
        },
      ];
    }

    case 'user_recovered':
    case 'user_speaking':
      return [
        {
          id: nextId(),
          name: 'change_agent_reaction',
          args: { mood: 'listening', message: '잘 하고 있어요, 계속 이어가세요 ✨' },
        },
        { id: nextId(), name: 'dismiss_hint', args: {} },
      ];

    case 'session_ended':
      return [
        {
          id: nextId(),
          name: 'change_agent_reaction',
          args: { mood: 'celebrating', message: '세션 완료! 오늘도 수고하셨어요 🏆' },
        },
      ];

    default:
      return [];
  }
}

// ── Conversation Turn Engine ───────────────────────────────────────
// This section handles real-time turn-taking (STT → LLM → TTS loop).
//
// Production swap point:
//   Replace generateTurnResponse() body with:
//   const response = await anthropic.messages.create({
//     model: 'claude-opus-4-7',
//     system: buildSystemPrompt(situation),
//     messages: history.map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.text })),
//   });
//   return response.content[0].text;

const SITUATION_SCRIPTS: Record<SituationId, string[]> = {
  interview: [
    "That's a solid introduction! Now, could you walk me through a specific challenge you've faced at work and how you resolved it?",
    "Excellent example — I like how you framed that. Where do you see yourself professionally in five years, and how does this role fit in?",
    "That's a clear vision. Last question — do you have any questions for me about the team, the role, or the company culture?",
    "Great! Thank you so much for your time today. We'll be reviewing all candidates and we'll be in touch soon. Is there anything else you'd like to add before we wrap up?",
  ],
  meeting: [
    "Thanks for that update! Are there any blockers or dependencies the rest of the team should be aware of right now?",
    "Good point. How are you proposing we address that before the end-of-quarter deadline?",
    "Alright. Would anyone else like to weigh in before we move to the next agenda item?",
    "Noted — let's table that for the async follow-up doc. Anything else to add before we close out this meeting?",
  ],
  presentation: [
    "Thanks for that opening. Could you now walk us through your key findings and the data behind them?",
    "Interesting data points. What do you see as the single biggest risk to this proposal, and how would you mitigate it?",
    "Clear analysis. How does this timeline and budget compare to what competitors in the space have done?",
    "Very compelling! We're ready for Q&A now — the floor is open for questions from the stakeholders. Please go ahead and field them.",
  ],
  travel: [
    "Absolutely, I can arrange that. Would you also like me to recommend some restaurants nearby while you get settled?",
    "You're all set! Here's your room key. The elevators are just around the corner. Is there anything else I can help you with?",
    "Wonderful — enjoy your stay! Don't hesitate to call the front desk anytime. We're here 24 hours.",
  ],
  networking: [
    "Oh really? That's fascinating — how long have you been working in that space?",
    "Wow, we actually have a lot in common! Have you had a chance to check out the keynote speaker yet? Pretty mind-blowing stuff.",
    "I'd love to learn more about what you're building. Do you have a card, or should we connect on LinkedIn?",
    "It was genuinely great meeting you! Let's definitely stay in touch — enjoy the rest of the event!",
  ],
};

const HESITATION_FOLLOWUPS = [
  "No worries at all — take your time! Even starting with 'Well...' or 'So...' is perfectly fine. Try again whenever you're ready.",
  "That's okay! Why don't you try again? You can start with something simple, like 'That's a great question — let me think about that for a second.'",
];

let _hesitIdx = 0;

export function generateOpeningMessage(situation: Situation): string {
  const openings: Record<SituationId, string> = {
    interview: "Hello! Welcome to your mock interview practice. I'll be your interviewer today. Let's start with the classic opener — please tell me a little about yourself and what drew you to apply for this position.",
    meeting: "Good morning, everyone! Let's go ahead and get started — we have quite a bit to cover. First up: can you give us a quick status update on where you are with the Q3 project?",
    presentation: "Good afternoon! Thank you all for joining today. We're excited to hear this presentation. Please go ahead and begin whenever you're ready — the floor is yours.",
    travel: "Good afternoon, and welcome to The Grand Hotel New York! I can see you have a reservation with us. How can I assist you today?",
    networking: "Hey there! Great event, right? I'm Alex — I work in product design over at Stripe. What brings you here today?",
  };
  return openings[situation.id] ?? "Hi! Let's practice your English speaking. Take a breath, and feel free to start whenever you're ready.";
}

function buildSystemPrompt(situation: Situation): string {
  const prompts: Record<SituationId, string> = {
    interview: `You are an experienced HR interviewer conducting a mock job interview in English. Keep responses conversational and under 40 words. Ask one follow-up question per turn based on what the candidate just said. Be encouraging but professionally realistic. Do not give feedback on their English — just respond naturally as an interviewer would.`,
    meeting: `You are a senior colleague facilitating a professional team meeting in English. Keep responses under 40 words. React naturally to what was just said and move the meeting forward. Be direct and results-oriented. Do not give feedback on their English.`,
    presentation: `You are an audience member or stakeholder listening to a business presentation in English. Keep responses under 40 words. Ask probing questions or make observations based on what was just presented. Be engaged but challenging. Do not give feedback on their English.`,
    travel: `You are a friendly hotel front desk staff member in an English-speaking country. Keep responses under 40 words. Be warm, professional, and helpful. Do not give feedback on their English.

IMPORTANT — vary your first follow-up question each session. When the guest says they want to check in, randomly choose ONE of these three directions (do not always ask about room preferences):
- Direction A (room style): Ask about their floor/view/bed preference, e.g. "Do you have any room preferences — high floor, city view, or king vs. twin beds?"
- Direction B (deposit & ID): Move straight to check-in formalities, e.g. "I can get you checked in right away. May I have a credit card for the deposit and a valid ID, please?"
- Direction C (breakfast / amenities): Confirm the booking then upsell, e.g. "I can see your reservation right here. Would you like to add breakfast, or shall I walk you through our pool and spa hours?"

Pick a different direction each time. After your chosen opening, follow the guest's response naturally.`,
    networking: `You are a friendly professional at a networking event in English. Keep responses under 40 words. React naturally to what the person just said and keep the conversation flowing. Be genuinely interested and ask one follow-up question per turn. Do not give feedback on their English.`,
  };
  return prompts[situation.id] ?? prompts.networking;
}

async function callClaudeForTurn(
  situation: Situation,
  history: ConversationMessage[],
  apiKey: string
): Promise<string> {
  const msgs = history
    .filter(m => m.role !== 'feedback' && !m.isIntervention)
    .map(m => ({
      role: m.role === 'agent' ? 'assistant' as const : 'user' as const,
      content: m.text,
    }));

  if (msgs.length === 0) throw new Error('empty history');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: buildSystemPrompt(situation),
      messages: msgs,
    }),
  });

  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  const text = data.content.find(b => b.type === 'text')?.text?.trim();
  if (!text) throw new Error('empty response');
  return text;
}

const TRAVEL_FIRST_RESPONSES = [
  "Of course! Do you have any room preferences — high floor, city view, or king vs. twin beds?",
  "Happy to help! May I have a credit card for the incidental deposit and a valid photo ID, please?",
  "I can see your reservation right here — all confirmed! Would you like to add our breakfast package, or shall I walk you through the pool and spa hours?",
];

function generateRuleBasedResponse(
  transcript: string,
  situation: Situation,
  history: ConversationMessage[]
): string {
  const words = transcript.trim().split(/\s+/);
  const hasFillers = /\b(um+|uh+|er+|hmm+|well|like,? i mean|you know)\b/i.test(transcript);

  if (words.length < 6 && hasFillers) {
    return HESITATION_FOLLOWUPS[_hesitIdx++ % HESITATION_FOLLOWUPS.length];
  }

  const agentTurns = history.filter(m => m.role === 'agent' && !m.isIntervention).length;
  const followupIdx = Math.max(0, agentTurns - 1);

  // Travel: first follow-up is randomly chosen from 3 directions each session
  if (situation.id === 'travel' && followupIdx === 0) {
    return TRAVEL_FIRST_RESPONSES[Math.floor(Math.random() * TRAVEL_FIRST_RESPONSES.length)];
  }

  const scripts = SITUATION_SCRIPTS[situation.id] ?? SITUATION_SCRIPTS.interview;
  // Travel: followupIdx 0 is handled above; subsequent turns map to scripts[0..n]
  const rawIdx = situation.id === 'travel' ? followupIdx - 1 : followupIdx;
  return scripts[Math.min(Math.max(rawIdx, 0), scripts.length - 1)];
}

export async function generateTurnResponse(
  transcript: string,
  situation: Situation,
  history: ConversationMessage[]
): Promise<string> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  if (apiKey) {
    try {
      return await callClaudeForTurn(situation, history, apiKey);
    } catch (err) {
      console.warn('[Agent] Claude API failed, falling back to rule-based:', err);
    }
  }
  return generateRuleBasedResponse(transcript, situation, history);
}

// ── Real-time Speech Feedback ─────────────────────────────────────
// Analyses what the user said and returns an immediate correction/improvement.
//
// Production swap point:
//   const result = await anthropic.messages.create({
//     model: 'claude-opus-4-7',
//     system: `You are an English coach. Analyze the user's English utterance and return JSON:
//       { type: "correction"|"improvement"|"grammar", suggestion: "<better English>", explanation: "<Korean explanation>" }
//       Return null JSON if the utterance is already natural and correct.`,
//     messages: [{ role: 'user', content: transcript }],
//   });

interface FeedbackRule {
  r: RegExp;
  fix: (t: string) => string;
  explanation: string;
  type: SpeechFeedback['type'];
  situations?: SituationId[];
}

const FEEDBACK_RULES: FeedbackRule[] = [
  // ── Formality & politeness ─────────────────────────────────────
  {
    r: /\bcan i\b/i,
    fix: t => t.replace(/\bcan i\b/i, 'Could I please'),
    explanation: '"Can I"보다 "Could I please"가 훨씬 더 공손하고 격식 있는 표현이에요.',
    type: 'improvement',
  },
  {
    r: /\bi want to\b/i,
    fix: t => t.replace(/\bi want to\b/i, "I'd like to"),
    explanation: '"I want to"보다 "I\'d like to"가 더 부드럽고 공손한 표현이에요.',
    type: 'improvement',
  },
  {
    r: /\bi want\b(?! to)/i,
    fix: t => t.replace(/\bi want\b/i, "I'd like"),
    explanation: '"I want"보다 "I\'d like"이 더 격식 있고 자연스러워요.',
    type: 'improvement',
  },
  {
    r: /^give me\b/i,
    fix: t => 'Could you please ' + t.charAt(0).toLowerCase() + t.slice(1),
    explanation: '"Give me"는 명령조로 들릴 수 있어요. "Could you please..."로 시작하면 훨씬 공손해요.',
    type: 'correction',
  },
  // ── Vocabulary ─────────────────────────────────────────────────
  {
    r: /\bput (my )?(bag|luggage|suitcase|stuff|things|belongings)\b/i,
    fix: t => t.replace(/\bput (my )?(bag|luggage|suitcase|stuff|things|belongings)\b/i, 'leave my luggage'),
    explanation: '짐을 맡길 때는 "put"보다 "leave" 또는 "store"가 더 자연스러운 원어민 표현이에요.',
    type: 'improvement',
    situations: ['travel'],
  },
  {
    r: /\bgo to (the )?bathroom\b/i,
    fix: t => t.replace(/\bgo to (the )?bathroom\b/i, 'use the restroom'),
    explanation: '격식 있는 자리에서는 "bathroom"보다 "restroom"이 더 적절한 표현이에요.',
    type: 'improvement',
    situations: ['interview', 'meeting', 'presentation'],
  },
  {
    r: /\bvery (unique|perfect|impossible|infinite|absolute)\b/i,
    fix: t => t.replace(/\bvery (unique|perfect|impossible|infinite|absolute)\b/i, '$1'),
    explanation: '"unique/perfect" 등 절대적인 형용사 앞에는 "very"를 쓰지 않아요. 단독으로 쓰는 게 맞아요.',
    type: 'grammar',
  },
  // ── Grammar ────────────────────────────────────────────────────
  {
    r: /\bmore better\b/i,
    fix: t => t.replace(/\bmore better\b/i, 'better'),
    explanation: '"more better"는 이중 비교급이에요. "better" 하나만 쓰는 게 문법적으로 올바른 표현이에요.',
    type: 'grammar',
  },
  {
    r: /\bi (has|have) went\b/i,
    fix: t => t.replace(/\bi (has|have) went\b/i, "I've gone"),
    explanation: '"have went"는 틀린 표현이에요. "have gone"이 현재완료의 올바른 형태예요.',
    type: 'grammar',
  },
  {
    r: /\bdepends (of|from)\b/i,
    fix: t => t.replace(/\bdepends (of|from)\b/i, 'depends on'),
    explanation: '"depends of/from"이 아니라 전치사 "on"을 써서 "depends on"이라고 해야 해요.',
    type: 'grammar',
  },
  {
    r: /\bless (people|employees|candidates|students|customers|applicants)\b/i,
    fix: t => t.replace(/\bless (people|employees|candidates|students|customers|applicants)\b/i, (_, noun) => `fewer ${noun}`),
    explanation: '셀 수 있는 명사 앞에는 "less"가 아니라 "fewer"를 써야 해요.',
    type: 'grammar',
  },
  {
    r: /\bme and ([A-Z][a-z]+)\b/,
    fix: t => t.replace(/\bme and ([A-Z][a-z]+)\b/, (_, name) => `${name} and I`),
    explanation: '주어 위치에서는 "me and ..."가 아니라 "... and I"가 문법적으로 올바른 표현이에요.',
    type: 'grammar',
  },
  {
    r: /\bdifferent than\b/i,
    fix: t => t.replace(/\bdifferent than\b/i, 'different from'),
    explanation: '격식체에서는 "different than"보다 "different from"이 더 올바른 표현이에요.',
    type: 'improvement',
  },
  {
    r: /\btell about\b/i,
    fix: t => t.replace(/\btell about\b/i, 'tell us about'),
    explanation: '"tell about" 뒤에는 청중(us/me/them 등)이 필요해요. "tell us about"이 자연스러운 표현이에요.',
    type: 'grammar',
    situations: ['meeting', 'presentation'],
  },
];

export function analyzeSpeech(
  transcript: string,
  situation: Situation,
): SpeechFeedback | null {
  // Production: replace this function body with a structured Claude API call.

  const words = transcript.trim().split(/\s+/);
  // Too short to give meaningful feedback
  if (words.length < 3) return null;

  let corrected = transcript;
  const explanations: string[] = [];
  let feedbackType: SpeechFeedback['type'] = 'improvement';

  for (const rule of FEEDBACK_RULES) {
    if (rule.situations && !rule.situations.includes(situation.id)) continue;
    if (!rule.r.test(corrected)) continue;

    const next = rule.fix(corrected);
    if (next === corrected) continue;

    corrected = next;
    explanations.push(rule.explanation);
    // Grammar errors take priority in label
    if (rule.type === 'grammar') feedbackType = 'grammar';
    else if (rule.type === 'correction' && feedbackType !== 'grammar') feedbackType = 'correction';
  }

  if (explanations.length === 0 || corrected === transcript) return null;

  return {
    type: feedbackType,
    original: transcript,
    suggestion: corrected,
    explanation: explanations.join(' 또, '),
  };
}

// ── User Response Evaluation ──────────────────────────────────────
// Detects single-word dead-ends and "I don't know" answers that would
// stall the conversation, and returns an immediate coaching intervention.

export interface EvaluationResult {
  appropriate: boolean;
  coaching?: string;
  hint?: { phrase: string; phonetic?: string; translation: string };
}

const WRONG_ANSWER_INTERVENTIONS: Record<SituationId, {
  coaching: string;
  hints: Array<{ phrase: string; phonetic?: string; translation: string }>;
}> = {
  interview: {
    coaching: "면접에서 '모른다'는 대답은 좀 위험해요! 모를 때도 자신 있게 대처하는 방법이 있어요. 오른쪽 힌트 카드를 보고 다시 한번 말해봐요!",
    hints: [
      { phrase: "That's a great question. Let me think about that for a moment.", phonetic: "/ðæts ə ɡreɪt ˈkwɛstʃən/", translation: "좋은 질문이에요. 잠깐 생각해볼게요." },
      { phrase: "I haven't faced that exact situation, but here's how I'd approach it...", translation: "그런 경험은 없었지만, 이렇게 접근할 것 같아요..." },
    ],
  },
  meeting: {
    coaching: "회의에서 단답은 전문가답지 않아 보여요! 이유나 맥락을 함께 붙여서 말해봐요. 힌트 카드 참고해봐요!",
    hints: [
      { phrase: "I'd need to review the data before committing to that.", translation: "확정하기 전에 데이터를 먼저 검토해야 할 것 같아요." },
      { phrase: "That's worth exploring, but let me check with the team first.", translation: "검토할 가치가 있지만, 팀과 먼저 확인해볼게요." },
    ],
  },
  presentation: {
    coaching: "발표 중에 그렇게 짧게 대답하면 청중이 당황할 수 있어요! 더 구체적인 설명을 붙여봐요. 힌트 카드 확인해봐요!",
    hints: [
      { phrase: "The data clearly supports this — let me walk you through the key metrics.", translation: "데이터가 이를 뒷받침해요. 주요 수치를 설명해 드릴게요." },
      { phrase: "Great question — I'd like to address that by pointing to our findings.", translation: "좋은 질문이에요. 저희 분석 결과를 보시면 답이 있어요." },
    ],
  },
  travel: {
    coaching: "어라? 실제 상황에서 그렇게 짧게 대답하면 체크인이 막혀요! 상황을 설명하는 영어 표현이 있어요. 오른쪽 힌트 카드 보고 다시 한번 말해봐요!",
    hints: [
      { phrase: "I'm afraid I left my card in my room. May I bring it in a moment?", phonetic: "/aɪm əˈfreɪd aɪ lɛft maɪ kɑːrd/", translation: "카드를 방에 두고 왔어요. 잠시 후 가져와도 될까요?" },
      { phrase: "I don't seem to have it on me right now. Could I use a different card?", translation: "지금 갖고 있지 않아요. 다른 카드로 결제할 수 있을까요?" },
    ],
  },
  networking: {
    coaching: "네트워킹에서 단답은 대화를 끊어버려요! 관심을 보이면서 자연스럽게 이어가봐요. 힌트 카드 참고해봐요!",
    hints: [
      { phrase: "That's really interesting! What kind of projects are you working on these days?", translation: "정말 흥미롭네요! 요즘 어떤 프로젝트를 하고 계세요?" },
      { phrase: "Oh wow, I'd love to hear more — how did you first get into that field?", translation: "와, 더 듣고 싶어요. 그 분야는 어떻게 시작하셨어요?" },
    ],
  },
};

const _wrongHintIdx: Record<SituationId, number> = {
  interview: 0, meeting: 0, presentation: 0, travel: 0, networking: 0,
};

function buildWrongAnswerResult(situation: Situation): EvaluationResult {
  const entry = WRONG_ANSWER_INTERVENTIONS[situation.id];
  const idx = _wrongHintIdx[situation.id] % entry.hints.length;
  _wrongHintIdx[situation.id]++;
  return { appropriate: false, coaching: entry.coaching, hint: entry.hints[idx] };
}

export function evaluateUserResponse(
  transcript: string,
  situation: Situation,
): EvaluationResult {
  const lower = transcript.trim().toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);

  // 1. Single-word responses that stall conversation
  const DEAD_ENDS = /^(no|yes|yeah|nope|ok|okay|sure|fine|maybe|right|really|oh|ah|hmm+|uh+|um+|er+|what|huh|idk)$/i;
  if (words.length === 1 && DEAD_ENDS.test(lower)) {
    return buildWrongAnswerResult(situation);
  }

  // 2. "I don't know" variants (short unhelpful admissions)
  if (words.length < 8 && /\bi\s*(don'?t|do\s+not)\s*know\b|^(idk|no idea)$/i.test(lower)) {
    return buildWrongAnswerResult(situation);
  }

  return { appropriate: true };
}

// ── Silence Intervention ───────────────────────────────────────────
// Returns Korean so the user can immediately understand the coaching nudge.
// TTS caller must set lang = 'ko-KR' for this text.
export function generateSilenceIntervention(
  situation: Situation,
  history: ConversationMessage[]
): string {
  const interventionCount = history.filter(m => m.role === 'agent' && m.isIntervention).length;

  const lines = [
    `어, 지금 어떻게 대답할지 좀 막히지? 완전 자연스러운 거야! 오른쪽 힌트 카드에 ${situation.title} 상황에서 바로 쓸 수 있는 표현 띄워줄게. 한번 봐봐!`,
    "당황하지 마! 원어민들도 막힐 땐 'Let me think about that...' 이런 말로 시간을 버는 거야. 오른쪽 힌트 카드에 딱 맞는 표현 있으니까 한번 써봐!",
    "아직 생각 정리 중이야? 침묵이 길어지면 더 긴장되니까, 일단 뭐라도 한 마디 시작해보자! 오른쪽 힌트 카드 봐봐, 시작하기 좋은 표현 있어.",
  ];
  return lines[Math.min(interventionCount, lines.length - 1)];
}
