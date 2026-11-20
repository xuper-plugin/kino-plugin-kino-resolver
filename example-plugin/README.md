# Resolver Demo — ejemplo mínimo

El plugin más pequeño que consume **kino-resolver**. Dos archivos, tres funciones.

- **`kino-plugin.json`** — declara `apiVersion: 20`, `recommends` + `consumes` (la dependencia por dirección
  de repo), `browser: true` y los permisos `search`, `resolve`, `screen`.
- **`plugin.js`** — `search()` (un título de demo), `resolve()` (el *seam*: delega en el resolver con captura
  de respaldo) y `screen()` (compuerta de instalación).

## Probarlo

1. Instala el resolver en Kino: **Plugins ▸ Agregar plugin** → `xuper-plugin/kino-plugin-kino-resolver`.
2. Carga este plugin (sube la carpeta a un repo tuyo y agrégalo, o usa el loop de depuración del
   [CONSUMER-PLAYBOOK §6](../CONSUMER-PLAYBOOK.md)).
3. Cambia los `embed` del `CATALOG` por URLs reales de hoster para ver reproducción real.

## Lo único que copias a tu plugin

La función `resolve()` de `plugin.js`. Todo lo demás (search, screen, catálogo) lo reemplazas por el scraping
de tu sitio. Ver la [guía rápida](../docs/README.md#guía-rápida-lo-mínimo).

> Código en inglés, texto de usuario ES + EN — convención de los plugins de Kino. No agregues líneas de
> coautoría en los commits.
