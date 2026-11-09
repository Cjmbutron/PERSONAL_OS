# Identidad visual "Altiplano" y registro rápido

## Decisiones

| ID | Decisión |
|---|---|
| D-79 | Paleta de niebla y tinta de lago (primario verde azulado) en vez del índigo genérico; modo claro y oscuro con contraste AA verificado (textos ≥ 4.5:1). |
| D-80 | **Un color por dimensión** (Trabajo azul, Hábitos rojo cochinilla, Entrenamiento ocre, Alimentación verde, Sueño violeta, Finanzas oro, Vida personal magenta). Se usa en el menú, el registro rápido y el borde superior de las tarjetas del dashboard: el color indica de qué parte de tu vida es cada cosa. Definidos como variables `--area-*` en `globals.css`. |
| D-81 | Tipografía: **Bricolage Grotesque** (paquete npm local, sin red en tiempo de ejecución) para títulos y cifras grandes; Geist se mantiene para el texto. |
| D-82 | Esquinas más amables: tarjetas y diálogos `rounded-xl/2xl`, controles `rounded-lg`. |
| D-83 | **Registro rápido**: botón "Registrar" en la barra lateral (atajo: tecla `N`) y botón flotante en el celular, que abre una hoja con accesos a gasto, ingreso, comida, sueño, tarea, evento y hábitos de hoy. Cada acceso lleva a su página con `?nuevo=…`, que abre el formulario ya listo y limpia el parámetro al cerrarlo. |

## Archivos clave

`src/app/globals.css`, `src/lib/constants/areas.ts`, `src/components/layout/quick-add.tsx`, `src/lib/utils/quick-param.ts`, `src/components/ui/card.tsx`.

## Navegación móvil y tendencias

| ID | Decisión |
|---|---|
| D-84 | En el celular, **barra inferior** con Dashboard, Trabajo, el botón central de registro, Hábitos y "Más" (panel con todos los módulos). Sustituye al menú de hamburguesa de la cabecera. |
| D-85 | El dashboard muestra **tendencias de las últimas 4 semanas** (tareas completadas, hábitos cumplidos y gasto en Bs), de lunes a domingo, con la semana actual resaltada. Se cargan en un bloque aparte para no retrasar el resto. |

Archivos: `src/components/layout/bottom-nav.tsx`, `src/components/dashboard/{trends-card,mini-bars}.tsx`, `src/features/review/trends.ts`.

## Formularios, hábitos y finanzas

| ID | Decisión |
|---|---|
| D-86 | **Formularios en el celular**: texto a 16 px (el iPhone no hace zoom al enfocar), campos y botones de 44 px de alto, y teclado numérico automático en campos numéricos (con decimales si el paso lo admite). En escritorio se mantienen los tamaños compactos. |
| D-87 | **Diálogos como hoja inferior** en el celular (se abren desde abajo, al alcance del pulgar); centrados en escritorio. `DialogContent` acepta `placement="free"` para el panel lateral de módulos. |
| D-88 | **Hábitos**: objetivos táctiles más grandes, barra de progreso del día y orden "pendientes primero, luego cumplidos". |
| D-89 | **Finanzas**: movimientos agrupados por día (más reciente primero, "Hoy" destacado) en lugar de repetir la fecha en cada fila. |

## Avisos, tema, acceso y dashboard

| ID | Decisión |
|---|---|
| D-90 | **Avisos breves** (`useToast`) al guardar cualquier formulario ("Tarea guardada", "Movimiento guardado"…) y al archivar o restaurar, este último con **Deshacer**. En el celular aparecen sobre la barra inferior. |
| D-91 | **Selector de tema** en la cabecera: automático (sigue al dispositivo), claro u oscuro; se recuerda en el dispositivo y se aplica antes de pintar para evitar parpadeos. |
| D-92 | **Acceso**: en escritorio, panel de marca con las siete dimensiones y su color; en el celular, marca compacta. Logotipo de tres picos. |
| D-93 | **Dashboard**: bloque "Atención de hoy" arriba con lo que pide acción, de lo más urgente a lo menos (tareas y pagos vencidos, eventos y vencimientos de hoy, hábitos pendientes, sueño sin registrar); cada línea lleva a donde se resuelve. Si no hay nada, lo dice. |
