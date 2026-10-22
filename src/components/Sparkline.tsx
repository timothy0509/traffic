export default function Sparkline({ values, width = 280, height = 52, color = "#1c1813" }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return <div className="font-readout text-xs text-muted">awaiting second reading…</div>;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 4 - ((v - min) / span) * (height - 10)).toFixed(1)}`).join(" ");
  const lastX = width.toFixed(1);
  const lastY = (height - 4 - ((values[values.length - 1] - min) / span) * (height - 10)).toFixed(1);
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height }}>
      <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="#cfc7ae" strokeWidth="1" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="miter" />
      <rect x={Number(lastX) - 3} y={Number(lastY) - 3} width="6" height="6" fill="#c8102e" />
    </svg>
  );
}
