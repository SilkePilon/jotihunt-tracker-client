import type {CSSProperties} from "react"
import {Toaster as Sonner} from "sonner"
import {useDarkMode} from "@/hooks/utils/darkmode.hook.ts"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({...props}: ToasterProps) => {
    // Follow the app's own dark mode (body.dark), which can differ from the OS preference
    const isDarkMode = useDarkMode()

    return (
        <Sonner
            theme={isDarkMode ? "dark" : "light"}
            className="toaster group"
            style={
                {
                    "--normal-bg": "var(--popover)",
                    "--normal-text": "var(--popover-foreground)",
                    "--normal-border": "var(--border)",
                } as CSSProperties
            }
            toastOptions={{
                closeButton: true,
                classNames: {
                    description: "text-muted-foreground!",
                    actionButton: "bg-primary! text-primary-foreground!",
                    cancelButton: "bg-muted! text-muted-foreground!",
                },
            }}
            {...props}
        />
    )
}

export {Toaster}
