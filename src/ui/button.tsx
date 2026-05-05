import { Button as Kobalte } from "@kobalte/core/button"
import { type ComponentProps, splitProps } from "solid-js"

export interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost"
  size?: "sm" | "md" | "lg"
}

export function Button(props: ComponentProps<"button"> & ButtonProps) {
  const [split, rest] = splitProps(props, ["variant", "size", "class", "classList"])
  return (
    <Kobalte
      {...rest}
      data-size={split.size || "sm"}
      data-variant={split.variant || "secondary"}
      class="inline-flex items-center justify-center rounded-md cursor-pointer font-medium transition-all duration-[var(--duration-normal)]
             min-w-0 whitespace-nowrap truncate shrink-0
             data-[size=sm]:h-7 data-[size=sm]:px-2.5 data-[size=sm]:text-[11px] data-[size=sm]:gap-1
             data-[size=md]:h-8 data-[size=md]:px-3 data-[size=md]:text-xs data-[size=md]:gap-1.5
             data-[size=lg]:h-10 data-[size=lg]:px-4 data-[size=lg]:text-sm data-[size=lg]:gap-2
             data-[variant=primary]:bg-primary data-[variant=primary]:text-primary-foreground
             data-[variant=primary]:hover:brightness-110 data-[variant=primary]:active:scale-[0.98]
             data-[variant=secondary]:bg-background-element data-[variant=secondary]:text-text
             data-[variant=secondary]:hover:bg-background-hover data-[variant=secondary]:border data-[variant=secondary]:border-border-subtle
             data-[variant=ghost]:text-text-muted data-[variant=ghost]:hover:text-text data-[variant=ghost]:hover:bg-background-element
             focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:ring-offset-0
             disabled:pointer-events-none disabled:opacity-40"
      classList={{
        ...(split.classList ?? {}),
        [split.class ?? ""]: !!split.class,
      }}
    >
      {props.children}
    </Kobalte>
  )
}
