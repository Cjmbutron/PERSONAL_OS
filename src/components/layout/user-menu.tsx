import { LogOut } from "lucide-react";
import { signOut } from "@/features/auth/actions";
import { getWorkspaceContext } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Lee la sesión: debe renderizarse detrás de <Suspense> (Cache Components). */
export async function UserMenu() {
  const { profile, email } = await getWorkspaceContext();
  const name = profile.full_name ?? email ?? "Usuario";
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-tight">{name}</p>
        {profile.full_name && email ? <p className="text-xs text-muted-foreground">{email}</p> : null}
      </div>
      <span
        aria-hidden
        className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
      >
        {initial}
      </span>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm" aria-label="Cerrar sesión">
          <LogOut aria-hidden />
          <span className="hidden sm:inline">Salir</span>
        </Button>
      </form>
    </div>
  );
}

export function UserMenuSkeleton() {
  return <Skeleton className="h-8 w-32" />;
}
