import type { Screen, Situation } from '../types';
import { SITUATIONS } from '../data/situations';

interface MainLandingProps {
  streak: number;
  xp: number;
  onEnterSession: (situation: Situation) => void;
  onNav: (s: Screen) => void;
}

const DIFF_LABEL = { beginner: '입문', intermediate: '중급', advanced: '고급' };
const DIFF_COLOR = { beginner: '#22c55e', intermediate: '#f59e0b', advanced: '#ef4444' };

export default function MainLanding({ streak, xp, onEnterSession, onNav }: MainLandingProps) {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '36px 20px 60px' }}>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 52 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--sl-accent)', padding: '3px 10px', borderRadius: 99,
            background: 'var(--sl-accent-dim)', border: '1px solid var(--sl-accent)',
          }}>
            BETA · AI Speaking Coach
          </span>
        </div>

        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 56px)',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          color: 'var(--sl-text)',
          lineHeight: 1.1,
          marginBottom: 16,
        }}>
          말문이 트이는<br />
          <span style={{
            background: `linear-gradient(135deg, var(--sl-accent), #60a5fa)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            실시간 영어 코칭
          </span>
        </h1>

        <p style={{ fontSize: 16, color: 'var(--sl-text-2)', maxWidth: 480, margin: '0 auto 28px', lineHeight: 1.7 }}>
          면접, 발표, 회의, 여행. 실전 상황에서 AI 에이전트가 당신의 표정·음성·시선을 실시간으로 분석해 개입합니다.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Stat icon="🔥" value={`${streak}일`} label="연속 학습" />
          <Stat icon="⚡" value={`${xp} XP`} label="획득" />
          <Stat icon="🤖" value="AI" label="실시간 코칭" color="var(--sl-accent)" />
        </div>
      </div>

      {/* ── Situation Cards ──────────────────────────────────────── */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--sl-text)', letterSpacing: '-0.02em' }}>
            상황을 선택하세요
          </h2>
          <p style={{ fontSize: 12, color: 'var(--sl-text-3)' }}>
            {SITUATIONS.length}개 시나리오
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {SITUATIONS.map(sit => (
            <SituationCard key={sit.id} situation={sit} onStart={onEnterSession} />
          ))}
        </div>
      </div>

      {/* ── How it works ─────────────────────────────────────────── */}
      <div style={{
        background: 'var(--sl-bg-card)',
        border: '1px solid var(--sl-border)',
        borderRadius: 16,
        padding: '28px 24px',
        marginBottom: 32,
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--sl-text)', marginBottom: 20, letterSpacing: '-0.02em' }}>
          말문(Malmoon)은 이렇게 작동해요
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
          {[
            { icon: '📷', step: '01', title: '멀티모달 감지', desc: 'MediaPipe가 표정·시선·음성을 로컬에서 실시간 분석' },
            { icon: '🧠', step: '02', title: 'AI 판단', desc: '침묵 20초, 표정 굳음, 시선 이탈 이벤트를 에이전트에 전달' },
            { icon: '🔧', step: '03', title: 'Tool Call', desc: 'show_hint_card(), change_agent_reaction() 등 UI 제어 함수 호출' },
            { icon: '💬', step: '04', title: '실시간 개입', desc: '힌트 카드, 표현 제안, 격려 메시지를 화면에 즉시 표시' },
          ].map(item => (
            <div key={item.step} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--sl-accent)', letterSpacing: '0.06em' }}>STEP {item.step}</span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--sl-text)' }}>{item.title}</p>
              <p style={{ fontSize: 12, color: 'var(--sl-text-2)', lineHeight: 1.5 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Slang bonus teaser ───────────────────────────────────── */}
      <div
        className="sl-card"
        style={{
          padding: '18px 22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          cursor: 'pointer', flexWrap: 'wrap',
        }}
        onClick={() => onNav('slang')}
      >
        <div>
          <span className="sl-tag" style={{ marginBottom: 6, display: 'inline-flex' }}>Bonus Tab</span>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--sl-text)' }}>원어민 슬랭 & 숙어 카드</p>
          <p style={{ fontSize: 12, color: 'var(--sl-text-2)', marginTop: 2 }}>듀오링고 스타일 플립 카드 + 퀴즈 → 별도 탭</p>
        </div>
        <span style={{ fontSize: 20, color: 'var(--sl-text-3)' }}>→</span>
      </div>
    </div>
  );
}

function SituationCard({ situation: sit, onStart }: { situation: Situation; onStart: (s: Situation) => void }) {
  return (
    <div
      className="sl-card"
      style={{ padding: '22px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
      onClick={() => onStart(sit)}
    >
      {/* Color accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: sit.color,
        borderRadius: '16px 16px 0 0',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 32 }}>{sit.icon}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
          background: DIFF_COLOR[sit.difficulty] + '22',
          color: DIFF_COLOR[sit.difficulty],
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {DIFF_LABEL[sit.difficulty]}
        </span>
      </div>

      <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--sl-text)', letterSpacing: '-0.02em', marginBottom: 4 }}>
        {sit.title}
      </h3>
      <p style={{ fontSize: 12, color: 'var(--sl-text-3)', marginBottom: 12 }}>{sit.subtitle}</p>

      <p style={{ fontSize: 12, color: 'var(--sl-text-2)', lineHeight: 1.5, marginBottom: 14 }}>
        {sit.scenarioPrompt.slice(0, 80)}…
      </p>

      <div style={{
        padding: '8px 14px', borderRadius: 8,
        background: sit.color + '15',
        border: `1.5px solid ${sit.color}40`,
        color: sit.color,
        fontSize: 13, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        transition: 'background 0.15s',
      }}>
        <span>▶</span>
        코칭 룸 입장
      </div>
    </div>
  );
}

function Stat({ icon, value, label, color = 'var(--sl-text)' }: { icon: string; value: string; label: string; color?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '8px 16px', borderRadius: 99,
      background: 'var(--sl-bg-card)',
      border: '1px solid var(--sl-border)',
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 15, fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: 12, color: 'var(--sl-text-3)' }}>{label}</span>
    </div>
  );
}
