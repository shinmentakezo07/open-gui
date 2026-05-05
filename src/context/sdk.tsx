import { createContext, useContext, type ParentProps, createSignal } from "solid-js"
import { createOpencodeClient } from "@opencode-ai/sdk/client"

const host = import.meta.env.VITE_OPENCODE_SERVER_HOST ?? "127.0.0.1"
const port = import.meta.env.VITE_OPENCODE_SERVER_PORT ?? "4096"

export type SDKError = {
  type: "connection" | "request" | "unknown"
  message: string
  timestamp: number
}

function init() {
  const [errors, setErrors] = createSignal<SDKError[]>([])
  const [connected, setConnected] = createSignal(true)

  const addError = (error: Omit<SDKError, "timestamp">) => {
    const err: SDKError = { ...error, timestamp: Date.now() }
    setErrors((prev) => [...prev.slice(-9), err])
    if (error.type === "connection") setConnected(false)
  }

  const clearErrors = () => {
    setErrors([])
    setConnected(true)
  }

  const client = createOpencodeClient({
    baseUrl: `http://${host}:${port}`,
  })

  const trackedClient = new Proxy(client, {
    get(target, prop) {
      const value = (target as any)[prop]
      if (typeof value === "function") {
        return async (...args: any[]) => {
          try {
            const result = await value.apply(target, args)
            if (!connected()) setConnected(true)
            return result
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            const isConnectionError =
              message.includes("fetch") ||
              message.includes("network") ||
              message.includes("ECONNREFUSED") ||
              message.includes("Failed to fetch")
            addError({
              type: isConnectionError ? "connection" : "request",
              message,
            })
            throw err
          }
        }
      }
      return value
    },
  })

  return {
    client: trackedClient as typeof client,
    errors,
    connected,
    clearErrors,
    _rawClient: client,
  }
}

type SDKContext = ReturnType<typeof init>

const ctx = createContext<SDKContext>()

export function SDKProvider(props: ParentProps) {
  const value = init()
  return <ctx.Provider value={value}>{props.children}</ctx.Provider>
}

export function useSDK() {
  const value = useContext(ctx)
  if (!value) {
    throw new Error("useSDK must be used within a SDKProvider")
  }
  return value
}
