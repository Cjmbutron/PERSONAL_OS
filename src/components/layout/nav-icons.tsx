import {
  Apple,
  Briefcase,
  ClipboardCheck,
  Dumbbell,
  Flame,
  LayoutDashboard,
  Moon,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ModuleDefinition } from "@/lib/constants/labels";

export const MODULE_ICONS: Record<ModuleDefinition["code"], LucideIcon> = {
  DASHBOARD: LayoutDashboard,
  WORK: Briefcase,
  HABITS: Flame,
  FITNESS: Dumbbell,
  NUTRITION: Apple,
  SLEEP: Moon,
  FINANCE: Wallet,
  PERSONAL: Sparkles,
  REVIEW: ClipboardCheck,
};
