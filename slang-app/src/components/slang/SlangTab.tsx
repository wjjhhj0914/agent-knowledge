import { useState } from 'react';
import LearnScreen from './LearnScreen';
import QuizScreen from './QuizScreen';
import ReviewScreen from './ReviewScreen';

type SlangView = 'learn' | 'quiz' | 'review';

interface SlangTabProps {
  onXP: (n: number) => void;
  onHeart: (n: number) => void;
}

const VIEWS: { id: SlangView; label: string; icon: string; desc: string }[] = [
  { id: 'learn',  label: '플립 카드',  icon: '◈', desc: '표현 학습' },
  { id: 'quiz',   label: '퀴즈',       icon: '✦', desc: '실력 테스트' },
  { id: 'review', label: '저장 단어',  icon: '♡', desc: '단어 목록' },
];

export default function SlangTab({ onXP, onHeart }: SlangTabProps) {
  const [view, setView] = useState<SlangView>('learn');

  return (
    <div style={{ minHeight: 'calc(100dvh - 60px)' }}>
      {/* Sub-tab header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--sl-border)',
        background: 'var(--sl-bg-card)',
      }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--sl-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            ✦ Bonus Tab — 원어민 슬랭 & 숙어
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            {VIEWS.map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                style={{
                  flex: 1,
                  padding: '9px 8px',
                  borderRadius: 10,
                  border: '1.5px solid',
                  borderColor: view === v.id ? 'var(--sl-accent)' : 'var(--sl-border)',
                  background: view === v.id ? 'var(--sl-accent-dim)' : 'transparent',
                  color: view === v.id ? 'var(--sl-accent-2)' : 'var(--sl-text-2)',
                  fontWeight: 600, fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}
              >
                <span style={{ fontSize: 16 }}>{v.icon}</span>
                <span>{v.label}</span>
                <span style={{ fontSize: 10, color: 'inherit', opacity: 0.7 }}>{v.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'learn'  && <LearnScreen onXP={onXP} />}
      {view === 'quiz'   && <QuizScreen onXP={onXP} onHeart={onHeart} />}
      {view === 'review' && <ReviewScreen />}
    </div>
  );
}
