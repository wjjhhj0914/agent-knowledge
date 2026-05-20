import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationMessage, Situation, SpeechFeedback, VoiceAccent } from '../types';
import { useCoachingPerception, type MediaErrorInfo } from '../hooks/useCoachingPerception';
import { useAgentSession } from '../hooks/useAgentSession';
import { useConversation } from '../hooks/useConversation';
import AgentAvatar from './AgentAvatar';
import AgentOverlay from './AgentOverlay';
import PerceptionStatus from './PerceptionStatus';

// ── Constants ──────────────────────────────────────────────────────
const SILENCE_THRESHOLD_SEC = 15;

interface CoachingRoomProps {
  situation: Situation;
  onExit: () => void;
}

export default function CoachingRoom({ situation, onExit }: CoachingRoomProps) {
  // ── Agent session (perception events → mood + hint cards) ────────
  const { agentState, handleEvent, dismissHint, reset, showWrongAnswerHint } = useAgentSession(situation);

  // ── Perception (webcam + MediaPipe + RMS speech) ─────────────────
  const { videoRef, latestFrame, snapshot, status, mediaError, start, stop } =
    useCoachingPerception({ situationId: situation.id, onEvent: handleEvent });

  // ── Conversation (STT → turn-taking → TTS + silence timer) ───────
  const onSilenceIntervention = useCallback(() => {
    handleEvent({
      type: 'silence_detected',
      situationId: situation.id,
      payload: { silenceSec: SILENCE_THRESHOLD_SEC },
      timestampMs: performance.now(),
    });
  }, [handleEvent, situation.id]);

  // ── Session state ─────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const [sessionOn, setSessionOn] = useState(false);
  const [accent, setAccent] = useState<VoiceAccent>('en-US');

  const onWrongAnswer = useCallback<NonNullable<Parameters<typeof useConversation>[1]['onWrongAnswer']>>(
    (card) => { showWrongAnswerHint(card); },
    [showWrongAnswerHint],
  );

  const { convState, startConversation, stopConversation } = useConversation(
    situation,
    { onSilenceIntervention, onWrongAnswer, accent }
  );
  const prevStatusRef = useRef(status);

  // Elapsed timer
  useEffect(() => {
    if (!sessionOn) return;
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [sessionOn]);

  // Auto-start conversation when MediaPipe finishes loading
  useEffect(() => {
    if (status === 'running' && prevStatusRef.current !== 'running' && sessionOn) {
      void startConversation();
    }
    prevStatusRef.current = status;
  }, [status, sessionOn, startConversation]);

  // ── Chat auto-scroll ───────────────────────────────────────────
  const chatScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [convState.messages, convState.turnState]);

  // ── Session controls ───────────────────────────────────────────
  async function startSession() {
    setElapsed(0);
    setSessionOn(true);
    reset();
    await start();
  }

  async function stopSession() {
    stopConversation();
    handleEvent({ type: 'session_ended', situationId: situation.id, payload: {}, timestampMs: performance.now() });
    await stop();
    setSessionOn(false);
    setElapsed(0);
  }

  function fmtTime(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  // ── Derived state ──────────────────────────────────────────────
  const sessionRunning = status === 'running';
  const isLoading = status === 'starting' || status === 'loading-models';
  const { turnState, silenceSec, interimText } = convState;

  const silenceRatio = Math.min(silenceSec / SILENCE_THRESHOLD_SEC, 1);
  const silenceColor =
    silenceRatio < 0.5 ? '#22c55e' : silenceRatio < 0.8 ? '#f59e0b' : '#ef4444';

  const turnStatusLabel: Record<typeof turnState, string> = {
    idle: '',
    agent_speaking: '🔊 말하는 중...',
    waiting: '👂 당신의 차례예요',
    user_speaking: '🎙️ 발화 감지됨',
    agent_thinking: '💭 생각 중...',
    intervening: '💡 힌트 제안 중',
  };

  return (
    <div style={{
      minHeight: 'calc(100dvh - 60px)',
      background: 'var(--sl-bg)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 18px',
        borderBottom: '1px solid var(--sl-border)',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <button className="sl-btn-ghost" style={{ padding: '5px 10px', fontSize: 13 }} onClick={onExit}>
          ← 나가기
        </button>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '5px 12px', borderRadius: 99,
          background: situation.color + '18',
          border: `1.5px solid ${situation.color}40`,
          fontSize: 12, fontWeight: 700, color: situation.color,
        }}>
          <span>{situation.icon}</span>
          <span>{situation.title}</span>
          <span style={{ fontSize: 10, fontWeight: 500, color: situation.color + 'aa' }}>
            {situation.difficulty.toUpperCase()}
          </span>
        </div>

        {/* Accent selector — disabled during live session */}
        <select
          value={accent}
          onChange={e => setAccent(e.target.value as VoiceAccent)}
          disabled={sessionOn}
          title="영어 발음 선택 (세션 시작 전에만 변경 가능)"
          style={{
            padding: '5px 10px', borderRadius: 8,
            border: '1.5px solid var(--sl-border)',
            background: 'var(--sl-bg-card)', color: 'var(--sl-text)',
            fontSize: 12, fontWeight: 600,
            cursor: sessionOn ? 'not-allowed' : 'pointer',
            opacity: sessionOn ? 0.5 : 1,
          }}
        >
          <option value="en-US">🇺🇸 미국식</option>
          <option value="en-GB">🇬🇧 영국식</option>
          <option value="en-AU">🇦🇺 호주식</option>
        </select>

        {sessionOn && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 99,
            background: '#ef444418', border: '1.5px solid #ef444440',
            fontSize: 11, fontWeight: 700, color: '#ef4444',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#ef4444', display: 'inline-block',
              animation: 'pulse 1s ease infinite',
            }} />
            LIVE {fmtTime(elapsed)}
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <PerceptionStatus
            frame={latestFrame}
            snapshot={snapshot}
            sessionRunning={sessionRunning}
          />
          {/* 세션 종료 버튼 — 항상 상단 바에 노출 */}
          {sessionOn && (
            <button
              onClick={stopSession}
              style={{
                padding: '7px 16px', borderRadius: 8,
                border: '1.5px solid #ef4444',
                background: '#ef4444', color: '#fff',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                whiteSpace: 'nowrap',
              }}
            >
              ■ 세션 종료
            </button>
          )}
        </div>
      </div>

      {/* ── Main layout ───────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 360px',
        overflow: 'hidden',
      }}>

        {/* ── Left: video panel ─────────────────────────────────── */}
        <div style={{
          borderRight: '1px solid var(--sl-border)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Video feed */}
          <div style={{
            flex: 1, position: 'relative',
            background: '#09090b', overflow: 'hidden', minHeight: 300,
          }}>
            <video
              ref={videoRef}
              style={{
                width: '100%', height: '100%',
                objectFit: 'contain',   // contain = no zoom-in crop
                transform: 'scaleX(-1)',
                opacity: sessionRunning ? 1 : 0.25,
                transition: 'opacity 0.4s',
              }}
            />

            {/* Loading / idle placeholder */}
            {!sessionRunning && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
              }}>
                <div style={{ fontSize: 44 }}>
                  {status === 'loading-models' ? '🧠' : '📷'}
                </div>
                <p style={{ color: '#71717a', fontSize: 13, textAlign: 'center', maxWidth: 240, lineHeight: 1.6 }}>
                  {status === 'starting'
                    ? '카메라 연결 중…'
                    : status === 'loading-models'
                      ? 'AI 모델 로딩 중…\n(최초 실행 시 10-20초 소요)'
                      : status === 'error'
                        ? '오류 — 아래 메시지를 확인해주세요'
                        : '세션을 시작해 영상통화를 시작하세요'}
                </p>
                {status === 'loading-models' && (
                  <div style={{ width: 120, height: 3, borderRadius: 99, background: '#27272a', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      background: 'var(--sl-accent)',
                      animation: 'loadingBar 1.8s ease-in-out infinite',
                    }} />
                  </div>
                )}
              </div>
            )}

            {/* Perception tags */}
            {sessionRunning && latestFrame && (
              <div style={{ position: 'absolute', bottom: interimText ? 60 : 12, left: 12, display: 'flex', gap: 6 }}>
                {latestFrame.faceVisible && (
                  <VideoTag color={latestFrame.gazeFocused ? '#22c55e' : '#f59e0b'}>
                    {latestFrame.gazeFocused ? '✓ 아이컨택' : '⚠ 시선 이탈'}
                  </VideoTag>
                )}
                {latestFrame.hasSpeech && <VideoTag color="#60a5fa">🎙️ 발화 중</VideoTag>}
              </div>
            )}

            {/* STT Interim caption */}
            {interimText && (
              <div style={{
                position: 'absolute', bottom: 12, left: 12, right: 12,
                background: 'rgba(0,0,0,0.72)',
                color: '#fff', fontSize: 14, fontWeight: 500,
                padding: '8px 14px', borderRadius: 10,
                backdropFilter: 'blur(6px)',
                lineHeight: 1.5,
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <span style={{ color: '#60a5fa', marginRight: 6 }}>🎙️</span>
                {interimText}
              </div>
            )}
          </div>

          {/* Scenario prompt */}
          <div style={{
            padding: '14px 18px',
            borderTop: '1px solid var(--sl-border)',
            background: 'var(--sl-bg-card)',
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--sl-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
              시나리오
            </p>
            <p style={{ fontSize: 12, color: 'var(--sl-text)', lineHeight: 1.6, fontStyle: 'italic' }}>
              "{situation.scenarioPrompt}"
            </p>
          </div>

          {/* Session controls */}
          <div style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--sl-border)',
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            {!sessionOn ? (
              <button
                className="sl-btn-primary"
                style={{ flex: 1 }}
                onClick={startSession}
                disabled={isLoading || (status === 'error' && mediaError?.canRetry === false)}
              >
                {status === 'starting'
                  ? '⏳ 카메라 연결 중…'
                  : status === 'loading-models'
                    ? '🧠 AI 모델 로딩 중…'
                    : status === 'error' && mediaError?.canRetry
                      ? '↺ 다시 시도'
                      : status === 'error'
                        ? '⚠ 권한 설정 후 새로고침'
                        : '▶ 영상통화 시작'}
              </button>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--sl-text-3)', flex: 1, textAlign: 'center' }}>
                상단의 <strong style={{ color: '#ef4444' }}>■ 세션 종료</strong> 버튼을 눌러 종료하세요
              </p>
            )}
          </div>

          {mediaError && (
            <ErrorBanner info={mediaError} onRetry={mediaError.canRetry ? startSession : undefined} />
          )}
        </div>

        {/* ── Right: agent + conversation panel ─────────────────── */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: 'var(--sl-bg-card)',
          overflow: 'hidden',
        }}>
          {/* Agent header */}
          <div style={{
            padding: '16px 18px 12px',
            borderBottom: '1px solid var(--sl-border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--sl-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              말문(Malmoon) 코칭 에이전트
            </p>
            <AgentAvatar mood={agentState.mood} message={agentState.message} size={72} />

            {/* Turn status badge */}
            {sessionOn && turnState !== 'idle' && (
              <div style={{
                padding: '4px 12px', borderRadius: 99,
                background: turnState === 'waiting' ? '#22c55e18'
                  : turnState === 'user_speaking' ? '#60a5fa18'
                  : turnState === 'agent_thinking' ? '#f59e0b18'
                  : '#71717a18',
                border: `1px solid ${
                  turnState === 'waiting' ? '#22c55e40'
                  : turnState === 'user_speaking' ? '#60a5fa40'
                  : turnState === 'agent_thinking' ? '#f59e0b40'
                  : '#71717a40'
                }`,
                fontSize: 11, fontWeight: 600,
                color: turnState === 'waiting' ? '#16a34a'
                  : turnState === 'user_speaking' ? '#2563eb'
                  : turnState === 'agent_thinking' ? '#b45309'
                  : 'var(--sl-text-3)',
              }}>
                {turnStatusLabel[turnState]}
              </div>
            )}
          </div>

          {/* Chat conversation */}
          <div
            ref={chatScrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '14px 14px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}
          >
            {convState.messages.length === 0 && !sessionOn && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', flex: 1, gap: 10,
                color: 'var(--sl-text-3)', textAlign: 'center',
              }}>
                <span style={{ fontSize: 32 }}>💬</span>
                <p style={{ fontSize: 12, lineHeight: 1.6 }}>
                  세션을 시작하면 AI와의<br />실시간 대화가 여기에 표시됩니다
                </p>
                {!convState.hasSpeechApi && (
                  <p style={{
                    fontSize: 11, color: '#ef4444',
                    background: '#fef2f2', border: '1px solid #fecaca',
                    padding: '6px 12px', borderRadius: 8,
                    lineHeight: 1.5,
                  }}>
                    ⚠ 이 브라우저는 음성 인식(STT)을 지원하지 않아요.<br />
                    Chrome 사용을 권장합니다.
                  </p>
                )}
              </div>
            )}

            {convState.messages.map(msg => (
              <ChatBubble key={msg.id} message={msg} accentColor={situation.color} />
            ))}

            {/* Thinking indicator */}
            {(turnState === 'agent_thinking' || turnState === 'intervening') && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '9px 14px', borderRadius: '18px 18px 18px 4px',
                  background: 'var(--sl-bg-hover)',
                  border: '1px solid var(--sl-border)',
                  display: 'flex', gap: 5, alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--sl-text-3)',
                      display: 'inline-block',
                      animation: `dotBounce 1.2s ease infinite ${i * 0.2}s`,
                    }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Silence timer bar (shown when it's the user's turn) */}
          {sessionOn && (turnState === 'waiting' || turnState === 'user_speaking') && (
            <div style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--sl-border)',
              background: 'var(--sl-bg)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--sl-text-3)' }}>
                  {turnState === 'user_speaking' ? '🎙️ 발화 감지 중...' : '⏱️ 응답 대기'}
                </span>
                {turnState === 'waiting' && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: silenceColor, fontVariantNumeric: 'tabular-nums' }}>
                    {silenceSec}s / {SILENCE_THRESHOLD_SEC}s
                  </span>
                )}
              </div>
              <div style={{
                height: 5, borderRadius: 99,
                background: 'var(--sl-border)', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  background: silenceColor,
                  width: turnState === 'waiting' ? `${silenceRatio * 100}%` : '0%',
                  transition: 'width 0.8s linear, background-color 0.5s',
                }} />
              </div>
            </div>
          )}

          {/* Hint card (from agentState.activeHint) */}
          {agentState.activeHint && (
            <div style={{
              padding: '12px 14px',
              borderTop: '1px solid var(--sl-border)',
              background: 'var(--sl-bg-hover)',
            }}>
              <InlineHintCard
                hint={agentState.activeHint}
                accentColor={situation.color}
                onDismiss={dismissHint}
              />
            </div>
          )}

          {/* Intervention counter */}
          {agentState.interventionCount > 0 && (
            <div style={{
              padding: '8px 16px',
              borderTop: '1px solid var(--sl-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, color: 'var(--sl-text-3)' }}>에이전트 개입</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--sl-accent)' }}>
                {agentState.interventionCount}회
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Floating hint overlay (from perception-based events) */}
      {!agentState.activeHint && <AgentOverlay hint={null} onDismiss={dismissHint} />}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes loadingBar {
          0%   { width: 0%;   margin-left: 0%; }
          50%  { width: 60%;  margin-left: 20%; }
          100% { width: 0%;   margin-left: 100%; }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

// ── Chat bubble ────────────────────────────────────────────────────
function ChatBubble({ message, accentColor }: { message: ConversationMessage; accentColor: string }) {
  if (message.role === 'feedback' && message.feedbackData) {
    return <FeedbackBubble feedback={message.feedbackData} />;
  }

  const isAgent = message.role === 'agent';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isAgent ? 'flex-start' : 'flex-end',
    }}>
      <div style={{
        maxWidth: '88%',
        padding: '10px 14px',
        borderRadius: isAgent ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
        background: isAgent ? 'var(--sl-bg-hover)' : accentColor,
        border: isAgent ? '1px solid var(--sl-border)' : 'none',
        color: isAgent ? 'var(--sl-text)' : '#fff',
        fontSize: 13,
        lineHeight: 1.6,
        wordBreak: 'break-word',
      }}>
        {message.text}
      </div>
    </div>
  );
}

