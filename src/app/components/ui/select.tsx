"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";

import { cn, stripFigmaProps } from "./utils";

// Wrapper to prevent Figma Make's compiler from injecting _fg* props into Radix primitives
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

const CleanRoot = createCleanRadix(SelectPrimitive.Root)
const CleanGroup = createCleanRadix(SelectPrimitive.Group)
const CleanValue = createCleanRadix(SelectPrimitive.Value)
const CleanTrigger = createCleanRadix(SelectPrimitive.Trigger, true)
const CleanIcon = createCleanRadix(SelectPrimitive.Icon)
const CleanPortal = createCleanRadix(SelectPrimitive.Portal)
const CleanContent = createCleanRadix(SelectPrimitive.Content)
const CleanViewport = createCleanRadix(SelectPrimitive.Viewport)
const CleanLabel = createCleanRadix(SelectPrimitive.Label)
const CleanItem = createCleanRadix(SelectPrimitive.Item)
const CleanItemIndicator = createCleanRadix(SelectPrimitive.ItemIndicator)
const CleanItemText = createCleanRadix(SelectPrimitive.ItemText)
const CleanSeparator = createCleanRadix(SelectPrimitive.Separator)
const CleanScrollUpButton = createCleanRadix(SelectPrimitive.ScrollUpButton)
const CleanScrollDownButton = createCleanRadix(SelectPrimitive.ScrollDownButton)

type SelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

type SelectProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root> & {
  options?: SelectOption[];
  label?: React.ReactNode;
  placeholder?: React.ReactNode;
  className?: string;
};

const SelectGroup = CleanGroup;

const SelectValue = CleanValue;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
    size?: "sm" | "default";
  }
>(({ className, children, size = "default", ...props }, ref) => {
  return (
    <CleanTrigger
      ref={ref}
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "uiSelectTrigger data-[placeholder]:text-muted-foreground relative flex w-full min-w-0 items-center gap-2 border pr-9 whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-50 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <CleanIcon asChild>
        <ChevronDownIcon className="absolute right-3 top-1/2 size-4 -translate-y-1/2 opacity-50" />
      </CleanIcon>
    </CleanTrigger>
  );
});
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => {
  return (
    <CleanPortal>
      <CleanContent
        ref={ref}
        data-slot="select-content"
        className={cn(
          "uiSelectContent data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-[200] max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <CleanViewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1",
          )}
        >
          {children}
        </CleanViewport>
        <SelectScrollDownButton />
      </CleanContent>
    </CleanPortal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => {
  return (
    <CleanLabel
      ref={ref}
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  );
});
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => {
  return (
    <CleanItem
      ref={ref}
      data-slot="select-item"
      className={cn(
        "uiSelectItem relative flex w-full cursor-default items-center gap-2 pr-8 pl-2 outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <CleanItemIndicator>
          <CheckIcon className="size-4" />
        </CleanItemIndicator>
      </span>
      <CleanItemText>{children}</CleanItemText>
    </CleanItem>
  );
});
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => {
  return (
    <CleanSeparator
      ref={ref}
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
});
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => {
  return (
    <CleanScrollUpButton
      ref={ref}
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className,
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </CleanScrollUpButton>
  );
});
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => {
  return (
    <CleanScrollDownButton
      ref={ref}
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className,
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </CleanScrollDownButton>
  );
});
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

function Select({ options, label, placeholder, className, children, ...props }: SelectProps) {
  if (!options) {
    return <CleanRoot {...props}>{children}</CleanRoot>;
  }

  const select = (
    <CleanRoot {...props}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </CleanRoot>
  );

  if (!label) return select;

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium leading-none text-foreground">{label}</label>
      {select}
    </div>
  );
}
Select.displayName = SelectPrimitive.Root.displayName || "Select";

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
