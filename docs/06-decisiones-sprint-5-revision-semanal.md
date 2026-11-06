# Sprint 5 · Revisión y planificación semanal — decisiones

**Estado:** paso 1 (migración 11) y paso 2 (pantalla `/review`, dashboard) implementados.
**No modifica** DEC-001 a DEC-004.

## Decisiones

| ID | Decisión |
|---|---|
| D-71 | La semana va de **lunes a domingo**. Una revisión por semana y workspace (`unique (workspace_id, week_start)`); `week_start` debe ser lunes (CHECK) y no puede ser futura (trigger, con la zona horaria del perfil). |
| D-72 | La revisión nace como **borrador** y pasa a **completada**; `completed_at` lo fija un trigger. **Sigue siendo editable** tras completarla. No se borra. |
| D-73 | Las **prioridades** son de la semana a la que aplican (no de la revisión): se planifican durante la revisión de la semana anterior o cuando quieras. **Máximo 5 por semana** (trigger). Tabla de composición: admite `DELETE` (D-39). |
| D-74 | Una prioridad es **texto libre y/o vinculada** a una tarea u objetivo del mismo workspace (FK compuesta; `tasks` gana `unique (workspace_id, id)`). El vínculo es informativo: marcar la prioridad no cierra la tarea. |
| D-75 | El **resumen** de la semana no se guarda: se calcula con datos reales (tareas completadas y vencidas, cumplimiento de hábitos, sesiones y volumen, sueño, ingresos y gastos por moneda, objetivos). Así nunca queda desactualizado respecto a lo registrado. |
| D-76 | Las **observaciones** son tres textos opcionales de hasta 2000 caracteres: qué salió bien, qué mejorar, aprendizajes. |
| D-77 | El dashboard gana un **filtro de periodo** (7 o 30 días, `?period=`) que afecta a tareas completadas y sueño, y una franja **"Esta semana"** con las prioridades y un aviso si falta la revisión de la semana pasada. Los demás indicadores mantienen su ventana natural (hoy, semana, mes). |
| D-78 | Módulo propio **"Revisión semanal"** (`/review`) en la navegación, con la semana pasada por defecto y navegación entre semanas. |

## Implementación

- Migración: `supabase/migrations/20261107000011_weekly_review_planning.sql` (11 pruebas en `tests/rls/weekly-review.test.ts`).
- Lógica pura: `src/lib/personal/weekly.ts`; validaciones: `src/lib/validations/personal.ts`.
- App: `src/features/review/{queries,actions}.ts` y componentes; página `src/app/(dashboard)/review/page.tsx`.

## Pendiente del Sprint 5

Filtros adicionales en listados, auditoría de rendimiento y pasada de experiencia móvil, y pruebas de regresión end-to-end (requieren un proyecto Supabase real).