// ── Feedback bubble ─────────────────────────────────────────────────
function FeedbackBubble({ feedback }: { feedback: SpeechFeedback }) {
  const cfg = {
    correction:  { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', label: '✏️ 교정' },
    improvement: { bg: '#eff6ff', border: '#93c5fd', text: '#1e3a8a', label: '💡 더 좋은 표현' },
    grammar:     { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c', label: '📝 문법' },
  }[feedback.type];

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 14,
      background: cfg.bg,
      border: `1.5px solid ${cfg.border}`,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Type label */}
      <span style={{ fontSize: 10, fontWeight: 800, color: cfg.text, letterSpacing: '0.06em' }}>
        {cfg.label}
      </span>

      {/* Before → after */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0, marginTop: 1 }}>✗</span>
          <span style={{
            fontSize: 12, color: '#9ca3af',
            textDecoration: 'line-through', fontStyle: 'italic',
            wordBreak: 'break-word',
          }}>
            "{feedback.original}"
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 12, color: '#16a34a', flexShrink: 0, marginTop: 1 }}>✓</span>
          <span style={{
            fontSize: 13, fontWeight: 700, color: cfg.text,
            wordBreak: 'break-word',
          }}>
            "{feedback.suggestion}"
          </span>
        </div>
      </div>

      {/* Korean explanation */}
      <p style={{
        fontSize: 11, color: cfg.text, lineHeight: 1.65,
        paddingTop: 6, borderTop: `1px solid ${cfg.border}`,
        margin: 0,
      }}>
        {feedback.explanation}
      </p>
    </div>
  );
}

