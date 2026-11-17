import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/cn"
import { Slot } from "radix-ui"
import { COARSE_HIT_AREA, ICON_XS_HIT_AREA } from "@/lib/hit-area"
import { TONAL_HOVER } from "@/lib/tonal-button"

/** Every size and variant: 12px corners and semibold labels, like the app's tonal buttons */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary-container text-on-primary-container hover:bg-[color-mix(in_oklab,var(--on-primary-container)_10%,var(--primary-container))]",
        // --destructive-fill: white text 4.8:1 light, 8.7:1 on the darker dark fill. Hover darkens; /90 lightened to 4.3:1
        destructive:
          "bg-destructive-fill text-white hover:bg-[color-mix(in_oklab,var(--destructive-fill)_88%,black)] focus-visible:ring-destructive",
        // Secondary action: the grey tonal sidebar button (TONAL_BUTTON) without border or shadow
        outline:
          `border-0 bg-beheer-row-high text-foreground shadow-none ${TONAL_HOVER} hover:text-foreground`,
        // Grey tonal pill (VehicleMenu, Life360 members, Jotiboard menu): row-high with the shared tonal hover
        secondary:
          `bg-beheer-row-high text-foreground ${TONAL_HOVER}`,
        ghost:
          "hover:bg-beheer-row-high hover:text-foreground",
        link: "text-primary-text underline-offset-4 hover:underline",
      },
      size: {
        // default / lg / icon-lg are under 44px too: the same invisible touch area, so dense layouts keep their size
        default: `${COARSE_HIT_AREA} h-9 px-4 py-2 has-[>svg]:px-3`,
        xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        // sm / icon / icon-sm are under 44px: on phones COARSE_HIT_AREA grows the touch area (parent needs `isolate`)
        sm: `${COARSE_HIT_AREA} h-8 gap-1.5 px-3 has-[>svg]:px-2.5`,
        // Full-width primary CTAs: 44px tall on touch screens
        lg: `${COARSE_HIT_AREA} h-10 px-6 pointer-coarse:h-11 has-[>svg]:px-4`,
        icon: `${COARSE_HIT_AREA} size-9`,
        // 24px button, 44px tall hit area that never overlaps a neighbour 4px away (ICON_XS_HIT_AREA)
        "icon-xs": `${ICON_XS_HIT_AREA} [&_svg:not([class*='size-'])]:size-3`,
        "icon-sm": `${COARSE_HIT_AREA} size-8`,
        "icon-lg": `${COARSE_HIT_AREA} size-10`,
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
