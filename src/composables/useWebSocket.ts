import { onBeforeUnmount, onMounted, ref, unref, watch, type ComputedRef, type Ref } from 'vue'

type MessageHandler = (data: any) => void
type Source<T> = Ref<T> | ComputedRef<T> | (() => T)
type UrlSource = Source<string>
type ProtocolValue = string | string[] | null | undefined
type ProtocolSource = Source<ProtocolValue>

function resolveSource<T>(source: Source<T>): T {
  return typeof source === 'function' ? source() : unref(source)
}

function resolveUrl(source: UrlSource): string {
  return resolveSource(source)
}

function normalizeProtocols(protocols: ProtocolValue): string | string[] | undefined {
  if (Array.isArray(protocols)) {
    const values = protocols.map((protocol) => protocol.trim()).filter(Boolean)
    return values.length > 0 ? values : undefined
  }

  const protocol = protocols?.trim()
  return protocol || undefined
}

function resolveProtocolKey(source?: ProtocolSource): string {
  if (!source) return ''

  const protocols = normalizeProtocols(resolveSource(source))
  if (!protocols) return ''

  return Array.isArray(protocols) ? protocols.join(',') : protocols
}

export function useWebSocket(urlSource: UrlSource, onMessage?: MessageHandler, protocolSource?: ProtocolSource) {
  const socket = ref<WebSocket | null>(null)
  const connected = ref(false)
  const lastMessage = ref<any>(null)

  let reconnectTimer: number | null = null
  let manualClose = false

  function clearReconnectTimer() {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function cleanupSocket() {
    if (!socket.value) return
    socket.value.onopen = null
    socket.value.onmessage = null
    socket.value.onerror = null
    socket.value.onclose = null
    socket.value.close()
    socket.value = null
  }

  function connect() {
    const url = resolveUrl(urlSource)
    if (!url) return

    const protocols = protocolSource ? normalizeProtocols(resolveSource(protocolSource)) : undefined
    if (protocolSource && !protocols) {
      console.warn('WS connection skipped: missing token')
      return
    }

    clearReconnectTimer()
    cleanupSocket()

    manualClose = false

    const ws = protocols ? new WebSocket(url, protocols) : new WebSocket(url)
    socket.value = ws

    ws.onopen = () => {
      connected.value = true
      console.log('WS connected:', url)
    }

    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return

      try {
        const parsed = JSON.parse(event.data)
        lastMessage.value = parsed
        onMessage?.(parsed)
      } catch (error) {
        console.warn('WS parse failed:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WS error:', error)
    }

    ws.onclose = (event) => {
      connected.value = false
      socket.value = null
      console.log('WS closed, code:', event.code, 'reason:', event.reason, 'wasClean:', event.wasClean)

      if (manualClose) return

      clearReconnectTimer()
      reconnectTimer = window.setTimeout(() => {
        connect()
      }, 3000)
    }
  }

  function reconnect() {
    manualClose = true
    clearReconnectTimer()
    cleanupSocket()
    connected.value = false
    connect()
  }

  function close() {
    manualClose = true
    clearReconnectTimer()
    cleanupSocket()
    connected.value = false
  }

  function send(payload: string | Record<string, unknown>) {
    if (!socket.value || socket.value.readyState !== WebSocket.OPEN) {
      return false
    }

    socket.value.send(typeof payload === 'string' ? payload : JSON.stringify(payload))
    return true
  }

  onMounted(() => {
    connect()
  })

  onBeforeUnmount(() => {
    close()
  })

  watch(
    () => [resolveUrl(urlSource), resolveProtocolKey(protocolSource)] as const,
    ([newUrl, newProtocol], [oldUrl, oldProtocol]) => {
      if (!newUrl || (protocolSource && !newProtocol) || (newUrl === oldUrl && newProtocol === oldProtocol)) return
      reconnect()
    },
  )

  return {
    socket,
    connected,
    lastMessage,
    connect,
    reconnect,
    close,
    send,
  }
}
