# Catálogo de resolvers

Los **20 extractores en línea** que trae **Kino Resolver 0.0.16**. "En línea" = se resuelven con un
`fetch` en segundo plano, sin abrir el navegador oculto → son **rápidos (tier 0)**. Agregar un hoster =
agregar `src/extractors/<id>.js` y registrarlo en `src/registry.js`.

> El `server` de cada fila es el **id** que verás en `stream.server`. La columna **Dominios / familia** es el
> patrón `match` real del extractor (mirrors incluidos). Todos resuelven **en línea**; cuando un host sirve un
> **loader con reto JS** en vez del reproductor, el extractor devuelve `needs_browser` y tu plugin captura
> (ver [la guía](README.md#fallback-para-hosts-con-reto-js-needs_browser)).

| # | `server` | Dominios / familia (patrón `match`) | Tipo de salida |
|---|---|---|---|
| 1 | `voe` | voe.sx + mirrors rotativos (voe-unblock, edwardarriveoften, nathanfromsubject, reputationsheriff, cloudwindow-route…) | hls / mp4 |
| 2 | `streamwish` | **familia streamwish/vidhide**: streamwish·strwish·embedwish·wishfast·flaswish·obeywish·cdnwish·playerwish·hlswish·streamhg·cybervynx·vibuxer + **vidhide·filelions·lionsflix·kravaxxa·dintezuvio·minochinos·morencius**… | hls *(gate → `needs_browser` si hay loader JS)* |
| 3 | `streamtape` | streamtape·strtape·strcloud·stape·tapewithadblock·streamadblock·watchadsontape·shavetape | mp4 |
| 4 | `mp4upload` | mp4upload | mp4 |
| 5 | `vidoza` | vidoza·videzz | mp4 |
| 6 | `uqload` | uqload | mp4 / hls |
| 7 | `vidmoly` | vidmoly (.biz/.me) — conserva `/embed-<code>.html`, CDN vmpx.online | hls |
| 8 | `streamvid` | streamvid·vidstreamz | hls / mp4 |
| 9 | `fastream` | fastream | hls |
| 10 | `streamhide` | streamhide·playhide·guccihide·moviesm4u·louishide·ahvsh·movhide | hls / mp4 |
| 11 | `streamlare` | streamlare·slmaxed·slwatch·sltube·streamlure | hls / mp4 |
| 12 | `supervideo` | supervideo | hls / mp4 |
| 13 | `okru` | ok.ru·okru.link·odnoklassniki | mp4 (varias calidades) |
| 14 | `zures` | **familia vimeos** (Balandro "zures"): vimeos.net·.zip·.to·.sx·.cc·.xyz·.lol·.art·.fun | hls / mp4 |
| 15 | `goodstream` | goodstream (goodstream.one) | hls |
| 16 | `nupload` | nupload.me·nupload.my | hls / mp4 |
| 17 | `mixdrop` | mixdrop + mirrors ofuscados (m1xdrop·mxdrop·mixdrp·mixdropjmk·md3b0j6hj·mdbekjwqa…) | hls / mp4 |
| 18 | `wolfstream` | wolfstream·aparat.cam | hls / mp4 |
| 19 | `lulustream` | lulustream·luluvdo·luluvid·lulucdn·hrnyvid·xxvideoss | hls / mp4 *(packed)* |
| 20 | `gamovideo` | gamovideo | hls / mp4 |

## Lo que caes a captura (no están en la lista)

La puerta es *inline-only*. Estos **no** los extrae y vuelven `needs_browser` → los captura **tu** plugin con
`kino.browser.capture`:

- **Hosts con reto JS / Cloudflare:** filemoon, doodstream, el loader de streamwish.to, vidhide cuando sirve
  el gate.
- **Cualquier host desconocido** (no hay extractor que haga `match`).
- **Hosts caídos** vuelven `dead` (no `needs_browser`): no gastes una captura en ellos.

## Notas de comportamiento

- **Inyección de headers:** cada stream en línea sale con un **User-Agent de navegador** (el mismo con que se
  bajó la página) y un **Referer** por defecto a la página del hoster. Esto arregla el "resuelve pero
  reproduce lento / se corta" (throttle/403 del CDN). Respeta `stream.referer` y `stream.headers` al
  reproducir.
- **`kind`** es `"hls"` o `"mp4"`. Mapea a MIME: `hls → application/x-mpegURL`, `mp4 → video/mp4`.
- **Subtítulos:** algunos hosters (streamwish, fastream, goodstream…) traen pistas → `res.subtitles`. Pásalas
  tal cual.
- **Deofuscación:** el motor desempaqueta P.A.C.K.E.R y variantes; puedes llamar `unpack({ code })` directo si
  solo necesitas desempaquetar.

> ¿Falta tu hoster? Es ~un archivo (`src/extractors/<id>.js` con `{ id, match, resolve }`) + registrarlo.
> Abre un issue o PR en el [repo](https://github.com/xuper-plugin/kino-plugin-kino-resolver). El
> [CONSUMER-PLAYBOOK §7](https://github.com/xuper-plugin/kino-plugin-kino-resolver/blob/main/CONSUMER-PLAYBOOK.md)
> explica cómo validar un extractor contra la web real.
