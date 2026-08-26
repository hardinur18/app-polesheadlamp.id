import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function stripInternalDomProps<T extends Record<string, unknown>>(props: T): T {
  return Object.fromEntries(
    Object.entries(props).filter(([key]) => !key.startsWith("_fg"))
  ) as T;
}
