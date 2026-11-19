# Kino Resolver

Resolvedor universal de hosters/embeds para plugins de Kino. Convierte un enlace de reproductor
(voe, streamwish, streamtape, mp4upload, vidoza, uqload, vidmoly, streamvid, fastream, streamhide,
streamlare, supervideo, okru…) en streams reproducibles, y cae al navegador de Kino para los que
requieren JavaScript o Cloudflare. **Sin servidor propio**: todo se resuelve en el aparato.

Otros plugins lo usan por el protocolo de Kino (`kino.plugins.call("resolver","resolve",{url})`).
Los plugins de sitios (como VerPelis) lo piden con un botón la primera vez.

## Instalar

En Kino, Plugins ▸ Agregar plugin:

```
xuper-plugin/kino-plugin-kino-resolver
```
