import { useLocal } from "@/context"
import type { LocalFile } from "@/context/local"
import { Collapsible, FileIcon, Tooltip, Icon } from "@/ui"
import { For, Match, Switch, Show, createMemo } from "solid-js"

// File type color mapping for the dot indicator
const FILE_TYPE_COLORS: Record<string, string> = {
  js: "#f7df1e",
  ts: "#3178c6",
  jsx: "#61dafb",
  tsx: "#3178c6",
  json: "#f7df1e",
  md: "#ffffff",
  css: "#264de4",
  scss: "#cc6699",
  html: "#e34c26",
  py: "#3776ab",
  rs: "#dea584",
  go: "#00add8",
  java: "#b07219",
  php: "#4f5d95",
  rb: "#701516",
  cpp: "#f34b7d",
  c: "#555555",
  sh: "#89e051",
  vue: "#41b883",
  svelte: "#ff3e00",
  astro: "#ff5d01",
  sql: "#e38c00",
  yaml: "#cb171e",
  toml: "#9c4121",
  dockerfile: "#2496ed",
  svg: "#ffb13b",
  png: "#26a17b",
  jpg: "#26a17b",
  gif: "#26a17b",
  mp4: "#ff0000",
  mp3: "#ff0000",
  pdf: "#e61e25",
  zip: "#ffd500",
  default: "#666666",
}

function getFileColor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || ""
  return FILE_TYPE_COLORS[ext] || FILE_TYPE_COLORS.default
}

function getFileExtension(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || ""
  if (ext === path.toLowerCase()) return ""
  return ext
}

export default function FileTree(props: {
  path: string
  class?: string
  nodeClass?: string
  level?: number
  onFileClick?: (file: LocalFile) => void
  filter?: string
}) {
  const local = useLocal()
  const level = props.level ?? 0

  const filteredChildren = createMemo(() => {
    const children = local.file.children(props.path)
    if (!props.filter || props.filter.trim() === "") return children
    
    const filter = props.filter.toLowerCase()
    return children.filter((node) => {
      if (node.name.toLowerCase().includes(filter)) return true
      if (node.type === "directory") {
        const hasMatchingDescendant = (path: string): boolean => {
          const descendants = local.file.children(path)
          return descendants.some((child) => {
            if (child.name.toLowerCase().includes(filter)) return true
            if (child.type === "directory") return hasMatchingDescendant(child.path)
            return false
          })
        }
        return hasMatchingDescendant(node.path)
      }
      return false
    })
  })

  return (
    <div class={`flex flex-col ${props.class}`}>
      <Show when={filteredChildren().length === 0 && props.filter}>
        <div class="px-6 py-10 text-center">
          <div class="w-10 h-10 rounded-xl bg-background-element flex items-center justify-center mx-auto mb-3 border border-border-subtle">
            <Icon name="search" size={16} class="text-text-subtle" />
          </div>
          <p class="text-xs text-text-subtle">No files match "{props.filter}"</p>
        </div>
      </Show>
      
      <For each={filteredChildren()}>
        {(node) => (
          <Tooltip forceMount={false} openDelay={1200} value={node.path} placement="right">
            <Switch>
              <Match when={node.type === "directory"}>
                <DirectoryNode 
                  node={node} 
                  level={level}
                  onFileClick={props.onFileClick}
                  filter={props.filter}
                />
              </Match>
              
              <Match when={node.type === "file"}>
                <FileNode 
                  node={node} 
                  level={level}
                  onFileClick={props.onFileClick}
                />
              </Match>
            </Switch>
          </Tooltip>
        )}
      </For>
    </div>
  )
}

