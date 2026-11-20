# Plugin de ejemplo mínimo

El plugin más pequeño que usa el resolver. Vive en
**[`example-plugin/`](https://github.com/xuper-plugin/kino-plugin-kino-resolver/tree/main/example-plugin)**
del repo: dos archivos, tres funciones. Cópialo y reemplaza el catálogo de demo por el scraping de tu sitio;
la función `resolve()` la copias casi verbatim.

## `kino-plugin.json`

```json
{
  "id": "resolver-demo",
  "name": "Resolver Demo",
  "version": "0.1.0",
  "apiVersion": 20,
  "entry": "plugin.js",
  "hosts": ["voe.sx", "streamtape.com"],
  "fetchHosts": "any",
  "streamHosts": "any",
  "browser": true,
  "capabilities": ["search", "resolve", "screen"],
  "screen": { "label": "Resolver Demo", "labelEn": "Resolver Demo", "icon": "link", "menuOpens": "screen", "opensFrom": ["menu"] },
  "recommends": ["xuper-plugin/kino-plugin-kino-resolver"],
  "consumes": {
    "resolver": { "repo": "xuper-plugin/kino-plugin-kino-resolver", "door": "resolver", "calls": ["resolve"] }
  }
}
```

Lo que importa: **`apiVersion: 20`**, el bloque **`consumes`** (empareja por dirección de repo), **`browser:
true`** y **`streamHosts: "any"`** (para la captura de respaldo).

## `plugin.js` (completo)

```js
const RESOLVER = "xuper-plugin/kino-plugin-kino-resolver";
const HLS = "application/x-mpegURL";

// Un "catalogo" de demo: titulo -> el embed que normalmente te daria tu sitio.
const CATALOG = [
  { id: "demo-voe", title: "Demo (voe)", embed: "https://voe.sx/e/XXXXXXXX" },
  { id: "demo-streamtape", title: "Demo (streamtape)", embed: "https://streamtape.com/e/XXXXXXXX" },
];

/** search: devuelve cards. Aqui una lista fija; normalmente consultarias tu sitio. */
export async function search(query) {
  return { items: CATALOG.map((c) => ({ id: c.id, ref: c.id, title: c.title, kind: "movie" })) };
}

/** resolve(ref): EL SEAM. Delega en el resolver; cae a captura. Devuelve un stream. */
export async function resolve(ref) {
  const item = CATALOG.find((c) => c.id === String(ref));
  if (!item) throw kino.error("not_found", "unknown ref: " + ref);
  const embed = item.embed;
  const referer = new URL(embed).origin + "/";

  // 1) El resolver compartido (rapido, inline, sin WebView).
  try {
    const res = await kino.plugins.call("resolver", "resolve", { url: embed, referer });
    const s = (res && Array.isArray(res.streams) ? res.streams : []).find((x) => x && x.url);
    if (s) {
      const headers = {};
      if (s.referer) headers.Referer = s.referer;
      if (Array.isArray(s.headers)) for (const h of s.headers) if (h && h.name) headers[h.name] = String(h.value);
      const stream = { url: s.url, mime: s.kind === "hls" ? HLS : (/\.mp4(\?|$)/i.test(s.url) ? "video/mp4" : HLS), headers };
      if (res.subtitles && res.subtitles.length) stream.subtitles = res.subtitles;
      return stream;
    }
    if (res && res.error === "dead") throw kino.error("not_found", "dead host");
    // else needs_browser -> cae a captura.
  } catch (e) {
    if (e && e.code === "not_found") throw e; // provider_missing: intenta capturar igual
  }

  // 2) Respaldo: captura con el navegador oculto (solo este plugin puede abrirlo).
  if (kino.browser && typeof kino.browser.capture === "function") {
    const page = await kino.browser.capture(embed, { timeoutMs: 18000, match: "\\.m3u8|\\.mp4", headers: { Referer: referer } });
    const best = ((page && page.media) || []).find((x) => /m3u8/i.test(x.url)) || (page && page.media && page.media[0]);
    if (best) return { url: best.url, mime: best.mime || HLS, headers: best.headers || { Referer: embed } };
  }
  throw kino.error("not_found", "no server opened");
}

/** screenEvent: obligatorio si declaras la capacidad "screen" (aunque no hagas nada). */
export async function screenEvent(ev) { return {}; }

/** screen(ctx): compuerta de instalacion del resolver. */
export async function screen(ctx) {
  if (!(ctx && ctx.installed && ctx.installed[RESOLVER])) {
    return { title: "Resolver Demo", body: [
      { text: { value: "Instala el motor de reproduccion para ver este contenido." } },
      { button: { label: "Instalar el motor", onPressed: { go: { installPlugin: { repo: RESOLVER } } } } },
    ] };
  }
  return { title: "Resolver Demo", body: CATALOG.map((c) => ({ button: { label: c.title, onPressed: { go: { play: { ref: c.id } } } } })) };
}
```

## Qué pasa cuando corre

1. La persona abre la pantalla → `screen()`. Si el resolver no está, ve un botón que lo instala de un toque.
2. Busca o abre un título → Kino llama `resolve(ref)`.
3. `resolve` le pide al resolver que extraiga el embed. Si es un host en línea (voe, streamtape…), vuelve con
   el stream **al instante**. Si es un host con reto JS, vuelve `needs_browser` y tu plugin **captura**.
4. Devuelves `{ url, mime, headers }` y Kino reproduce.

> Para la reproducción real, cambia los `embed` del `CATALOG` por URLs que saques de tu sitio. Para el loop
> de "editar → push byte-exacto → probar" sin reinstalar, ver
> **[CONSUMER-PLAYBOOK §6](https://github.com/xuper-plugin/kino-plugin-kino-resolver/blob/main/CONSUMER-PLAYBOOK.md)**.
