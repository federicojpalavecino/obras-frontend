# FAIM OBRAS — Frontend

SaaS de gestión integral para estudios de arquitectura e ingeniería en Argentina.
Stack: React (Create React App) + Vercel. Dominio: faimobras.com

## Backend
- Vive en `C:\obras-backend` (FastAPI + Railway + PostgreSQL)
- API producción: https://obras-backend-production.up.railway.app
- El backend es un repo separado. Si un cambio necesita endpoint nuevo, hay que tocar ambos repos.

## Arquitectura general
- **Multi-tenant**: cada estudio es un "tenant". TODO filtra por `tenant_id`.
- **Roles**: estudio (admin/personal) y cliente (portal de solo lectura).
- Autenticación por JWT guardado en `localStorage` como `obras_token`.
- Datos del tenant en `localStorage` como `obras_tenant` (incluye logo_url, color_primario, nombre).

## Estructura de carpetas
- `src/App.js` — auth, login (estudio + cliente), routing principal, estado de tenant/usuario
- `src/pages/` — páginas a nivel app: ControlFinanciero, Clientes, ConfigCuenta, AccesosClientes, ClientePortal, Landing, AdminSuperPanel, Obra, Planner, Fiscal
- `src/cotizador/pages/` — Presupuesto, Certificado, Gantt, CurvaInversion, AnalisisCostos, ManoObra, Maquinaria, Materiales, Menu, ListadoMateriales, PanelAnalisis, PanelComputo, PrintPresupuesto
- `src/cotizador/api.js` — cliente axios con interceptor de token

## Módulos principales (todos vinculados entre sí)
1. **Cotizador**: presupuestos con rubros, líneas, análisis de costos, coeficientes (GG/BEN/IVA), cómputo. Catálogo de ~524 ítems + 200 materiales.
2. **Análisis de costos**: catálogo global + override por tenant. Materiales, mano de obra, maquinaria.
3. **Certificados**: avance de obra vinculado al presupuesto. Con egresos.
4. **Gantt**: planificación automática desde el presupuesto.
5. **Curva de inversión**.
6. **Adicionales**: presupuestos adicionales vinculados al base, con coeficientes propios.
7. **Gestión de Obra** (`Obra.jsx`): tabs Resumen, Contrato, Cobros, Subcontratos, Compras, Certificados. Ruta `/cotizador/presupuesto/:id/obra`.
8. **Control Financiero**: ingresos/egresos/personal por semana/quincena/mes. Importa cobros/pagos desde Obra.
9. **Portal de clientes**: el cliente ve avance, contrato (puede aceptarlo), cuenta corriente, planificación, consultas. Configurable qué secciones y qué presupuestos ve cada cliente (en AccesosClientes).

## Estética / convenciones de UI
- Fuente: Syne (titulos/UI), IBM Plex Mono (números/códigos)
- Color acento por defecto: #059669 (verde). Cada tenant puede cambiar su color_primario.
- Paleta usada en casi todos los archivos:
  `const C = { bg:"#f8f9fa", surface:"#ffffff", surface2:"#f1f3f5", border:"#e0e0e8", text:"#1a1a2e", muted:"#6b7280", accent:"#059669", accent2:"#7c3aed", warn:"#d97706", green:"#10b981", red:"#ef4444" }`
- Estilos inline (no CSS modules). Bordes redondeados 8-16px.
- Formato moneda argentino: `"$ " + Math.round(n).toLocaleString("es-AR")`

## Deploy
- `npm run build` para verificar que compila
- `git add . && git commit -m "..." && git push`
- Vercel auto-deploya desde la rama main al hacer push
- IMPORTANTE: el build DEBE pasar antes de pushear. Si falla, no pushear.

## Cosas a tener en cuenta
- No usar localStorage/sessionStorage en artifacts, pero acá es app real así que sí se usa.
- Los componentes son JSX con estilos inline, sin TypeScript.
- Al editar archivos grandes (Presupuesto.js tiene ~1600 líneas), tener cuidado con el balance de tags JSX — es la fuente más común de errores de compilación.
- Cuando se agrega un campo a un modelo del backend, hay que: agregar columna SQL en Railway → Postgres, agregar al modelo en models.py, y usarlo en el endpoint en main.py.
