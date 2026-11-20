// Resolver Demo — the smallest plugin that consumes kino-resolver.
//
// It does three things, and only three:
//   1. search()  -> returns one demo title.
//   2. resolve() -> turns that title's embed URL into a playable stream by DELEGATING to the resolver door,
//                   with a hidden-browser capture as the fallback for JS-gate / unknown hosts.
//   3. screen()  -> an install gate: if the resolver isn't installed, it offers a one-tap install button.
//
// Replace the demo catalog with your own site scraping. The resolve() seam is the part you copy verbatim.
// Code in English; user-facing text ES + EN. See https://kinotvapp.github.io/kino-plugins/ for the plugin API.

const RESOLVER = "xuper-plugin/kino-plugin-kino-resolver";
const HLS = "application/x-mpegURL";

// A tiny demo "catalog": title -> the embed URL your site would normally give you.
// (Swap these for the embeds you scrape. The id/ref is how Kino asks you to resolve a title.)
const CATALOG = [
  { id: "demo-voe", title: "Demo (voe)", embed: "https://voe.sx/e/XXXXXXXX" },
  { id: "demo-streamtape", title: "Demo (streamtape)", embed: "https://streamtape.com/e/XXXXXXXX" },
];

const L = () => (kino.lang === "en" ? EN : ES);
const ES = { needResolver: "Instala el motor de reproduccion para ver este contenido.", install: "Instalar el motor", noStream: "Ningun servidor abrio. Intenta de nuevo mas tarde." };
const EN = { needResolver: "Install the playback engine to watch this content.", install: "Install the engine", noStream: "No server opened. Try again later." };

/** search: return cards. Here, a fixed demo list; normally you'd query your site. */
export async function search(query) {
  const items = CATALOG.map((c) => ({ id: c.id, ref: c.id, title: c.title, kind: "movie" }));
  return { items };
}

/** resolve(ref): THE SEAM. Delegate to the resolver; fall back to a browser capture. Return one stream. */
export async function resolve(ref) {
  const item = CATALOG.find((c) => c.id === String(ref));
  if (!item) throw kino.error("not_found", "unknown ref: " + ref);
  const embed = item.embed;
  const referer = new URL(embed).origin + "/";

  // 1) Ask the shared resolver (fast, inline, no WebView).
  try {
    const res = await kino.plugins.call("resolver", "resolve", { url: embed, referer });
    const s = (res && Array.isArray(res.streams) ? res.streams : []).find((x) => x && x.url);
    if (s) {
      const headers = {};
      if (s.referer) headers.Referer = s.referer;
      // headers is a Header[] = [{name,value}] — never a plain object.
      if (Array.isArray(s.headers)) for (const h of s.headers) if (h && h.name) headers[h.name] = String(h.value);
      const stream = { url: s.url, mime: s.kind === "hls" ? HLS : (/\.mp4(\?|$)/i.test(s.url) ? "video/mp4" : HLS), headers };
      if (res.subtitles && res.subtitles.length) stream.subtitles = res.subtitles;
      return stream;
    }
    if (res && res.error === "dead") throw kino.error("not_found", "dead host", { userMessage: L().noStream });
    // else: error === "needs_browser" (JS-gate / unknown host) -> fall through to capture.
  } catch (e) {
    // A throw here usually means the resolver isn't installed (provider_missing). The hidden browser may
    // still reach the host, so we try to capture before giving up.
    if (e && e.code === "not_found") throw e;
  }

  // 2) Fallback: capture the stream with the hidden browser (only this plugin can open it).
  if (kino.browser && typeof kino.browser.capture === "function") {
    const page = await kino.browser.capture(embed, { timeoutMs: 18000, match: "\\.m3u8|\\.mp4", headers: { Referer: referer } });
    const media = (page && page.media) || [];
    const best = media.find((x) => /m3u8/i.test(x.url)) || media[0];
    if (best) return { url: best.url, mime: best.mime || (/\.mp4/i.test(best.url) ? "video/mp4" : HLS), headers: best.headers || { Referer: embed } };
  }

  throw kino.error("not_found", "no server opened", { userMessage: L().noStream });
}

/** screenEvent: required when the "screen" capability is declared. Our buttons use declarative `go`, so
 *  there's nothing to handle here — but the export must exist or Kino refuses the install. */
export async function screenEvent(ev) {
  return {};
}

/** screen(ctx): the install gate. If the resolver isn't installed, offer a one-tap install button. */
export async function screen(ctx) {
  const installed = ctx && ctx.installed && ctx.installed[RESOLVER];
  if (!installed) {
    return {
      title: "Resolver Demo",
      body: [
        { text: { value: L().needResolver } },
        { button: { label: L().install, onPressed: { go: { installPlugin: { repo: RESOLVER } } } } },
      ],
    };
  }
  // Resolver present: show the demo catalog as a normal screen.
  return {
    title: "Resolver Demo",
    body: CATALOG.map((c) => ({ button: { label: c.title, onPressed: { go: { play: { ref: c.id } } } } })),
  };
}
