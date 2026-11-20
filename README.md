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

## Para desarrolladores

¿Quieres usar el resolver en tu plugin? Empieza por la documentación:

- 📚 **Documentación (GitHub Pages):** <https://xuper-plugin.github.io/kino-plugin-kino-resolver/>
  — guía rápida (lo mínimo), catálogo de los 20 resolvers, ejemplos reales y un prompt de IA.
- 🚀 **Plugin de ejemplo mínimo:** [`example-plugin/`](example-plugin/) — un consumer completo, dos archivos.
- 🤖 **Prompt de IA:** [`docs/ai-prompt.md`](docs/ai-prompt.md) — pégalo en tu asistente para que escriba el plugin por ti.
- 🔧 **Playbook de migración (detalle fino):** [`CONSUMER-PLAYBOOK.md`](CONSUMER-PLAYBOOK.md).

Lo usan hoy en producción: **Latino, animes-es, SeriesKao, SoloLatino, HDFull**.

> La documentación es [Docsify](https://docsify.js.org/) sirviéndose de la carpeta `docs/` — sin paso de
> build. Para publicarla: en GitHub, **Settings ▸ Pages ▸ Source: `main` / carpeta `/docs`**.
