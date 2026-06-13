# VPS — Loop de deploy + backup (instalación guiada)

> Objetivo: cerrar el loop `push → prod` sin SSH manual + backup nocturno de Supabase.
> Tres piezas: **(A)** endpoint `/deploy` en lobby-api · **(B)** no-cache para `index.html` ·
> **(C)** backup pg_dump con rotación.
> Escrito 2026-06-12. Los pasos marcados 🔍 dependen del descubrimiento inicial.

---

## 0. Descubrimiento (correr UNA vez en el VPS y pasar el output a Claude)

```bash
echo "--- repo:"; ls -d /var/www/* /root/* /home/*/* 2>/dev/null | grep -i -E "lobby|mepex" ; \
echo "--- web server:"; (nginx -v 2>&1; ls /etc/nginx/sites-enabled/ 2>/dev/null) || apache2 -v 2>/dev/null || echo "ni nginx ni apache" ; \
echo "--- procesos node:"; (pm2 ls 2>/dev/null || systemctl list-units --type=service | grep -iE "node|lobby|pyme" || ps aux | grep -v grep | grep node) ; \
echo "--- pg_dump:"; pg_dump --version 2>/dev/null || echo "NO instalado"
```

Con ese output se confirman: ruta del repo, qué sirve el puerto 80, cómo corre
lobby-api (pm2/systemd/manual) y si hace falta instalar `postgresql-client`.

---

## A. Endpoint `/deploy` (lobby-api)

El código ya está en `lobby-api/index.js` (este repo). En el VPS:

1. `cd <ruta-del-repo> && git pull` (la última vez a mano 😄).
2. Agregar a `lobby-api/.env`:
   ```
   DEPLOY_TOKEN=<un-token-largo-random>     # generarlo: openssl rand -hex 24
   # REPO_DIR=/ruta/del/repo                # solo si lobby-api NO vive dentro del repo
   ```
3. Reiniciar lobby-api (`pm2 restart lobby-api` o el systemd que corresponda 🔍).
4. Probar:
   ```bash
   curl -X POST http://localhost:3002/deploy -H "X-Deploy-Token: <token>"
   # → {"success":true,"output":"Already up to date.","head":"<commit>"}
   ```

**Uso desde entonces:** tras cada push a main, cualquiera (Claude incluido, si Fede
comparte el token) dispara:
`curl -X POST http://195.200.1.250:3002/deploy -H "X-Deploy-Token: <token>"`
⚠️ Requiere que el puerto 3002 esté accesible desde afuera; si no, se llama por SSH
o se agrega un proxy_pass en nginx (`/lobby-api/ → :3002`).

## B. No-cache para index.html 🔍

**Si es nginx** — en el server block del sitio (`/etc/nginx/sites-enabled/...`):

```nginx
# index.html SIEMPRE fresco (los .js?v= siguen cacheados, está bien)
location = /index.html {
    add_header Cache-Control "no-cache, must-revalidate";
}
location = / {
    add_header Cache-Control "no-cache, must-revalidate";
}
```

Luego `nginx -t && systemctl reload nginx`.
**Resultado:** se acabó el "hard refresh después de cada pull" — el browser revalida
index.html siempre y los `?v=` hacen el resto.

**Si es apache:** avisar a Claude, hay snippet equivalente (`<Files "index.html">` +
`Header set Cache-Control "no-cache"`, requiere `a2enmod headers`).

## C. Backup nocturno (pg_dump)

Script: `tools/vps/backup-supabase.sh` (este repo). Setup completo en el header del
script. Resumen:

1. `apt install postgresql-client` (si falta 🔍 — debe ser v15+).
2. Connection string de Supabase (Dashboard → Settings → Database) en
   `/root/.mepex_db_url` con `chmod 600`.
3. `mkdir -p /root/backups-mepex && cp <repo>/tools/vps/backup-supabase.sh /root/`
4. Probar a mano: `bash /root/backup-supabase.sh`
5. Cron: `30 2 * * * /bin/bash /root/backup-supabase.sh >> /root/backups-mepex/backup.log 2>&1`

**Resultado:** cada DROP de legacy (RRHH.2, Fase 4) pasa de irreversible a recuperable
(`pg_restore --table=tabla`).

---

## Checklist final

- [ ] `curl -X POST .../deploy` devuelve `success:true`
- [ ] `curl -sI http://195.200.1.250/index.html | grep -i cache` → `no-cache`
- [ ] `ls /root/backups-mepex/` tiene un dump de hoy
- [ ] `crontab -l` muestra la línea de las 02:30
