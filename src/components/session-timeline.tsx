import { useLocal, useSync } from "@/context"
import { Collapsible, Icon } from "@/ui"
import type { Part, ToolPart } from "@opencode-ai/sdk"
import { DateTime } from "luxon"
import {
  createSignal,
  onMount,
  For,
  Match,
  Switch,
  type ParentProps,
  createEffect,
  createMemo,
  Show,
} from "solid-js"
import { getFilename } from "@/utils"
import { Markdown } from "./markdown"
import { Code } from "./code"
import { createElementSize } from "@solid-primitives/resize-observer"
import { createScrollPosition } from "@solid-primitives/scroll"

// Tool call components
function ToolCall(props: { icon: string; label: string; status?: "pending" | "completed" | "error"; children?: ParentProps["children"] }) {
  const statusColors = {
    pending: "text-warning",
    completed: "text-success",
    error: "text-error",
  }
  
  return (
    <div class="my-2 rounded-lg border border-border-subtle/60 bg-background-element/50 overflow-hidden">
      <div class="flex items-center gap-2 px-3 py-2 bg-background-element/80 border-b border-border-subtle/40">
        <Icon name={props.icon as any} size={13} class={props.status ? statusColors[props.status] : "text-text-subtle"} />
        <span class="text-[11px] font-medium text-text-muted">{props.label}</span>
        <Show when={props.status === "pending"}>
          <div class="ml-auto w-3.5 h-3.5 border-2 border-text-faint border-t-primary rounded-full animate-spin" />
        </Show>
      </div>
      <Show when={props.children}>
        <div class="p-3">{props.children}</div>
      </Show>
    </div>
  )
}

function ReadToolPart(props: { part: ToolPart }) {
  const local = useLocal()
  return (
    <Switch>
      <Match when={props.part.state.status === "pending"}>
        <ToolCall icon="file-text" label="Reading file..." status="pending" />
      </Match>
      <Match when={props.part.state.status === "completed" && props.part.state}>
        {(state) => {
          const path = state().input["filePath"] as string
          return (
            <ToolCall 
              icon="file-text" 
              label={`Read ${getFilename(path)}`}
              status="completed"
            >
              <button 
                onClick={() => local.file.open(path)}
                class="text-[11px] text-text-muted hover:text-primary transition-colors"
              >
                Open file
              </button>
            </ToolCall>
          )
        }}
      </Match>
      <Match when={props.part.state.status === "error" && props.part.state}>
        {(state) => (
          <ToolCall 
            icon="file-text" 
            label={`Read ${getFilename(state().input["filePath"] as string)}`}
            status="error"
          >
            <div class="text-error text-[11px]">{state().error}</div>
          </ToolCall>
        )}
      </Match>
    </Switch>
  )
}

function EditToolPart(props: { part: ToolPart }) {
  return (
    <Switch>
      <Match when={props.part.state.status === "pending"}>
        <ToolCall icon="edit" label="Preparing edit..." status="pending" />
      </Match>
      <Match when={props.part.state.status === "completed" && props.part.state}>
        {(state) => (
          <Collapsible defaultOpen>
            <Collapsible.Trigger class="w-full">
              <ToolCall 
                icon="edit" 
                label={`Edited ${getFilename(state().input["filePath"] as string)}`}
                status="completed"
              >
                <Code
                  path={state().input["filePath"] as string}
                  code={state().metadata["diff"] as string}
                  class="[&_code]:pb-0!"
                />
              </ToolCall>
            </Collapsible.Trigger>
          </Collapsible>
        )}
      </Match>
      <Match when={props.part.state.status === "error" && props.part.state}>
        {(state) => (
          <ToolCall 
            icon="edit" 
            label={`Edit ${getFilename(state().input["filePath"] as string)}`}
            status="error"
          >
            <div class="text-error text-[11px]">{state().error}</div>
          </ToolCall>
        )}
      </Match>
    </Switch>
  )
}

function WriteToolPart(props: { part: ToolPart }) {
  return (
    <Switch>
      <Match when={props.part.state.status === "pending"}>
        <ToolCall icon="file-plus" label="Preparing write..." status="pending" />
      </Match>
      <Match when={props.part.state.status === "completed" && props.part.state}>
        {(state) => (
          <ToolCall 
            icon="file-plus" 
            label={`Wrote ${getFilename(state().input["filePath"] as string)}`}
            status="completed"
          >
            <div class="p-3 bg-background-element rounded-lg border border-border-subtle min-h-[60px]"></div>
          </ToolCall>
        )}
      </Match>
      <Match when={props.part.state.status === "error" && props.part.state}>
        {(state) => (
          <ToolCall 
            icon="file-plus" 
            label={`Write ${getFilename(state().input["filePath"] as string)}`}
            status="error"
          >
            <div class="text-error text-[11px]">{state().error}</div>
          </ToolCall>
        )}
      </Match>
    </Switch>
  )
}

