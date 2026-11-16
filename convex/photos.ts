import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";

type Photo = { label: string; url: string | null; author: string; license: string; source: string };
const headers = { "User-Agent": "ScenicRoute/1.0 (hackathon app)" };
const strip = (html?: string) => (html ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

async function findPhoto(label: string, lat: number, lng: number, wiki?: string): Promise<Photo> {
  try {
    const page = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent((wiki ?? label).replace(/ /g, "_"))}`, { headers });
    if (page.ok) {
      const data = await page.json() as { type?: string; thumbnail?: { source: string; width: number; height: number }; content_urls?: { desktop?: { page?: string } } };
      if (data.type !== "disambiguation" && data.thumbnail && data.thumbnail.width >= data.thumbnail.height) {
        return { label, url: data.thumbnail.source, author: "Wikipedia", license: "See source", source: data.content_urls?.desktop?.page ?? "" };
      }
    }
  } catch {}
  try {
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=geosearch&ggscoord=${lat}%7C${lng}&ggsradius=1000&ggsnamespace=6&ggslimit=8&prop=imageinfo&iiprop=url%7Csize%7Cextmetadata&iiurlwidth=600`, { headers });
    const text = await response.text();
    if (!response.ok) throw new Error(`commons ${response.status} ${text.slice(0, 120)}`);
    const data = JSON.parse(text) as { query?: { pages?: Record<string, { index?: number; title?: string; imageinfo?: { thumburl?: string; url: string; width: number; height: number; descriptionurl: string; extmetadata?: Record<string, { value?: string }> }[] }> } };
    const pages = Object.values(data.query?.pages ?? {});
    if (!pages.length) throw new Error(`no pages ${text.slice(0, 150)}`);
    pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (!info || info.width <= info.height || !/\.jpe?g$/i.test(p.title ?? "")) continue;
      return { label, url: info.thumburl ?? info.url, author: strip(info.extmetadata?.Artist?.value) || "Wikimedia Commons", license: strip(info.extmetadata?.LicenseShortName?.value) || "See source", source: info.descriptionurl };
    }
  } catch (e) { return { label, url: null, author: "", license: String(e).slice(0, 200), source: "" }; }
  return { label, url: null, author: "", license: "none", source: "" };
}

export const byLabels = query({
  args: { labels: v.array(v.string()) },
  handler: async (ctx, { labels }) => {
    const found = await Promise.all(labels.map((label) => ctx.db.query("momentPhotos").withIndex("by_label", (q) => q.eq("label", label)).first()));
    return found.filter((p) => p !== null && p.url !== null);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query("momentPhotos").collect()).filter((p) => p.url !== null),
});

export const save = internalMutation({
  args: { label: v.string(), url: v.union(v.string(), v.null()), author: v.string(), license: v.string(), source: v.string() },
  handler: async (ctx, photo) => {
    const existing = await ctx.db.query("momentPhotos").withIndex("by_label", (q) => q.eq("label", photo.label)).first();
    if (!existing) await ctx.db.insert("momentPhotos", photo);
    else if (existing.url === null) await ctx.db.replace("momentPhotos", existing._id, photo);
  },
});

async function fetchAndSave(ctx: { runQuery: any; runMutation: any }, label: string, lat: number, lng: number, wiki?: string) {
  const existing = await ctx.runQuery(internal.photos.cachedInternal, { label });
  if (existing?.url) return existing;
  const photo = await findPhoto(label, lat, lng, wiki);
  await ctx.runMutation(internal.photos.save, photo);
  return photo;
}

export const cachedInternal = internalQuery({
  args: { label: v.string() },
  handler: async (ctx, { label }) => await ctx.db.query("momentPhotos").withIndex("by_label", (q) => q.eq("label", label)).first(),
});

export const momentPhoto = action({
  args: { label: v.string(), lat: v.number(), lng: v.number(), wiki: v.optional(v.string()) },
  handler: async (ctx, { label, lat, lng, wiki }): Promise<Photo> => {
    const p = await fetchAndSave(ctx, label, lat, lng, wiki);
    return { label: p.label, url: p.url, author: p.author, license: p.license, source: p.source };
  },
});

export const prefetch = internalAction({
  args: { moments: v.array(v.object({ label: v.string(), lat: v.number(), lng: v.number(), wiki: v.optional(v.string()) })) },
  handler: async (ctx, { moments }) => {
    await Promise.all(moments.map((m) => fetchAndSave(ctx, m.label, m.lat, m.lng, m.wiki)));
  },
});
