# PERSONAL OS

Aplicación web modular para gestionar las dimensiones de la vida personal (trabajo, entrenamiento, alimentación, sueño, finanzas y vida personal).
Stack: Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Auth, PostgreSQL, RLS) · `@supabase/ssr` · Recharts.

**Estado:** Sprint 1 implementado (autenticación, workspace automático, layout, dashboard, proyectos y tareas)
y, del Sprint 2, los módulos de hábitos y sueño (alimentación y entrenamiento: decididos, sin implementar).
La revisión del documento de especificación y las decisiones técnicas están en
[`docs/01-revision-y-decisiones-sprint-1.md`](docs/01-revision-y-decisiones-sprint-1.md) y
[`docs/02-decisiones-habitos.md`](docs/02-decisiones-habitos.md) y
[`docs/03-decisiones-sprint-2.md`](docs/03-decisiones-sprint-2.md).

## Puesta en marcha

Requisitos: Node.js 22+ y un proyecto de Supabase.

```bash
npm install
cp .env.example .env.local      # completa URL y clave pública de tu proyecto Supabase
npm run dev                      # http://localhost:3000
```

### Base de datos

Aplica las migraciones de `supabase/migrations/` en orden: 

```bash
supabase link --project-ref <tu-ref>
supabase db push
```

También puedes pegarlas en el editor SQL de Supabase, en orden de nombre de archivo.

En **Authentication → URL Configuration** añade `http://localhost:3000/auth/callback` como URL de redirección permitida.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | Comprobación de tipos (TypeScript estricto) |
| `npm test` | Pruebas de seguridad RLS sobre PostgreSQL real en memoria (PGlite) |

## Estructura

```text
src/app/            Rutas (grupos (auth) y (dashboard))
src/components/     ui/ (base estilo shadcn), layout/, dashboard/, shared/
src/features/       Lógica por dominio: auth, projects, tasks
src/lib/            supabase/, auth/ (capa de acceso a datos), validations/, utils/, constants/
src/proxy.ts        Refresco de sesión y redirección optimista de rutas privadas
supabase/migrations Esquema, funciones, triggers y políticas RLS versionados
tests/rls/          Escenarios de seguridad de la sección 7.4 del documento
docs/               Revisión del documento y decisiones técnicas
```

## Seguridad

- RLS activo en todas las tablas privadas; `owns_workspace()` centraliza la propiedad.
- `authenticated` no tiene `DELETE`: el borrado es lógico mediante `archived_at`.
- El `workspace_id` de las escrituras lo determina el servidor, nunca el formulario.
- No uses la clave `service_role` en variables `NEXT_PUBLIC_*`.

## Pendiente

Ver la sección 6 (acciones tuyas) y la 7 (decisiones abiertas de la sección 17 del documento) en
`docs/01-revision-y-decisiones-sprint-1.md`.
