import type { AgentMood } from '../types';

interface AgentAvatarProps {
  mood: AgentMood;
  message: string;
  size?: number;
}

const MOOD_CONFIG: Record<AgentMood, { gradient: string; ring: string; pulse: boolean; emoji: string }> = {
  idle:         { gradient: 'linear-gradient(135deg, #3f3f46, #27272a)', ring: '#52525b', pulse: false, emoji: '●' },
  listening:    { gradient: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', ring: '#60a5fa', pulse: true,  emoji: '◎' },
  thinking:     { gradient: 'linear-gradient(135deg, #7c3aed, #a78bfa)', ring: '#c4b5fd', pulse: true,  emoji: '◌' },
  encouraging:  { gradient: 'linear-gradient(135deg, #15803d, #22c55e)', ring: '#4ade80', pulse: false, emoji: '◈' },
  alert:        { gradient: 'linear-gradient(135deg, #b45309, #f59e0b)', ring: '#fbbf24', pulse: true,  emoji: '◆' },
  celebrating:  { gradient: 'linear-gradient(135deg, #b91c1c, #f43f5e)', ring: '#fb7185', pulse: true,  emoji: '★' },
};

export default function AgentAvatar({ mood, message, size = 96 }: AgentAvatarProps) {
  const cfg = MOOD_CONFIG[mood];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* Avatar circle */}
      <div style={{ position: 'relative' }}>
        {/* Pulse ring */}
        {cfg.pulse && (
          <div style={{
            position: 'absolute', inset: -8,
            borderRadius: '50%',
            border: `2px solid ${cfg.ring}`,
            opacity: 0.5,
            animation: 'agentPulse 1.8s ease-in-out infinite',
          }} />
        )}
        <div style={{
          width: size, height: size,
          borderRadius: '50%',
          background: cfg.gradient,
          boxShadow: `0 0 0 3px ${cfg.ring}40, 0 8px 32px ${cfg.ring}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.35,
          color: 'rgba(255,255,255,0.9)',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          userSelect: 'none',
          transition: 'background 0.4s, box-shadow 0.4s',
        }}>
          {cfg.emoji}
        </div>
      </div>

      {/* Agent message bubble */}
      <div style={{
        background: 'var(--sl-bg-card)',
        border: '1px solid var(--sl-border)',
        borderRadius: 12,
        padding: '10px 16px',
        maxWidth: 260,
        textAlign: 'center',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--sl-text)',
        lineHeight: 1.5,
        position: 'relative',
        boxShadow: 'var(--sl-shadow)',
      }}>
        <div style={{
          position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%)',
          width: 12, height: 12,
          background: 'var(--sl-bg-card)',
          border: '1px solid var(--sl-border)',
          borderBottom: 'none', borderRight: 'none',
          rotate: '45deg',
        }} />
        {message}
      </div>

      <style>{`
        @keyframes agentPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 0.15; }
        }
      `}</style>
    </div>
  );
}
