import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn, stripFigmaProps } from "./utils"

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

const CleanRoot = createCleanRadix(SheetPrimitive.Root)
const CleanTrigger = createCleanRadix(SheetPrimitive.Trigger, true)
const CleanClose = createCleanRadix(SheetPrimitive.Close)
const CleanPortal = createCleanRadix(SheetPrimitive.Portal)
const CleanOverlay = createCleanRadix(SheetPrimitive.Overlay)
const CleanContent = createCleanRadix(SheetPrimitive.Content)
const CleanTitle = createCleanRadix(SheetPrimitive.Title)
const CleanDescription = createCleanRadix(SheetPrimitive.Description)

const Sheet = CleanRoot

const SheetTrigger = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Trigger>
>((props, ref) => (
  <CleanTrigger {...props} ref={ref} />
))
SheetTrigger.displayName = SheetPrimitive.Trigger.displayName

const SheetClose = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Close>
>((props, ref) => (
  <CleanClose {...props} ref={ref} />
))
SheetClose.displayName = SheetPrimitive.Close.displayName

const SheetPortal = CleanPortal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <CleanOverlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
    showOverlay?: boolean;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, showOverlay = true, ...props }, ref) => (
  <SheetPortal>
    {showOverlay && <SheetOverlay />}
    <CleanContent
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      <CleanClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </CleanClose>
    </CleanContent>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...stripFigmaProps(props as Record<string, unknown>)}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...stripFigmaProps(props as Record<string, unknown>)}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <CleanTitle
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <CleanDescription
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}