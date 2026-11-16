import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const point = v.object({ lat: v.number(), lng: v.number() });

export default defineSchema({
  drives: defineTable({
    name: v.string(),
    region: v.string(),
    blurb: v.string(),
    bestTime: v.union(v.literal("sunset"), v.literal("night"), v.literal("any")),
    waypoints: v.array(point),
    color: v.string(),
    upvotes: v.number(),
    vibes: v.optional(v.array(v.object({ label: v.string(), points: v.number(), icon: v.string() }))),
    elevationSpan: v.optional(v.number()),
  }).index("by_upvotes", ["upvotes"]).index("by_name", ["name"]),
  driven: defineTable({
    driveId: v.id("drives"),
    handle: v.string(),
    drivenAt: v.number(),
  }).index("by_handle_and_driveId", ["handle", "driveId"]),
  routeSplits: defineTable({
    driveId: v.id("drives"),
    fast: v.array(v.array(v.number())),
    vibe: v.array(v.array(v.number())),
    extraMinutes: v.number(),
    miles: v.number(),
    goldenHourAt: v.string(),
    vibeScore: v.optional(v.number()),
  }).index("by_driveId", ["driveId"]),
});
