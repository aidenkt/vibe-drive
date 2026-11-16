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
  }).index("by_upvotes", ["upvotes"]).index("by_name", ["name"]),
});
