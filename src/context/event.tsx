import { createContext, useContext, type ParentProps } from "solid-js"
import { createEventBus } from "@solid-primitives/event-bus"
import type { Event as SDKEvent } from "@opencode-ai/sdk"
import { useSDK } from "@/context"

export type Event = SDKEvent

function init() {
  const sdk = useSDK()
  const bus = createEventBus<Event>()

  let active = true
  let retryDelay = 1000
  const maxRetryDelay = 30000

  const connect = async () => {
    if (!active) return
    try {
      const events = await sdk.client.event.subscribe()
      retryDelay = 1000
      for await (const event of events.stream) {
        if (!active) break
        bus.emit(event)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("Event stream error:", message)
    }

    if (active) {
      setTimeout(connect, retryDelay)
      retryDelay = Math.min(retryDelay * 2, maxRetryDelay)
    }
  }

  connect()

  return {
    ...bus,
    dispose() {
      active = false
    },
  }
}

type EventContext = ReturnType<typeof init>

const ctx = createContext<EventContext>()

export function EventProvider(props: ParentProps) {
  const value = init()
  return <ctx.Provider value={value}>{props.children}</ctx.Provider>
}

export function useEvent() {
  const value = useContext(ctx)
  if (!value) {
    throw new Error("useEvent must be used within a EventProvider")
  }
  return value
}
