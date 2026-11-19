import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Adorable pastel claymorphic buttons: tactile press, rounded pills, soft bevel highlights. */
export const worldButton = cva(
  "inline-flex items-center justify-center gap-2 font-heading font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-scrim disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.97] cursor-pointer",
  {
    variants: {
      variant: {
        hero: "bg-wood-plank leaf-sprout border border-amber/70 font-heading tracking-wide text-white [text-shadow:0_1px_2px_rgba(50,25,20,0.5)] hover:brightness-105 hover:-translate-y-0.5 shadow-clay",
        glass: "glass-panel text-cream hover:bg-secondary/80 hover:-translate-y-0.5 shadow-clay",
        clay: "bg-gradient-to-b from-butter to-peach text-deep-plum border border-white/60 shadow-clay hover:brightness-105 hover:-translate-y-0.5",
        icon: "glass-panel text-cream hover:bg-secondary/80 rounded-full shadow-clay",
        ghost: "rounded-full text-muted-foreground hover:bg-secondary/50 hover:text-cream",
      },
      size: {
        lg: "h-14 rounded-full px-8 text-lg font-bold",
        md: "h-11 rounded-full px-5 text-sm",
        sm: "h-9 rounded-full px-4 text-xs",
        icon: "h-11 w-11 rounded-full",
        iconLg: "h-14 w-14 rounded-full",
      },
    },
    defaultVariants: { variant: "glass", size: "md" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof worldButton>;

export const WorldButton = forwardRef<HTMLButtonElement, Props>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(worldButton({ variant, size }), className)} {...props} />
));
WorldButton.displayName = "WorldButton";
