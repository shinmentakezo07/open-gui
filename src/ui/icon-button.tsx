import { Button as KobalteButton } from "@kobalte/core/button"
import { splitProps } from "solid-js"
import type { ComponentProps, JSX } from "solid-js"

export interface IconButtonProps extends ComponentProps<typeof KobalteButton> {
  variant?: "primary" | "secondary" | "outline" | "ghost"
  size?: "xs" | "sm" | "md" | "lg"
  children: JSX.Element
}

export function IconButton(props: IconButtonProps) {
  const [local, others] = splitProps(props, ["variant", "size", "class", "classList"])
  return (
    <KobalteButton
      classList={{
        ...(local.classList || {}),
        "inline-flex items-center justify-center rounded-md font-medium cursor-pointer transition-all duration-[var(--duration-normal)]": true,
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:ring-offset-0": true,
        "disabled:pointer-events-none disabled:opacity-40": true,
        "active:scale-95": true,
        "bg-primary text-primary-foreground hover:brightness-110":
          (local.variant || "primary") === "primary",
        "bg-background-element text-text hover:bg-background-hover border border-border-subtle":
          local.variant === "secondary",
        "border border-border-active bg-transparent text-text hover:bg-background-element":
          local.variant === "outline",
        "text-text-muted hover:text-text hover:bg-background-element":
          local.variant === "ghost",
        "h-5 w-5 text-[10px]": local.size === "xs",
        "h-7 w-7 text-xs": local.size === "sm",
        "h-8 w-8 text-sm": (local.size || "md") === "md",
        "h-10 w-10 text-base": local.size === "lg",
        [local.class ?? ""]: !!local.class,
      }}
      {...others}
    />
  )
}
