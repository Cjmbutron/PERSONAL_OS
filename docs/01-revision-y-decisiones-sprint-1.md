# PERSONAL OS — Revisión del documento y decisiones del Sprint 1

**Documento revisado:** Especificación Técnica y Funcional v1.0
**Roles aplicados:** Product Owner · Líder técnico · Analista UX
**Fecha:** 2026-11-03

---

## 1. Veredicto

| Alcance | ¿Listo para implementar? | Motivo |
|---|---|---|
| **Sprint 1** (auth, workspace, layout, dashboard, proyectos, tareas) | **Sí, con las decisiones de la sección 3** | Las dependencias abiertas de la sección 17 que le afectan (esquema, permisos, `SECURITY DEFINER`, eliminación, zona horaria) se cierran aquí para este alcance. |
| Sprint 2 (hábitos, entrenamiento, comida, sueño) | **No todavía** | Faltan reglas de recurrencia de hábitos (17.7) y campos/estados definitivos (17.9). |
| Sprint 3 (finanzas) | **No todavía** | Faltan validación de moneda (17.5), transferencias atómicas (17.6) y reglas de categorías. |
| Sprints 4–6 | No evaluados | Dependen de decisiones de zona horaria de eventos (17.8) y del backlog formal (17.10). |

El documento es una buena base de producto y arquitectura. Lo que impide darlo por "aprobado" es lo que él mismo declara en la sección 17 y en el estado del Sprint 0: el esquema físico y las políticas RLS no estaban revisados. Esta entrega los define para el alcance del Sprint 1.

---

## 2. Hallazgos

Severidad: **A** = bloquea o puede causar un defecto de seguridad/integridad · **M** = genera retrabajo o ambigüedad · **B** = mejora.