// ── Inline hint card (shown in right panel) ───────────────────────
function InlineHintCard({
  hint,
  accentColor,
  onDismiss,
}: {
  hint: { title: string; body: string; phrase?: string; phonetic?: string; translation?: string; urgency: string };
  accentColor: string;
  onDismiss: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: accentColor }}>{hint.title}</p>
        <button
          onClick={onDismiss}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--sl-text-3)', fontSize: 14, lineHeight: 1, padding: 0,
          }}
        >
          ×
        </button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--sl-text)', lineHeight: 1.5 }}>{hint.body}</p>
      {hint.phrase && (
        <div style={{
          padding: '8px 10px', borderRadius: 8,
          background: 'var(--sl-bg)',
          border: `1px solid ${accentColor}30`,
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>"{hint.phrase}"</p>
          {hint.phonetic && (
            <p style={{ fontSize: 10, color: 'var(--sl-text-3)', marginTop: 1 }}>{hint.phonetic}</p>
          )}
          {hint.translation && (
            <p style={{ fontSize: 11, color: 'var(--sl-text-2)', marginTop: 2 }}>{hint.translation}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Small tag overlay on video ─────────────────────────────────────
function VideoTag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '3px 9px', borderRadius: 99,
      background: color + '22', border: `1px solid ${color}55`,
      color, fontSize: 10, fontWeight: 700,
      backdropFilter: 'blur(4px)',
    }}>
      {children}
    </div>
  );
}

// ── Error banner ───────────────────────────────────────────────────
function ErrorBanner({ info, onRetry }: { info: MediaErrorInfo; onRetry?: () => void }) {
  const isPermission = info.name === 'NotAllowedError' || info.name === 'PermissionDeniedError';
  return (
    <div style={{
      padding: '12px 16px',
      background: '#fef2f2',
      borderTop: '2px solid #ef4444',
      display: 'flex', flexDirection: 'column', gap: 7,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 99,
          background: '#fecaca', color: '#b91c1c', letterSpacing: '0.06em',
        }}>
          {info.name}
        </span>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>{info.title}</p>
      </div>
      <p style={{ fontSize: 12, color: '#7f1d1d', lineHeight: 1.6 }}>{info.guide}</p>
      {isPermission && (
        <ol style={{ fontSize: 11, color: '#7f1d1d', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.6 }}>
          <li>주소창 왼쪽 🔒 아이콘 클릭</li>
          <li>"카메라" → <strong>허용</strong></li>
          <li>"마이크" → <strong>허용</strong></li>
          <li>페이지 새로고침 후 재시도</li>
        </ol>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            alignSelf: 'flex-start', padding: '6px 14px',
            borderRadius: 8, border: '1.5px solid #ef4444',
            background: 'transparent', color: '#b91c1c',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          ↺ 다시 시도
        </button>
      )}
      {info.detail && (
        <details style={{ marginTop: 2 }}>
          <summary style={{ fontSize: 10, color: '#9ca3af', cursor: 'pointer' }}>
            개발자 상세 정보
          </summary>
          <pre style={{
            fontSize: 10, color: '#6b7280', background: '#fff7f7',
            padding: '5px 8px', borderRadius: 6, marginTop: 4,
            overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            border: '1px solid #fecaca',
          }}>
            {info.name}: {info.detail}
          </pre>
        </details>
      )}
    </div>
  );
}
