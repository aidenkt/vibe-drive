export type Coordinate = [number, number];

function perpendicular(p: Coordinate, a: Coordinate, b: Coordinate) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

function douglasPeucker(points: Coordinate[], epsilon: number) {
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let index = -1;
    let max = epsilon;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicular(points[i], points[start], points[end]);
      if (d > max) { max = d; index = i; }
    }
    if (index !== -1) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

export function simplify(points: Coordinate[], target = 40): Coordinate[] {
  if (points.length <= target) return points;
  let low = 0;
  let high = 1;
  let best = douglasPeucker(points, high);
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    const result = douglasPeucker(points, mid);
    if (result.length > target) low = mid;
    else { high = mid; best = result; }
  }
  return best;
}
