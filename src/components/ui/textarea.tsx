import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { controlClasses } from "./input";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(controlClasses, "min-h-24 resize-y", className)} {...props} />;
}
