import { useEffect, useMemo, useRef } from 'react';
import { useApp } from '../store.tsx';
import { Rating, formatInterval } from '../fsrs/recall-scheduler.ts';
import { autoNordic, checkTyped, clozeParts } from '../util/answer.ts';

const TYPE_ANSWERS = true;

export function Study() {
  const { state, actions, scheduler, currentCard } = useApp();
  const card = currentCard();
  const typeRef = useRef<HTMLInputElement>(null);
  const now = useMemo(() => new Date(), [state.qIndex, state.studyDeckId]);

  // focus the type-answer input on each new card
  useEffect(() => {
    if (card && !state.revealed) typeRef.current?.focus();
  }, [state.qIndex, state.revealed, card]);

  const deck = state.decks.find((d) => d.id === state.studyDeckId);
  const title = state.studyLabel || deck?.name || '';

  // Done state
  if (!card) {
    const futureDue = deck ? deck.cards.map((c) => c.fsrs.due.getTime()).filter((x) => x > now.getTime()) : [];
    const nextIn = futureDue.length ? formatInterval(Math.min(...futureDue) - now.getTime()) : '1d';
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
        <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'var(--accent-tint)', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'rvPop 0.5s ease both' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 44, color: 'var(--accent)', lineHeight: 1 }}>✓</span>
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 600, margin: '22px 0 6px', color: '#4b4b4b' }}>
          {state.practice ? 'Practice complete' : 'All caught up'}
        </h2>
        <p style={{ fontSize: 14, color: '#777777', margin: '0 0 4px' }}>You {state.practice ? 'practiced' : 'reviewed'} {state.session.reviewed} cards in this session.</p>
        {!state.practice && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', margin: '0 0 26px' }}>Next review in {nextIn}</p>}
        <button className="btn3d" onClick={() => actions.goto('home')} style={{ padding: '13px 28px 15px', borderRadius: 16, fontSize: 14, marginTop: state.practice ? 22 : 0 }}>
          Back to decks
        </button>
      </div>
    );
  }

  const isCloze = card.type === 'cloze';
  const isNewCard = card.fsrs.lastReview === null;
  // Direction flips which side is the prompt (basic cards only; cloze is always sentence → word).
  const reversed = !isCloze && !!state.queue[state.qIndex]?.reversed;
  const promptText = reversed ? card.back : card.front;
  const answerText = isCloze ? card.back : reversed ? card.front : card.back;
  const tag = isCloze ? 'Fill in the blank' : isNewCard ? 'New card' : 'Review';

  const rest = state.queue.slice(state.qIndex);
  let newLeft = 0;
  let dueLeft = 0;
  const seen = new Set<string>();
  for (const ref of rest) {
    if (seen.has(ref.cardId)) continue; // a requeued card appears twice — count it once
    seen.add(ref.cardId);
    const c = state.decks.find((d) => d.id === ref.deckId)?.cards.find((x) => x.id === ref.cardId);
    if (!c) continue;
    if (c.fsrs.lastReview === null) newLeft++;
    else dueLeft++;
  }
  const totalDistinct = new Set(state.queue.map((r) => r.cardId)).size;
  const remainingDistinct = new Set(state.queue.slice(state.qIndex).map((r) => r.cardId)).size;
  const progressPct = totalDistinct ? Math.round(((totalDistinct - remainingDistinct) / totalDistinct) * 100) : 100;

  const buttons = scheduler.gradeButtons(card.fsrs, now);
  const typedContent = state.typed.trim().length > 0;
  const typedCorrect = checkTyped(state.typed, answerText);
  const showTypedResult = state.revealed && TYPE_ANSWERS && typedContent;

  const grade = (r: Rating) => actions.grade(r);

  // For cloze: render the sentence with the blank (revealed → filled answer, highlighted).
  const [clozeBefore, clozeAfter] = isCloze ? clozeParts(card.front) : ['', ''];
  const promptNode = !isCloze ? (
    promptText
  ) : (
    <>
      {clozeBefore}
      {state.revealed ? (
        <span style={{ color: 'var(--accent)', borderBottom: '3px solid var(--accent)', paddingBottom: 2 }}>{card.back}</span>
      ) : (
        <span style={{ borderBottom: '3px solid oklch(0.8 0 0)', padding: '0 26px' }}>&nbsp;</span>
      )}
      {clozeAfter}
    </>
  );

  const gradeBtn = (label: string, iv: string, bg: string, color: string, onClick: () => void) => (
    <button onClick={onClick} style={{ flex: 1, minWidth: 110, border: 'none', cursor: 'pointer', padding: '13px 8px', borderRadius: 13, background: bg, color, fontWeight: 700 }}>
      <div style={{ fontSize: 14 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.8, marginTop: 2 }}>{iv}</div>
    </button>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '18px var(--pad) 0', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => actions.goto('home')} style={{ border: 'none', background: 'oklch(0.93 0 0)', cursor: 'pointer', width: 34, height: 34, borderRadius: 10, fontSize: 17, color: '#777777', lineHeight: 1 }}>
          ✕
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#4b4b4b', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
            {state.practice && (
              <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--accent)', background: 'var(--accent-tint)', padding: '2px 8px', borderRadius: 7 }}>PRACTICE</span>
            )}
          </div>
          <div style={{ height: 7, background: 'oklch(0.91 0 0)', borderRadius: 20, marginTop: 7, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--accent)', borderRadius: 20, transition: 'width 0.35s ease' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
          <span style={{ color: 'oklch(0.55 0.11 250)' }}>{newLeft}</span>
          <span style={{ color: 'oklch(0.62 0.12 150)' }}>{dueLeft}</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--study-area-pad) var(--pad)', minHeight: 0, overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 560, margin: 'auto 0', flexShrink: 0, background: 'oklch(0.995 0 0)', border: '1px solid oklch(0.9 0 0)', borderRadius: 22, boxShadow: '0 18px 44px -28px oklch(0.3 0 0 / 0.5)', overflow: 'hidden' }}>
          <div style={{ padding: state.revealed ? '20px 36px 14px' : 'var(--study-card-pad) 36px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase' }}>{tag}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: isCloze ? (state.revealed ? 30 : 32) : state.revealed ? 28 : 42, fontWeight: 500, color: '#4b4b4b', marginTop: 12, lineHeight: 1.3, transition: 'font-size 0.2s' }}>{promptNode}</div>
            {!state.revealed && TYPE_ANSWERS && (
              <input
                ref={typeRef}
                value={state.typed}
                onChange={(e) => actions.setTyped(autoNordic(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    actions.reveal();
                  }
                }}
                placeholder={isCloze ? 'Type the missing word, then press Enter' : 'Type your answer, then press Enter'}
                style={{ width: '100%', maxWidth: 360, textAlign: 'center', marginTop: 'var(--study-input-gap)', border: 'none', borderBottom: '2px solid oklch(0.86 0.025 72)', background: 'transparent', fontFamily: 'var(--font-display)', fontSize: 24, padding: '8px 4px', color: '#4b4b4b' }}
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = 'var(--accent)')}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'oklch(0.86 0.025 72)')}
              />
            )}
          </div>
          {state.revealed && (
            <div style={{ borderTop: '1px dashed oklch(0.85 0.025 72)', padding: '20px 36px 18px', textAlign: 'center', animation: 'rvReveal 0.3s ease both', background: 'oklch(0.985 0 0)' }}>
              {showTypedResult && (
                <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: '1px dashed oklch(0.88 0 0)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em', color: '#afafaf', textTransform: 'uppercase' }}>You typed</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, marginTop: 6, color: typedCorrect ? 'oklch(0.5 0.13 150)' : 'oklch(0.55 0.16 25)' }}>
                    {typedContent ? state.typed.trim() : '(left blank)'}
                    <span style={{ fontSize: 16 }}>{typedCorrect ? '✓' : '✗'}</span>
                  </div>
                </div>
              )}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em', color: '#afafaf', textTransform: 'uppercase' }}>Answer</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, color: '#4b4b4b', marginTop: 8, lineHeight: 1.3 }}>{answerText}</div>
              {card.example && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed oklch(0.88 0 0)', fontSize: 15, fontStyle: 'italic', color: '#777777', lineHeight: 1.4 }}>{card.example}</div>
              )}
              {card.mnemonic && (
                <div style={{ marginTop: 14, background: 'var(--accent-tint)', borderRadius: 12, padding: '11px 16px', fontSize: 14, color: '#4b4b4b', lineHeight: 1.45 }}>{card.mnemonic}</div>
              )}
              {card.image && (
                <img src={card.image} alt="" style={{ marginTop: 14, maxWidth: '100%', maxHeight: 200, borderRadius: 12, objectFit: 'contain' }} />
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '14px var(--pad) 26px' }}>
        {state.practice && (
          <div style={{ textAlign: 'center', fontSize: 12, color: '#afafaf', marginBottom: 12 }}>Practice session — grades won't change your review schedule</div>
        )}
        {state.revealed ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', maxWidth: 560, margin: '0 auto' }}>
            {gradeBtn('Again', buttons.again, '#ffe5e5', '#ea2b2b', () => grade(Rating.Again))}
            {gradeBtn('Hard', buttons.hard, '#ffeccc', '#d97e00', () => grade(Rating.Hard))}
            {gradeBtn('Good', buttons.good, '#e1f7cf', '#46a302', () => grade(Rating.Good))}
            {gradeBtn('Easy', buttons.easy, '#d7eefd', '#1185c9', () => grade(Rating.Easy))}
          </div>
        ) : (
          <button className="btn3d" onClick={() => actions.reveal()} style={{ display: 'block', width: '100%', maxWidth: 560, margin: '0 auto', padding: 15, borderRadius: 16, fontSize: 15 }}>
            Show answer
          </button>
        )}
      </div>
    </div>
  );
}
