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
