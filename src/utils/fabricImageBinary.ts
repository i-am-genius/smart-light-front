const MAGIC = new Uint8Array([0x53, 0x4c, 0x46, 0x49])
const VERSION = 1
const PREFIX_BYTES = 9
const MAX_HEADER_BYTES = 16 * 1024
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_CHUNK_BYTES = 256 * 1024
const MAX_CHUNKS = 64
const TRANSFER_TIMEOUT_MS = 30_000
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export interface CompletedFabricImage {
  chipId: string
  imageId: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  source: 'live' | 'replay'
  blob: Blob
}

interface FabricImageChunkHeader {
  type: 'fabricRecognizeImageChunk'
  chipId: string
  imageId: string
  mimeType: CompletedFabricImage['mimeType']
  source: CompletedFabricImage['source']
  chunkIndex: number
  totalChunks: number
  totalBytes: number
}

interface PendingTransfer {
  header: FabricImageChunkHeader
  chunks: Array<Uint8Array<ArrayBuffer> | undefined>
  receivedBytes: number
  updatedAt: number
}

export class FabricImageAssembler {
  private readonly pending = new Map<string, PendingTransfer>()

  get pendingCount() {
    return this.pending.size
  }

  accept(frame: ArrayBuffer, now = Date.now()): CompletedFabricImage | null {
    this.clearExpired(now)
    const { header, payload } = decodeFrame(frame)
    const key = `${header.chipId}\u0000${header.imageId}`
    const existing = this.pending.get(key)

    if (existing && !sameTransfer(existing.header, header)) {
      this.pending.delete(key)
      throw new Error('fabric image has conflicting transfer metadata')
    }

    const transfer = existing ?? {
      header,
      chunks: new Array<Uint8Array<ArrayBuffer> | undefined>(header.totalChunks),
      receivedBytes: 0,
      updatedAt: now,
    }
    const previousChunk = transfer.chunks[header.chunkIndex]
    if (previousChunk) {
      if (!equalBytes(previousChunk, payload)) {
        this.pending.delete(key)
        throw new Error('fabric image has conflicting duplicate chunk')
      }
      transfer.updatedAt = now
      this.pending.set(key, transfer)
      return null
    }

    transfer.chunks[header.chunkIndex] = payload
    transfer.receivedBytes += payload.byteLength
    transfer.updatedAt = now
    if (transfer.receivedBytes > header.totalBytes) {
      this.pending.delete(key)
      throw new Error('fabric image received bytes exceed totalBytes')
    }
    this.pending.set(key, transfer)

    if (transfer.chunks.includes(undefined)) {
      return null
    }
    if (transfer.receivedBytes !== header.totalBytes) {
      this.pending.delete(key)
      throw new Error('fabric image completed byte count does not match totalBytes')
    }

    this.pending.delete(key)
    return {
      chipId: header.chipId,
      imageId: header.imageId,
      mimeType: header.mimeType,
      source: header.source,
      blob: new Blob(
        transfer.chunks.map(chunk => chunk!.buffer),
        { type: header.mimeType },
      ),
    }
  }

  clearExpired(now = Date.now()) {
    for (const [key, transfer] of this.pending) {
      if (now - transfer.updatedAt > TRANSFER_TIMEOUT_MS) {
        this.pending.delete(key)
      }
    }
  }

  reset() {
    this.pending.clear()
  }
}

function decodeFrame(frame: ArrayBuffer) {
  const bytes = new Uint8Array(frame)
  if (bytes.byteLength < PREFIX_BYTES) {
    throw new Error('fabric image frame is too short')
  }
  for (let index = 0; index < MAGIC.byteLength; index += 1) {
    if (bytes[index] !== MAGIC[index]) {
      throw new Error('fabric image magic is invalid')
    }
  }
  if (bytes[4] !== VERSION) {
    throw new Error('fabric image protocol version is unsupported')
  }

  const headerLength = new DataView(frame).getUint32(5, false)
  if (headerLength <= 0 || headerLength > MAX_HEADER_BYTES) {
    throw new Error('fabric image header length is invalid')
  }
  const payloadOffset = PREFIX_BYTES + headerLength
  if (payloadOffset > bytes.byteLength) {
    throw new Error('fabric image header exceeds frame length')
  }

  let rawHeader: unknown
  try {
    const headerJson = new TextDecoder('utf-8', { fatal: true })
      .decode(bytes.subarray(PREFIX_BYTES, payloadOffset))
    rawHeader = JSON.parse(headerJson)
  } catch {
    throw new Error('fabric image header JSON is invalid')
  }
  const header = validateHeader(rawHeader)
  const payloadView = bytes.subarray(payloadOffset)
  if (payloadView.byteLength <= 0 || payloadView.byteLength > MAX_CHUNK_BYTES) {
    throw new Error('fabric image chunk size is invalid')
  }
  const payload: Uint8Array<ArrayBuffer> = new Uint8Array(
    new ArrayBuffer(payloadView.byteLength),
  )
  payload.set(payloadView)
  return { header, payload }
}

function validateHeader(value: unknown): FabricImageChunkHeader {
  if (!value || typeof value !== 'object') {
    throw new Error('fabric image header must be an object')
  }
  const header = value as Record<string, unknown>
  if (header.type !== 'fabricRecognizeImageChunk') {
    throw new Error('fabric image frame type is invalid')
  }
  if (!isBoundedString(header.imageId, 512) || !isBoundedString(header.chipId, 128)) {
    throw new Error('fabric image identity is invalid')
  }
  if (typeof header.mimeType !== 'string' || !MIME_TYPES.has(header.mimeType)) {
    throw new Error('fabric image MIME type is invalid')
  }
  if (header.source !== 'live' && header.source !== 'replay') {
    throw new Error('fabric image source is invalid')
  }
  if (!Number.isInteger(header.totalChunks)
      || Number(header.totalChunks) < 1
      || Number(header.totalChunks) > MAX_CHUNKS) {
    throw new Error('fabric image totalChunks is invalid')
  }
  if (!Number.isInteger(header.chunkIndex)
      || Number(header.chunkIndex) < 0
      || Number(header.chunkIndex) >= Number(header.totalChunks)) {
    throw new Error('fabric image chunkIndex is invalid')
  }
  if (!Number.isInteger(header.totalBytes)
      || Number(header.totalBytes) < 1
      || Number(header.totalBytes) > MAX_IMAGE_BYTES) {
    throw new Error('fabric image transfer is too large')
  }
  return header as unknown as FabricImageChunkHeader
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
}

function sameTransfer(first: FabricImageChunkHeader, second: FabricImageChunkHeader) {
  return first.chipId === second.chipId
    && first.imageId === second.imageId
    && first.mimeType === second.mimeType
    && first.totalChunks === second.totalChunks
    && first.totalBytes === second.totalBytes
}

function equalBytes(first: Uint8Array, second: Uint8Array) {
  if (first.byteLength !== second.byteLength) return false
  return first.every((value, index) => value === second[index])
}
