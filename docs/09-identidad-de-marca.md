# Identidad de marca · logotipo (D-115 a D-118)

| ID | Decisión |
|----|----------|
| D-115 | **Concepto:** una "P" en movimiento, hecha de hojas inclinadas que suben hacia la derecha (referencia de estilo aportada por el usuario). El bloque ámbar de la base es "hoy". Sustituye a las propuestas anteriores (tres picos, tres escalones, P de barras). |
| D-116 | **Colores:** fondo siempre oscuro (`#10262b` → `#0a1416`), P con degradado de `#5fd6d2` a `#2b8fd6` y ámbar `#f2b84b`. Como el fondo no cambia, la marca es idéntica en tema claro y oscuro. |
| D-117 | **Nombre:** "Personal OS" (ya no en mayúsculas), en Bricolage Grotesque semibold; "OS" en el color primario. |
| D-118 | **Archivos:** `public/brand/logo-mark.svg` (con fondo), `logo-mark-mono.svg` (una tinta, `currentColor`), íconos PNG 192/512 y 512 maskable, `src/app/icon.svg` (favicon) y `src/app/apple-icon.png`. En la app: `src/components/brand/logo.tsx` (`LogoMark`, `Logo`). |

Uso: tamaño mínimo 16 px (legible); sobre el color primario el nombre va en blanco (`tone="onPrimary"`); no estirar, rotar ni cambiar el ámbar.

## Enlaces compartidos y app instalable (D-119 a D-122)

| ID | Decisión |
|----|----------|
| D-119 | **App instalable:** `src/app/manifest.ts` (nombre, íconos 192/512 y maskable, `display: standalone`, inicio en `/dashboard`, accesos directos a Panel, Avisos y Registrar entrenamiento). Se instala desde el navegador ("Añadir a la pantalla de inicio"). |
| D-120 | **Privacidad:** `robots: noindex, nofollow`: es una app personal y no debe aparecer en buscadores. Las páginas internas requieren sesión, así que al compartir un enlace solo se ve la tarjeta de marca. |
| D-121 | **Tarjeta al compartir enlaces:** `opengraph-image.png` / `twitter-image.png` (1200×630) con logotipo y lema, más título y descripción Open Graph. La URL base sale de `NEXT_PUBLIC_SITE_URL` o, en Vercel, de `VERCEL_PROJECT_PRODUCTION_URL`. |
| D-122 | **Color de la barra del navegador** (`theme-color`) según tema claro u oscuro. Sin service worker por ahora: no hay modo sin conexión, para no guardar en caché datos personales ni sesiones. |
