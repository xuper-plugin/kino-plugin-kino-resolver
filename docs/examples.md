# Plugins que ya usan el resolver

Estos plugins en producción ya delegan la extracción en **kino-resolver**. Son la mejor referencia real:
mira su `consumes` en el manifiesto y su *seam* de `resolve`. (Datos verificados el 2026-11-20.)

| Plugin | Versión | `apiVersion` | `calls` que usa | Captura de respaldo | Notas |
|---|---|---|---|---|---|
| **Latino** | 2.5.5 | 20 | `resolve`, `normalizeHost` | ✅ sí (`browser:true`) | El consumer de referencia. Ranking por tiers, mensaje "falta el motor" al reproducir. |
| **animes-es** | 1.6.1 | 20 | `resolve` | según host | Anime; llama `resolve({ url: embedUrl })`. |
| **SeriesKao** | 0.2.4 | 20 | `resolve` | ✅ sí (`browser:true`) | Series; `resolve({ url, referer })` + captura de respaldo. Plantilla ideal de lo mínimo. |
| **SoloLatino** | 0.2.1 | 20 | `resolve` | ✅ sí (`browser:true`) | `resolve({ url: server.url, referer: SITE + "/" })`. |
| **HDFull** | 0.5.10 | 20 | `resolve` | ✅ sí (`browser:true`) | Su migración destapó 2 bugs del resolver (vidmoly `/embed-`, headers `Header[]`) → por eso un 2º consumer vale oro. Play-ahead instantáneo en su variante inline (0.5.8). |

## El patrón común (idéntico en los cinco)

**1. Manifiesto** — declara la dependencia por dirección de repo:

```json
{
  "apiVersion": 20,
  "browser": true,
  "fetchHosts": "any",
  "streamHosts": "any",
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

**2. Seam de reproducción** — el extracto real de **SeriesKao** (`src/plugin.js`), que puedes copiar casi tal
cual:

```js
// El kino-resolver compartido hace la extracción (su puerta provider); la captura es el respaldo
// para hosts con reto JS (filemoon, doodstream) y para cuando el resolver no está instalado.
try {
  const res = await kino.plugins.call("resolver", "resolve", { url: server.url, referer: site() + "/" });
  const s = (res && Array.isArray(res.streams) ? res.streams : []).find((x) => x && x.url);
  if (s) {
    const headers = {};
    if (s.referer) headers.Referer = s.referer;
    if (Array.isArray(s.headers)) { for (const h of s.headers) if (h && h.name) headers[h.name] = String(h.value); }
    const out = { url: s.url, mime: s.kind === "hls" ? HLS : (/\.mp4(\?|$)/i.test(s.url) ? "video/mp4" : HLS), headers };
    if (res.subtitles && res.subtitles.length) out.subtitles = res.subtitles;
    return out;
  }
  if (res && res.error === "dead") return null; // un host muerto: no gastes una captura en él
} catch (_) { /* provider_missing / falló: el navegador oculto todavía puede alcanzarlo */ }

// Respaldo: captura con el navegador oculto (solo este plugin puede)
if (!kino.browser || typeof kino.browser.capture !== "function" || budget.captures <= 0) return null;
budget.captures -= 1;
const page = await kino.browser.capture(server.url, { timeoutMs: CAPTURE_MS, match: "\\.m3u8|\\.mp4", headers: { Referer: site() + "/" } });
const media = (page && page.media) || [];
const best = media.find((x) => /m3u8/i.test(x.url)) || media[0];
if (!best) return null;
return { captured: true, url: best.url, mime: best.mime || (/\.mp4/i.test(best.url) ? "video/mp4" : HLS), headers: best.headers || { Referer: server.url } };
```

## Diferencias que vale copiar

- **Latino** usa también `normalizeHost` para nombrar/rankear el servidor **antes** de resolver, y mantiene un
  `SERVER_TIER` (inline = tier 0, gate = tier 2) para probar primero lo rápido.
- **HDFull** etiqueta el error (`e.resolverMissing`) para cortar su bucle de resolución en la primera copia y
  mostrar una sola vez el aviso de "falta el motor".
- **Un presupuesto de capturas** (`budget.captures`) evita abrir el WebView una vez por cada copia — caro.

> El detalle completo de cada migración (ranking, play-ahead, loop de depuración) está en el
> **[CONSUMER-PLAYBOOK.md](https://github.com/xuper-plugin/kino-plugin-kino-resolver/blob/main/CONSUMER-PLAYBOOK.md)**.
> Para arrancar de cero, mira el **[plugin de ejemplo mínimo](example-plugin.md)**.
