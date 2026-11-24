/**
 * FlipCard.jsx — a card that flips in 3D to reveal the answer.
 * The back repeats the question (smaller) above the answer, like Anki.
 */

export default function FlipCard({ front, back, flipped, onFlip }) {
  const face = 'flip-face panel flex min-h-72 flex-col items-center justify-center p-8 text-center shadow-sm sm:p-12';
  const text = 'whitespace-pre-wrap break-words text-2xl leading-snug sm:text-3xl';

  return (
    <div className="flip-card card-enter cursor-pointer" onClick={onFlip}>
      <div className={`flip-inner ${flipped ? 'is-flipped' : ''}`}>
        <div className={face} aria-hidden={flipped}>
          <p className={text}>{front}</p>
        </div>
        <div className={`${face} flip-back`} aria-hidden={!flipped}>
          <p className="whitespace-pre-wrap break-words text-base text-zinc-500 dark:text-zinc-400">{front}</p>
          <hr className="my-5 w-16 border-zinc-200 dark:border-zinc-700" />
          <p className={`${text} font-medium`}>{back}</p>
        </div>
      </div>
    </div>
  );
}
