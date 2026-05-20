import { useState } from 'react';
import { CARDS } from '../../data/cards';
import type { SlangCard } from '../../types';

interface LearnScreenProps {
  onXP: (n: number) => void;
}

export default function LearnScreen({ onXP }: LearnScreenProps) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());

  const card = CARDS[idx];

  function next() {
    if (!done.has(card.id)) {
      setDone(prev => new Set([...prev, card.id]));
      onXP(20);
    }
    setFlipped(false);
    setTimeout(() => setIdx(i => Math.min(i + 1, CARDS.length - 1)), 150);
  }

  function prev() {
    setFlipped(false);
    setTimeout(() => setIdx(i => Math.max(i - 1, 0)), 150);
  }

  const progress = ((idx + 1) / CARDS.length) * 100;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--sl-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Gen-Z Slang Essentials
          </p>
          <p style={{ fontSize: 13, color: 'var(--sl-text-2)', marginTop: 2 }}>
            {idx + 1} of {CARDS.length} expressions
          </p>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--sl-accent)' }}>
          {done.size} learned ✓
        </span>
      </div>

      {/* Progress */}
      <div className="sl-xp-track" style={{ marginBottom: 28, height: 5 }}>
        <div className="sl-xp-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Flip card */}
      <FlipCard card={card} flipped={flipped} onFlip={() => setFlipped(f => !f)} />

      {/* Hint */}
      {!flipped && (
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--sl-text-3)', marginTop: 14 }}>
          Tap the card to reveal meaning & example
        </p>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button className="sl-btn-ghost" style={{ flex: 1 }} onClick={prev} disabled={idx === 0}>
          ← Prev
        </button>
        <button className="sl-btn-primary" style={{ flex: 2 }} onClick={next} disabled={idx === CARDS.length - 1}>
          {done.has(card.id) ? 'Next →' : 'Got it · Next →'}
        </button>
      </div>

      {/* Keyboard hint */}
      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--sl-text-3)', marginTop: 16 }}>
        Shortcut: Space to flip · ← → to navigate
      </p>
    </div>
  );
}

function FlipCard({ card, flipped, onFlip }: { card: SlangCard; flipped: boolean; onFlip: () => void }) {
  const HEIGHT = 340;

  return (
    <div className="flip-scene" style={{ height: HEIGHT }}>
      <div className={`flip-card ${flipped ? 'flipped' : ''}`} style={{ height: HEIGHT }}>
        {/* Front */}
        <div className="flip-face sl-card" style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          textAlign: 'center', padding: '32px 28px', cursor: 'pointer', height: HEIGHT,
        }} onClick={onFlip}>
          <span className="sl-tag accent" style={{ marginBottom: 20 }}>{card.category}</span>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: 'var(--sl-text)', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 10 }}>
            {card.term}
          </h2>
          {card.phonetic && (
            <p style={{ fontSize: 14, color: 'var(--sl-text-3)', fontFamily: 'monospace', marginBottom: 20 }}>
              {card.phonetic}
            </p>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {card.tags.map((t: string) => <span key={t} className="sl-tag" style={{ fontSize: 11 }}>#{t}</span>)}
          </div>
          <p style={{ fontSize: 12, color: 'var(--sl-text-3)', marginTop: 24 }}>tap to flip</p>
        </div>

        {/* Back */}
        <div className="flip-face flip-back sl-card" style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '28px', cursor: 'pointer', height: HEIGHT,
          background: 'var(--sl-bg-card)',
        }} onClick={onFlip}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--sl-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Meaning
            </p>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--sl-text)', lineHeight: 1.4, marginBottom: 20 }}>
              {card.meaning}
            </p>
          </div>

          <div style={{ background: 'var(--sl-bg-hover)', borderRadius: 10, padding: '14px 16px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--sl-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Example
            </p>
            <p style={{ fontSize: 14, color: 'var(--sl-text)', lineHeight: 1.6, fontStyle: 'italic' }}>
              "{card.example}"
            </p>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            borderTop: '1px solid var(--sl-border)', paddingTop: 14,
          }}>
            <span style={{ fontSize: 16 }}>🇰🇷</span>
            <p style={{ fontSize: 13, color: 'var(--sl-text-2)' }}>{card.translation}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
