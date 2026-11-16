import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

export const listDrives = query({
  args: {},
  handler: async (ctx) => ctx.db.query("drives").withIndex("by_upvotes").order("desc").take(100),
});

export const upvote = mutation({
  args: { driveId: v.id("drives") },
  handler: async (ctx, { driveId }) => {
    const drive = await ctx.db.get("drives", driveId);
    if (!drive) throw new Error("Drive not found");
    await ctx.db.patch("drives", driveId, { upvotes: drive.upvotes + 1 });
    return drive.upvotes + 1;
  },
});

export const markDriven = mutation({
  args: { driveId: v.id("drives"), handle: v.string() },
  handler: async (ctx, { driveId, handle }) => {
    if (!(await ctx.db.get("drives", driveId))) throw new Error("Drive not found");
    const existing = await ctx.db.query("driven")
      .withIndex("by_handle_and_driveId", (q) => q.eq("handle", handle).eq("driveId", driveId)).unique();
    if (existing) return existing;
    const id = await ctx.db.insert("driven", { driveId, handle, drivenAt: Date.now() });
    return (await ctx.db.get("driven", id))!;
  },
});

export const listDriven = query({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) =>
    ctx.db.query("driven").withIndex("by_handle_and_driveId", (q) => q.eq("handle", handle)).take(100),
});

export const listSplits = query({
  args: {},
  handler: async (ctx) => ctx.db.query("routeSplits").take(100),
});

export const saveSplit = internalMutation({
  args: {
    driveId: v.id("drives"),
    fast: v.array(v.array(v.number())),
    vibe: v.array(v.array(v.number())),
    extraMinutes: v.number(),
    miles: v.number(),
    goldenHourAt: v.string(),
    vibeScore: v.optional(v.number()),
  },
  handler: async (ctx, split) => {
    const existing = await ctx.db.query("routeSplits").withIndex("by_driveId", (q) => q.eq("driveId", split.driveId)).unique();
    if (existing) await ctx.db.replace("routeSplits", existing._id, split);
    else await ctx.db.insert("routeSplits", split);
    return null;
  },
});

