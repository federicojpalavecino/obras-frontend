# FAIM OBRAS — Frontend

SaaS de gestión integral para estudios de arquitectura e ingeniería en Argentina.
React (Create React App) + Vercel. Dominio: faimobras.com

## Empezá por acá

- **`docs/MAPA.md` es el mapa del sistema**: qué módulos hay, qué resuelve cada
  uno, cómo se conectan, en qué estado están y qué queda pendiente. Está para no
  tener que revisar todo el código en cada sesión nueva — leelo antes de salir a
  explorar a mano.
- **`whatsapp/README.md`** — cómo se producen las placas, los reels y la
  locución. `instagram/` tiene los textos y guiones ya escritos.

## La regla que manda sobre todas

Hay cinco estudios trabajando con esto todos los días. **Ningún cambio puede
tocar los datos que ya cargaron.** Migraciones aditivas, nada de backfills sobre
datos de tenant sin pedirlo, y todo filtra por `tenant_id` siempre.

## Backend

- Vive en `C:\obras-backend` (FastAPI + Railway + PostgreSQL). **No es repo git**:
  se deploya con `railway up --detach`.
- API producción: https://obras-backend-production.up.railway.app
- Consultar producción: `railway ssh "python -c ..."` desde `C:\obras-backend`.
  `railway run` **no** sirve — `DATABASE_URL` apunta a `postgres.railway.internal`.
- Migraciones inline en el `lifespan` de FastAPI. Las de datos van marcadas en
  `_migraciones_datos` para que corran una sola vez.
- Campo nuevo = columna SQL + modelo en `models.py` + endpoint en `main.py`.

## Estructura

- `src/App.js` — auth, login (estudio + cliente), routing, estado de tenant
- `src/pages/` — páginas a nivel app
- `src/cotizador/pages/` — el cotizador y todo lo que cuelga del presupuesto
- `src/cotizador/api.js` — axios con interceptor de token
- JWT en `localStorage` como `obras_token`; el tenant en `obras_tenant`
  (incluye `logo_url`, `color_primario`, `nombre`).

## Estética

- Fuente: Syne (títulos/UI), IBM Plex Mono (números/códigos)
- Acento por defecto `#059669`; cada tenant puede cambiar su `color_primario`
- Paleta que se repite en casi todos los archivos:
  `const C = { bg:"#f8f9fa", surface:"#ffffff", surface2:"#f1f3f5", border:"#e0e0e8", text:"#1a1a2e", muted:"#6b7280", accent:"#059669", accent2:"#7c3aed", warn:"#d97706", green:"#10b981", red:"#ef4444" }`
- Estilos inline, sin CSS modules ni TypeScript. Bordes 8-16px.
- Moneda: `"$ " + Math.round(n).toLocaleString("es-AR")`

## Deploy

`npm run build` → `git add . && git commit -m "..." && git push`. Vercel deploya
solo desde `main`. **Si el build falla, no se pushea.**

## Trampas conocidas

- **Buscá el endpoint antes de darlo por faltante.** El patrón más común de este
  código es backend completo sin UI que lo llame (ver «Lo que existe pero nadie
  usa» en `docs/MAPA.md`).
- Archivos grandes (`Presupuesto.js` ~1600 líneas): el balance de tags JSX es la
  causa número uno de errores de compilación.
- Nada de datos de tenant en material público: ni obras, ni clientes, ni montos.
  Los números del catálogo global sí (436 ítems, 829 materiales).
