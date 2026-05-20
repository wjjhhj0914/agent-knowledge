import { useState, useMemo } from 'react';
import { CARDS, CHOICE_POOL } from '../../data/cards';
import type { SlangCard } from '../../types';

interface QuizQuestion { card: SlangCard; choices: string[]; correctIndex: number; }

interface QuizScreenProps {
  onXP: (n: number) => void;
  onHeart: (n: number) => void;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildQuiz(): QuizQuestion[] {
  return shuffle(CARDS).slice(0, 5).map(card => {
    const wrongs = shuffle(CHOICE_POOL.filter((m: string) => m !== card.meaning)).slice(0, 3);
    const choices = shuffle([card.meaning, ...wrongs]);
    return { card, choices, correctIndex: choices.indexOf(card.meaning) };
  });
}

type Phase = 'answering' | 'correct' | 'wrong' | 'done';

export default function QuizScreen({ onXP, onHeart }: QuizScreenProps) {
  const questions = useMemo(buildQuiz, []);
  const [qi, setQi]           = useState(0);
  const [phase, setPhase]     = useState<Phase>('answering');
  const [chosen, setChosen]   = useState<number | null>(null);
  const [score, setScore]     = useState(0);

  const q = questions[qi];
  const progress = ((qi + (phase === 'done' ? 1 : 0)) / questions.length) * 100;

  function pick(idx: number) {
    if (phase !== 'answering') return;
    setChosen(idx);
    if (idx === q.correctIndex) {
      setPhase('correct');
      setScore(s => s + 1);
      onXP(30);
    } else {
      setPhase('wrong');
      onHeart(-1);
    }
  }

  function next() {
    if (qi + 1 >= questions.length) {
      setPhase('done');
    } else {
      setQi(i => i + 1);
      setPhase('answering');
      setChosen(null);
    }
  }

  if (phase === 'done') {
    return <DoneScreen score={score} total={questions.length} onRetry={() => window.location.reload()} />;
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--sl-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Question {qi + 1} / {questions.length}
        </p>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sl-accent)' }}>
          {score} correct
        </span>
      </div>

      <div className="sl-xp-track" style={{ marginBottom: 32, height: 5 }}>
        <div className="sl-xp-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Question */}
      <div className="sl-card" style={{ padding: '28px 24px', textAlign: 'center', marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--sl-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          What does this mean?
        </p>
        <h2 style={{ fontSize: 34, fontWeight: 900, color: 'var(--sl-text)', letterSpacing: '-0.04em', marginBottom: 8 }}>
          {q.card.term}
        </h2>
        {q.card.phonetic && (
          <p style={{ fontSize: 13, color: 'var(--sl-text-3)', fontFamily: 'monospace' }}>{q.card.phonetic}</p>
        )}
      </div>

      {/* Choices */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {q.choices.map((choice, idx) => {
          let cls = 'sl-choice';
          if (phase !== 'answering') {
            if (idx === q.correctIndex) cls += ' correct';
            else if (idx === chosen)   cls += ' wrong';
          }
          return (
            <button key={idx} className={cls} onClick={() => pick(idx)}>
              <span style={{ color: 'var(--sl-text-3)', marginRight: 10, fontWeight: 700, fontSize: 12 }}>
                {String.fromCharCode(65 + idx)}
              </span>
              {choice}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {phase !== 'answering' && (
        <div style={{
          padding: '16px 20px',
          borderRadius: 12,
          background: phase === 'correct' ? 'var(--sl-accent-dim)' : '#fef2f2',
          border: `1.5px solid ${phase === 'correct' ? 'var(--sl-accent)' : 'var(--sl-danger)'}`,
          marginBottom: 16,
        }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: phase === 'correct' ? 'var(--sl-accent-2)' : 'var(--sl-danger)', marginBottom: 4 }}>
            {phase === 'correct' ? '✓ Correct! +30 XP' : '✗ Not quite — see the correct answer above'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--sl-text-2)', fontStyle: 'italic' }}>
            "{q.card.example}"
          </p>
        </div>
      )}

      {phase !== 'answering' && (
        <button className="sl-btn-primary" style={{ width: '100%' }} onClick={next}>
          Continue →
        </button>
      )}
    </div>
  );
}

function DoneScreen({ score, total, onRetry }: { score: number; total: number; onRetry: () => void }) {
  const pct = Math.round((score / total) * 100);
  return (
    <div style={{ maxWidth: 480, margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
      <div className="sl-card" style={{ padding: '40px 32px' }}>
        <p style={{ fontSize: 48, marginBottom: 16 }}>{pct >= 80 ? '🏆' : pct >= 50 ? '💪' : '📚'}</p>
        <h2 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 8 }}>
          Quiz Complete!
        </h2>
        <p style={{ fontSize: 40, fontWeight: 900, color: 'var(--sl-accent)', marginBottom: 4 }}>
          {score}/{total}
        </p>
        <p style={{ fontSize: 14, color: 'var(--sl-text-2)', marginBottom: 28 }}>
          {pct}% accuracy · {score * 30} XP earned
        </p>
        <button className="sl-btn-primary" onClick={onRetry}>Try Again</button>
      </div>
    </div>
  );
}
