"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "auto" | "light" | "dark";
const ORDER: Theme[] = ["auto", "light", "dark"];
const LABEL: Record<Theme, string> = { auto: "automático", light: "claro", dark: "oscuro" };

function apply(theme: Theme) {
  if (theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    if (theme === "auto") localStorage.removeItem("theme");
    else localStorage.setItem("theme", theme);
  } catch {
    /* sin almacenamiento: el cambio vale solo para esta visita */
  }
}

/** Alterna automático → claro → oscuro. Se recuerda en este dispositivo. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    // Se lee una vez al montar, para reflejar lo que dejó el script inicial.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(t === "light" || t === "dark" ? t : "auto");
  }, []);

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const nextTheme = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Tema ${LABEL[theme]}. Cambiar a ${LABEL[nextTheme]}`}
      title={`Tema ${LABEL[theme]}`}
      onClick={() => {
        apply(nextTheme);
        setTheme(nextTheme);
      }}
    >
      <Icon aria-hidden />
    </Button>
  );
}
