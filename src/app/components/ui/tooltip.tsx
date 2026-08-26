"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn, stripInternalDomProps } from "./utils";

function createCleanRadix<T extends React.ElementType>(Primitive: T, wrapAsChild: boolean = false) {
  const CleanPrimitive = React.forwardRef<React.ElementRef<T>, React.ComponentPropsWithoutRef<T>>(
    (props, ref) => {
      const cleanProps = stripInternalDomProps(props as Record<string, unknown>);
      
      if (wrapAsChild && cleanProps.asChild && React.isValidElement(cleanProps.children)) {
        if (typeof cleanProps.children.type !== 'string') {
          cleanProps.children = React.createElement(
            "div",
            { className: "relative inline-flex items-center justify-center" },
            cleanProps.children
          ) as unknown as React.ReactNode;
        }
      }

      const { children, ...rest } = cleanProps;
      return React.createElement(Primitive, { ...rest, ref } as any, children as React.ReactNode);
    }
  );
  CleanPrimitive.displayName = (Primitive as any).displayName || "CleanPrimitive";
  return CleanPrimitive;
}

const CleanTrigger = createCleanRadix(TooltipPrimitive.Trigger, true);
const CleanContent = createCleanRadix(TooltipPrimitive.Content);
const CleanArrow = createCleanRadix(TooltipPrimitive.Arrow);
const CleanPortal = createCleanRadix(TooltipPrimitive.Portal);

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  const { children, ...cleanProps } = stripInternalDomProps(
    props as Record<string, unknown>,
  ) as unknown as React.ComponentProps<typeof TooltipPrimitive.Provider>;

  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...cleanProps}
    >
      {children}
    </TooltipPrimitive.Provider>
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...stripInternalDomProps(props as Record<string, unknown>)} />
    </TooltipProvider>
  );
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <CleanTrigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <CleanPortal>
      <CleanContent
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
          className,
        )}
        {...props}
      >
        {children}
        <CleanArrow className="bg-primary fill-primary z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
      </CleanContent>
    </CleanPortal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
