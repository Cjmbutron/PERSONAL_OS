import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { CornerDownRight, Pencil, Plus, Tags } from "lucide-react";
import { getWorkspaceContext } from "@/lib/auth/session";
import { CATEGORY_KIND_LABELS } from "@/lib/constants/labels";
import { listCategories } from "@/features/finance/queries";
import { setCategoryArchived } from "@/features/finance/actions";
import { ArchiveButton } from "@/features/finance/components/archive-button";
import { CategoryFormDialog } from "@/features/finance/components/category-form-dialog";
import { CATEGORY_KINDS } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton, PageTitleSkeleton } from "@/components/shared/skeletons";

export const metadata: Metadata = { title: "Categorías" };

/** Cada categoría principal seguida de sus subcategorías. */
function ordered<T extends { id: string; name: string; parent_id: string | null }>(items: T[]): T[] {
  const ids = new Set(items.map((i) => i.id));
  const roots = items.filter((i) => !i.parent_id || !ids.has(i.parent_id));
  return roots.flatMap((r) => [r, ...items.filter((i) => i.parent_id === r.id)]);
}

const archivedSchema = z.enum(["1"]).optional().catch(undefined);

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default function CategoriesPage({ searchParams }: PageProps<"/finance/categories">) {
  return (
    <Suspense
      fallback={
        <>
          <PageTitleSkeleton />
          <ListSkeleton />
        </>
      }
    >
      <CategoriesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CategoriesContent({ searchParams }: { searchParams: PageProps<"/finance/categories">["searchParams"] }) {
  const raw = await searchParams;
  const archived = archivedSchema.parse(first(raw.archived)) === "1";
  const ctx = await getWorkspaceContext();
  const categories = await listCategories(ctx.workspace.id, { archived });

  return (
    <>
      <PageHeader
        title="Categorías"
        description={archived ? "Categorías archivadas. Puedes restaurarlas." : "Clasifica tus ingresos y gastos."}
        actions={
          !archived ? (
            <CategoryFormDialog
              trigger={
                <Button>
                  <Plus aria-hidden />
                  Nueva categoría
                </Button>
              }
            />
          ) : undefined
        }
      />

      <nav aria-label="Vista" className="mb-4 flex gap-2 text-sm">
        <Link href="/finance/categories" aria-current={archived ? undefined : "page"} className={archived ? "text-muted-foreground hover:text-foreground" : "font-medium text-primary"}>
          Activas
        </Link>
        <span aria-hidden className="text-muted-foreground">·</span>
        <Link href="/finance/categories?archived=1" aria-current={archived ? "page" : undefined} className={archived ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}>
          Archivadas
        </Link>
      </nav>

      {categories.length === 0 ? (
        <EmptyState icon={Tags} title={archived ? "No tienes categorías archivadas" : "Aún no tienes categorías"} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {CATEGORY_KINDS.map((kind) => {
            const items = categories.filter((c) => c.kind === kind);
            return (
              <Card key={kind}>
                <CardHeader>
                  <CardTitle className="text-base">{CATEGORY_KIND_LABELS[kind]}</CardTitle>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin categorías.</p>
                  ) : (
                    <ul className="divide-y divide-border" aria-label={CATEGORY_KIND_LABELS[kind]}>
                      {ordered(items).map((c) => (
                        <li key={c.id} className={`flex items-center justify-between gap-2 py-1.5 ${c.parent_id ? "pl-6" : ""}`}>
                          <span className="flex min-w-0 items-center gap-1.5 truncate text-sm">
                            {c.parent_id ? <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
                            {c.name}
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            {!archived && !c.parent_id ? (
                              <CategoryFormDialog
                                parent={c}
                                trigger={
                                  <Button variant="ghost" size="icon-sm" aria-label={`Añadir una subcategoría a ${c.name}`}>
                                    <Plus aria-hidden />
                                  </Button>
                                }
                              />
                            ) : null}
                            {!archived ? (
                              <CategoryFormDialog
                                category={c}
                                trigger={
                                  <Button variant="ghost" size="icon-sm" aria-label={`Editar la categoría ${c.name}`}>
                                    <Pencil aria-hidden />
                                  </Button>
                                }
                              />
                            ) : null}
                            <ArchiveButton action={setCategoryArchived} id={c.id} archived={archived} label={`la categoría ${c.name}`} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
