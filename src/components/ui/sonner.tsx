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

/**
 * Phones (top-center): below the notch and the offline badge (8px under the safe area, up to two lines), so a toast
 * never hides the badge. Sonner only applies mobileOffset under 600px; offset covers the 600–767px phone widths.
 */
const PHONE_OFFSET = { top: "calc(env(safe-area-inset-top) + 48px)" }
/**
 * Desktop (bottom-right): left of the 40px map control column (8px margin + 40px + 12px gap, plus the landscape-phone
 * safe area), so a long-lived toast never covers zoom, layers or my location.
 */
const DESKTOP_OFFSET = { right: "calc(env(safe-area-inset-right) + 60px)" }

const Toaster = ({ ...props }: ToasterProps) => {
  // Follow the app's own dark mode (body.dark), which can differ from the OS
  // preference. The upstream component uses next-themes, which this app does
  // not use.
  const isDarkMode = useDarkMode()
  // Phones: the bottom sheet owns the bottom edge
  const isMobile = useIsMobile()

  return (
    <Sonner
      theme={isDarkMode ? "dark" : "light"}
      className="toaster group"
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
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      // Dutch names for the toast region and the close buttons (sonner's defaults are English); not "Meldingen", that is the notification settings dialog
      containerAriaLabel="Pop-upberichten"
      toastOptions={{
        closeButton: true,
        closeButtonAriaLabel: "Sluiten",
        classNames: {
          description: "text-muted-foreground!",
          actionButton: "bg-primary-container! text-on-primary-container!",
          cancelButton: "bg-muted! text-muted-foreground!",
          // 24px instead of sonner's 20px; on touch an invisible ::after grows the target to 44px
          closeButton: "size-6! pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5 pointer-coarse:after:content-['']",
        },
      }}
      position={isMobile ? "top-center" : "bottom-right"}
      offset={isMobile ? PHONE_OFFSET : DESKTOP_OFFSET}
      mobileOffset={PHONE_OFFSET}
      {...props}
    />
  )
}

export { Toaster }