function BashToolPart(props: { part: ToolPart }) {
  return (
    <Switch>
      <Match when={props.part.state.status === "pending"}>
        <ToolCall icon="terminal" label="Running command..." status="pending" />
      </Match>
      <Match when={props.part.state.status === "completed" && props.part.state}>
        {(state) => {
          const cmd = state().input["command"] as string
          const output = state().output
          const markdownText = "```\n" + cmd + "\n" + output + "```"
          return (
            <Collapsible defaultOpen>
              <Collapsible.Trigger class="w-full">
                <ToolCall 
                  icon="terminal" 
                  label={`$ ${cmd}`}
                  status="completed"
                >
                  <Markdown text={markdownText} />
                </ToolCall>
              </Collapsible.Trigger>
            </Collapsible>
          )
        }}
      </Match>
      <Match when={props.part.state.status === "error" && props.part.state}>
        {(state) => (
          <ToolCall 
            icon="terminal" 
            label={`$ ${state().input["command"]}`}
            status="error"
          >
            <div class="text-error text-[11px]">{state().error}</div>
          </ToolCall>
        )}
      </Match>
    </Switch>
  )
}

function ToolPart(props: { part: ToolPart }) {
  return (
    <Switch>
      <Match when={props.part.tool === "read"}>
        <ReadToolPart part={props.part} />
      </Match>
      <Match when={props.part.tool === "edit"}>
        <EditToolPart part={props.part} />
      </Match>
      <Match when={props.part.tool === "write"}>
        <WriteToolPart part={props.part} />
      </Match>
      <Match when={props.part.tool === "bash"}>
        <BashToolPart part={props.part} />
      </Match>
    </Switch>
  )
}

// User avatar
function UserAvatar() {
  return (
    <div class="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
      <Icon name="avatar-square" size={12} class="text-primary" />
    </div>
  )
}

// Agent avatar
function AgentAvatar() {
  return (
    <div class="w-6 h-6 rounded-full bg-success/20 border border-success/30 flex items-center justify-center shrink-0">
      <Icon name="robot" size={12} class="text-success" />
    </div>
  )
}

// Message bubble
function UserMessage(props: { text: string; timestamp: number; username?: string }) {
  return (
    <div class="flex gap-2.5 mb-5">
      <div class="flex-1 min-w-0" />
      <div class="max-w-[85%] flex flex-col items-end gap-1">
        <div class="rounded-2xl rounded-tr-sm bg-primary/10 border border-primary/20 px-4 py-2.5">
          <p class="text-[13px] text-text whitespace-pre-wrap break-words leading-relaxed">{props.text}</p>
        </div>
        <span class="text-[10px] text-text-faint font-medium">
          {DateTime.fromMillis(props.timestamp).toRelative()} · {props.username || "You"}
        </span>
      </div>
      <UserAvatar />
    </div>
  )
}

function AgentMessage(props: { children?: ParentProps["children"] }) {
  return (
    <div class="flex gap-2.5 mb-5">
      <AgentAvatar />
      <div class="flex-1 min-w-0 flex flex-col gap-1">
        {props.children}
      </div>
    </div>
  )
}

// Reasoning/Thinking component
function ThinkingBlock(props: { text: string; duration?: string }) {
  return (
    <Collapsible>
      <Collapsible.Trigger class="group/thinking flex items-center gap-2 py-1.5 px-2 -ml-2 rounded-md hover:bg-background-hover transition-colors w-fit">
        <Icon name="sparkles" size={12} class="text-warning" />
        <span class="text-[11px] text-text-subtle font-medium">
          <Show when={props.duration} fallback="Thinking...">
            Thought for {props.duration}s
          </Show>
        </span>
        <Collapsible.Arrow size={10} class="text-text-faint group-hover/thinking:text-text-subtle transition-colors" />
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div class="mt-1.5 mb-2 pl-3 border-l-2 border-border-subtle/60">
          <Markdown text={props.text} class="text-text-muted" />
        </div>
      </Collapsible.Content>
    </Collapsible>
  )
}

