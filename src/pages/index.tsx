import { Button, FileIcon, Icon, IconButton, Logo, Tooltip } from "@/ui"
import { Tabs } from "@/ui/tabs"
import { Select } from "@/components/select"
import FileTree from "@/components/file-tree"
import { For, Match, onCleanup, onMount, Show, Switch } from "solid-js"
import { SelectDialog } from "@/components/select-dialog"
import { useLocal, useSDK, useSync } from "@/context"
import { Code } from "@/components/code"
import {
  DragDropProvider,
  DragDropSensors,
  DragOverlay,
  SortableProvider,
  createSortable,
  closestCenter,
  useDragDropContext,
} from "@thisbeyond/solid-dnd"
import type { DragEvent, Transformer } from "@thisbeyond/solid-dnd"
import type { LocalFile } from "@/context/local"
import SessionList from "@/components/session-list"
import SessionTimeline from "@/components/session-timeline"
import { createStore } from "solid-js/store"
import { getDirectory, getFilename } from "@/utils"

export default function Page() {
  const sdk = useSDK()
  const local = useLocal()
  const sync = useSync()
  const [store, setStore] = createStore({
    clickTimer: undefined as number | undefined,
    activeItem: undefined as string | undefined,
    prompt: "",
    dragging: undefined as "left" | "right" | undefined,
    modelSelectOpen: false,
    fileSelectOpen: false,
    fileFilter: "",
  })

  let inputRef: HTMLInputElement | undefined = undefined

  const MOD = typeof navigator === "object" && /(Mac|iPod|iPhone|iPad)/.test(navigator.platform) ? "Meta" : "Control"

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown)
  })

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown)
  })

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.getModifierState(MOD) && e.shiftKey && e.key.toLowerCase() === "p") {
      e.preventDefault()
      return
    }
    if (e.getModifierState(MOD) && e.key.toLowerCase() === "p") {
      e.preventDefault()
      setStore("fileSelectOpen", true)
      return
    }

    const inputFocused = document.activeElement === inputRef
    if (inputFocused) {
      if (e.key === "Escape") {
        inputRef?.blur()
      }
      return
    }

    if (document.activeElement?.id === "select-filter") {
      return
    }

    if (local.file.active()) {
      if (e.getModifierState(MOD)) {
        if (e.key.toLowerCase() === "a") {
          return
        }
        if (e.key.toLowerCase() === "c") {
          return
        }
      }
    }

    if (e.key.length === 1 && e.key !== "Unidentified") {
      inputRef?.focus()
    }
  }

  const navigateChange = (dir: 1 | -1) => {
    const active = local.file.active()
    if (!active) return
    const current = local.file.changeIndex(active.path)
    const next = current == undefined ? (dir === 1 ? 0 : -1) : current + dir
    local.file.setChangeIndex(active.path, next)
  }

  const resetClickTimer = () => {
    if (!store.clickTimer) return
    clearTimeout(store.clickTimer)
    setStore("clickTimer", undefined)
  }

  const startClickTimer = () => {
    const newClickTimer = setTimeout(() => {
      setStore("clickTimer", undefined)
    }, 300)
    setStore("clickTimer", newClickTimer as unknown as number)
  }

  const handleFileClick = async (file: LocalFile) => {
    if (store.clickTimer) {
      resetClickTimer()
      local.file.update(file.path, { ...file, pinned: true })
    } else {
      local.file.open(file.path)
      startClickTimer()
    }
  }

  const handleTabChange = (path: string) => {
    local.file.open(path)
  }

  const handleTabClose = (file: LocalFile) => {
    local.file.close(file.path)
  }

  const onDragStart = (event: DragEvent) => {
    setStore("activeItem", event.draggable.id as string)
  }

  const onDragOver = (event: DragEvent) => {
    const { draggable, droppable } = event
    if (draggable && droppable) {
      const currentFiles = local.file.opened().map((f) => f.path)
      const fromIndex = currentFiles.indexOf(draggable.id.toString())
      const toIndex = currentFiles.indexOf(droppable.id.toString())
      if (fromIndex !== toIndex) {
        local.file.move(draggable.id.toString(), toIndex)
      }
    }
  }

  const onDragEnd = () => {
    setStore("activeItem", undefined)
  }

  const handleLeftDragStart = (e: MouseEvent) => {
    e.preventDefault()
    setStore("dragging", "left")
    const startX = e.clientX
    const startWidth = local.layout.leftWidth()

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX
      const newWidth = startWidth + deltaX
      local.layout.setLeftWidth(newWidth)
    }

    const handleMouseUp = () => {
      setStore("dragging", undefined)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }

  const handleRightDragStart = (e: MouseEvent) => {
    e.preventDefault()
    setStore("dragging", "right")
    const startX = e.clientX
    const startWidth = local.layout.rightWidth()

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX
      const newWidth = startWidth + deltaX
      local.layout.setRightWidth(newWidth)
    }

    const handleMouseUp = () => {
      setStore("dragging", undefined)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    const prompt = store.prompt
    setStore("prompt", "")
    inputRef?.blur()

    const session =
      (local.layout.rightPane() ? local.session.active() : undefined) ??
      (await sdk.client.session.create().then((x) => x.data!))
    if (!session) return
    local.session.setActive(session.id)
    local.layout.openRightPane()

    const currentAgent = local.agent.current()
    const currentModel = local.model.current()
    if (!currentAgent || !currentModel) return

    await sdk.client.session.prompt({
      path: { id: session.id },
      body: {
        agent: currentAgent.name,
        model: { modelID: currentModel.id, providerID: currentModel.provider.id },
        parts: [
          {
            type: "text",
            text: prompt,
          },
          ...local.file
            .opened()
            .filter((f) => f.selection || local.file.active()?.path === f.path)
            .flatMap((f) => [
              {
                type: "file" as const,
                mime: "text/plain",
                url: `file://${f.absolute}${f.selection ? `?start=${f.selection.startLine}&end=${f.selection.endLine}` : ""}`,
                filename: f.name,
                source: {
                  type: "file" as const,
                  text: {
                    value: "@" + f.name,
                    start: 0,
                    end: 0,
                  },
                  path: f.absolute,
                },
              },
            ]),
        ],
      },
    })
  }

  return (
    <div class="relative bg-background min-h-screen">
      {/* LEFT SIDEBAR */}
      <div
        class="fixed top-0 left-0 h-full border-r border-border-subtle flex flex-col overflow-hidden bg-background z-10"
        style={`width: ${local.layout.leftWidth()}px`}
      >
        {/* Project Header */}
        <div class="shrink-0 px-3 py-3 border-b border-border-subtle">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-background-element border border-border-subtle flex items-center justify-center">
              <Icon name="files" size={15} class="text-text-subtle" />
            </div>
            <div class="flex-1 min-w-0">
              <span class="text-[13px] font-semibold text-text truncate block">
                {sync.data.path.directory.split('/').pop() || 'Project'}
              </span>
              <span class="text-[10px] text-text-subtle truncate block mt-0.5">
                {sync.data.path.directory}
              </span>
            </div>
          </div>
        </div>

        <Tabs class="relative flex flex-col h-full" defaultValue="files">
          {/* Tab List */}
          <div class="sticky top-0 shrink-0 flex px-3 pt-3 pb-2">
            <Tabs.List class="grow w-full after:hidden bg-transparent border-b border-border-subtle/60">
              <Tabs.Trigger value="files" class="flex-1 justify-center text-[12px] gap-1.5 py-2 text-text-muted data-[selected]:text-text data-[selected]:border-b-[1.5px] data-[selected]:border-primary tab-underline">
                <Icon name="files" size={12} />
                Files
              </Tabs.Trigger>
              <Tabs.Trigger value="changes" class="flex-1 justify-center text-[12px] gap-1.5 py-2 text-text-muted data-[selected]:text-text data-[selected]:border-b-[1.5px] data-[selected]:border-primary tab-underline">
                <Icon name="branch" size={12} />
                Changes
                <Show when={local.file.changes().length > 0}>
                  <span class="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-1">
                    {local.file.changes().length}
                  </span>
                </Show>
              </Tabs.Trigger>
            </Tabs.List>
          </div>

          {/* Files Tab */}
          <Tabs.Content value="files" class="grow min-h-0 bg-background flex flex-col">
            {/* Search Input */}
            <div class="shrink-0 px-3 py-2">
              <div class="relative">
                <Icon 
                  name="search" 
                  size={11} 
                  class="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none" 
                />
                <input
                  type="text"
                  value={store.fileFilter}
                  onInput={(e) => setStore("fileFilter", e.currentTarget.value)}
                  placeholder="Filter files..."
                  class="w-full h-8 pl-8 pr-7 text-[12px] bg-transparent border border-border-subtle
                         rounded-md text-text placeholder:text-text-faint
                         focus:outline-none focus:border-border-active
                         transition-all duration-[var(--duration-normal)]"
                />
                <Show when={store.fileFilter}>
                  <IconButton
                    size="xs"
                    variant="ghost"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-muted"
                    onClick={() => setStore("fileFilter", "")}
                  >
                    <Icon name="close" size={10} />
                  </IconButton>
                </Show>
              </div>
            </div>

            {/* File Tree */}
            <div class="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
              <FileTree 
                path="" 
                onFileClick={handleFileClick}
                filter={store.fileFilter}
              />
            </div>
          </Tabs.Content>

          {/* Changes Tab */}
          <Tabs.Content value="changes" class="grow min-h-0 bg-background flex flex-col">
            <Show
              when={local.file.changes().length}
              fallback={
                <div class="flex flex-col items-center justify-center py-16 text-center">
                  <div class="w-12 h-12 rounded-full bg-background-element border border-border-subtle flex items-center justify-center mb-4">
                    <Icon name="check-circle" size={20} class="text-text-subtle" />
                  </div>
                  <p class="text-sm text-text-muted font-medium">Working tree clean</p>
                  <p class="text-xs text-text-subtle mt-1">No uncommitted changes</p>
                </div>
              }
            >
              {/* Changes Summary */}
              <div class="shrink-0 px-3 py-3">
                <div class="flex items-center justify-between bg-background-element rounded-lg px-3 py-2 border border-border-subtle/50">
                  <span class="text-xs text-text-muted font-medium">
                    Modified Files
                  </span>
                  <span class="text-xs text-primary font-medium">
                    {local.file.changes().length} files
                  </span>
                </div>
              </div>

              {/* Changes List */}
              <div class="flex-1 overflow-y-auto min-h-0 custom-scrollbar px-2 pb-2">
                <ul class="space-y-1">
                  <For each={local.file.changes()}>
                    {(path) => (
                      <li>
                        <button
                          onClick={() => local.file.open(path, { view: "diff-unified", pinned: true })}
                          class="w-full flex items-center px-3 py-2 gap-x-3 text-text-muted grow min-w-0 cursor-pointer
                                 hover:bg-background-hover rounded-lg transition-all duration-[var(--duration-normal)] group"
                        >
                          <div class="relative">
                            <FileIcon node={{ path, type: "file" }} class="shrink-0 size-4 text-text-subtle" />
                            <span class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background" />
                          </div>
                          <div class="flex-1 min-w-0 flex flex-col items-start">
                            <span class="text-sm text-text whitespace-nowrap">{getFilename(path)}</span>
                            <span class="text-xs text-text-subtle whitespace-nowrap truncate w-full">
                              {getDirectory(path)}
                            </span>
                          </div>
                          <Icon 
                            name="chevron-right" 
                            size={12} 
                            class="text-text-faint group-hover:text-text-subtle transition-colors shrink-0" 
                          />
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            </Show>
          </Tabs.Content>
        </Tabs>
      </div>

      {/* Left Resize Handle */}
      <div
        class="fixed top-0 h-full w-1.5 bg-transparent cursor-col-resize z-50 group"
        style={`left: ${local.layout.leftWidth()}px`}
        onMouseDown={(e) => handleLeftDragStart(e)}
      >
        <div
          classList={{
            "w-px h-full bg-transparent group-hover:bg-border-active transition-colors": true,
            "bg-primary!": store.dragging === "left",
          }}
        />
      </div>

      {/* MAIN CONTENT - Code Editor Only */}
      <div
        class="relative bg-background min-h-screen"
        style={`margin-left: ${local.layout.leftWidth()}px; margin-right: ${local.layout.rightPane() ? local.layout.rightWidth() : 0}px`}
      >
        {/* Empty State Logo */}
        <Show when={!local.file.active()}>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-center">
              <Logo
                size={48}
                variant="ornate"
                class="opacity-[0.12] mx-auto mb-4"
              />
              <p class="text-text-faint text-sm font-medium">Open a file to start editing</p>
            </div>
          </div>
        </Show>

        {/* Editor Area */}
        <DragDropProvider
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          collisionDetector={closestCenter}
        >
          <DragDropSensors />
          <ConstrainDragYAxis />
          <Tabs
            class="relative grow w-full flex flex-col h-screen"
            value={local.file.active()?.path}
            onChange={handleTabChange}
          >
            {/* Tab Bar */}
            <div class="sticky top-0 shrink-0 flex bg-background border-b border-border-subtle">
              <Tabs.List class="grow">
                <SortableProvider ids={local.file.opened().map((f) => f.path)}>
                  <For each={local.file.opened()}>
                    {(file) => <SortableTab file={file} onTabClick={handleFileClick} onTabClose={handleTabClose} />}
                  </For>
                </SortableProvider>
              </Tabs.List>
              <div class="shrink-0 h-full flex items-center gap-1 px-2">
                <Show when={local.file.active() && local.file.active()!.content?.diff}>
                  {(() => {
                    const f = local.file.active()!
                    const view = local.file.view(f.path)
                    return (
                      <div class="flex items-center gap-0.5 bg-background-element rounded-lg p-0.5 border border-border-subtle/50">
                        <Show when={view !== "raw"}>
                          <div class="flex items-center gap-0.5 mr-1">
                            <Tooltip value="Previous change" placement="bottom">
                              <IconButton size="xs" variant="ghost" onClick={() => navigateChange(-1)} class="text-text-subtle hover:text-text">
                                <Icon name="arrow-up" size={13} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip value="Next change" placement="bottom">
                              <IconButton size="xs" variant="ghost" onClick={() => navigateChange(1)} class="text-text-subtle hover:text-text">
                                <Icon name="arrow-down" size={13} />
                              </IconButton>
                            </Tooltip>
                          </div>
                        </Show>
                        <Tooltip value="Raw" placement="bottom">
                          <IconButton
                            size="xs"
                            variant="ghost"
                            classList={{
                              "text-text bg-background-hover": view === "raw",
                              "text-text-subtle hover:text-text-muted": view !== "raw",
                            }}
                            onClick={() => local.file.setView(f.path, "raw")}
                          >
                            <Icon name="file-text" size={13} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip value="Unified diff" placement="bottom">
                          <IconButton
                            size="xs"
                            variant="ghost"
                            classList={{
                              "text-text bg-background-hover": view === "diff-unified",
                              "text-text-subtle hover:text-text-muted": view !== "diff-unified",
                            }}
                            onClick={() => local.file.setView(f.path, "diff-unified")}
                          >
                            <Icon name="checklist" size={13} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip value="Split diff" placement="bottom">
                          <IconButton
                            size="xs"
                            variant="ghost"
                            classList={{
                              "text-text bg-background-hover": view === "diff-split",
                              "text-text-subtle hover:text-text-muted": view !== "diff-split",
                            }}
                            onClick={() => local.file.setView(f.path, "diff-split")}
                          >
                            <Icon name="columns" size={13} />
                          </IconButton>
                        </Tooltip>
                      </div>
                    )
                  })()}
                </Show>
                <Tooltip value={local.layout.rightPane() ? "Close chat" : "Open chat"} placement="bottom">
                  <IconButton 
                    size="xs" 
                    variant="ghost" 
                    onClick={() => local.layout.toggleRightPane()}
                    class="text-text-subtle hover:text-text"
                  >
                    <Icon name={local.layout.rightPane() ? "close-pane" : "open-pane"} size={14} />
                  </IconButton>
                </Tooltip>
              </div>
            </div>

            {/* Tab Content */}
            <For each={local.file.opened()}>
              {(file) => (
                <Tabs.Content value={file.path} class="grow h-full select-text bg-background">
                  {(() => {
                    const view = local.file.view(file.path)
                    const showRaw = view === "raw" || !file.content?.diff
                    const code = showRaw ? (file.content?.content ?? "") : (file.content?.diff ?? "")
                    return <Code path={file.path} code={code} />
                  })()}
                </Tabs.Content>
              )}
            </For>
          </Tabs>

          {/* Drag Overlay */}
          <DragOverlay>
            {store.activeItem &&
              (() => {
                const draggedFile = local.file.node(store.activeItem!)
                return (
                  <div
                    class="relative px-3 h-8 flex items-center 
                           text-sm font-medium text-text whitespace-nowrap
                           shrink-0 bg-background-element rounded-md
                           border border-border-active shadow-xl"
                  >
                    <TabVisual file={draggedFile} />
                  </div>
                )
              })()}
          </DragOverlay>
        </DragDropProvider>
      </div>

      {/* RIGHT PANEL - Chat / Session */}
      <Show when={local.layout.rightPane()}>
        <div
          class="fixed top-0 right-0 h-full border-l border-border-subtle flex flex-col overflow-hidden bg-background z-10"
          style={`width: ${local.layout.rightWidth()}px`}
        >
          {/* Session Header */}
          <div class="shrink-0 bg-background z-50 px-3 h-10 border-b border-border-subtle flex items-center gap-2">
            <IconButton
              size="xs"
              variant="ghost"
              onClick={() => local.session.clearActive()}
              class="text-text-subtle hover:text-text"
            >
              <Icon name="arrow-left" size={14} />
            </IconButton>
            <h2 class="text-sm font-medium text-text truncate flex-1">
              {local.session.active()?.title || "Chat"}
            </h2>
            <IconButton
              size="xs"
              variant="ghost"
              onClick={() => local.layout.toggleRightPane()}
              class="text-text-subtle hover:text-text"
            >
              <Icon name="close" size={14} />
            </IconButton>
          </div>

          {/* Session Timeline (scrollable) */}
          <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
            <Show when={local.session.active()} fallback={<SessionList />}>
              {(activeSession) => (
                <SessionTimeline session={activeSession().id} />
              )}
            </Show>
          </div>

          {/* Chat Input (sticky bottom) */}
          <div class="shrink-0 border-t border-border-subtle/60 bg-background p-3">
            <form onSubmit={handleSubmit} class="flex flex-col gap-2">
              {/* Attached file tags */}
              <div class="flex flex-wrap gap-1.5">
                <Show when={local.file.active()}>
                  <FileTag
                    default
                    file={local.file.active()!}
                    onClose={() => local.file.close(local.file.active()?.path ?? "")}
                  />
                </Show>
                <For each={local.file.opened().filter((x) => x.selection)}>
                  {(file) => <FileTag file={file} onClose={() => local.file.select(file.path, undefined)} />}
                </For>
              </div>
              
              {/* Text input */}
              <input
                ref={(el) => (inputRef = el)}
                type="text"
                value={store.prompt}
                onInput={(e) => setStore("prompt", e.currentTarget.value)}
                placeholder="Ask anything..."
                class="w-full p-2 text-text font-light placeholder:text-text-faint text-sm focus:outline-none bg-transparent"
              />
              
              {/* Controls row */}
              <div class="flex justify-between items-center text-xs text-text-subtle">
                <div class="flex gap-2 items-center">
                  <Select
                    options={local.agent.list().map((a) => a.name)}
                    current={local.agent.current()?.name}
                    onSelect={local.agent.set}
                    class="uppercase text-text-muted"
                  />
                  <Button 
                    onClick={() => setStore("modelSelectOpen", true)}
                    class="text-text-muted hover:text-text"
                  >
                    {local.model.current()?.name ?? "Select model"}
                    <Icon name="chevron-down" size={16} class="text-text-faint" />
                  </Button>
                  <span class="text-text-faint whitespace-nowrap">{local.model.current()?.provider.name}</span>
                </div>
                <div class="flex gap-1 items-center">
                  <IconButton class="text-text-faint hover:text-text-subtle" size="xs" variant="ghost">
                    <Icon name="photo" size={14} />
                  </IconButton>
                  <IconButton 
                    class="text-primary-foreground! bg-primary hover:brightness-110 rounded-full! w-7 h-7 flex items-center justify-center" 
                    size="xs" 
                    variant="ghost"
                  >
                    <Icon name="arrow-up" size={12} />
                  </IconButton>
                </div>
              </div>
            </form>
          </div>
        </div>
        
        {/* Right Resize Handle */}
        <div
          class="fixed top-0 h-full w-1.5 bg-transparent cursor-col-resize z-50 group flex justify-end"
          style={`right: ${local.layout.rightWidth()}px`}
          onMouseDown={(e) => handleRightDragStart(e)}
        >
          <div
            classList={{
              "w-px h-full bg-transparent group-hover:bg-border-active transition-colors": true,
              "bg-primary!": store.dragging === "right",
            }}
          />
        </div>
      </Show>

      {/* Model Select Dialog */}
      <Show when={store.modelSelectOpen}>
        <SelectDialog
          key={(x) => `${x.provider.id}:${x.id}`}
          items={local.model.list()}
          current={local.model.current()}
          render={(i) => (
            <div class="w-full flex items-center justify-between">
              <div class="flex items-center gap-x-2 text-text-muted grow min-w-0">
                <img src={`https://models.dev/logos/${i.provider.id}.svg`} class="size-4 invert opacity-30" />
                <span class="text-xs text-text whitespace-nowrap">{i.name}</span>
                <span class="text-xs text-text-faint whitespace-nowrap overflow-hidden overflow-ellipsis truncate min-w-0">
                  {i.id}
                </span>
              </div>
              <div class="flex items-center gap-x-1 text-text-faint shrink-0">
                <Tooltip forceMount={false} value="Reasoning">
                  <Icon name="brain" size={14} classList={{ "text-primary/70": i.reasoning }} />
                </Tooltip>
                <Tooltip forceMount={false} value="Tools">
                  <Icon name="hammer" size={14} classList={{ "text-primary": i.tool_call }} />
                </Tooltip>
                <Tooltip forceMount={false} value="Attachments">
                  <Icon name="photo" size={14} classList={{ "text-success": i.attachment }} />
                </Tooltip>
                <div class="rounded-full bg-background-element text-text-muted w-9 h-4 flex items-center justify-center text-[10px]">
                  {new Intl.NumberFormat("en-US", {
                    notation: "compact",
                    compactDisplay: "short",
                  }).format(i.limit.context)}
                </div>
                <Tooltip forceMount={false} value={`$${i.cost?.input}/1M input, $${i.cost?.output}/1M output`}>
                  <div class="rounded-full bg-background-element text-success/70 w-9 h-4 flex items-center justify-center text-[10px]">
                    <Switch fallback="FREE">
                      <Match when={i.cost?.input > 10}>$$$</Match>
                      <Match when={i.cost?.input > 1}>$$</Match>
                      <Match when={i.cost?.input > 0.1}>$</Match>
                    </Switch>
                  </div>
                </Tooltip>
              </div>
            </div>
          )}
          filter={["provider.name", "name", "id"]}
          groupBy={(x) => x.provider.name}
          onClose={() => setStore("modelSelectOpen", false)}
          onSelect={(x) => local.model.set(x ? { modelID: x.id, providerID: x.provider.id } : undefined)}
        />
      </Show>

      {/* File Select Dialog */}
      <Show when={store.fileSelectOpen}>
        <SelectDialog
          items={local.file.search}
          key={(x) => x}
          render={(i) => (
            <div class="w-full flex items-center justify-between">
              <div class="flex items-center gap-x-2 text-text-muted grow min-w-0">
                <FileIcon node={{ path: i, type: "file" }} class="shrink-0 size-4 text-text-faint" />
                <span class="text-xs text-text whitespace-nowrap">{getFilename(i)}</span>
                <span class="text-xs text-text-faint whitespace-nowrap overflow-hidden overflow-ellipsis truncate min-w-0">
                  {getDirectory(i)}
                </span>
              </div>
            </div>
          )}
          onClose={() => setStore("fileSelectOpen", false)}
          onSelect={(x) => (x ? local.file.open(x, { pinned: true }) : undefined)}
        />
      </Show>
    </div>
  )
}

const TabVisual = (props: { file: LocalFile }) => {
  return (
    <div class="flex items-center gap-x-1.5">
      <FileIcon node={props.file} class="text-text-faint" />
      <span classList={{ "text-xs": true, "text-primary": !!props.file.status?.status, "text-text-muted italic": !props.file.pinned && !props.file.status?.status, "text-text": props.file.pinned && !props.file.status?.status }}>
        {props.file.name}
      </span>
      <span class="text-xs">
        <Switch>
          <Match when={props.file.status?.status === "modified"}>
            <span class="text-warning">M</span>
          </Match>
          <Match when={props.file.status?.status === "added"}>
            <span class="text-success">A</span>
          </Match>
          <Match when={props.file.status?.status === "deleted"}>
            <span class="text-destructive">D</span>
          </Match>
        </Switch>
      </span>
    </div>
  )
}

const SortableTab = (props: {
  file: LocalFile
  onTabClick: (file: LocalFile) => void
  onTabClose: (file: LocalFile) => void
}) => {
  const sortable = createSortable(props.file.path)

  return (
    // @ts-ignore
    <div use:sortable classList={{ "opacity-0": sortable.isActiveDraggable }}>
      <Tooltip value={props.file.path} placement="bottom">
        <div class="relative">
          <Tabs.Trigger
            value={props.file.path}
            class="peer/tab pr-7 text-text-muted hover:text-text-subtle data-[selected]:text-text data-[selected]:bg-background-element"
            onClick={() => props.onTabClick(props.file)}
          >
            <TabVisual file={props.file} />
          </Tabs.Trigger>
          <IconButton
            class="absolute right-1 top-1.5 opacity-0 text-text-faint
                   peer-data-[selected]/tab:opacity-100 peer-data-[selected]/tab:text-text-muted
                   peer-data-[selected]/tab:hover:text-text
                   hover:opacity-100 peer-hover/tab:opacity-100"
            size="xs"
            variant="ghost"
            onClick={() => props.onTabClose(props.file)}
          >
            <Icon name="close" size={14} />
          </IconButton>
        </div>
      </Tooltip>
    </div>
  )
}

const FileTag = (props: { file: LocalFile; default?: boolean; onClose: () => void }) => (
  <div
    class="flex items-center bg-background-element group/tag
           border border-border-subtle hover:border-border-active
           rounded-lg text-xs text-text-muted transition-colors"
  >
    <IconButton class="text-text-faint hover:text-text" size="xs" variant="ghost" onClick={props.onClose}>
      <Switch fallback={<FileIcon node={props.file} class="group-hover/tag:hidden size-3! text-text-faint" />}>
        <Match when={props.default}>
          <Icon name="file" class="group-hover/tag:hidden text-text-faint" size={12} />
        </Match>
      </Switch>
      <Icon name="close" class="hidden group-hover/tag:block text-text-muted" size={12} />
    </IconButton>
    <div class="pr-2 flex gap-1 items-center">
      <span class="text-text-subtle">{props.file.name}</span>
      <Show when={!props.default && props.file.selection}>
        <span class="text-text-faint">
          ({props.file.selection!.startLine}-{props.file.selection!.endLine})
        </span>
      </Show>
    </div>
  </div>
)

const ConstrainDragYAxis = () => {
  const context = useDragDropContext()
  if (!context) return <></>
  const [, { onDragStart, onDragEnd, addTransformer, removeTransformer }] = context
  const transformer: Transformer = {
    id: "constrain-y-axis",
    order: 100,
    callback: (transform) => ({ ...transform, y: 0 }),
  }
  onDragStart((event: DragEvent) => {
    addTransformer("draggables", event.draggable.id, transformer)
  })
  onDragEnd((event: DragEvent) => {
    removeTransformer("draggables", event.draggable.id, transformer.id)
  })
  return <></>
}
