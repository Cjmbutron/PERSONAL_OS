import { cn } from "@/lib/utils/cn";

/** Mensaje global de un formulario (error o éxito). Se anuncia a lectores de pantalla. */
export function FormMessage({
  message,
  tone = "error",
  className,
}: {
  message?: string;
  tone?: "error" | "success";
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        tone === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-success/30 bg-success/10 text-success",
        className,
      )}
    >
      {message}
    </p>
  );
}
