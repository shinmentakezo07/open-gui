import { Tabs as KobalteTabs } from "@kobalte/core/tabs"
import { splitProps } from "solid-js"
import type { ComponentProps, ParentProps } from "solid-js"

export interface TabsProps extends ComponentProps<typeof KobalteTabs> {}
export interface TabsListProps extends ComponentProps<typeof KobalteTabs.List> {}
export interface TabsTriggerProps extends ComponentProps<typeof KobalteTabs.Trigger> {}
export interface TabsContentProps extends ComponentProps<typeof KobalteTabs.Content> {}

function TabsRoot(props: TabsProps) {
  return <KobalteTabs {...props} />
}

function TabsList(props: TabsListProps) {
  const [local, others] = splitProps(props, ["class"])
  return (
    <KobalteTabs.List
      classList={{
        "relative flex items-center bg-transparent overflow-x-auto no-scrollbar": true,
        [local.class ?? ""]: !!local.class,
      }}
      {...others}
    />
  )
}

function TabsTrigger(props: ParentProps<TabsTriggerProps>) {
  const [local, others] = splitProps(props, ["class", "children"])
  return (
    <KobalteTabs.Trigger
      classList={{
        "relative px-3 h-9 flex items-center gap-1.5": true,
        "text-[12px] font-medium cursor-pointer select-none": true,
        "whitespace-nowrap shrink-0 text-text-muted": true,
        "disabled:pointer-events-none disabled:opacity-40": true,
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/30": true,
        "data-[selected]:text-text": true,
        "hover:text-text/80 transition-colors duration-[var(--duration-normal)]": true,
        [local.class ?? ""]: !!local.class,
      }}
      {...others}
    >
      {local.children}
    </KobalteTabs.Trigger>
  )
}

function TabsContent(props: ParentProps<TabsContentProps>) {
  const [local, others] = splitProps(props, ["class", "children"])
  return (
    <KobalteTabs.Content
      classList={{
        "bg-transparent overflow-y-auto h-full no-scrollbar outline-none": true,
        [local.class ?? ""]: !!local.class,
      }}
      {...others}
    >
      {local.children}
    </KobalteTabs.Content>
  )
}

export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
})
