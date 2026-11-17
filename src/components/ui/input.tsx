import * as React from "react"
import { cn } from "@/lib/cn"
import { TONAL_FIELD } from "@/lib/tonal-field"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        TONAL_FIELD,
        "h-9 w-full min-w-0 px-3 py-1 transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:ring-[3px] focus-visible:ring-ring",
        // the hairline turns red; the ring keeps its soft red halo
        "aria-invalid:shadow-[inset_0_0_0_1px_var(--destructive)] aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
