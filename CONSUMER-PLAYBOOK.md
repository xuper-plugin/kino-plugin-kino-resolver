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

## 9. Keeping the resolver present + current (the dependency)

A consumer needs the resolver **installed** and **recent enough**. What Kino does and does NOT give us
(verified 2026-11-20), and the defense-in-depth that follows:

**Kino's limits (so you don't design around things that aren't there):**
- `consumes` has **no minVersion** (`ProtocolUse` = alias/repo/door/calls/streams only).
- The screen's `ctx.installed[repo]` is a **boolean** (keyed by `recommends`), it does **not** carry the version.
- `go.installPlugin` works **only on the plugin's own screen**, and does **nothing** if the plugin is already
  installed (it never updates — just a toast).
- A `settingsAction` can only show a message (≤300 chars) + clear keys — **no `go`, no install, no open-screen**.
- A playback error's `userMessage` is shown only for the five typed codes **and only if it does not spell
  "kino"** anywhere (`PluginErrors.safeShape` → `kinoSkeleton`); otherwise Kino shows its own generic line.
- Kino does **not** install a plugin's `recommends`/`consumes` when the consumer is installed/updated, and has
  **no "update the dependency with the plugin"** hook.

**"Not installed" — three surfaces, defense in depth:**
1. **Screen gate** (§4): `screen(ctx)` → install button + donate. One-tap, but only for someone who opens the
   screen.
2. **Resolve message** (Latino 2.5.3, HDFull 0.5.10): on `provider_missing`, `resolve()` throws a **shown**
   `userMessage` routing the person to the screen (where the gate is) — this covers playing from Home / search
   / a TMDB panel, which never opens the screen. **Word it WITHOUT the engine's brand name** ("el motor de
   reproducción", not "Kino Resolver"), or Kino drops it. HDFull tags the error (`e.resolverMissing`) so its
   resolve loop stops at the first copy; Latino (which has a WebView-capture fallback) shows it only when even
   capture opened nothing AND `resolverInstalled(kino)` is false.
3. **Settings**: it can't install, so at most a conditional `status` line (via `settingsStatus()` + apiVersion
   13 `hide`) pointing to the screen. A plugin with `settingsIn: "screen"` (Latino) already routes settings →
   screen → gate, so a separate status is redundant there.

**"Too old" — self-heals, don't over-engineer:** you can't cleanly detect it (no version in `installed`, no
minVersion). But Kino **auto-updates installed plugins on app open** (`PluginAutoUpdate`): Kino-signed always;
community silently when the update adds no permissions/hosts — the resolver's `fetchHosts: "any"` means its
updates add no hosts, so it qualifies. Keep the door's contract stable so an old resolver *degrades* (fewer
hosters) rather than breaks, and auto-update carries it forward.

**Root fix (best, and it answers "update the dependency too"):** make the resolver a **default plugin**. Add it
to **`default-plugins.json`** (schema 1, public repo `kinotvapp/kino-plugins`, read from raw.githubusercontent +
jsDelivr, cached 12 h): Kino then **auto-installs it for everyone and auto-updates it**, independent of any
consumer — so the dependency is always present and current, and the three surfaces above become a safety net.
Entry: `{ "id": "kino-resolver", "repo": "xuper-plugin/kino-plugin-kino-resolver", "required": false }`
(`required: true` would also hide Desinstalar). It's a **data** change, not a Kino-app change. Owner decision
(it ships the engine to every device).
