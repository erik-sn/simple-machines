// A gear drawn as one ink line; the stroke follows the theme's ink colour.
export function GearIcon() {
  const teeth = 8;
  const points: string[] = [];
  for (let i = 0; i < teeth * 2; i += 1) {
    const angle = (Math.PI * i) / teeth;
    const radius = i % 2 === 0 ? 11 : 8;
    points.push(
      `${(12 + radius * Math.cos(angle)).toFixed(2)},${(12 + radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <polygon points={points.join(" ")} />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
