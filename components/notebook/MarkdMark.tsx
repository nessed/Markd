// Akada's bookmark monogram with Markd's letter in it, so the two read as
// one family of notebooks.

interface Props {
  size?: number;
  letter?: string;
  className?: string;
}

export default function MarkdMark({ size = 18, letter = 'm', className }: Props) {
  const h = Math.round((size * 68) / 56);
  return (
    <svg width={size} height={h} viewBox="0 0 56 68" fill="none" aria-hidden className={className}>
      <path d="M6 4 H50 V60 L28 48 L6 60 Z" stroke="currentColor" strokeWidth="2.4" fill="var(--paper)" />
      <text
        x="28"
        y="38"
        textAnchor="middle"
        fontFamily="var(--font-cormorant), 'Cormorant Garamond', Georgia, serif"
        fontSize="34"
        fontStyle="italic"
        fontWeight="500"
        fill="currentColor"
      >
        {letter}
      </text>
    </svg>
  );
}
