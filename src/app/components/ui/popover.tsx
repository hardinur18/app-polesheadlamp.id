"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn, stripFigmaProps } from "./utils";

function createCleanRadix<T extends React.ElementType>(Primitive: T, wrapAsChild: boolean = false) {
  const CleanPrimitive = React.forwardRef<React.ElementRef<T>, React.ComponentPropsWithoutRef<T>>(
    (props, ref) => {
      const cleanProps = stripFigmaProps(props as Record<string, unknown>);
      
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

const CleanRoot = createCleanRadix(PopoverPrimitive.Root);
const CleanTrigger = createCleanRadix(PopoverPrimitive.Trigger, true);
const CleanPortal = createCleanRadix(PopoverPrimitive.Portal);
const CleanContent = createCleanRadix(PopoverPrimitive.Content);
const CleanAnchor = createCleanRadix(PopoverPrimitive.Anchor);

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <CleanRoot data-slot="popover" {...props} />;
}

const PopoverTrigger = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>
>(({ ...props }, ref) => {
  return <CleanTrigger ref={ref} data-slot="popover-trigger" {...props} />;
});
PopoverTrigger.displayName = PopoverPrimitive.Trigger.displayName;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => {
  return (
    <CleanPortal>
      <CleanContent
        ref={ref}
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "border border-border bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-xl p-4 shadow-lg outline-hidden",
          className,
        )}
        {...props}
      />
    </CleanPortal>
  );
});
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <CleanAnchor data-slot="popover-anchor" {...props} />;
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
