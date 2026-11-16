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

const catalog = [
  {
    name: "Torrey Pines to Del Mar", region: "San Diego coast",
    blurb: "Salt air, sandstone cliffs, and the Pacific beside you on historic Highway 101.",
    bestTime: "sunset" as const, color: "#FF976B",
    waypoints: [{ lat: 32.9252, lng: -117.2583 }, { lat: 32.9367, lng: -117.2606 }, { lat: 32.9483, lng: -117.2632 }, { lat: 32.9585, lng: -117.2654 }],
  },
  {
    name: "Dana Point to Crystal Cove", region: "Orange County",
    blurb: "Follow PCH from Dana Point through Laguna's coves to the open coastline of Crystal Cove.",
    bestTime: "sunset" as const, color: "#EAAF69",
    waypoints: [{ lat: 33.4661, lng: -117.6995 }, { lat: 33.4873, lng: -117.7284 }, { lat: 33.5152, lng: -117.7574 }, { lat: 33.5425, lng: -117.7836 }, { lat: 33.5684, lng: -117.8232 }, { lat: 33.5861, lng: -117.8457 }],
  },
  {
    name: "Cuyamaca to Julian", region: "San Diego mountains",
    blurb: "Take SR-79 through oak woods, mountain bends, and Lake Cuyamaca to Julian.",
    bestTime: "any" as const, color: "#97AF7B",
    waypoints: [{ lat: 32.8305, lng: -116.6175 }, { lat: 32.8883, lng: -116.5726 }, { lat: 32.9606, lng: -116.5786 }, { lat: 32.9863, lng: -116.5702 }, { lat: 33.0485, lng: -116.5997 }, { lat: 33.0785, lng: -116.6019 }],
  },
  {
    name: "Rancho Santa Fe Backroads", region: "North County San Diego",
    blurb: "Slow down among eucalyptus groves and rolling ranch country on Paseo Delicias and Del Dios Highway.",
    bestTime: "any" as const, color: "#C0B38A",
    waypoints: [{ lat: 32.9972, lng: -117.2302 }, { lat: 33.0203, lng: -117.2027 }, { lat: 33.0357, lng: -117.1841 }, { lat: 33.0572, lng: -117.1483 }, { lat: 33.0749, lng: -117.1198 }],
  },
  {
    name: "San Diego Harbor Nights", region: "San Diego waterfront",
    blurb: "Cruise public Harbor Drive from the naval waterfront to downtown's skyline and North Harbor Drive.",
    bestTime: "night" as const, color: "#A59BD4",
    waypoints: [{ lat: 32.6872, lng: -117.1244 }, { lat: 32.7022, lng: -117.1454 }, { lat: 32.7081, lng: -117.1601 }, { lat: 32.7137, lng: -117.1731 }, { lat: 32.7252, lng: -117.1817 }, { lat: 32.7325, lng: -117.1932 }],
  },
  {
    name: "Topanga Canyon to the Pacific", region: "Los Angeles coast",
    blurb: "Wind down Topanga Canyon Boulevard, then follow PCH west with the ocean at your side.",
    bestTime: "sunset" as const, color: "#E48D9D",
    waypoints: [{ lat: 34.1033, lng: -118.5984 }, { lat: 34.0895, lng: -118.6043 }, { lat: 34.0654, lng: -118.5861 }, { lat: 34.0395, lng: -118.5784 }, { lat: 34.0325, lng: -118.5994 }, { lat: 34.0362, lng: -118.6339 }],
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
      }
    }
    return { inserted };
  },
});