| ID | Sev. | Hallazgo | Resolución |
|---|:-:|---|---|
| H-01 | M | El MVP (3.2) incluye "gestión inicial de hábitos", pero ninguna historia del Sprint 1 la cubre y el Sprint 2 la desarrolla. | Los hábitos pasan al Sprint 2 (D-11). Requiere tu confirmación como dueño del producto. |
| H-02 | M | `life_areas` aparece bajo `workspaces` en 6.3, pero 2.2 dice que es un catálogo fijo gestionado por migraciones y DEC-002 que no se edita desde la interfaz. | Catálogo global sin `workspace_id`, solo lectura (D-01). |
| H-03 | A | La regla 5 de 6.4 ("no referencias cruzadas entre workspaces") no se puede garantizar solo con RLS por tabla: una tarea podría apuntar al proyecto de otro usuario. | Claves foráneas compuestas `(workspace_id, id)` (D-03). |
| H-04 | A | 7.2 exige que el usuario no cambie su `workspace_id`; RLS por sí sola no lo impide en un `UPDATE`. | Trigger de inmutabilidad (D-04). |
| H-05 | M | DEC-004 (archivado lógico) y 7.2 (sin DELETE a `authenticated`) implican que la interfaz nunca borra, pero el procedimiento de eliminación definitiva (17.4) no existe. | En Sprint 1 no hay DELETE para `authenticated`; archivar y restaurar vía `archived_at` (D-02). La eliminación definitiva queda pendiente y fuera de la UI. |
| H-06 | M | S1-07 cubre registro e inicio de sesión, pero un flujo de autenticación utilizable también necesita cierre de sesión, confirmación de correo y recuperación de contraseña. | Se incluyen cierre de sesión y callback de confirmación. **La recuperación de contraseña no está en el documento**; la propongo como historia P1 (D-12). |
| H-07 | M | El dashboard (8.1) lista nueve bloques; la mayoría depende de módulos que no existen en el Sprint 1. | Solo se muestran datos reales (tareas y proyectos) más accesos rápidos; nada de cifras inventadas (D-14). |
| H-08 | M | "Fecha de vencimiento" sin definir zona horaria (17.8) genera tareas "vencidas" erróneas según el huso. | `due_date` es `DATE` y "hoy" se calcula en la zona del perfil, por defecto `America/La_Paz` (D-08). |
| H-09 | M | El backlog de 50 historias (sección 12) solo da rangos; no hay texto, criterios ni prioridades P0/P1/P2. No hay trazabilidad real. | Se formalizan solo las historias del Sprint 1 (sección 5). El resto sigue pendiente (17.10). |
| H-10 | B | No hay definición de idioma de la interfaz ni de formatos de fecha/número. | Interfaz en español (es-BO), fechas `dd/mm/aaaa`, sin framework i18n en el MVP (D-10). |
| H-11 | B | UX: no hay wireframes, estados vacíos ni jerarquía de contenido definidos. | Se define una guía mínima en la sección 4. |
| H-12 | M | S1-03 (repositorio GitHub) y S1-04 (proyecto Supabase) son acciones manuales tuyas; no se pueden completar desde aquí. | Listadas en la sección 6. |
| H-13 | B | El documento nombra la clave pública `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Supabase también acepta la clave `anon` histórica. | Se usa la nomenclatura del documento; funciona con ambas en `@supabase/ssr`. |
| H-14 | B | Recharts figura en el stack, pero el Sprint 1 no necesita gráficos. | No se instala hasta el Sprint 2 (regla 13 de 15.1: evitar dependencias innecesarias). |

---

## 3. Decisiones técnicas del Sprint 1

Estas decisiones no modifican las aprobadas (DEC-001 a DEC-004); concretan lo que el documento deja abierto.

| ID | Decisión | Cierra |
|---|---|---|
| D-01 | `life_areas` es un catálogo **global** (sin `workspace_id`), sembrado por migración, con `SELECT` para `authenticated` y ninguna escritura. Códigos: WORK, FITNESS, NUTRITION, SLEEP, FINANCE, PERSONAL. | H-02 · 17.1 |
| D-02 | `authenticated` recibe `SELECT`, `INSERT` y `UPDATE` sobre `projects` y `tasks`. **Sin `DELETE`.** Archivar = `archived_at = now()`; restaurar = `archived_at = null`. | H-05 · 17.2 · 17.4 (parcial) |
| D-03 | Integridad entre workspaces mediante claves foráneas compuestas: `tasks(workspace_id, project_id) → projects(workspace_id, id)`. | H-03 |
| D-04 | Trigger `BEFORE UPDATE` que rechaza cualquier cambio de `workspace_id`. | H-04 |
| D-05 | `profiles.id = auth.users.id`. `workspaces.owner_id` es `UNIQUE` (un workspace por usuario). Un trigger `SECURITY DEFINER` sobre `auth.users` crea perfil y workspace en el registro. | S1-08 |
| D-06 | `owns_workspace(uuid)` es `SECURITY DEFINER`, `STABLE`, con `search_path = ''`, sin acceso para `anon`. Las políticas la invocan como `(select owns_workspace(workspace_id))` para que Postgres la evalúe una vez por consulta. | 17.3 |
| D-07 | Estados y prioridades como `text` + `CHECK` (no `ENUM` de Postgres) para poder evolucionarlos con migraciones simples. Tareas: `pending · in_progress · completed · cancelled`. Proyectos: `active · on_hold · completed`. Prioridades: `low · medium · high · urgent`. | 17.9 (Sprint 1) |
| D-08 | `due_date` es `DATE`. `profiles.timezone` (por defecto `America/La_Paz`) define qué es "hoy" para vencidas y próximas. | H-08 · 17.8 (parcial) |
| D-09 | `completed_at` lo fija un trigger de base de datos cuando `status` pasa a `completed`, y se limpia si vuelve a otro estado. No depende de la interfaz. | RNF-07 |
| D-10 | Interfaz en español; sin librería de i18n. | H-10 |
| D-11 | Hábitos se desarrollan en el Sprint 2. | H-01 |
| D-12 | Se incluyen cierre de sesión y confirmación de correo. Recuperación de contraseña: historia propuesta P1, no implementada. | H-06 |
| D-13 | Lecturas en Server Components; escrituras mediante Server Actions con validación Zod en servidor, además de las restricciones de PostgreSQL. | 7.3 |
| D-14 | El dashboard del Sprint 1 muestra únicamente datos reales de tareas y proyectos más accesos rápidos a los módulos. | H-07 |
| D-15 | Cada tarea tiene `project_id` **opcional** (tareas sueltas permitidas) y `life_area_id` opcional. | 8.2 |

Campos añadidos que el documento no nombra, con su justificación (regla 3 de 15.1):

- `projects.status`: el dashboard exige "proyectos activos".
- `tasks.completed_at`: necesario para "tareas completadas" por periodo y para el Sprint 5.
- `profiles.timezone`: D-08.
- `projects.due_date`: simétrico a las tareas; opcional.

---

## 4. Guía UX mínima (Sprint 1)

- **Navegación:** barra lateral fija en escritorio; en móvil, barra superior con menú desplegable. El Dashboard es la pantalla de inicio tras iniciar sesión.
- **Módulos sin construir:** Fitness, Nutrición, Sueño, Finanzas y Personal aparecen en la navegación con una pantalla "Próximamente". Así la estructura de seis dimensiones es visible desde el primer día sin simular funciones.
- **Trabajo:** una sola sección con dos pestañas, *Tareas* y *Proyectos*. Las tareas se filtran por estado, prioridad y proyecto, y se pueden ver archivadas.
- **Acción principal siempre visible:** botón "Nueva tarea" / "Nuevo proyecto" arriba a la derecha.
- **Completar una tarea** debe ser un solo toque (casilla en la lista), sin abrir formularios.
- **Estados obligatorios** en cada vista (9.2): carga (esqueleto), vacío (mensaje y acción) y error (mensaje y reintento).
- **Fechas vencidas** se marcan visualmente además de por color (texto "Vencida"), por accesibilidad (RNF-09).
- **Formularios:** etiquetas visibles, errores junto al campo, foco gestionado y uso por teclado.

---

## 5. Historias del Sprint 1 con criterios de aceptación

| Historia | Criterios de aceptación | Estado en esta entrega |
|---|---|---|
| S1-01/02 Entorno y Next.js | Proyecto Next.js + TypeScript estricto + Tailwind compila y pasa lint. | Hecho |
| S1-03 GitHub | Repositorio remoto conectado. | **Acción tuya** |
| S1-04 Proyecto Supabase | Proyecto creado y variables configuradas. | **Acción tuya** |
| S1-05 SSR | Clientes de servidor y navegador con `@supabase/ssr`; sesión refrescada en el Proxy; rutas privadas redirigen a `/login`. | Hecho (sin probar contra Supabase real) |
| S1-06 Migraciones y RLS | Migraciones versionadas; RLS activo en todas las tablas privadas; escenarios 1–4 de 7.4 rechazados. | Hecho y probado en PostgreSQL local (PGlite) |
| S1-07 Registro y acceso | Registro, acceso y cierre de sesión con validación en servidor y mensajes de error claros. | Implementado (sin probar contra Supabase real) |
| S1-08 Workspace automático | Al registrarse existen perfil y workspace; no se puede tener un segundo workspace. | Hecho y probado (PGlite) |
| S1-09 Layout | Sidebar en escritorio, navegación móvil, encabezado consistente, estados de carga y vacío. | Hecho |
| S1-10 Dashboard | Muestra tareas pendientes, vencidas, de hoy, proyectos activos y completadas recientes con datos reales. | Hecho |
| S1-11 Proyectos y tareas | Crear, editar, archivar y restaurar ambos; completar tareas; asociar tarea a proyecto y dimensión; filtrar por estado, prioridad y proyecto. | Hecho |

---

## 6. Acciones que dependen de ti

1. **S1-03:** crear el repositorio en GitHub y subir este proyecto.
2. **S1-04:** crear el proyecto en Supabase, copiar la URL y la clave pública a `.env.local` (ver `.env.example`).
3. Aplicar las migraciones de `supabase/migrations/` en orden (con la CLI de Supabase: `supabase db push`, o pegándolas en el editor SQL).
4. En Supabase → Authentication → URL Configuration, añadir `http://localhost:3000/auth/callback` como URL de redirección permitida.
5. Confirmar o corregir **D-11** (hábitos en el Sprint 2) y **D-12** (recuperación de contraseña como historia P1).

---

## 7. Pendiente del documento (sección 17)

Cerradas en `04-decisiones-sprint-3-finanzas.md` (sin implementar): 17.5 (moneda) y 17.6 (transferencias). Cerradas antes: 17.7 (hábitos, `02-decisiones-habitos.md`) y 17.9 de sueño, alimentación y entrenamiento (`03-decisiones-sprint-2.md`). Sin cerrar: 17.4 (eliminación definitiva), 17.8 (eventos de día completo), 17.9 de vida personal y 17.10 (criterios de las 50 historias).
