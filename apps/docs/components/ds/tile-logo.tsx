/** The mark: a 3 by 3 board with one lit square. It moves only when motion is allowed. */
export function TileLogo({ size = 24, title }: { size?: number; title?: string }) {
  const cell = 10;
  const gap = 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 34 34"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {Array.from({ length: 9 }, (_, index) => (
        <rect
          key={index}
          x={(index % 3) * (cell + gap)}
          y={Math.floor(index / 3) * (cell + gap)}
          width={cell}
          height={cell}
          rx="2"
          fill="currentColor"
          opacity="0.28"
        />
      ))}
      <rect className="gg-logo-lit" x="0" y="0" width={cell} height={cell} rx="2" fill="var(--gg-signal)" />
    </svg>
  );
}
