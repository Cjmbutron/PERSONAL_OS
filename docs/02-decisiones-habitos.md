# PERSONAL OS — Decisiones del módulo de hábitos (Sprint 2, parte 1)

**Cierra:** 17.7 (reglas de recurrencia de hábitos) y la parte de 17.9 que corresponde a hábitos.
**Estado:** propuesto por PO / Líder técnico; **pendiente de tu ratificación**. No modifica DEC-001 a DEC-004.
**Fecha:** 2026-11-04

El resto del Sprint 2 (entrenamiento, alimentación, sueño) **no está desbloqueado**: siguen sin definirse sus campos y estados (17.9). El documento (15.2) recomienda además no construir varios módulos en una sola instrucción, por eso se entrega solo hábitos.

---

## 1. Decisiones

| ID | Decisión | Cierra |
|---|---|---|
| D-16 | Tres tipos de frecuencia: `daily` (todos los días), `days_of_week` (días ISO 1–7 elegidos, p. ej. lun-mié-vie) y `times_per_week` (meta de 1 a 7 días distintos por semana, lunes a domingo). Un CHECK de PostgreSQL exige que los campos de frecuencia coincidan con el tipo. | 17.7 |
| D-17 | `habit_logs` guarda **una fila por hábito y fecha** (`UNIQUE (habit_id, log_date)`, regla 6.4.6) con `completed boolean`. Deshacer = `completed = false`, porque `authenticated` no tiene `DELETE` (D-02). `log_date` es `DATE` del calendario del usuario (D-08) y no puede ser futura: lo valida un trigger con la zona horaria del perfil. Tras la inserción solo `completed` es modificable. | 17.7 · 17.8 (parcial) |
| D-18 | **Rachas.** Diario y días específicos: días programados cumplidos consecutivos; un día no programado no rompe ni suma. `times_per_week`: semanas ISO consecutivas con la meta cumplida. En ambos casos el periodo en curso (hoy / la semana actual) no rompe la racha mientras no termine. Cumplir un día no programado no suma. | 17.7 |
| D-19 | Las rachas se calculan sobre una ventana de **400 días** (`STREAK_WINDOW_DAYS`). Una racha mayor se muestra recortada. Cambiar la frecuencia de un hábito se aplica retroactivamente: no se guarda historial de frecuencias. | límite consciente |
| D-20 | Archivado lógico con `archived_at` y restauración; el historial de registros se conserva. Sin `DELETE`. | DEC-004 |

## 2. Lo que no está decidido

- **Hábitos medibles** (p. ej. "8 vasos de agua"): el modelo es binario (cumplido / no cumplido). Si lo necesitas, requiere una columna de cantidad y una meta por día.
- **Historial de frecuencias:** si te importa que una racha pasada no cambie al editar la frecuencia, hay que versionar la definición.
- **Hábitos en MVP:** 3.2 los incluye, pero el roadmap los pone en el Sprint 2. Aquí se desarrollaron antes que entrenamiento, comida y sueño por ser los únicos con reglas cerradas.

## 3. Hallazgo de las pruebas

Al probar la migración contra PostgreSQL apareció un defecto: un hábito `times_per_week` **sin meta** pasaba el CHECK, porque `NULL BETWEEN 1 AND 7` es `NULL` y PostgreSQL acepta un CHECK que no da `FALSE`. Se corrigió con `target_per_week IS NOT NULL` y queda cubierto por una prueba. Conviene revisar con la misma lupa los CHECK de las migraciones 1 y 2: los de `projects` y `tasks` usan `IN (...)` sobre columnas `NOT NULL`, por lo que no les afecta.

## 4. Cómo probarlo

```bash
npm test                      # 79 pruebas: RLS, integridad, rachas, validaciones
supabase db push              # aplica 20261104000003_habits.sql
```