const catalog = [
  {
    name: "Torrey Pines to Del Mar", elevationSpan: 100, vibes: [{ points: 4, label: "Ocean the whole way", icon: "water.waves" }, { points: 3, label: "Sandstone cliffs", icon: "mountain.2" }, { points: 2, label: "Torrey pines (rarest pine in the US)", icon: "tree" }, { points: 1, label: "Beach parking pull-offs", icon: "parkingsign" }], region: "San Diego coast",
    blurb: "Salt air, sandstone cliffs, and the Pacific beside you on historic Highway 101.",
    bestTime: "sunset" as const, color: "#FF976B",
    waypoints: [{ lat: 32.9252, lng: -117.2583 }, { lat: 32.9367, lng: -117.2606 }, { lat: 32.9483, lng: -117.2632 }, { lat: 32.9585, lng: -117.2654 }],
  },
  {
    name: "Dana Point to Crystal Cove", elevationSpan: 60, vibes: [{ points: 4, label: "Pacific beside you on PCH", icon: "water.waves" }, { points: 3, label: "Laguna's coves and tide pools", icon: "binoculars" }, { points: 2, label: "Crystal Cove's open coastline", icon: "sun.horizon" }, { points: 1, label: "Beach towns to stop in", icon: "cup.and.saucer" }], region: "Orange County",
    blurb: "Follow PCH from Dana Point through Laguna's coves to the open coastline of Crystal Cove.",
    bestTime: "sunset" as const, color: "#EAAF69",
    waypoints: [{ lat: 33.4661, lng: -117.6995 }, { lat: 33.4873, lng: -117.7284 }, { lat: 33.5152, lng: -117.7574 }, { lat: 33.5425, lng: -117.7836 }, { lat: 33.5684, lng: -117.8232 }, { lat: 33.5861, lng: -117.8457 }],
  },
  {
    name: "Cuyamaca to Julian", elevationSpan: 400, vibes: [{ points: 3, label: "Oak and pine forest", icon: "tree" }, { points: 3, label: "Mountain bends on SR-79", icon: "road.lanes.curved.right" }, { points: 2, label: "Lake Cuyamaca", icon: "drop" }, { points: 2, label: "Apple pie in Julian", icon: "fork.knife" }], region: "San Diego mountains",
    blurb: "Take SR-79 through oak woods, mountain bends, and Lake Cuyamaca to Julian.",
    bestTime: "any" as const, color: "#97AF7B",
    waypoints: [{ lat: 32.8305, lng: -116.6175 }, { lat: 32.8883, lng: -116.5726 }, { lat: 32.9606, lng: -116.5786 }, { lat: 32.9863, lng: -116.5702 }, { lat: 33.0485, lng: -116.5997 }, { lat: 33.0785, lng: -116.6019 }],
  },
  {
    name: "Rancho Santa Fe Backroads", elevationSpan: 120, vibes: [{ points: 3, label: "Eucalyptus groves", icon: "tree" }, { points: 2, label: "Rolling ranch country", icon: "leaf" }, { points: 2, label: "Lake Hodges on Del Dios Hwy", icon: "drop" }, { points: 1, label: "Barely any traffic", icon: "car" }], region: "North County San Diego",
    blurb: "Slow down among eucalyptus groves and rolling ranch country on Paseo Delicias and Del Dios Highway.",
    bestTime: "any" as const, color: "#C0B38A",
    waypoints: [{ lat: 32.9972, lng: -117.2302 }, { lat: 33.0203, lng: -117.2027 }, { lat: 33.0357, lng: -117.1841 }, { lat: 33.0572, lng: -117.1483 }, { lat: 33.0749, lng: -117.1198 }],
  },
  {
    name: "San Diego Harbor Nights", elevationSpan: 10, vibes: [{ points: 3, label: "Skyline on the water", icon: "building.2" }, { points: 2, label: "Coronado Bridge lights", icon: "sparkles" }, { points: 2, label: "Waterfront the whole way", icon: "water.waves" }, { points: 1, label: "Ships at the naval piers", icon: "ferry" }], region: "San Diego waterfront",
    blurb: "Cruise public Harbor Drive from the naval waterfront to downtown's skyline and North Harbor Drive.",
    bestTime: "night" as const, color: "#A59BD4",
    waypoints: [{ lat: 32.6872, lng: -117.1244 }, { lat: 32.7022, lng: -117.1454 }, { lat: 32.7081, lng: -117.1601 }, { lat: 32.7137, lng: -117.1731 }, { lat: 32.7252, lng: -117.1817 }, { lat: 32.7325, lng: -117.1932 }],
  },
  {
    name: "Topanga Canyon to the Pacific", elevationSpan: 450, vibes: [{ points: 4, label: "Canyon walls and switchbacks", icon: "road.lanes.curved.right" }, { points: 3, label: "Drop straight onto PCH", icon: "water.waves" }, { points: 2, label: "Topanga village", icon: "house" }, { points: 1, label: "Sunset over Malibu", icon: "sun.horizon" }], region: "Los Angeles coast",
    blurb: "Wind down Topanga Canyon Boulevard, then follow PCH west with the ocean at your side.",
    bestTime: "sunset" as const, color: "#E48D9D",
    waypoints: [{ lat: 34.1033, lng: -118.5984 }, { lat: 34.0895, lng: -118.6043 }, { lat: 34.0654, lng: -118.5861 }, { lat: 34.0395, lng: -118.5784 }, { lat: 34.0325, lng: -118.5994 }, { lat: 34.0362, lng: -118.6339 }],
  },
  {
    name: "Marin Headlands via Conzelman Road", elevationSpan: 280, vibes: [{ points: 4, label: "The bridge with the whole city behind it", icon: "building.2" }, { points: 3, label: "Cliff-edge road", icon: "road.lanes.curved.right" }, { points: 2, label: "Hawk Hill lookout", icon: "binoculars" }, { points: 2, label: "Rodeo Beach at the end", icon: "beach.umbrella" }], region: "San Francisco",
    blurb: "The whole city framed by the bridge, from the edge of a cliff.",
    bestTime: "sunset" as const, color: "#E07A5F",
    waypoints: [{ lat: 37.8078, lng: -122.4752 }, { lat: 37.8324, lng: -122.4807 }, { lat: 37.8297, lng: -122.4831 }, { lat: 37.8256, lng: -122.4993 }, { lat: 37.8320, lng: -122.5390 }],
  },
  {
    name: "Presidio to Baker Beach", elevationSpan: 110, vibes: [{ points: 3, label: "Bridge popping out of the fog", icon: "cloud.fog" }, { points: 3, label: "Cypress forest", icon: "tree" }, { points: 2, label: "Baker Beach", icon: "beach.umbrella" }, { points: 1, label: "Legion of Honor", icon: "building.columns" }], region: "San Francisco",
    blurb: "Cypress, fog and the bridge popping in and out of it.",
    bestTime: "any" as const, color: "#8FA98A",
    waypoints: [{ lat: 37.8039, lng: -122.4646 }, { lat: 37.8001, lng: -122.4770 }, { lat: 37.7936, lng: -122.4836 }, { lat: 37.7845, lng: -122.5008 }, { lat: 37.7785, lng: -122.5136 }],
  },
  {
    name: "Highway 1 to Stinson Beach", elevationSpan: 300, vibes: [{ points: 4, label: "Ocean views", icon: "water.waves" }, { points: 3, label: "Cliffside switchbacks", icon: "road.lanes.curved.right" }, { points: 2, label: "Muir Beach overlook", icon: "binoculars" }, { points: 2, label: "Ends at a beach", icon: "beach.umbrella" }], region: "San Francisco",
    blurb: "Forty switchbacks of cliffside Highway 1, then sand.",
    bestTime: "any" as const, color: "#D9A15B",
    waypoints: [{ lat: 37.8780, lng: -122.5150 }, { lat: 37.8620, lng: -122.5850 }, { lat: 37.8605, lng: -122.5760 }, { lat: 37.9005, lng: -122.6440 }],
  },
  {
    name: "Embarcadero and the Bay Lights", elevationSpan: 10, vibes: [{ points: 4, label: "25,000 LEDs on the Bay Bridge", icon: "sparkles" }, { points: 2, label: "Waterfront the whole way", icon: "water.waves" }, { points: 1, label: "Ferry Building", icon: "building.columns" }], region: "San Francisco",
    blurb: "The Bay Bridge lights doing their thing over the water.",
    bestTime: "night" as const, color: "#8E8BD6",
    waypoints: [{ lat: 37.8080, lng: -122.4177 }, { lat: 37.8087, lng: -122.4098 }, { lat: 37.7955, lng: -122.3937 }, { lat: 37.7890, lng: -122.3880 }, { lat: 37.7786, lng: -122.3893 }],
  },
];

export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    for (const drive of catalog) {
      const existing = await ctx.db.query("drives").withIndex("by_name", (q) => q.eq("name", drive.name)).unique();
      if (!existing) {
        await ctx.db.insert("drives", { ...drive, upvotes: 0 });
        inserted++;
      } else {
        await ctx.db.patch("drives", existing._id, { vibes: drive.vibes, elevationSpan: drive.elevationSpan });
      }
    }
    return { inserted };
  },
});
