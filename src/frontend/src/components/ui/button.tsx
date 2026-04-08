import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Pill Primary Dark — main CTA
        default:
          "bg-[#181e25] text-white hover:bg-[#2d3748] rounded-[8px] px-5 py-[11px]",
        // Pill Nav — navigation tabs / filter toggles
        nav: "bg-black/5 text-[#18181b] hover:bg-black/10 rounded-full dark:bg-white/10 dark:text-white dark:hover:bg-white/20",
        // Pill White — secondary nav
        pillWhite:
          "bg-white/50 text-[rgba(24,30,37,0.8)] hover:bg-white rounded-full border border-border",
        // Secondary Light
        secondary:
          "bg-[#f0f0f0] text-[#333333] hover:bg-[#e0e0e0] rounded-[8px] px-5 py-[11px] dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/80",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-[8px]",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-[8px]",
        ghost:
          "hover:bg-accent hover:text-accent-foreground rounded-[8px]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-[8px] px-3 text-xs",
        lg: "h-12 rounded-[8px] px-6 text-base",
        icon: "h-9 w-9 rounded-[8px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
