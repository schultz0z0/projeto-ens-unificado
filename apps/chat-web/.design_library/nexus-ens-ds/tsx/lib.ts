// ==========================================================================
// Nexus ENS Design System — utility cn (mirror of /src/lib/utils.ts)
// Use this if consuming the .tsx components outside the chat-web project.
// Inside chat-web, prefer `import { cn } from "@/lib/utils"`.
// ==========================================================================
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
