import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import * as React from "react";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress",
  {
    variants: {
      variant: {
        default:
          "bg-brand-gradient text-white shadow-[0_0_0_1px_rgb(255_255_255/0.08)_inset] hover:brightness-110 hover:shadow-[0_6px_24px_-8px_rgb(153_69_255/0.7)] active:brightness-95",
        outline:
          "border-border bg-card-elevated/60 text-foreground hover:border-brand-purple/70 hover:bg-secondary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70 hover:text-foreground",
        ghost: "hover:bg-secondary hover:text-foreground",
      },
      size: {
        default: "h-9 gap-1.5 px-3.5",
        sm: "h-8 gap-1.5 px-3 text-[0.8rem]",
        lg: "h-11 gap-2 px-5 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
