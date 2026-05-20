import type { PerceptionFrame, PerceptionSnapshot } from '../types';

interface PerceptionStatusProps {
  frame: PerceptionFrame | null;
  snapshot: PerceptionSnapshot;
  sessionRunning: boolean;
}

export default function PerceptionStatus({ frame, snapshot, sessionRunning }: PerceptionStatusProps) {
  if (!sessionRunning || !frame) {
    return (
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        padding: '8px 14px', borderRadius: 99,
        background: 'var(--sl-bg-hover)',
        border: '1px solid var(--sl-border)',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#52525b', display: 'inline-block' }} />
        <span style={{ fontSize: 12, color: 'var(--sl-text-3)' }}>대기 중</span>
      </div>
    );
  }

  const voiceOk  = frame.hasSpeech;
  const gazeOk   = frame.gazeFocused && frame.faceVisible;
  const silWarn  = snapshot.silenceSec >= 15;
  const silAlert = snapshot.silenceSec >= 20;

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <Indicator
        icon="🎙️"
        label={voiceOk ? '발화 중' : silAlert ? `침묵 ${snapshot.silenceSec}s` : silWarn ? `${snapshot.silenceSec}s` : '대기'}
        status={voiceOk ? 'good' : silAlert ? 'danger' : silWarn ? 'warn' : 'idle'}
      />
      <Indicator
        icon="👁️"
        label={gazeOk ? '아이컨택' : snapshot.gazeAwaySec > 0 ? `이탈 ${snapshot.gazeAwaySec}s` : '감지 중'}
        status={gazeOk ? 'good' : snapshot.gazeAwaySec >= 8 ? 'warn' : 'idle'}
      />
      <Indicator
        icon="😐"
        label={frame.expression === 'happy' ? '자연스러움' : frame.expression === 'neutral' ? (snapshot.frozenSec > 8 ? `굳음 ${snapshot.frozenSec}s` : '보통') : frame.expression}
        status={frame.expression === 'happy' ? 'good' : snapshot.frozenSec >= 12 ? 'warn' : 'idle'}
      />
    </div>
  );
}

function Indicator({ icon, label, status }: { icon: string; label: string; status: 'good' | 'warn' | 'danger' | 'idle' }) {
  const colors = {
    good:   { dot: '#22c55e', text: '#16a34a', bg: '#dcfce7', border: '#86efac' },
    warn:   { dot: '#f59e0b', text: '#b45309', bg: '#fef3c7', border: '#fcd34d' },
    danger: { dot: '#ef4444', text: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' },
    idle:   { dot: '#71717a', text: '#52525b', bg: 'var(--sl-bg-hover)', border: 'var(--sl-border)' },
  };
  const c = colors[status];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '5px 10px', borderRadius: 99,
      background: c.bg,
      border: `1.5px solid ${c.border}`,
      transition: 'all 0.3s',
    }}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: c.dot,
        display: 'inline-block',
        boxShadow: status === 'good' ? `0 0 6px ${c.dot}` : 'none',
        animation: status === 'danger' ? 'statusPulse 1s ease infinite' : 'none',
      }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: c.text, whiteSpace: 'nowrap' }}>{label}</span>
      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
