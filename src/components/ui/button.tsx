import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"
import { COARSE_HIT_AREA, ICON_XS_HIT_AREA } from "@/lib/hit-area"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary-container text-on-primary-container hover:bg-[color-mix(in_oklab,var(--on-primary-container)_10%,var(--primary-container))]",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-border dark:bg-border/30 dark:hover:bg-border/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        // sm / icon / icon-sm are under 44px: on phones COARSE_HIT_AREA grows the touch area (parent needs `isolate`)
        sm: `${COARSE_HIT_AREA} h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5`,
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: `${COARSE_HIT_AREA} size-9`,
        // 24px button, 44px tall hit area that never overlaps a neighbour 4px away (ICON_XS_HIT_AREA)
        "icon-xs": `${ICON_XS_HIT_AREA} rounded-md [&_svg:not([class*='size-'])]:size-3`,
        "icon-sm": `${COARSE_HIT_AREA} size-8`,
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
