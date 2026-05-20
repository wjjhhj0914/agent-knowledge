import type { HintCard } from '../types';

interface AgentOverlayProps {
  hint: HintCard | null;
  onDismiss: () => void;
}

const TYPE_STYLE: Record<string, { border: string; bg: string; icon: string; label: string }> = {
  phrase:       { border: 'var(--sl-accent)',   bg: 'var(--sl-accent-dim)',   icon: '💬', label: 'PHRASE'      },
  tip:          { border: '#60a5fa',            bg: '#eff6ff',                icon: '💡', label: 'TIP'         },
  breathe:      { border: '#a78bfa',            bg: '#f5f3ff',                icon: '🧘', label: 'BREATHE'     },
  encouragement:{ border: 'var(--sl-accent)',   bg: 'var(--sl-accent-dim)',   icon: '🎯', label: 'YOU GOT THIS' },
  correction:   { border: '#f59e0b',            bg: '#fffbeb',                icon: '✏️', label: 'CORRECTION'  },
};

const URGENCY_ANIM: Record<string, string> = {
  low:    'slideInRight 0.3s ease',
  medium: 'slideInRight 0.25s ease',
  high:   'slideInRight 0.2s ease, urgencyShake 0.4s ease 0.25s',
};

export default function AgentOverlay({ hint, onDismiss }: AgentOverlayProps) {
  if (!hint) return null;

  const style = TYPE_STYLE[hint.type] ?? TYPE_STYLE.tip;
  const urgencyColor = hint.urgency === 'high' ? '#ef4444' : hint.urgency === 'medium' ? '#f59e0b' : '#6b7280';

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        @keyframes urgencyShake {
          0%, 100% { transform: translateX(0); }
          25%       { transform: translateX(-4px); }
          75%       { transform: translateX(4px); }
        }
      `}</style>

      <div style={{
        position: 'fixed',
        bottom: 100,
        right: 20,
        width: 320,
        zIndex: 100,
        animation: URGENCY_ANIM[hint.urgency],
      }}>
        <div style={{
          background: 'var(--sl-bg-card)',
          border: `2px solid ${style.border}`,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: `0 8px 32px ${style.border}30, 0 2px 8px rgba(0,0,0,0.12)`,
        }}>
          {/* Header */}
          <div style={{
            background: style.bg,
            padding: '10px 16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>{style.icon}</span>
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                color: style.border, textTransform: 'uppercase',
              }}>
                {style.label}
              </span>
              {hint.urgency === 'high' && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                  background: urgencyColor + '22', color: urgencyColor, textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>URGENT</span>
              )}
            </div>
            <button
              onClick={onDismiss}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--sl-text-3)', fontSize: 16, lineHeight: 1, padding: '0 2px',
              }}
            >×</button>
          </div>

          {/* Body */}
          <div style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--sl-text)', marginBottom: 4 }}>
              {hint.title}
            </p>
            <p style={{ fontSize: 12, color: 'var(--sl-text-2)', lineHeight: 1.5, marginBottom: hint.phrase ? 12 : 0 }}>
              {hint.body}
            </p>

            {hint.phrase && (
              <div style={{
                background: 'var(--sl-bg-hover)',
                borderRadius: 10, padding: '10px 12px',
                borderLeft: `3px solid ${style.border}`,
              }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--sl-text)', marginBottom: 2, lineHeight: 1.3 }}>
                  "{hint.phrase}"
                </p>
                {hint.phonetic && (
                  <p style={{ fontSize: 11, color: 'var(--sl-text-3)', fontFamily: 'monospace', marginBottom: 4 }}>
                    {hint.phonetic}
                  </p>
                )}
                {hint.translation && (
                  <p style={{ fontSize: 12, color: 'var(--sl-text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>🇰🇷</span> {hint.translation}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