export default function SessionTimeline(props: { session: string; class?: string }) {
  const sync = useSync()
  const [scrollElement, setScrollElement] = createSignal<HTMLElement | undefined>(undefined)
  const [root, setRoot] = createSignal<HTMLDivElement | undefined>(undefined)
  const [tail, setTail] = createSignal(true)
  const size = createElementSize(root)
  const scroll = createScrollPosition(scrollElement)

  onMount(() => sync.session.sync(props.session))
  const messages = createMemo(() => sync.data.message[props.session] ?? [])
  const working = createMemo(() => {
    const msgs = messages()
    if (msgs.length === 0) return false
    const last = msgs[msgs.length - 1]
    if (last.role === "user") return true
    return !last.time?.completed
  })

  const getScrollParent = (el: HTMLElement | null): HTMLElement | undefined => {
    let p = el?.parentElement
    while (p && p !== document.body) {
      const s = getComputedStyle(p)
      if (s.overflowY === "auto" || s.overflowY === "scroll") return p
      p = p.parentElement
    }
    return undefined
  }

  createEffect(() => {
    if (!root()) return
    setScrollElement(getScrollParent(root()!))
  })

  const scrollToBottom = () => {
    const element = scrollElement()
    if (!element) return
    element.scrollTop = element.scrollHeight
  }

  createEffect(() => {
    size.height
    if (tail()) scrollToBottom()
  })

  createEffect(() => {
    if (working()) {
      setTail(true)
      scrollToBottom()
    }
  })

  let lastScrollY = 0
  createEffect(() => {
    if (scroll.y < lastScrollY) {
      setTail(false)
    }
    lastScrollY = scroll.y
  })

  const valid = (part: Part) => {
    if (!part) return false
    switch (part.type) {
      case "step-start":
      case "step-finish":
      case "file":
      case "patch":
        return false
      case "text":
        return !part.synthetic
      case "reasoning":
        return part.text.trim()
      default:
        return true
    }
  }

  const duration = (part: Part) => {
    switch (part.type) {
      default:
        if (
          "time" in part &&
          part.time &&
          "start" in part.time &&
          part.time.start &&
          "end" in part.time &&
          part.time.end
        ) {
          const start = DateTime.fromMillis(part.time.start)
          const end = DateTime.fromMillis(part.time.end)
          return end.diff(start).toFormat("s")
        }
        return ""
    }
  }

  return (
    <div
      ref={setRoot}
      classList={{
        "p-4 select-text flex flex-col": true,
        [props.class ?? ""]: !!props.class,
      }}
    >
      <Show when={messages().length === 0}>
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <div class="w-12 h-12 rounded-2xl bg-background-element border border-border-subtle flex items-center justify-center mb-4">
            <Icon name="robot" size={24} class="text-text-subtle" />
          </div>
          <p class="text-sm text-text-muted font-medium">Start a conversation</p>
          <p class="text-xs text-text-faint mt-1">Ask me to help with code, explain concepts, or debug issues</p>
        </div>
      </Show>

      <For each={messages()}>
        {(message) => {
          const parts = sync.data.part[message.id]?.filter(valid) ?? []
          const isUser = message.role === "user"
          
          return (
            <div class="mb-2">
              <Switch>
                <Match when={isUser}>
                  <For each={parts}>
                    {(part) => (
                      <Switch>
                        <Match when={part.type === "text" && part}>
                          {(textPart) => (
                            <UserMessage 
                              text={textPart().text} 
                              timestamp={message.time.created}
                              username={sync.data.config.username}
                            />
                          )}
                        </Match>
                      </Switch>
                    )}
                  </For>
                </Match>
                <Match when={!isUser}>
                  <AgentMessage>
                    <For each={parts}>
                      {(part) => (
                        <Switch>
                          <Match when={part.type === "text" && part}>
                            {(textPart) => (
                              <div class="text-[13px] text-text leading-relaxed">
                                <Markdown text={textPart().text} />
                              </div>
                            )}
                          </Match>
                          <Match when={part.type === "reasoning" && part}>
                            {(reasoningPart) => (
                              <ThinkingBlock
                                text={reasoningPart().text}
                                duration={duration(reasoningPart()) || undefined}
                              />
                            )}
                          </Match>
                          <Match when={part.type === "tool" && part}>
                            {(toolPart) => <ToolPart part={toolPart()} />}
                          </Match>
                        </Switch>
                      )}
                    </For>
                  </AgentMessage>
                </Match>
              </Switch>
            </div>
          )
        }}
      </For>

      <Show when={working()}>
        <div class="flex gap-2.5 mb-4">
          <AgentAvatar />
          <div class="flex items-center gap-1.5 py-2 px-3 bg-background-element rounded-2xl rounded-tl-sm border border-border-subtle/60">
            <div class="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style="animation-delay: 0ms" />
            <div class="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style="animation-delay: 150ms" />
            <div class="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style="animation-delay: 300ms" />
          </div>
        </div>
      </Show>
    </div>
  )
}
