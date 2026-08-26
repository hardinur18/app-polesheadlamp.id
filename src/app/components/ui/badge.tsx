import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn, stripInternalDomProps } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  status,
  size,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    status?: string;
    size?: "sm" | "md" | string;
  }) {
  const Comp = asChild ? Slot : "span";
  const normalizedStatus = status?.toLowerCase();
  const statusLabel: Record<string, string> = {
    pending: "Terjadwal",
    processing: "Proses",
    waiting: "Menunggu",
    done: "Selesai",
    completed: "Selesai",
    cancelled: "Batal",
    reschedule: "Jadwal Ulang",
    otw: "OTW",
    working: "Dikerjakan",
    qc: "QC",
    teknisi_completed: "Menunggu QC",
  };
  const statusClassName: Record<string, string> = {
    pending: "border-yellow-200 bg-yellow-50 text-yellow-700",
    processing: "border-blue-200 bg-blue-50 text-blue-700",
    waiting: "border-amber-200 bg-amber-50 text-amber-700",
    done: "border-emerald-200 bg-emerald-50 text-emerald-700",
    completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cancelled: "border-red-200 bg-red-50 text-red-700",
    reschedule: "border-orange-200 bg-orange-50 text-orange-700",
    otw: "border-sky-200 bg-sky-50 text-sky-700",
    working: "border-blue-200 bg-blue-50 text-blue-700",
    qc: "border-purple-200 bg-purple-50 text-purple-700",
    teknisi_completed: "border-purple-200 bg-purple-50 text-purple-700",
  };
  const renderedChildren = children ?? (normalizedStatus ? statusLabel[normalizedStatus] || status : undefined);

  return (
    <Comp
      data-slot="badge"
      className={cn(
        badgeVariants({ variant: status ? "outline" : variant }),
        normalizedStatus && statusClassName[normalizedStatus],
        size === "sm" && "px-1.5 py-0 text-[10px]",
        className,
      )}
      {...stripInternalDomProps(props as unknown as Record<string, unknown>)}
    >
      {renderedChildren}
    </Comp>
  );
}

export { Badge, badgeVariants };
