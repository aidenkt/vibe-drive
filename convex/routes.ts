import { getTimes } from "suncalc";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { point } from "./schema";
import { simplify } from "./simplify";

type Point = { lat: number; lng: number };
type Coordinate = [number, number];
type Step = { type: string; modifier: string; name: string; distance: number; along: number; lat: number; lng: number };
type Route = { steps: Step[]; meters: number; coordinates: Coordinate[]; minutes: number; firstLegMinutes: number; legKm: number[]; estimated: boolean };

function distance(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

async function route(points: Point[]): Promise<Route> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const coordinates = points.map((p) => `${p.lng},${p.lat}`).join(";");
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`, { signal: controller.signal });
    if (!response.ok) throw new Error("Routing unavailable");
    const data = await response.json() as {
      code?: string;
      routes?: { duration: number; distance: number; geometry: { coordinates: number[][] }; legs: { duration: number; distance: number; steps?: { distance: number; name?: string; maneuver: { type: string; modifier?: string; location: number[] } }[] }[] }[];
    };
    const result = data.routes?.[0];
    if (data.code !== "Ok" || !result || !Number.isFinite(result.duration) || result.duration < 0
      || !Number.isFinite(result.legs?.[0]?.duration) || !Array.isArray(result.geometry?.coordinates)
      || result.geometry.coordinates.length < 2 || result.geometry.coordinates.some((p) => p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) {
      throw new Error("Invalid routing response");
    }
    let along = 0;
    const steps: Step[] = result.legs.flatMap((leg) => leg.steps ?? []).flatMap((step) => {
      const start = along;
      along += step.distance;
      if (step.maneuver.type === "depart" || (step.maneuver.type === "arrive" && along < result.distance - 50)) return [];
      return [{ type: step.maneuver.type, modifier: step.maneuver.modifier ?? "", name: step.name ?? "", distance: step.distance, along: start, lat: step.maneuver.location[1], lng: step.maneuver.location[0] }];
    });
    return {
      steps, meters: result.distance,
      coordinates: result.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      minutes: result.duration / 60,
      firstLegMinutes: result.legs[0].duration / 60,
      legKm: result.legs.map((leg) => leg.distance / 1000),
      estimated: false,
    };
  } catch {
    const legKm = points.slice(1).map((p, index) => distance(points[index], p));
    const legMinutes = legKm.map((km) => km / 50 * 60);
    return {
      steps: [], meters: legKm.reduce((t, km) => t + km, 0) * 1000,
      coordinates: points.map((p) => [p.lat, p.lng]),
      minutes: legMinutes.reduce((total, minutes) => total + minutes, 0),
      firstLegMinutes: legMinutes[0],
      legKm,
      estimated: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}

const kindPoints: Record<string, number> = { bridge: 3, viewpoint: 3, water: 2, beach: 2, curves: 2, forest: 2, landmark: 1, city: 1 };
type TimedMoment = { wiki?: string; label: string; kind: string; lat: number; lng: number; note: string; points: number; offsetMinutes: number; sunsetAt: number };

type Item = { label: string; points: number; icon: string; muted?: boolean };

function heading(a: Coordinate, b: Coordinate) {
  const r = Math.PI / 180;
  const y = Math.sin((b[1] - a[1]) * r) * Math.cos(b[0] * r);
  const x = Math.cos(a[0] * r) * Math.sin(b[0] * r) - Math.sin(a[0] * r) * Math.cos(b[0] * r) * Math.cos((b[1] - a[1]) * r);
  return Math.atan2(y, x) * 180 / Math.PI;
}

function turningPerKm(coords: Coordinate[]) {
  const pts = simplify(coords, 300);
  let turn = 0;
  let km = 0;
  for (let i = 1; i < pts.length; i++) {
    km += distance({ lat: pts[i - 1][0], lng: pts[i - 1][1] }, { lat: pts[i][0], lng: pts[i][1] });
    if (i > 1) turn += Math.abs(((heading(pts[i - 1], pts[i]) - heading(pts[i - 2], pts[i - 1]) + 540) % 360) - 180);
  }
  return km ? turn / km : 0;
}

const laTime = (date: Date) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit", hour12: true }).format(date);

export const planRoutes = action({
  args: { origin: point, destination: point, driveId: v.optional(v.id("drives")) },
  handler: async (ctx, { origin, destination, driveId }): Promise<{
    fast: Coordinate[]; fastMinutes: number; fastItems: Item[]; fastScore: number; estimated: boolean;
    vibe: Coordinate[] | null; vibeMinutes: number | null; extraMinutes: number | null; drive: Doc<"drives"> | null;
    goldenHour: string | null; goldenHourAt: string | null; miles: number | null; scenicItems: Item[]; scenicScore: number | null;
    moments: TimedMoment[]; leaveAt: number | null; sunsetAt: number | null; steps: Step[]; meters: number | null;
  }> => {
    for (const p of [origin, destination]) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) {
        throw new Error("Enter valid latitude and longitude coordinates");
      }
    }
    const drives: Doc<"drives">[] = await ctx.runQuery(api.drives.listDrives, {});
    const direct = distance(origin, destination);
    const length = (w: Point[]) => w.slice(1).reduce((t, p, i) => t + distance(w[i], p), 0);
    const options = drives.filter((d) => d.waypoints.length > 1 && (!driveId || d._id === driveId)).flatMap((d) =>
      [d.waypoints, [...d.waypoints].reverse()].map((waypoints) => ({
        drive: d, waypoints,
        score: distance(origin, waypoints[0]) + distance(waypoints[waypoints.length - 1], destination) - direct - length(waypoints),
      }))).sort((x, y) => x.score - y.score);
    const now = new Date();
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hour12: false }).format(now)) % 24;
    const rush = (hour >= 7 && hour < 10) || (hour >= 16 && hour < 19);
    const fast = await route([origin, destination]);
    const fastMinutes = Math.round(fast.minutes);
    let best: (typeof options)[number] | null = null;
    let vibe: Route | null = null;
    for (const option of options.slice(0, 3)) {
      const candidate = await route([origin, ...option.waypoints, destination]);
      const extra = Math.round(candidate.minutes) - fastMinutes;
      const endsAtDestination = distance(option.waypoints[option.waypoints.length - 1], destination) < 5;
      if (driveId || extra <= 45 || extra <= fastMinutes * 0.6 || (endsAtDestination && extra <= Math.max(fastMinutes * 0.8, 75))) { best = option; vibe = candidate; break; }
    }
    const fastItems: Item[] = [
      { label: "Freeway the whole way", points: 0, icon: "road.lanes" },
      { label: "Sound walls", points: -1, icon: "rectangle.split.3x1" },
      rush ? { label: "Rush-hour traffic", points: -1, icon: "car.2" } : { label: "Light traffic right now", points: 0, icon: "car.2" },
    ];
    const fastScore = fastItems.reduce((t, i) => t + i.points, 0);
    const none = { vibe: null, vibeMinutes: null, extraMinutes: null, drive: null, goldenHour: null, goldenHourAt: null, miles: null, scenicItems: [], scenicScore: null, moments: [], leaveAt: null, sunsetAt: null, steps: [], meters: null };
    if (!best || !vibe) return { fast: fast.coordinates, fastMinutes, fastItems, fastScore, estimated: fast.estimated, ...none };
    const vibeMinutes = Math.round(vibe.minutes);
    const extraMinutes = Math.max(0, vibeMinutes - fastMinutes);
    const drive = best.drive;
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const part = (type: string) => parts.find((p) => p.type === type)!.value;
    const start = best.waypoints[0];
    const sunset = getTimes(new Date(`${part("year")}-${part("month")}-${part("day")}T20:00:00Z`), start.lat, start.lng).sunset ?? now;
    const departure = new Date(sunset.getTime() - (40 + vibe.firstLegMinutes) * 60_000);
    const arrival = now.getTime() + vibe.firstLegMinutes * 60_000;
    const inGolden = arrival >= sunset.getTime() - 60 * 60_000 && arrival <= sunset.getTime() + 10 * 60_000;
    const leave = laTime(departure).replace(/\s?[AP]M$/, "");
    const ratio = turningPerKm(vibe.coordinates) / Math.max(1, turningPerKm(fast.coordinates));
    const curves = ratio > 2.5 ? 3 : ratio > 1.6 ? 2 : ratio > 1.1 ? 1 : 0;
    const span = drive.elevationSpan ?? 0;
    const scenicItems: Item[] = [
      ...(drive.vibes ?? []),
      inGolden ? { label: "Golden hour timing", points: 3, icon: "sun.horizon" } : { label: `Golden hour timing · leave at ${leave}`, points: 0, icon: "sun.horizon", muted: true },
      ...(curves ? [{ label: "More curves than the freeway", points: curves, icon: "road.lanes.curved.right" }] : []),
      ...(span > 150 ? [{ label: `Climbs about ${span} m`, points: span > 400 ? 2 : 1, icon: "mountain.2" }] : []),
    ];
    const scenicScore = scenicItems.reduce((t, i) => t + i.points, 0);
    const miles = Math.round(vibe.legKm.slice(1, -1).reduce((total, km) => total + km, 0) * 0.621371 * 10) / 10;
    const goldenHourAt = laTime(new Date(sunset.getTime() - 40 * 60_000)).replace(/\s?([AP])M$/, "$1");
    const cumulative = [0];
    for (let i = 1; i < vibe.coordinates.length; i++) {
      const [a, b] = [vibe.coordinates[i - 1], vibe.coordinates[i]];
      cumulative.push(cumulative[i - 1] + distance({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }));
    }
    const total = cumulative[cumulative.length - 1] || 1;
    const sunsetDay = new Date(`${part("year")}-${part("month")}-${part("day")}T20:00:00Z`);
    const nearRoute = (p: Point) => vibe.coordinates.some(([lat, lng]) => distance(p, { lat, lng }) < 0.5);
    const landmarkMoments = (await ctx.runQuery(internal.drives.listLandmarks, {})).filter(nearRoute)
      .map((l) => ({ label: l.name, kind: l.kind, lat: l.lat, lng: l.lng, note: l.note, wiki: l.wiki }));
    const seen = new Set<string>();
    const merged = [...landmarkMoments, ...(drive.moments ?? [])].filter((m) => !seen.has(m.label.toLowerCase()) && !!seen.add(m.label.toLowerCase()));
    const moments: TimedMoment[] = merged.map((moment) => {
      let nearest = 0;
      let nearestKm = Infinity;
      vibe.coordinates.forEach(([lat, lng], i) => {
        const km = distance(moment, { lat, lng });
        if (km < nearestKm) { nearestKm = km; nearest = i; }
      });
      return { ...moment, points: kindPoints[moment.kind] ?? 1, offsetMinutes: cumulative[nearest] / total * vibe.minutes,
        sunsetAt: (getTimes(sunsetDay, moment.lat, moment.lng).sunset ?? sunset).getTime() };
    }).sort((a, b) => a.offsetMinutes - b.offsetMinutes);
    await ctx.scheduler.runAfter(0, internal.photos.prefetch, { moments: moments.map(({ label, lat, lng, wiki }) => ({ label, lat, lng, wiki })) });
    await ctx.runMutation(internal.drives.saveSplit, {
      driveId: drive._id, fast: simplify(fast.coordinates, 60), vibe: simplify(vibe.coordinates, 60), extraMinutes, miles, goldenHourAt, vibeScore: scenicScore,
    });
    return {
      fast: fast.coordinates, fastMinutes, fastItems, fastScore, estimated: fast.estimated || vibe.estimated,
      vibe: vibe.coordinates, vibeMinutes, extraMinutes, drive, miles, goldenHourAt, scenicItems, scenicScore,
      goldenHour: `Leave at ${leave} to hit ${drive.name} at golden hour`,
      moments, leaveAt: departure.getTime(), sunsetAt: sunset.getTime(), steps: vibe.steps, meters: vibe.meters,
    };
  },
});
