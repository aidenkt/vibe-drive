import { getTimes } from "suncalc";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { point } from "./schema";
import { simplify } from "./simplify";

type Point = { lat: number; lng: number };
type Coordinate = [number, number];
type Route = { coordinates: Coordinate[]; minutes: number; firstLegMinutes: number; legKm: number[]; estimated: boolean };

function distance(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

function segmentDistance(p: Point, a: Point, b: Point) {
  const scale = Math.cos((a.lat + b.lat) / 2 * Math.PI / 180);
  const dx = (b.lng - a.lng) * scale;
  const dy = b.lat - a.lat;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((p.lng - a.lng) * scale * dx + (p.lat - a.lat) * dy) / lengthSquared));
  return distance(p, { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) });
}

async function route(points: Point[]): Promise<Route> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const coordinates = points.map((p) => `${p.lng},${p.lat}`).join(";");
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`, { signal: controller.signal });
    if (!response.ok) throw new Error("Routing unavailable");
    const data = await response.json() as {
      code?: string;
      routes?: { duration: number; geometry: { coordinates: number[][] }; legs: { duration: number; distance: number }[] }[];
    };
    const result = data.routes?.[0];
    if (data.code !== "Ok" || !result || !Number.isFinite(result.duration) || result.duration < 0
      || !Number.isFinite(result.legs?.[0]?.duration) || !Array.isArray(result.geometry?.coordinates)
      || result.geometry.coordinates.length < 2 || result.geometry.coordinates.some((p) => p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) {
      throw new Error("Invalid routing response");
    }
    return {
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

export const planRoutes = action({
  args: { origin: point, destination: point, driveId: v.optional(v.id("drives")) },
  handler: async (ctx, { origin, destination, driveId }): Promise<{
    fast: Coordinate[]; vibe: Coordinate[]; fastMinutes: number; vibeMinutes: number;
    extraMinutes: number; drive: Doc<"drives">; goldenHour: string; goldenHourAt: string; miles: number; estimated: boolean;
  }> => {
    for (const p of [origin, destination]) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) {
        throw new Error("Enter valid latitude and longitude coordinates");
      }
    }
    const drives: Doc<"drives">[] = await ctx.runQuery(api.drives.listDrives, {});
    const candidates = drives.filter((drive) => drive.waypoints.length > 0 && distance(drive.waypoints[0], origin) > 8);
    if (!candidates.length) throw new Error("No scenic drives available. Seed the drive catalog first.");
    const drive = drives.find((d) => d._id === driveId) ?? candidates.reduce((best, candidate) =>
      segmentDistance(candidate.waypoints[0], origin, destination) < segmentDistance(best.waypoints[0], origin, destination) ? candidate : best);
    const [fast, vibe] = await Promise.all([
      route([origin, destination]),
      route([origin, ...drive.waypoints, destination]),
    ]);
    const today = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(today);
    const part = (type: string) => parts.find((p) => p.type === type)!.value;
    const midday = new Date(`${part("year")}-${part("month")}-${part("day")}T20:00:00Z`);
    const start = drive.waypoints[0];
    const sunset = getTimes(midday, start.lat, start.lng).sunset;
    if (!sunset) throw new Error("Sunset is unavailable for this drive");
    const departure = new Date(sunset.getTime() - (40 + vibe.firstLegMinutes) * 60_000);
    const fastMinutes = Math.round(fast.minutes);
    const vibeMinutes = Math.round(vibe.minutes);
    const extraMinutes = Math.max(0, vibeMinutes - fastMinutes);
    const miles = Math.round(vibe.legKm.slice(1, -1).reduce((total, km) => total + km, 0) * 0.621371 * 10) / 10;
    const golden = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit", hour12: true })
      .format(new Date(sunset.getTime() - 40 * 60_000));
    const goldenHourAt = golden.replace(/\s?([AP])M$/, "$1");
    await ctx.runMutation(internal.drives.saveSplit, {
      driveId: drive._id, fast: simplify(fast.coordinates, 60), vibe: simplify(vibe.coordinates, 60), extraMinutes, miles, goldenHourAt,
    });
    return {
      goldenHourAt, miles,
      fast: fast.coordinates, vibe: vibe.coordinates, fastMinutes, vibeMinutes,
      extraMinutes, drive,
      goldenHour: `Leave at ${new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit", hour12: true }).format(departure).replace(/\s?[AP]M$/, "")} to hit ${drive.name} at golden hour`,
      estimated: fast.estimated || vibe.estimated,
    };
  },
});
