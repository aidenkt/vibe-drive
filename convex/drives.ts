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


type MomentKind = "water" | "bridge" | "landmark" | "viewpoint" | "forest" | "curves" | "beach" | "city";
type Moment = { label: string; kind: MomentKind; lat: number; lng: number; note: string };
const m = (label: string, kind: MomentKind, lat: number, lng: number, note: string): Moment => ({ label, kind, lat, lng, note });
export const momentsByDrive: Record<string, Moment[]> = {
  "Torrey Pines to Del Mar": [
    m("Torrey Pines Reserve", "forest", 32.9233, -117.2531, "The rarest pine in the US, right above the road"),
    m("Sandstone bluffs", "viewpoint", 32.9300, -117.2590, "Cliffs drop straight into the surf"),
    m("Torrey Pines State Beach", "beach", 32.9330, -117.2600, "Pull into the beach lot"),
    m("Peñasquitos Lagoon", "water", 32.9370, -117.2580, "Lagoon on the right, ocean on the left"),
    m("Del Mar", "city", 32.9595, -117.2653, "Roll into Del Mar village"),
  ],
  "Dana Point to Crystal Cove": [
    m("Dana Point Harbor", "water", 33.4600, -117.6980, "Boats tucked under the headland"),
    m("PCH above the Pacific", "water", 33.5000, -117.7420, "Ocean right beside the road"),
    m("Laguna Main Beach", "beach", 33.5427, -117.7854, "Boardwalk and volleyball nets"),
    m("Heisler Park", "viewpoint", 33.5440, -117.7900, "Clifftop gardens over the coves"),
    m("Crystal Cove", "beach", 33.5750, -117.8400, "Open coastline, no buildings"),
  ],
  "Cuyamaca to Julian": [
    m("Cuyamaca Rancho forest", "forest", 32.8600, -116.5900, "Oaks and pines close in"),
    m("Stonewall Peak", "viewpoint", 32.9600, -116.5800, "Granite peak above the meadow"),
    m("Lake Cuyamaca", "water", 32.9850, -116.5780, "Mountain lake beside the road"),
    m("SR-79 bends", "curves", 33.0200, -116.5850, "Mountain curves heading north"),
    m("Julian", "city", 33.0787, -116.6019, "Apple pie on Main Street"),
  ],
  "Rancho Santa Fe Backroads": [
    m("Eucalyptus tunnel", "forest", 33.0100, -117.2150, "Tall eucalyptus over the road"),
    m("Rancho Santa Fe village", "city", 33.0205, -117.2030, "Tiny village in the groves"),
    m("Del Dios Highway", "curves", 33.0450, -117.1700, "Winding through ranch country"),
    m("Lake Hodges", "water", 33.0600, -117.1300, "Lake opens up below the road"),
  ],
  "San Diego Harbor Nights": [
    m("Coronado Bridge", "bridge", 32.6890, -117.1500, "The bridge arcs overhead"),
    m("Seaport Village", "water", 32.7090, -117.1710, "Skyline on the water"),
    m("USS Midway", "landmark", 32.7137, -117.1751, "Aircraft carrier on the waterfront"),
    m("Harbor Island", "viewpoint", 32.7250, -117.1900, "Downtown lights across the bay"),
  ],
  "Topanga Canyon to the Pacific": [
    m("Topanga village", "city", 34.0930, -118.6020, "Canyon village with the old shops"),
    m("Canyon switchbacks", "curves", 34.0700, -118.5880, "Rock walls on both sides"),
    m("Drop onto PCH", "water", 34.0390, -118.5810, "The canyon opens onto the Pacific"),
    m("Big Rock", "viewpoint", 34.0350, -118.6150, "Coast all the way to Point Dume"),
    m("Las Flores Beach", "beach", 34.0365, -118.6340, "Ends on Malibu sand"),
  ],
  "Marin Headlands via Conzelman Road": [
    m("Golden Gate Bridge", "bridge", 37.8199, -122.4783, "Cross the Golden Gate"),
    m("Battery Spencer", "viewpoint", 37.8297, -122.4831, "The bridge with the whole city behind it"),
    m("Hawk Hill", "viewpoint", 37.8256, -122.4993, "Highest point on Conzelman"),
    m("Conzelman cliff road", "curves", 37.8270, -122.5100, "One-way road on the cliff edge"),
    m("Rodeo Beach", "beach", 37.8320, -122.5390, "Ends at Rodeo Beach"),
  ],
  "Presidio to Baker Beach": [
    m("Palace of Fine Arts", "landmark", 37.8029, -122.4484, "Rotunda over the lagoon"),
    m("Golden Gate in the fog", "bridge", 37.8040, -122.4700, "Bridge popping out of the fog"),
    m("Presidio cypress", "forest", 37.7960, -122.4800, "Cypress forest on both sides"),
    m("Baker Beach", "beach", 37.7936, -122.4836, "Sand right under the bridge"),
    m("Legion of Honor", "landmark", 37.7845, -122.5008, "Columns above Lands End"),
    m("Lands End", "viewpoint", 37.7785, -122.5136, "Cliffs at the edge of the city"),
  ],
  "Highway 1 to Stinson Beach": [
    m("Golden Gate Bridge", "bridge", 37.8199, -122.4783, "Cross the Golden Gate"),
    m("Muir Beach Overlook", "viewpoint", 37.8620, -122.5850, "Pull off: the whole coast"),
    m("Highway 1 switchbacks", "curves", 37.8800, -122.6100, "Cliffside curves above the ocean"),
    m("Ocean the whole way", "water", 37.8900, -122.6300, "Pacific below the guardrail"),
    m("Stinson Beach", "beach", 37.9005, -122.6440, "Ends on the sand"),
  ],
  "Embarcadero and the Bay Lights": [
    m("Fisherman's Wharf", "landmark", 37.8080, -122.4177, "Start at the Wharf"),
    m("Waterfront piers", "water", 37.8060, -122.4030, "The bay the whole way"),
    m("Ferry Building", "landmark", 37.7955, -122.3937, "Clock tower on the water"),
    m("Bay Bridge lights", "bridge", 37.7890, -122.3880, "25,000 LEDs overhead"),
    m("Oracle Park", "city", 37.7786, -122.3893, "Ends at the ballpark"),
  ],
};

export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    for (const drive of catalog) {
      const existing = await ctx.db.query("drives").withIndex("by_name", (q) => q.eq("name", drive.name)).unique();
      if (!existing) {
        await ctx.db.insert("drives", { ...drive, upvotes: 0, moments: momentsByDrive[drive.name] });
        inserted++;
      } else {
        await ctx.db.patch("drives", existing._id, { vibes: drive.vibes, elevationSpan: drive.elevationSpan, moments: momentsByDrive[drive.name] });
      }
    }
    return { inserted };
  },
});
