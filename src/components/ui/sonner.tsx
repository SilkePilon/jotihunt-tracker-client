import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { useDarkMode } from "@/hooks/utils/darkmode.hook.ts"
import { useIsMobile } from "@/hooks/media.hook"
import { phoneToastOffset } from "@/lib/top-stack"
import useTopStackStore from "@/stores/top-stack.store"
import { COARSE_HIT_AREA } from "@/lib/hit-area"

/**
 * Desktop (bottom-right): left of the 40px map control column (8px margin + 40px + 12px gap, plus the landscape-phone
 * safe area), so a long-lived toast never covers zoom, layers or my location.
 */
const DESKTOP_OFFSET = { right: "calc(env(safe-area-inset-right) + 60px)" }

/** Action / cancel buttons: `!` beats sonner's own [data-button] rules */
const TOAST_BUTTON = `${COARSE_HIT_AREA} h-8! rounded-xl! px-3! text-[13px]! font-semibold! focus-visible:ring-[3px]! focus-visible:ring-ring!`

const Toaster = ({ ...props }: ToasterProps) => {
  // Follow the app's own dark mode (body.dark), which can differ from the OS
  // preference. The upstream component uses next-themes, which this app does
  // not use.
  const isDarkMode = useDarkMode()
  // Phones: the bottom sheet owns the bottom edge
  const isMobile = useIsMobile()
  // Phones (top-center): below the offline badge, the happy-hour pill and the drawing toolbar while they are shown
  // (lib/top-stack.ts). Sonner only applies mobileOffset under 600px; offset covers the 600–767px phone widths.
  const heights = useTopStackStore((s) => s.heights)
  const phoneOffset = phoneToastOffset(heights)

  return (
    <Sonner
      theme={isDarkMode ? "dark" : "light"}
      // The stack eases down/up when the badge, pill or toolbar above it comes or goes (sonner's own transform transition kept)
      className="toaster group transition-[top,transform]! duration-300! ease-out! motion-reduce:transition-none!"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          // The menu card look (MENU_SURFACE): 24px corners, no border; the hairline + soft shadow come from classNames.toast
          "--normal-border": "transparent",
          "--border-radius": "24px",
        } as React.CSSProperties
      }
      // Dutch names for the toast region and the close buttons (sonner's defaults are English); not "Meldingen", that is the notification settings dialog
      containerAriaLabel="Pop-upberichten"
      toastOptions={{
        closeButton: true,
        closeButtonAriaLabel: "Sluiten",
        classNames: {
          // Keeps sonner's own focus ring visible: ring-* composes with this shadow
          toast: "border-0! shadow-(--shadow-menu)! focus-visible:ring-[3px] focus-visible:ring-ring",
          description: "text-muted-foreground!",
          // The app's small buttons (h-8, 12px corners, 13px semibold, 3px focus ring) instead of sonner's 24px / 4px
          // corners; on touch an invisible ::after grows the target to 44px (the toast is its own stacking context)
          actionButton: `${TOAST_BUTTON} bg-primary-container! text-on-primary-container!`,
          // Tonal like the other secondary buttons
          cancelButton: `${TOAST_BUTTON} bg-beheer-row-high! text-foreground!`,
          // 24px instead of sonner's 20px, with the card hairline so its edge reads where it overhangs the toast's
          // corner; on touch an invisible ::after grows the target to 44px
          closeButton: "size-6! shadow-[0_0_0_1px_var(--border)]! focus-visible:ring-[3px] focus-visible:ring-ring pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5 pointer-coarse:after:content-['']",
        },
      }}
      position={isMobile ? "top-center" : "bottom-right"}
      offset={isMobile ? phoneOffset : DESKTOP_OFFSET}
      mobileOffset={phoneOffset}
      {...props}
    />
  )
}

export { Toaster }
