import { createStore, produce, reconcile } from "solid-js/store"
import { batch, createContext, createEffect, createMemo, useContext, type ParentProps } from "solid-js"
import { uniqueBy } from "remeda"
import type { FileContent, FileNode, Model, Provider, File as FileStatus } from "@opencode-ai/sdk"
import { useSDK, useEvent, useSync } from "@/context"

export type LocalFile = FileNode &
  Partial<{
    loaded: boolean
    pinned: boolean
    expanded: boolean
    content: FileContent
    selection: { startLine: number; startChar: number; endLine: number; endChar: number }
    scrollTop: number
    view: "raw" | "diff-unified" | "diff-split"
    folded: string[]
    selectedChange: number
    status: FileStatus
  }>
export type TextSelection = LocalFile["selection"]
export type View = LocalFile["view"]

export type LocalModel = Omit<Model, "provider"> & {
  provider: Provider
}
export type ModelKey = { providerID: string; modelID: string }

function safeParseJSON<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function init() {
  const sdk = useSDK()
  const sync = useSync()

  const agent = (() => {
    const list = createMemo(() => sync.data.agent.filter((x) => x.mode !== "subagent"))
    const [store, setStore] = createStore<{
      current: string
    }>({
      current: list()[0]?.name ?? "",
    })
    return {
      list,
      current() {
        return list().find((x) => x.name === store.current)
      },
      set(name: string | undefined) {
        const agents = list()
        if (agents.length === 0) return
        setStore("current", name ?? agents[0].name)
      },
      move(direction: 1 | -1) {
        const agents = list()
        if (agents.length === 0) return
        let next = agents.findIndex((x) => x.name === store.current) + direction
        if (next < 0) next = agents.length - 1
        if (next >= agents.length) next = 0
        const value = agents[next]
        setStore("current", value.name)
        if (value.model)
          model.set({
            providerID: value.model.providerID,
            modelID: value.model.modelID,
          })
      },
    }
  })()

  const model = (() => {
    const list = createMemo(() =>
      sync.data.provider.flatMap((p) => Object.values(p.models).map((m) => ({ ...m, provider: p }) as LocalModel)),
    )
    const find = (key: ModelKey | undefined) =>
      key ? list().find((m) => m.id === key.modelID && m.provider.id === key.providerID) : undefined

    const [store, setStore] = createStore<{
      model: Record<string, ModelKey>
      recent: ModelKey[]
    }>({
      model: {},
      recent: safeParseJSON(localStorage.getItem("model"), []),
    })

    createEffect(() => {
      localStorage.setItem("model", JSON.stringify(store.recent))
    })

    const fallback = createMemo(() => {
      if (store.recent.length) return store.recent[0]
      const provider = sync.data.provider[0]
      if (!provider) return undefined
      const model = Object.values(provider.models)[0]
      if (!model) return undefined
      return { modelID: model.id, providerID: provider.id }
    })

    const current = createMemo(() => {
      const a = agent.current()
      const agentKey = a ? store.model[a.name] : undefined
      return find(agentKey) ?? find(a?.model) ?? find(fallback())
    })

    const recent = createMemo(() => store.recent.map(find).filter(Boolean) as LocalModel[])

    return {
      list,
      current,
      recent,
      set(model: ModelKey | undefined, options?: { recent?: boolean }) {
        const fb = fallback()
        const key = model ?? fb
        if (!key) return
        batch(() => {
          const a = agent.current()
          if (a) setStore("model", a.name, key)
          if (options?.recent && model) {
            const uniq = uniqueBy([model, ...store.recent], (x) => x.providerID + x.modelID)
            if (uniq.length > 5) uniq.pop()
            setStore("recent", uniq)
          }
        })
      },
    }
  })()

  const file = (() => {
    const [store, setStore] = createStore<{
      node: Record<string, LocalFile>
      opened: string[]
      active?: string
    }>({
      node: Object.fromEntries(sync.data.node.map((x) => [x.path, x])),
      opened: [],
    })

    const active = createMemo(() => {
      if (!store.active) return undefined
      return store.node[store.active]
    })
    const opened = createMemo(() => store.opened.map((x) => store.node[x]))
    const changeset = createMemo(() => new Set(sync.data.changes.map((f) => f.path)))
    const changes = createMemo(() => Array.from(changeset()).sort((a, b) => a.localeCompare(b)))

    createEffect((prev: FileStatus[]) => {
      const removed = prev.filter((p) => !sync.data.changes.find((c) => c.path === p.path))
      for (const p of removed) {
        setStore(
          "node",
          p.path,
          produce((draft) => {
            draft.status = undefined
            draft.view = "raw"
          }),
        )
        load(p.path)
      }
      for (const p of sync.data.changes) {
        if (store.node[p.path] === undefined) {
          fetch(p.path).then(() => setStore("node", p.path, "status", p))
        } else {
          setStore("node", p.path, "status", p)
        }
      }
      return sync.data.changes
    }, sync.data.changes)

    const changed = (path: string) => {
      const node = store.node[path]
      if (node?.status) return true
      const set = changeset()
      if (set.has(path)) return true
      for (const p of set) {
        if (p.startsWith(path ? path + "/" : "")) return true
      }
      return false
    }

    const resetNode = (path: string) => {
      setStore("node", path, undefined!)
    }

    const relative = (path: string) => path.replace(sync.data.path.directory + "/", "")

    const load = async (path: string) => {
      const relativePath = relative(path)
      try {
        const x = await sdk.client.file.read({ query: { path: relativePath } })
        setStore(
          "node",
          relativePath,
          produce((draft) => {
            draft.loaded = true
            draft.content = x.data
          }),
        )
      } catch (err) {
        console.error(`Failed to load file ${relativePath}:`, err)
      }
    }

    const fetch = async (path: string) => {
      const relativePath = relative(path)
      const parent = relativePath.split("/").slice(0, -1).join("/")
      if (parent) {
        await list(parent)
      }
    }

    const open = async (path: string, options?: { pinned?: boolean; view?: LocalFile["view"] }) => {
      const relativePath = relative(path)
      if (!store.node[relativePath]) await fetch(path)
      setStore("opened", (x) => {
        if (x.includes(relativePath)) return x
        return [
          ...opened()
            .filter((x) => x.pinned)
            .map((x) => x.path),
          relativePath,
        ]
      })
      setStore("active", relativePath)
      if (options?.pinned) setStore("node", relativePath, "pinned", true)
      if (options?.view && store.node[relativePath].view === undefined) setStore("node", relativePath, "view", options.view)
      if (store.node[relativePath].loaded) return
      return load(relativePath)
    }

    const list = async (path: string) => {
      try {
        const x = await sdk.client.file.list({ query: { path: path + "/" } })
        setStore(
          "node",
          produce((draft) => {
            x.data!.forEach((node) => {
              if (node.path in draft) return
              draft[node.path] = node
            })
          }),
        )
      } catch (err) {
        console.error(`Failed to list directory ${path}:`, err)
      }
    }

    const search = (query: string) =>
      sdk.client.find
        .files({ query: { query } })
        .then((x) => x.data!)
        .catch(() => [] as string[])

    const bus = useEvent()
    bus.listen((event) => {
      switch (event.type) {
        case "message.part.updated":
          const part = event.properties.part
          if (part.type === "tool" && part.state.status === "completed") {
            switch (part.tool) {
              case "read":
                break
              case "edit":
                break
              default:
                break
            }
          }
          break
        case "file.watcher.updated":
          setTimeout(sync.load.changes, 1000)
          const relativePath = relative(event.properties.file)
          if (relativePath.startsWith(".git/")) return
          load(relativePath)
          break
      }
    })

    return {
      active,
      opened,
      node: (path: string) => store.node[path],
      update: (path: string, node: LocalFile) => setStore("node", path, reconcile(node)),
      open,
      load,
      close(path: string) {
        const index = store.opened.findIndex((f) => f === path)
        setStore("opened", (opened) => opened.filter((x) => x !== path))
        if (store.active === path) {
          const previous = store.opened[Math.max(0, index - 1)]
          setStore("active", previous)
        }
        resetNode(path)
      },
      expand(path: string) {
        setStore("node", path, "expanded", true)
        if (store.node[path].loaded) return
        setStore("node", path, "loaded", true)
        list(path)
      },
      collapse(path: string) {
        setStore("node", path, "expanded", false)
      },
      select(path: string, selection: TextSelection | undefined) {
        setStore("node", path, "selection", selection)
      },
      scroll(path: string, scrollTop: number) {
        setStore("node", path, "scrollTop", scrollTop)
      },
      move(path: string, to: number) {
        const index = store.opened.findIndex((f) => f === path)
        if (index === -1) return
        setStore(
          "opened",
          produce((opened) => {
            opened.splice(to, 0, opened.splice(index, 1)[0])
          }),
        )
        setStore("node", path, "pinned", true)
      },
      view(path: string): View {
        const n = store.node[path]
        return n && n.view ? n.view : "raw"
      },
      setView(path: string, view: View) {
        setStore("node", path, "view", view)
      },
      unfold(path: string, key: string) {
        setStore("node", path, "folded", (xs) => {
          const a = xs ?? []
          if (a.includes(key)) return a
          return [...a, key]
        })
      },
      fold(path: string, key: string) {
        setStore("node", path, "folded", (xs) => (xs ?? []).filter((k) => k !== key))
      },
      folded(path: string) {
        const n = store.node[path]
        return n && n.folded ? n.folded : []
      },
      changeIndex(path: string) {
        return store.node[path]?.selectedChange
      },
      setChangeIndex(path: string, index: number | undefined) {
        setStore("node", path, "selectedChange", index)
      },
      changes,
      changed,
      children(path: string) {
        return Object.values(store.node).filter(
          (x) =>
            x.path.startsWith(path) &&
            x.path !== path &&
            !x.path.replace(new RegExp(`^${path + "/"}`), "").includes("/"),
        )
      },
      search,
      relative,
    }
  })()

  const layout = (() => {
    const [store, setStore] = createStore<{
      rightPane: boolean
      leftWidth: number
      rightWidth: number
    }>({
      rightPane: false,
      leftWidth: 200,
      rightWidth: 320,
    })

    const saved = safeParseJSON<Record<string, unknown> | null>(localStorage.getItem("layout"), null)
    if (saved) {
      if (typeof saved.rightPane === "boolean") setStore("rightPane", saved.rightPane)
      if (typeof saved.leftWidth === "number") setStore("leftWidth", Math.max(150, Math.min(400, saved.leftWidth)))
      if (typeof saved.rightWidth === "number") setStore("rightWidth", Math.max(200, Math.min(500, saved.rightWidth)))
    }
    createEffect(() => {
      localStorage.setItem("layout", JSON.stringify(store))
    })

    return {
      rightPane() {
        return store.rightPane
      },
      leftWidth() {
        return store.leftWidth
      },
      rightWidth() {
        return store.rightWidth
      },
      toggleRightPane() {
        setStore("rightPane", (x) => !x)
      },
      openRightPane() {
        setStore("rightPane", true)
      },
      closeRightPane() {
        setStore("rightPane", false)
      },
      setLeftWidth(width: number) {
        setStore("leftWidth", Math.max(150, Math.min(400, width)))
      },
      setRightWidth(width: number) {
        setStore("rightWidth", Math.max(200, Math.min(500, width)))
      },
    }
  })()

  const session = (() => {
    const [store, setStore] = createStore<{
      active?: string
    }>({})

    const active = createMemo(() => {
      if (!store.active) return undefined
      return sync.session.get(store.active)
    })

    return {
      active,
      setActive(sessionId: string | undefined) {
        setStore("active", sessionId)
      },
      clearActive() {
        setStore("active", undefined)
      },
    }
  })()

  const result = {
    model,
    agent,
    file,
    layout,
    session,
  }
  return result
}

type LocalContext = ReturnType<typeof init>

const ctx = createContext<LocalContext>()

export function LocalProvider(props: ParentProps) {
  const value = init()
  return <ctx.Provider value={value}>{props.children}</ctx.Provider>
}

export function useLocal() {
  const value = useContext(ctx)
  if (!value) {
    throw new Error("useLocal must be used within a LocalProvider")
  }
  return value
}
