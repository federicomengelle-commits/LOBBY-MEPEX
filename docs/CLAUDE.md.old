MEPEX — Sistema de Gestión Integral (Lobby) | CLAUDE.md

Claude Code lee este archivo automáticamente al abrir el proyecto.


Este proyecto
Lobby del Sistema de Gestión Integral MEPEX — Puerta de entrada a todos los módulos del ecosistema.

Stack: Vanilla JS + HTML + CSS (SPA con hash routing)
Backend: Consume el mismo backend del cotizador (Railway)
Backend URL: https://cotizador-mepex-production.up.railway.app
Carpeta local: C:\Users\Fede\Desktop\APPS ANTIGRAVITY\LOBBY MEPEX\


Contexto de la empresa
MEPEX es una empresa argentina fundada en 1983, especializada en montaje y equipamiento para exposiciones. Sistema modular OCTEXA. Modelo de ALQUILER B2B de alto valor.
Equipo:

Fede y Lelean — dueños
Noe — comercial senior
17 fijos + 3 eventuales en taller, hasta 40 en picos


Ecosistema MEPEX
AppEstadoURLEste lobbyEn desarrolloLocalCotizador V3✅ Producciónhttps://cotizador-mepex.vercel.appWeb institucionalEn desarrollo—
El cotizador se abre desde el módulo Ventas > Cotizador como link externo.

Arquitectura del sistema
Leer mepex-sistema-v2.md para el blueprint completo. Resumen:
8 módulos: Ventas + Marketing, Clientes/CRM, Eventos/Proyectos, Finanzas, Producción & Operaciones, Inventario, RRHH, Proveedores.
Filosofía circular: No son apps separadas. Un dato ingresado en un módulo aparece automáticamente donde corresponde. El usuario navega perspectivas del mismo dato.
Eje central: CLIENTE → tiene PROYECTOS → vinculados a EVENTOS.
6 roles: Admin, Ventas, Operaciones, Finanzas, Taller, Externo.

Notion — Bases de datos (vía backend Railway)
DBIDEndpointCatálogo2d17d5080de88008a227ce63782f5745/api/catalogClientes1837d5080de880039615ce31eb560601/api/clientsProyectos 20262947d5080de880a6b75ed336e48599e9/api/projectsEventos 20262947d5080de880c18569c2dc84652154/api/events

Branding (resumen)
ElementoValorColor principalTurquesa #00ACC9FondoNegro #000102AcentoNaranja #FF7200TipografíaCabin (Google Fonts)TemaDark theme siempre

Archivos de referencia en esta carpeta

mepex-sistema-v2.md — Blueprint completo del sistema (módulos, subcategorías, interconexiones, auth, roles)
PLAN_LOBBY_PARTES.md — Plan de implementación por fases
MEPEX_BRAND.md — Identidad visual completa
MEPEX_STACK.md — Stack técnico y convenciones de código
MEPEX_COMPONENTS.css — Variables CSS y componentes base
MEPEX_NOTION.md — Documentación de integración Notion
NOTION_INTEGRATION.md — IDs de DBs y endpoints


Reglas de conducta

Trabajo acertado a la movida. Planificar antes de codear. Usar plan mode.
No romper lo que funciona. Cambios quirúrgicos, verificar antes y después.
Nunca borrar archivos sin preguntar. Hacer backup antes de reescribir un archivo completo.
No crear backend nuevo. El backend ya existe en Railway. Solo consumir endpoints.
Fallback offline. Si el backend no responde, usar datos mock de data.js.
Mostrar resultado antes de avanzar. No encadenar cambios sin validación.
Consistencia visual. Dark theme MEPEX siempre.
Leer todos los .md de la raíz antes de empezar a codear.
Actualizar la sección "Estado actual" al final de cada sesión.
Simplicidad para taller. Las interfaces de rol Taller deben ser ultra simples.


Estado actual

Última sesión: 2026-02-22
Partes completadas: 1 (login + routing + shell), 2 (header global + barra lateral + dashboard)
Pendiente: Parte 3 (interiores módulos), Parte 4 (buscador global), Parte 5 (conexión Notion)
Bugs conocidos: Ninguno reportado
Último cambio: Header fijo con logo HOME + barra lateral acciones rápidas por rol + KPIs dashboard