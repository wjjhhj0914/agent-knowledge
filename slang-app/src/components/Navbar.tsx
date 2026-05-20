import type { Screen, Theme } from '../types';

interface NavbarProps {
  screen: Screen;
  theme: Theme;
  streak: number;
  xp: number;
  hearts: number;
  inSession: boolean;
  onNav: (s: Screen) => void;
  onTheme: () => void;
}

const NAV_ITEMS: { id: Screen; label: string; icon: string }[] = [
  { id: 'landing', label: '코칭 룸',       icon: '⬡' },
  { id: 'slang',   label: '슬랭 보너스',   icon: '✦' },
];

export default function Navbar({ screen, theme, streak, xp, hearts, inSession, onNav, onTheme }: NavbarProps) {
  return (
    <nav className="sl-nav">
      {/* Logo */}
      <span
        style={{ fontWeight: 900, fontSize: 18, letterSpacing: '-0.04em', cursor: 'default', flexShrink: 0 }}
      >
        <span style={{ color: 'var(--sl-accent)' }}>말문</span>
        <span style={{ color: 'var(--sl-text)', fontSize: 13, fontWeight: 600, marginLeft: 2 }}>Malmoon</span>
      </span>

      {/* Page tabs — hidden during active session */}
      {!inSession && (
        <div style={{ display: 'flex', gap: 2, flex: 1, justifyContent: 'center' }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              style={{
                padding: '6px 16px',
                borderRadius: 8, border: 'none',
                background: screen === item.id ? 'var(--sl-accent-dim)' : 'transparent',
                color: screen === item.id ? 'var(--sl-accent-2)' : 'var(--sl-text-2)',
                fontWeight: screen === item.id ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}

      {inSession && (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <span style={{
            fontSize: 12, fontWeight: 600, color: 'var(--sl-text-3)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'statusPulse 1s ease infinite' }} />
            세션 진행 중
          </span>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <Stat icon="🔥" value={`${streak}`} color="var(--sl-warning)" />
        <Stat icon="⚡" value={`${xp} XP`} color="var(--sl-accent)" />
        <Stat icon="❤️" value={`${hearts}`} color="var(--sl-danger)" />

        <button
          onClick={onTheme}
          className="sl-btn-ghost"
          style={{ padding: '7px 11px', fontSize: 15, borderRadius: 9 }}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>

      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; } 50% { opacity: 0.2; }
        }
      `}</style>
    </nav>
  );
}

function Stat({ icon, value, color }: { icon: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}
