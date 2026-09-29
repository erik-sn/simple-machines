import rough from "roughjs";
import { useTheme } from "../theme/ThemeProvider";

const generator = rough.generator();

// A gear drawn by the same hand as the plates: ten teeth and a hub, through
// the theme's pen, so it reads as a drawing rather than an app's icon.
export function GearIcon() {
  const { theme } = useTheme();
  const teeth = 10;
  const points: [number, number][] = [];
  for (let i = 0; i < teeth * 2; i += 1) {
    const angle = (Math.PI * i) / teeth;
    const radius = i % 2 === 0 ? 11.5 : 8.5;
    points.push([13 + radius * Math.cos(angle), 13 + radius * Math.sin(angle)]);
  }
  const roughness = theme === "ink" ? 0.9 : theme === "fusion" ? 0.5 : 0;
  const options = {
    seed: 7,
    roughness,
    bowing: theme === "graph" ? 0 : 0.4,
    disableMultiStroke: true,
    preserveVertices: true,
    strokeWidth: 1,
  };
  const paths = [
    ...generator.toPaths(generator.polygon(points, options)),
    ...generator.toPaths(
      generator.circle(13, 13, 7, { ...options, curveStepCount: 12 }),
    ),
  ];
  return (
    <svg
      viewBox="0 0 26 26"
      width="26"
      height="26"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {paths.map((path) => (
        <path key={path.d} d={path.d} />
      ))}
    </svg>
  );
}
