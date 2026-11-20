# Migrating a plugin to consume kino-resolver — playbook

How to make a content plugin (movies/series) stop carrying its own hoster extractors and delegate to the
shared **kino-resolver** instead. Done for **Latino** (2.5.x) and **HDFull** (0.5.7). Benefits: one
engine, the header/ranking/fast-cut fixes, new hosters for free, far less code, and a 2nd consumer that
validates the resolver — HDFull's migration alone surfaced two resolver bugs (see §7).

**The door's stream `headers` is a `Header[]` (`[{name,value}]`), never a plain object.** The engine
normalizes every stream to that and injects the UA, so an extractor may return either shape; but a consumer
translating the door's output reads `s.headers` as an array (`for (const h of s.headers) out[h.name]=h.value`).
A stream that reaches the door with object headers is rejected to the caller as **`bad_output`**.

## 1. The seam — the only real change

Replace each per-host `extract(embedUrl)` with the resolver's **provider door**:

```js
const res = await kino.plugins.call("resolver", "resolve", { url: embedUrl, referer });
// res = { streams: [{ url, kind, server, referer?, headers? }], subtitles?, error? }
```

Then translate the door's stream to your plugin's own stream shape (kind→mime, referer→headers, etc.).

**The door is INLINE-ONLY** (it's a background call; it cannot open the hidden WebView). So:
- A **gate** host (streamwish.to, vidhide, filemoon, doodstream) comes back `error: "needs_browser"`. YOU
  then run `kino.browser.capture(embedUrl, { headers:{Referer}, timeoutMs:18000 })` inside your `resolve`
  (the consumer *can* capture). An unknown host also → `needs_browser`.
- A **DNS-dead** host comes back `error: "dead"` (resolver 0.0.14+) → drop the copy, do **not** capture.

## 2. Keep a tiny classifier (not an extractor)

The resolver returns a `server` id only after resolving; your ranking/labels run *before* that. Keep a small
`serverFromHost(url) -> id` (host→id map + family regex) just for naming + ranking. ~25 lines, no fetching.

## 3. Ranking — inline first

Inline hosters (vimeos/voe/mixdrop/fastream/streamtape/vidoza/uqload/supervideo/...) resolve fast → **tier
0**. JS-**gate** hosters (streamwish, vidhide, filemoon, doodstream) need the slow (~5-18 s) WebView capture
→ **tier 2** (tried last). Dead hosts (waaw) → tier 2. This makes the primary copy fast and skips the slow
ones. (Latino `SERVER_TIER` in src/resolver.js.)

## 4. Manifest

- `apiVersion` → **20** (the plugin protocol / `kino.plugins.call` needs 20). **`consumes` matches the
  provider by REPO ADDRESS**, so the resolver must be installed from `xuper-plugin/kino-plugin-kino-resolver`
  (a tunnel-installed copy has a different address and won't match).
- Add:
  ```json
  "recommends": ["xuper-plugin/kino-plugin-kino-resolver"],
  "consumes": { "resolver": { "repo": "xuper-plugin/kino-plugin-kino-resolver", "door": "resolver", "calls": ["resolve", "normalizeHost"] } }
  ```
- If you bumped apiVersion, **fold any `enhancements` whose key is ≤ the new apiVersion into the base**
  (capabilities + the screen block, etc.) — otherwise validate errors.
- Keep the plugin's own `hosts` (for the capture fallback) + `browser: true` + `streamHosts: "any"`, or use
  `fetchHosts: "any"`.
- **Install gate** (plugins with the `screen` capability): the first screen is `screen(ctx)` and it receives
  `ctx.installed`. If `!ctx.installed["xuper-plugin/kino-plugin-kino-resolver"]`, return an install view with a
  button `onPressed: { go: { installPlugin: { repo } } }`; else the normal screen. (Plugins that use `home()`
  instead of `screen` can't host a go-button in a card, so the gate lives in their `screen`.) **Owner rule:
  ALWAYS put the author's donate affordance right under the install button** — `supportNode(device)`: a
  `QrImage` on TV (a TV can't open a link well), a heart `ElevatedButton` → `go: { url: { href } }` to the
  Ko-fi (`https://ko-fi.com/xuperplugins`) on phone/desktop. (Latino 2.5.2, HDFull 0.5.9.)
- **Play-ahead**: `"resolveAhead": true` in the manifest lets Kino resolve a title ahead while the person
  reads its page (Mode.RESOLVE in PlayAhead.kt) — dwell → the door resolves in the background → Reproducir
  takes the ready-ahead stream with **0 ms wait**. **It is IGNORED (dropped + a kit-validate warning) beside
  `browser` or `catalogOnly`** — a resolve-ahead is a background call that can't open a hidden page. So a
  door-only, inline plugin gets it (**HDFull 0.5.8**, verified instant play); a plugin that captures gate
  hosts (**Latino**, `browser:true`) cannot, and declaring it there is pointless. Without it the log reads
  `play ahead … (not_declared)` — harmless, the real play just resolves on press.

## 5. What the resolver gives you (0.0.16)

- ~20 inline extractors: voe, streamwish (+vidhide/filelions family), vimeos/zures, fastream, goodstream,
  nupload, mixdrop, lulustream, wolfstream, streamtape, vidoza, uqload, supervideo, mp4upload, streamlare,
  streamvid, streamhide, vidmoly, okru. Add one = add `src/extractors/<id>.js` + register in registry.js.
- **Header injection** (engine.resolve): every inline stream leaves with a browser User-Agent (the *same*
  `UA` const getText fetches pages with — token-bound URLs like streamtape need the fetch UA == the play UA)
  and a Referer defaulting to the hoster page. Fixes CDN throttle/403 = "resolves but plays slow / cuts".
- **Fast-cut**: a DNS/host-resolution failure → `"dead"` (skip the 18 s capture of a dead domain).

## 6. Debug + test workflow (the enabler)

- Build debug Kino: `./gradlew assembleDebug` → `app/build/outputs/apk/debug/app-debug.apk` (needs 0.9.81+
  for apiVersion 20 — check the APK: `aapt dump badging`). A production device is a release build (no
  `run-as`); replace it with the debug build (back up the prod APK via `adb shell pm path` + `adb pull`).
- Bypass activation: debug `DevGateBypass` reads `files/dev-skip-gate` →
  `adb shell run-as <pkg> touch files/dev-skip-gate` (+ a first-run "connects with third-party services"
  consent → Continuar).
- **THE FAST LOOP** (no UI, no repo, no reinstall): edit → build → byte-exact push + patch the hash:
  ```
  MSYS_NO_PATHCONV=1 adb push plugin.js /data/local/tmp/x.js
  MSYS_NO_PATHCONV=1 adb shell run-as <pkg> cp /data/local/tmp/x.js files/plugins/<id>/plugin.js
  # set installed.json "sha256" = sha256sum plugin.js   (the hash is verified on load: PluginStore.readVerifiedScript)
  MSYS_NO_PATHCONV=1 adb shell run-as <pkg> cp /data/local/tmp/ij.json files/plugins/<id>/installed.json
  adb shell am force-stop <pkg>   # then relaunch
  ```
  Works for the resolver AND the consumer. Verify: `installed.json` damaged=False.
- Trace: temporarily log per resolution in engine.resolve (`[rvtrace] <id> OK/MISS/THREW <embed> => <stream>`),
  grep logcat, **remove before publishing**. The player's "Servidor y calidad" sheet lists the lazy copies —
  selecting one triggers resolveLazy → its embed appears in the trace.

## 7. Validating an extractor against the LIVE web

- From Windows, **Node/curl are CloudFlare-blocked for the SOURCE sites** (lamovie, hdfull, …) but the
  **HOSTER pages are reachable** (vimeos.net, streamwish.to, mixdrop, streamtape).
- So: grab the embed URL from the device `[rvtrace]` → fetch the real hoster page from Node → replicate the
  extraction → compare what the web sends (status, cookie, packed/gate/dead markers) vs what we attach.
- **ALWAYS cross-check Node with curl + public DNS (8.8.8.8)** — Node on Windows has given false DNS failures.
- 2026-11-20 findings: our extractors were all correct. vimeos inline works unchanged; streamwish.to is a JS
  gate (452-byte loader → capture is the only way); **vidhide is DOWN globally** (vidhidefast.com NXDOMAIN —
  filelions/vidhidepro all 301 to it); a streamtape "dead" was a real 404. The "slow/cuts" = gate captures +
  dead hosts, not missing headers.
- **HDFull migration (2026-11-20) found two resolver bugs** — exactly why a 2nd consumer is worth it:
  1. **vidmoly `normalize` stripped `/embed-`** (the alfa-era shape). `vidmoly.biz/<code>.html` now 404s to
     notice.php; only `/embed-<code>.html` serves the player (`sources:[{file:'…m3u8'}]`). Every vidmoly copy
     was resolving to `needs_browser`. Fix: keep the embed path, fix the turnstile-cookie slug (it hardcoded
     `vidmoly.me`), send a vidmoly `Referer`+`Origin` for the vmpx.online CDN, add a broad `.m3u8` fallback.
  2. **The engine injected the UA as a plain OBJECT** when an extractor returned no/object headers, but the
     door's output type is `Header[]` → the consumer got **`bad_output`**. The engine now normalizes every
     stream's headers to `Header[]`. Any extractor with object headers was affected. (resolver 0.0.16)
  Method that nailed both: a temporary `[rvtrace]` in the consumer's `viaResolver` logging
  `embed -> streams=N err=…` (or `THREW <code>`), then fetching the real hoster page from Node (the HOSTER is
  reachable even when the SOURCE site is CF-blocked) to see what it actually serves vs what the extractor did.

## 8. References + rules

- Kodi-addon references to mine for hosters: `/c/dev/alfa-reference` (211 servers, richest), `/c/dev/
  balandro-reference`, `/c/dev/palantir-reference`. Cross-check all three for the best inline logic + newest
  mirrors. See the alfa-family-references memory.
- Commit/push as **xuper-plugin**, no `Co-Authored-By`. Code/commits in English; user-facing text ES + EN.
