# Kino Resolver — documentación para desarrolladores

**Resolvedor universal de hosters/embeds para plugins de [Kino](https://kinotvapp.github.io/kino-plugins/).**
Convierte un enlace de reproductor (voe, streamwish, streamtape, mixdrop, vidmoly, okru…) en **streams
reproducibles**, deofusca JS empaquetado (P.A.C.K.E.R) y normaliza dominios de hoster — **sin servidor
propio, todo en el aparato**. Tu plugin deja de cargar sus propios extractores y delega en este con **una
sola llamada**.

- **Repo / instalación:** `xuper-plugin/kino-plugin-kino-resolver`
- **Versión:** 0.0.16 · **apiVersion:** 20 · **puerta (door):** `resolver`
- **Lo usan hoy:** Latino, animes-es, SeriesKao, SoloLatino, HDFull → [ver cómo](examples.md)

> ¿Vas a migrar un plugin que ya trae sus propios extractores? Esta guía te da **lo mínimo**. Para el
> detalle fino (ranking, play-ahead, loop de depuración, validar un extractor contra la web real) está el
> **[CONSUMER-PLAYBOOK.md](https://github.com/xuper-plugin/kino-plugin-kino-resolver/blob/main/CONSUMER-PLAYBOOK.md)**.

---

## Guía rápida (lo mínimo)

### 1. Instala el resolver (una vez, en el aparato)

En Kino: **Plugins ▸ Agregar plugin** →

```
xuper-plugin/kino-plugin-kino-resolver
```

### 2. Declara la dependencia en tu `kino-plugin.json`

`apiVersion` **20** (lo pide `kino.plugins.call`). El emparejamiento es **por dirección de repo**, así que
el repo debe escribirse exactamente así:

```json
{
  "apiVersion": 20,
  "recommends": ["xuper-plugin/kino-plugin-kino-resolver"],
  "consumes": {
    "resolver": {
      "repo": "xuper-plugin/kino-plugin-kino-resolver",
      "door": "resolver",
      "calls": ["resolve"]
    }
  }
}
```

### 3. Llama a la puerta y reproduce

```js
const res = await kino.plugins.call("resolver", "resolve", { url: embedUrl, referer });
// res = { streams: [{ url, kind, server, referer?, headers? }], subtitles?, error? }

const s = (res?.streams || []).find((x) => x && x.url);
if (s) {
  const headers = {};
  if (s.referer) headers.Referer = s.referer;
  if (Array.isArray(s.headers)) for (const h of s.headers) if (h?.name) headers[h.name] = String(h.value);
  return {
    url: s.url,
    mime: s.kind === "hls" ? "application/x-mpegURL" : "video/mp4",
    headers,
    ...(res.subtitles?.length ? { subtitles: res.subtitles } : {}),
  };
}
```

Eso es **todo** lo necesario para los ~20 hosters que el resolver extrae en línea. Lo demás de abajo es para
casos de borde (hosts con reto JS, host caído, resolver no instalado).

---

## El contrato de la puerta

### Entradas — `kino.plugins.call("resolver", "<call>", <args>)`

| call | argumentos | devuelve |
|---|---|---|
| `resolve` | `{ url: string, referer?: string }` | `StreamSet` |
| `normalizeHost` | `{ url: string }` | `{ server: string, url: string }` |
| `unpack` | `{ code: string }` | `{ code: string }` (deofusca P.A.C.K.E.R) |

### Salida de `resolve` — `StreamSet`

```ts
StreamSet = {
  streams: Stream[];        // vacío si no pudo (mira `error`)
  subtitles?: Subtitle[];   // presente solo si el hoster trae pistas
  error?: string;           // "needs_browser" | "dead" (ausente si hubo streams)
}

Stream = {
  url: string;              // el stream reproducible (m3u8 o mp4)
  kind: string;             // "hls" | "mp4"
  server?: string;          // id del hoster resuelto, p. ej. "voe"
  quality?: string;         // "1080p"… si el hoster lo informa
  lang?: string;
  referer?: string;         // ponlo como header Referer al reproducir
  headers?: Header[];       // SIEMPRE un arreglo [{name,value}], nunca un objeto
}

Header = { name: string, value: string }
```

> **⚠️ `headers` es un `Header[]` (`[{name,value}]`), no un objeto.** El motor inyecta el User-Agent y el
> Referer y normaliza todo a esa forma. Léelo así:
> `for (const h of s.headers) out[h.name] = h.value`. (Un stream con headers-objeto se rechaza como
> `bad_output`.)

### Códigos de `error` que debes manejar

El campo `error` **dentro del `StreamSet`** (la puerta respondió, pero sin stream):

| `error` | Qué significa | Qué hacer |
|---|---|---|
| *(ausente)* + `streams` con datos | Resuelto en línea ✅ | Reproduce el primer stream con `url`. |
| `"needs_browser"` | Host con **reto JS / Cloudflare**, o host **desconocido**. La puerta es *inline-only* y no abre el WebView oculto. | Fallback: **tú** capturas con `kino.browser.capture(...)` (ver abajo). |
| `"dead"` | El dominio **no resuelve / 404** (host muerto). | **No** gastes una captura. Descarta esa copia. |

Y cuando **la llamada `kino.plugins.call` lanza** (error de Kino al enrutar hacia la puerta), el `e.code` es
uno de estos — maneja sobre todo **`provider_missing`**:

| `e.code` | Qué significa | Qué hacer |
|---|---|---|
| `provider_missing` | El resolver **no está instalado**. | Cae a captura; muestra la compuerta de instalar (ver [abajo](#si-el-resolver-no-está-instalado)). |
| `not_declared` | Olvidaste el bloque `consumes` (o el `call` no está en `calls`). | Corrige el manifiesto. |
| `bad_input` | Argumentos mal formados (p. ej. falta `url`). | Revisa lo que mandas. |
| `bad_output` | El stream llegó con `headers` **objeto** en vez de `Header[]`. | Es bug del extractor; repórtalo. |
| `rate_limited` / `timeout` / `provider_failed` | Transitorio del proveedor. | Reintenta o cae a captura. |

---

## Fallback para hosts con reto JS (`needs_browser`)

La puerta resuelve en línea, pero los hosts tipo *gate* (streamwish.to con loader, vidhide, filemoon,
doodstream) y los desconocidos vuelven con `error: "needs_browser"`. Tu plugin — que sí puede abrir el
navegador oculto — captura entonces el stream:

```js
if (res?.error === "dead") return null;               // muerto: ni lo intentes
// needs_browser, o la llamada lanzó: captura tú
if (kino.browser?.capture) {
  const page = await kino.browser.capture(embedUrl, {
    timeoutMs: 18000,
    match: "\\.m3u8|\\.mp4",
    headers: { Referer: referer },
  });
  const best = (page?.media || []).find((m) => /m3u8/i.test(m.url)) || page?.media?.[0];
  if (best) return { url: best.url, mime: best.mime || "application/x-mpegURL", headers: best.headers || { Referer: embedUrl } };
}
return null;
```

Para esto tu manifiesto necesita `"browser": true` y los hosts de captura (o `fetchHosts: "any"` /
`streamHosts: "any"`).

---

## Si el resolver no está instalado

Kino **no** instala solo las dependencias de tu plugin. Defensa en profundidad (cualquiera, no todas):

1. **Compuerta en tu pantalla:** en `screen(ctx)`, si `!ctx.installed["xuper-plugin/kino-plugin-kino-resolver"]`
   muestra un botón de instalar: `onPressed: { go: { installPlugin: { repo: "xuper-plugin/kino-plugin-kino-resolver" } } }`.
   (`installPlugin` solo funciona desde la pantalla propia del plugin.)
2. **Mensaje al reproducir:** si la llamada lanza y la captura tampoco abre nada, lanza un error con
   `userMessage` que mande a la persona a tu pantalla. **No menciones la marca "Kino Resolver"** en ese texto
   (di "el motor de reproducción") o Kino descarta el mensaje.
3. **Lo más robusto:** pídele al dueño que agregue el resolver a **`default-plugins.json`** — Kino lo
   autoinstala y autoactualiza para todos. Es un cambio de datos, no de la app.

> Mantén el *degradado elegante*: con un resolver viejo/ausente, tu plugin ofrece menos hosters, pero no se
> rompe. Kino autoactualiza los plugins instalados al abrir la app.

---

## Siguientes pasos

- 📚 **[Catálogo de resolvers](resolvers.md)** — los 20 hosters que extrae hoy.
- 🧩 **[Plugins que ya lo usan](examples.md)** — Latino, animes-es, SeriesKao, SoloLatino, HDFull.
- 🚀 **[Plugin de ejemplo mínimo](example-plugin.md)** — un consumer completo en ~60 líneas.
- 🤖 **[Prompt de IA para desarrolladores](ai-prompt.md)** — pégalo en tu asistente para que escriba el plugin por ti.
