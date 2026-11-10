# Sprint 6 · Automatización: decisiones (D-94 a D-103)

Alcance aprobado: centro de avisos **dentro de la app** (sin push ni correo), calculado **al abrir la app** (sin cron), con tres automatizaciones: tareas recurrentes, avisos de vencimientos y aviso de revisión semanal.

| ID | Decisión |
|----|----------|
| D-94 | Completar una tarea pasa por la función `complete_task(p_task_id)`: completa y, si es recurrente, crea la siguiente en la **misma transacción**. `SECURITY INVOKER`: respeta RLS. |
| D-95 | Recurrencias: diaria, semanal, mensual. La siguiente fecha es estrictamente posterior al vencimiento **y a hoy**: si completas con retraso, cae en el próximo hueco de la serie, no en el pasado. Mensual conserva el día ancla (31 → 28/29 feb → 31), igual que `pay_obligation`. |
| D-96 | Una tarea tiene como máximo **una sucesora** (índice único en `recurrence_source_id`): reabrir y completar de nuevo no duplica. La recurrencia exige fecha de vencimiento (CHECK). |
| D-97 | Los avisos **no se guardan**: se calculan en cada apertura a partir de tareas, obligaciones y revisiones. Sin cron ni jobs; nada que se desincronice. |
| D-98 | `notice_states` guarda solo si un aviso fue **leído** o **descartado**, con clave determinista (`task:<id>:<fecha>:<overdue/today/soon>`). Si la situación cambia (de "hoy" a "vencida") la clave cambia y el aviso reaparece. Descartar tiene "Deshacer". |
| D-99 | Aviso semanal: sábado y domingo → semana en curso; lunes y martes → semana que terminó; desaparece al completar la revisión. Enlaza a `/review?week=…`. |
| D-100 | Umbrales: tareas vencidas, de hoy y próximos 2 días; obligaciones pendientes vencidas y próximos 7 días (coherente con `dueState`). |
| D-101 | Campana en el encabezado con contador de sin leer (detrás de `Suspense`; un fallo al calcular nunca rompe el encabezado) y página `/notices`. Urgencia: color + icono + texto. |
| D-102 | Marcar todo como leído nunca baja un descartado a leído. Sin `upsert` de PostgREST: actualizar lo existente e insertar lo que falta. |
| D-103 | Fuera de alcance (no elegido): push/correo, recordatorios de hábitos, tareas recurrentes con fin o intervalos personalizados. Las filas antiguas de `notice_states` no se limpian aún (volumen mínimo). |

Migración: `supabase/migrations/20261109000012_automation.sql`. Pruebas: `tests/rls/automation.test.ts`, `tests/notices/compute.test.ts`.

## Revisión de accesibilidad (D-104 a D-108)

| ID | Decisión |
|----|----------|
| D-104 | Contraste (WCAG AA, 4.5:1 para texto) medido sobre fondo, tarjeta y fondo atenuado en claro y oscuro. Se oscurecieron en modo claro `success`, `warning`, `fitness` y `nutrition`, que quedaban entre 4.1 y 4.5. |
| D-105 | Nuevo token `--input`: el borde de los campos pasa de 1.4:1 a más de 3:1 (WCAG 1.4.11). Las tarjetas conservan el borde suave, que es decorativo. |
| D-106 | Enlace "Saltar al contenido" (primer elemento enfocable) y `main` enfocable. |
| D-107 | Áreas táctiles mínimas: cierre de diálogos 40 px, botones de los avisos emergentes 36 px; etiquetas de la barra inferior de 12 px. |
| D-108 | "Atención de hoy" incluye el aviso de revisión semanal y un enlace a Avisos con el número de sin leer. Pendiente: mover el foco al primer campo con error tras enviar, y pausar los avisos emergentes al pasar el cursor. |

## Subcategorías de finanzas (D-109 a D-114)

Motivo: registrar, por ejemplo, Vivienda → Luz, Agua, Internet o IAN → Pensión, Tenis, Piano, y ver el total de la categoría y su desglose. Migración: `20261110000013_subcategories.sql`.

| ID | Decisión |
|----|----------|
| D-109 | `transaction_categories.parent_id`: un solo nivel (categoría → subcategoría). Los movimientos, presupuestos y obligaciones siguen usando `category_id`, que puede ser una categoría o una subcategoría; no se migra ningún dato. |
| D-110 | Una subcategoría es del mismo tipo que su padre (clave foránea compuesta con `kind`); al crearla, el tipo se hereda. `parent_id` solo se fija al crear (sin permiso de UPDATE), igual que `kind`. |
| D-111 | Un trigger impide subcategorías de subcategorías y crear o restaurar una subcategoría bajo un padre archivado. Archivar un padre archiva sus subcategorías; restaurar solo restaura la elegida. |
| D-112 | El nombre es único dentro de su padre ("Pensión" puede existir bajo dos padres). Selectores y listas muestran "IAN › Tenis", ordenados con cada principal seguida de sus hijos. |
| D-113 | Los totales se suman en la aplicación, no en la base de datos: reportes muestran la principal con su desglose (y "Sin subcategoría" si hay gasto directo); un presupuesto de una principal cuenta también lo gastado en sus subcategorías; el de una subcategoría, solo lo suyo. Una subcategoría cubierta por el presupuesto de su padre no aparece en "Gastos sin presupuesto". |
| D-114 | Fuera de alcance: mover una categoría existente a otra principal (hoy se crea la subcategoría nueva y se reclasifican los movimientos), más de un nivel y etiquetas libres. |
