# PERSONAL OS — Decisiones del Sprint 2 (sueño, alimentación, entrenamiento)

**Cierra:** 17.9 para sueño, alimentación y entrenamiento, y 17.8 para estos módulos.
**Estado:** aprobadas por el Product Owner el 2026-11-04 (propuestas aceptadas), con **un cambio**: el entrenamiento registra **series individuales** y admite **una rutina distinta cada mes**.
**No modifica** DEC-001 a DEC-004. Los hábitos (D-16 a D-20) están en `02-decisiones-habitos.md`.

Orden de entrega: **sueño → alimentación → entrenamiento**, cada uno con su migración y sus pruebas de RLS.

| Módulo | Estado |
|---|---|
| Sueño | Implementado (migración 4) |
| Alimentación | Implementado (migración 5) |
| Entrenamiento y rutinas | Implementado (migración 6) |

---

## 1. Transversales

| ID | Decisión |
|---|---|
| D-21 | Alimentación, sueño y entrenamiento usan **archivado lógico** con `archived_at` y restauración. Sin `DELETE` para `authenticated` (D-02). |
| D-22 | Unidades: **kg** y **km**. Instantes en `timestamptz`; el "día" de un registro es el día local según `profiles.timezone` (D-08). |
| D-23 | **Recharts** se instala en el Sprint 2 (H-14) para las tendencias. Cada gráfico se acompaña de los datos en lista o tabla (RNF-09). |
| D-24 | Indicadores del dashboard: entrenamientos de la semana, promedio de sueño de 7 días y calorías de hoy (solo si hay registros). |

## 2. Sueño (implementado)

| ID | Decisión |
|---|---|
| D-25 | `sleep_records`: `bedtime` y `wake_time` (`timestamptz`), `duration_minutes` **calculada por la base de datos** (columna generada), `quality` de 1 a 5 (opcional) y `notes`. |
| D-26 | Una noche por día de despertar: `sleep_date` (día local de `wake_time`) lo fija un trigger y es único entre registros no archivados. Siestas fuera del MVP. |
| D-27 | Validaciones en PostgreSQL: despertar posterior a acostarse, duración entre 1 y 16 horas, **sin solapamiento** entre registros del mismo workspace (restricción de exclusión) y sin registrar instantes futuros. |
| D-28 | Meta de sueño: `profiles.sleep_goal_hours` (por defecto 8; entre 4 y 12) como referencia de los indicadores. |
| D-29 | Tendencias: vista de 7, 30 y 90 días con promedio de duración, promedio de calidad y noches que alcanzaron la meta. |

Limitación conocida: `sleep_date` se fija al guardar. Si cambias tu zona horaria, los registros antiguos conservan el día con que se guardaron.

## 3. Alimentación (implementado)

| ID | Decisión |
|---|---|
| D-30 | `meal_logs`: tipo (`breakfast`, `lunch`, `dinner`, `snack`), `eaten_at` (`timestamptz`), descripción, y calorías, proteínas, carbohidratos y grasas **opcionales** (rangos validados por CHECK). |
| D-31 | El día de una comida es el día local de `eaten_at` (una cena a las 00:30 cuenta para el día nuevo). |
| D-32 | **Sin metas diarias** de calorías o macros: está fuera de alcance (3.3 excluye asesoramiento nutricional). |

Detalles de implementación: la descripción es obligatoria (1 a 500 caracteres); calorías de 0 a 10 000 (entero) y gramos de 0 a 2 000 con un decimal. Un campo vacío se guarda como `NULL` ("sin dato") y es distinto de 0; los totales del día solo suman lo informado y muestran "—" si nadie registró ese dato. No se admiten comidas en el futuro (5 minutos de tolerancia).

## 4. Entrenamiento y rutinas (implementado)

Cambio respecto a la propuesta original: en lugar de series uniformes por ejercicio, se registran **series individuales**, y se añaden **rutinas mensuales**. Esto introduce tablas que el documento no nombra; se justifican por pedido expreso del Product Owner (regla 3 de 15.1). La sección 2.2 ya menciona "rutinas" como parte de la dimensión FITNESS.

### 4.1 Registro de lo entrenado

| Tabla | Contenido |
|---|---|
| `workout_sessions` | Inicio (`started_at`), tipo (`strength`, `cardio`, `mobility`, `sport`, `other`), duración en minutos, esfuerzo percibido 1–10 (opcional), notas, `routine_id` opcional. |
| `workout_exercises` | Ejercicio de una sesión: nombre libre, posición, notas. Para cardio: `distance_km` y `duration_min` opcionales. |
| `workout_sets` (**nueva**) | Una fila por serie: `set_number`, `reps`, `weight_kg` (opcional, peso corporal si es nulo). Permite 80 kg × 5 y luego 85 kg × 3. |

D-33: el volumen de un ejercicio es la suma de `reps × weight_kg` de sus series. Sesiones por semana y volumen por ejercicio son las métricas de evolución.

### 4.2 Rutinas mensuales (propuesta; vetable)

| ID | Decisión |
|---|---|
| D-34 | `workout_routines` (**nueva**): nombre, descripción y `period_month` (primer día del mes calendario). **Una rutina activa por mes**: único `(workspace_id, period_month)` entre no archivadas. Un mes puede quedar sin rutina. |
| D-35 | `routine_exercises` (**nueva**): ejercicio planificado de una rutina, con día de la semana ISO (1–7), posición, nombre, series objetivo, repeticiones objetivo, peso objetivo opcional y notas. Los días de entrenamiento salen de los días que tengan ejercicios. |
| D-36 | **Cambio de mes:** la rutina vigente es la del mes calendario actual (zona del perfil). La acción "Duplicar al mes siguiente" copia la rutina con sus ejercicios, para ajustarla sin partir de cero. |
| D-37 | **Entrenar desde la rutina:** al registrar una sesión, se puede elegir un día de la rutina vigente; se precargan sus ejercicios con las series objetivo y el usuario ajusta lo realmente hecho. La sesión guarda `routine_id`. |
| D-38 | Integridad entre workspaces con claves foráneas compuestas, igual que en D-03: una sesión solo apunta a una rutina de su workspace. |

| D-39 | `authenticated` tiene `DELETE` **solo** sobre las tablas de composición (`routine_exercises`, `workout_exercises`, `workout_sets`), siempre bajo RLS, porque editar una sesión o una rutina reemplaza sus hijos dentro de una transacción. Sesiones y rutinas (registros principales) siguen sin `DELETE`: archivado lógico (D-02, D-21). |

Detalles de implementación: el guardado es transaccional mediante las funciones `save_workout_session`, `save_workout_routine` y `duplicate_workout_routine` (SECURITY INVOKER, con la RLS de quien llama). El día de una sesión (`started_date`) lo fija un trigger con la zona del perfil y no se admiten sesiones en el futuro (5 minutos de tolerancia). Una serie sin peso es de peso corporal y no suma volumen. El progreso por ejercicio compara los últimos 30 días con los 30 anteriores, agrupando por nombre sin distinguir mayúsculas, tildes ni espacios repetidos. Restaurar una rutina archivada falla con aviso si el mes ya tiene otra vigente.

Lo que queda abierto en entrenamiento: si una rutina puede abarcar un periodo distinto de un mes calendario (p. ej. 4 semanas desde una fecha). La propuesta usa mes calendario porque es lo que pediste y simplifica el cambio de rutina.
