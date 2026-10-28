import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** One nature look for every button: wooden planks with a leaf sprout, forest glass for quieter actions. */
export const worldButton = cva(
  "inline-flex items-center justify-center gap-2 font-heading font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-scrim disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        hero: "bg-wood-plank leaf-sprout border border-amber/60 font-swag tracking-wide text-cream [text-shadow:0_1px_0_oklch(0.3_0.07_45/0.8)] hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0",
        glass: "glass-panel text-cream hover:bg-secondary/80 hover:-translate-y-0.5 active:translate-y-0",
        icon: "glass-panel text-cream hover:bg-secondary/80",
        ghost: "rounded-xl text-muted-foreground hover:bg-secondary/40 hover:text-cream",
      },
      size: {
        lg: "h-14 rounded-2xl px-7 text-lg",
        md: "h-11 rounded-xl px-5 text-sm",
        icon: "h-11 w-11 rounded-xl",
        iconLg: "h-16 w-16 rounded-2xl",
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
