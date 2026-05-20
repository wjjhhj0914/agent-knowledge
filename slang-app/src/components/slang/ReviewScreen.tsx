import { useState } from 'react';
import { CARDS } from '../../data/cards';
import type { Category, Difficulty } from '../../types';

const DIFF_COLOR: Record<Difficulty, string> = {
  beginner:     '#22c55e',
  intermediate: '#f59e0b',
  advanced:     '#ef4444',
};

const CAT_LABEL: Record<Category, string> = {
  slang:          'Slang',
  idiom:          'Idiom',
  'phrasal-verb': 'Phrasal Verb',
  colloquial:     'Colloquial',
};

export default function ReviewScreen() {
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [search, setSearch] = useState('');

  const visible = CARDS.filter(c => {
    const matchCat  = filter === 'all' || c.category === filter;
    const matchText = c.term.toLowerCase().includes(search.toLowerCase())
      || c.meaning.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchText;
  });

  const cats: (Category | 'all')[] = ['all', 'slang', 'idiom', 'phrasal-verb', 'colloquial'];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--sl-text)', letterSpacing: '-0.03em', marginBottom: 4 }}>
          Saved Words
        </h1>
        <p style={{ fontSize: 13, color: 'var(--sl-text-3)' }}>{CARDS.length} expressions collected</p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--sl-text-3)', fontSize: 16 }}>
          ⌕
        </span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search expressions…"
          style={{
            width: '100%',
            padding: '11px 14px 11px 38px',
            borderRadius: 10,
            border: '1.5px solid var(--sl-border)',
            background: 'var(--sl-bg-input)',
            color: 'var(--sl-text)',
            fontSize: 14,
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--sl-accent)')}
          onBlur={e  => (e.target.style.borderColor = 'var(--sl-border)')}
        />
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {cats.map((c: Category | 'all') => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            style={{
              padding: '6px 14px',
              borderRadius: 99,
              border: '1.5px solid',
              borderColor: filter === c ? 'var(--sl-accent)' : 'var(--sl-border)',
              background: filter === c ? 'var(--sl-accent-dim)' : 'transparent',
              color: filter === c ? 'var(--sl-accent-2)' : 'var(--sl-text-2)',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.15s',
              textTransform: 'capitalize',
            }}
          >
            {c === 'all' ? 'All' : CAT_LABEL[c as Category]}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--sl-text-3)' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🔍</p>
          <p style={{ fontSize: 15 }}>No expressions match your search.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {visible.map(card => (
            <div key={card.id} className="sl-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--sl-text)', letterSpacing: '-0.02em', marginBottom: 3 }}>
                    {card.term}
                  </h3>
                  {card.phonetic && (
                    <p style={{ fontSize: 11, color: 'var(--sl-text-3)', fontFamily: 'monospace' }}>{card.phonetic}</p>
                  )}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                  background: DIFF_COLOR[card.difficulty] + '22',
                  color: DIFF_COLOR[card.difficulty],
                  textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
                }}>
                  {card.difficulty}
                </span>
              </div>

              <p style={{ fontSize: 13, color: 'var(--sl-text-2)', lineHeight: 1.5, marginBottom: 10 }}>
                {card.meaning}
              </p>

              <p style={{ fontSize: 12, color: 'var(--sl-text-3)', fontStyle: 'italic', borderTop: '1px solid var(--sl-border)', paddingTop: 10, lineHeight: 1.5 }}>
                "{card.example}"
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {card.tags.map((t: string) => <span key={t} className="sl-tag" style={{ fontSize: 10 }}>#{t}</span>)}
                </div>
                <span style={{ fontSize: 11, color: 'var(--sl-text-3)' }}>♡ {card.likes}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
