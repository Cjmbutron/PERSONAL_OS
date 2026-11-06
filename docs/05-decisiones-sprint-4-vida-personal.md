# PERSONAL OS — Decisiones del Sprint 4 (vida personal, calendario y objetivos)

**Cierra:** 17.8 (zona horaria y eventos de día completo) y 17.9 para calendario, objetivos y vida personal.
**Estado:** aprobadas por el Product Owner el 2026-11-06. Propuestas aceptadas con tres respuestas: el avance de un objetivo se mide con **hitos (checklist)**; una actividad personal **reutiliza tareas y eventos** (sin tabla nueva); el calendario muestra **eventos, vencimientos de tareas y vencimientos de obligaciones de dinero**.
**No modifica** DEC-001 a DEC-004.

| Paso | Contenido | Estado |
|---|---|---|
| 1 | Calendario, objetivos e hitos (migración 10) | Implementado y probado (21 pruebas RLS) |
| 2 | Pantallas (resumen, calendario, objetivos) y tarjeta del dashboard | Implementado |

## 1. Calendario (17.8)

| ID | Decisión |
|---|---|
| D-57 | `calendar_events`: título, descripción, lugar (opcional), dimensión de vida (opcional) y archivado lógico. Cada evento es **con hora** (`starts_at`, `ends_at` en `timestamptz`) o **de todo el día** (`start_date`, `end_date` en `DATE`, fin inclusivo); la base de datos impone que sea de uno solo de los dos tipos. |
| D-58 | Los eventos con hora se muestran en la zona horaria del perfil. Los de todo el día **no tienen zona horaria**. |
| D-59 | El fin no puede ser anterior al inicio. Un evento con hora dura como máximo 14 días y uno de todo el día, 31. Se admiten eventos pasados (historial) y futuros. |
| D-60 | Sin repetición, recordatorios ni sincronización con calendarios externos (Sprint 6 o fuera de alcance). |
| D-61 | Vistas de **mes** y de **agenda**. Un evento que abarca varios días aparece en cada uno; para ello un trigger fija `first_day` y `last_day` (día local) y las consultas de un mes buscan solapamiento. |
| D-67 | El calendario muestra, de solo lectura, los **vencimientos de tareas** (no archivadas) y los de **obligaciones de dinero** pendientes, junto a los eventos. Filtro por dimensión. |

Limitación conocida (igual que `sleep_date`): `first_day` y `last_day` de un evento con hora se fijan al guardar. Si cambias tu zona horaria, los eventos antiguos conservan el día con que se guardaron.

## 2. Objetivos

| ID | Decisión |
|---|---|
| D-62 | `goals`: título, descripción, dimensión de vida (opcional), fecha objetivo (`DATE`, opcional), estado (`active`, `paused`, `completed`, `cancelled`), porcentaje manual 0–100 (se usa solo si el objetivo no tiene hitos) y archivado lógico. |
| D-63 | `completed_at` lo fija un trigger y existe si y solo si el estado es `completed` (como D-09). |
| D-64 | Los objetivos son **transversales**: valen para cualquier dimensión. |
| D-68 | **Avance por hitos:** `goal_milestones` (título, hecho/pendiente, orden). Avance = hitos hechos ÷ total; sin hitos, se usa el porcentaje manual; un objetivo `completed` muestra 100 %. Hasta 50 hitos por objetivo. Los hitos son una tabla de composición: admiten `DELETE` bajo RLS (D-39). `done_at` lo fija un trigger. |

## 3. Vida personal

| ID | Decisión |
|---|---|
| D-65 | La pantalla Vida personal reúne los objetivos activos, los próximos eventos y las tareas de la dimensión PERSONAL, con su historial reciente (tareas completadas y eventos pasados de los últimos 30 días). |
| D-69 | Una **actividad personal** es una tarea o un evento con dimensión PERSONAL. No se crea una tabla nueva. |
| D-66 | Dashboard: próximos eventos (7 días) y objetivos activos con su avance. |
| D-70 | Calendario y objetivos viven bajo Vida personal (`/personal/calendar`, `/personal/goals`) y muestran **todas** las dimensiones, con filtro por dimensión. |

## 4. Fuera del MVP

Eventos repetidos, recordatorios y notificaciones, calendarios externos, reordenar hitos arrastrando, vincular tareas a objetivos.
