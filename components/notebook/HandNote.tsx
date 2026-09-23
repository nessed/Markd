'use client';

// Handwritten marginalia (Caveat), lifted from Akada. Off-grid annotations
// like "~ 6 min left" that keep the page from feeling machine-made.

interface Props {
  children: React.ReactNode;
  color?: string;
  size?: number;
  rotate?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function HandNote({
  children,
  color = 'var(--ink-soft)',
  size = 17,
  rotate = -2,
  className = '',
  style,
}: Props) {
  return (
    <span
      className={`font-hand inline-block ${className}`}
      style={{
        color,
        fontSize: size,
        lineHeight: 1.05,
        transform: `rotate(${rotate}deg)`,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
