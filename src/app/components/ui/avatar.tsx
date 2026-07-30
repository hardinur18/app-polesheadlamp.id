"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "./utils";

// Strip Figma inspector props (_fgT, _fgS, _fgB, etc.) that leak into DOM elements
// from Figma Make's FGCmp wrapper system.
function stripFigmaProps<T extends Record<string, unknown>>(props: T): T {
  return Object.fromEntries(
    Object.entries(props).filter(([key]) => !key.startsWith("_fg"))
  ) as T;
}

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-10 shrink-0 overflow-hidden rounded-full",
        className,
      )}
      {...stripFigmaProps(props as unknown as Record<string, unknown>)}
    />
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...stripFigmaProps(props as unknown as Record<string, unknown>)}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className,
      )}
      {...stripFigmaProps(props as unknown as Record<string, unknown>)}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };