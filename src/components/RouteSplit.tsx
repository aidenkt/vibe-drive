import Svg, { Circle, Polyline, Text as SvgText } from 'react-native-svg';
import { simplify, Coordinate } from '../../convex/simplify';
import { passColors, passFonts } from '../lib/drives';

type Props = { fast: number[][]; vibe: number[][]; extraMinutes?: number; width: number; height: number; scale: number };

function nearest(p: number[], line: number[][]) {
  let best = { d: Infinity, x: line[0][0], y: line[0][1] };
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const dx = bx - ax, dy = by - ay;
    const l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l)) : 0;
    const x = ax + t * dx, y = ay + t * dy;
    const d = Math.hypot(p[0] - x, p[1] - y);
    if (d < best.d) best = { d, x, y };
  }
  return best;
}

export function RouteSplit({ fast, vibe, extraMinutes, width, height, scale }: Props) {
  const fastPts = simplify(fast as Coordinate[], 40);
  const vibePts = simplify(vibe as Coordinate[], 40);
  const all = [...fastPts, ...vibePts];
  if (all.length < 2) return null;
  const cos = Math.cos((all.reduce((t, p) => t + p[0], 0) / all.length) * Math.PI / 180);
  const project = (p: number[]) => [p[1] * cos, -p[0]];
  const projected = all.map(project);
  const xs = projected.map((p) => p[0]), ys = projected.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 8 * scale;
  const k = Math.min((width - pad * 2) / (maxX - minX || 1), (height - pad * 2) / (maxY - minY || 1));
  const ox = (width - (maxX - minX) * k) / 2, oy = (height - (maxY - minY) * k) / 2;
  const fit = (p: number[]) => { const [x, y] = project(p); return [ox + (x - minX) * k, oy + (y - minY) * k]; };
  const f = fastPts.map(fit), v = vibePts.map(fit);
  const points = (line: number[][]) => line.map((p) => p.join(',')).join(' ');
  let label: { x: number; y: number; anchor: 'start' | 'end' | 'middle' } | null = null;
  if (extraMinutes !== undefined && f.length > 1) {
    let far = { d: -1, p: v[0], n: nearest(v[0], f) };
    for (const p of v) { const n = nearest(p, f); if (n.d > far.d) far = { d: n.d, p, n }; }
    const dx = far.p[0] - far.n.x, dy = far.p[1] - far.n.y, len = Math.hypot(dx, dy) || 1;
    const off = 12 * scale;
    const x = far.p[0] + (dx / len) * off, y = far.p[1] + (dy / len) * off + 4 * scale;
    const anchor = dx / len > 0.35 ? 'start' : dx / len < -0.35 ? 'end' : 'middle';
    const approx = 52 * scale;
    const cx = anchor === 'start' ? Math.min(x, width - approx) : anchor === 'end' ? Math.max(x, approx) : Math.max(approx / 2, Math.min(width - approx / 2, x));
    label = { x: cx, y: Math.max(12 * scale, Math.min(height - 4 * scale, y)), anchor };
  }
  const [start, end] = [v[0], v[v.length - 1]];
  return <Svg width={width} height={height}>
    {f.length > 1 && <Polyline points={points(f)} fill="none" stroke={passColors.paper} strokeOpacity={0.25} strokeWidth={1.5 * scale} strokeLinejoin="round" strokeLinecap="round" />}
    <Polyline points={points(v)} fill="none" stroke={passColors.accent} strokeWidth={3 * scale} strokeLinejoin="round" strokeLinecap="round" />
    <Circle cx={start[0]} cy={start[1]} r={3.5 * scale} fill={passColors.paper} />
    <Circle cx={end[0]} cy={end[1]} r={3.5 * scale} fill={passColors.paper} />
    {label && <SvgText x={label.x} y={label.y} textAnchor={label.anchor} fill={passColors.accent} fontFamily={passFonts.monoMedium} fontSize={11 * scale} letterSpacing={1 * scale}>{`+${extraMinutes} MIN`}</SvgText>}
  </Svg>;
}