function DirectoryNode(props: {
  node: LocalFile
  level: number
  onFileClick?: (file: LocalFile) => void
  filter?: string
}) {
  const local = useLocal()
  const level = props.level
  
  const isActive = createMemo(() => local.file.active()?.path === props.node.path)
  
  return (
    <Collapsible
      forceMount={false}
      open={local.file.node(props.node.path)?.expanded}
      onOpenChange={(open) => (open ? local.file.expand(props.node.path) : local.file.collapse(props.node.path))}
    >
      <Collapsible.Trigger class="w-full">
        <div
          classList={{
            "group w-full flex items-center cursor-pointer select-none transition-colors duration-[var(--duration-normal)] relative": true,
            "py-[2px]": true,
            "hover:bg-background-hover": !isActive(),
            "bg-background-active": isActive(),
          }}
          style={`padding-left: ${8 + level * 16}px;`}
        >
          {/* Indentation guides */}
          <IndentationGuides level={level} />
          
          {/* Active indicator line */}
          <Show when={isActive()}>
            <div class="absolute left-0 top-1 bottom-1 w-[2px] bg-primary rounded-r-full" />
          </Show>

          <div class="flex items-center gap-[5px] min-w-0 flex-1 relative z-10">
            {/* Expand/collapse arrow */}
            <div class="w-3.5 h-3.5 flex items-center justify-center shrink-0">
              <Collapsible.Arrow
                size={9}
                class="text-text-subtle transition-transform duration-[var(--duration-normal)] group-hover:text-text-muted"
              />
            </div>
            
            {/* Folder icon */}
            <FileIcon
              node={props.node}
              expanded={local.file.node(props.node.path)?.expanded}
              class="text-text-muted shrink-0 size-[16px] group-hover:text-text-muted/80 transition-colors duration-[var(--duration-normal)]"
            />

            {/* Folder name */}
            <span
              classList={{
                "text-[13px] whitespace-nowrap truncate flex-1 min-w-0 leading-tight": true,
                "text-text-muted": !isActive(),
                "text-text font-medium": isActive(),
              }}
            >
              {props.node.name}
            </span>
          </div>
        </div>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <FileTree 
          path={props.node.path} 
          level={level + 1} 
          onFileClick={props.onFileClick}
          filter={props.filter}
        />
      </Collapsible.Content>
    </Collapsible>
  )
}

function FileNode(props: {
  node: LocalFile
  level: number
  onFileClick?: (file: LocalFile) => void
}) {
  const local = useLocal()
  const level = props.level
  
  const isActive = createMemo(() => local.file.active()?.path === props.node.path)
  const isChanged = createMemo(() => local.file.changed(props.node.path))
  
  return (
    <button
      classList={{
        "group w-full flex items-center cursor-pointer select-none transition-colors duration-[var(--duration-normal)] relative text-left": true,
        "py-[2px]": true,
        "hover:bg-background-hover": !isActive(),
        "bg-background-active": isActive(),
      }}
      style={`padding-left: ${8 + level * 16}px;`}
      onClick={() => props.onFileClick?.(props.node)}
    >
      {/* Indentation guides */}
      <IndentationGuides level={level} />
      
      {/* Active indicator line */}
      <Show when={isActive()}>
        <div class="absolute left-0 top-1 bottom-1 w-[2px] bg-primary rounded-r-full" />
      </Show>

      {/* Changed indicator dot */}
      <Show when={isChanged() && !isActive()}>
        <div class="absolute left-0 top-1/2 -translate-y-1/2 w-[4px] h-[4px] rounded-full bg-primary" />
      </Show>

      <div class="flex items-center gap-[5px] min-w-0 flex-1 relative z-10">
        {/* Spacer for alignment with folder arrows */}
        <div class="w-3.5 shrink-0" />
        
        {/* File icon with color dot */}
        <div class="relative shrink-0">
          <FileIcon
            node={props.node}
            class="text-text-subtle shrink-0 size-[16px] group-hover:text-text-muted transition-colors duration-[var(--duration-normal)]"
          />
          <div
            class="absolute -bottom-0.5 -right-0.5 w-[5px] h-[5px] rounded-full ring-1 ring-background"
            style={{ "background-color": getFileColor(props.node.path) }}
          />
        </div>

        {/* File name */}
        <span
          classList={{
            "text-[13px] whitespace-nowrap truncate flex-1 min-w-0 leading-tight": true,
            "text-text-faint": props.node.ignored,
            "text-text-muted": !props.node.ignored && !isActive() && !isChanged(),
            "text-text font-medium": isActive(),
            "text-primary/80": isChanged() && !isActive(),
          }}
        >
          {props.node.name}
        </span>

        {/* File extension chip */}
        <Show when={!isActive() && getFileExtension(props.node.path)}>
          <span class="text-[9px] text-text-faint uppercase tracking-wider shrink-0 mr-1 font-medium">
            {getFileExtension(props.node.path)}
          </span>
        </Show>
      </div>
    </button>
  )
}

function IndentationGuides(props: { level: number }) {
  if (props.level === 0) return null
  
  return (
    <>
      {Array.from({ length: props.level }).map((_, i) => (
        <div
          class="absolute top-0 bottom-0 w-px bg-border-subtle/30 pointer-events-none"
          style={{ left: `${8 + i * 16}px` }}
        />
      ))}
    </>
  )
}
