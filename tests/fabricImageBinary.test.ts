import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { FabricImageAssembler } from '../src/utils/fabricImageBinary.ts'

const encoder = new TextEncoder()

interface FrameHeader {
  type: string
  imageId: string
  chipId: string
  mimeType: string
  chunkIndex: number
  totalChunks: number
  totalBytes: number
  source: string
}

function makeFrame(
  overrides: Partial<FrameHeader>,
  payload: Uint8Array,
  magic = [0x53, 0x4c, 0x46, 0x49],
) {
  const header: FrameHeader = {
    type: 'fabricRecognizeImageChunk',
    imageId: 'a.jpg',
    chipId: 'lamp-1',
    mimeType: 'image/jpeg',
    chunkIndex: 0,
    totalChunks: 1,
    totalBytes: payload.byteLength,
    source: 'live',
    ...overrides,
  }
  const headerBytes = encoder.encode(JSON.stringify(header))
  const frame = new Uint8Array(9 + headerBytes.byteLength + payload.byteLength)
  frame.set(magic, 0)
  frame[4] = 1
  new DataView(frame.buffer).setUint32(5, headerBytes.byteLength, false)
  frame.set(headerBytes, 9)
  frame.set(payload, 9 + headerBytes.byteLength)
  return frame.buffer
}

describe('FabricImageAssembler', () => {
  it('assembles out-of-order binary chunks into one Blob', async () => {
    const assembler = new FabricImageAssembler()
    const first = makeFrame(
      { chunkIndex: 0, totalChunks: 2, totalBytes: 5 },
      new Uint8Array([1, 2]),
    )
    const second = makeFrame(
      { chunkIndex: 1, totalChunks: 2, totalBytes: 5 },
      new Uint8Array([3, 4, 5]),
    )

    assert.equal(assembler.accept(second), null)
    const completed = assembler.accept(first)

    assert.equal(completed?.chipId, 'lamp-1')
    assert.equal(completed?.imageId, 'a.jpg')
    assert.equal(completed?.mimeType, 'image/jpeg')
    assert.deepEqual(
      new Uint8Array(await completed!.blob.arrayBuffer()),
      new Uint8Array([1, 2, 3, 4, 5]),
    )
    assert.equal(assembler.pendingCount, 0)
  })

  it('rejects invalid magic and oversized transfers', () => {
    const assembler = new FabricImageAssembler()

    assert.throws(
      () => assembler.accept(makeFrame({}, new Uint8Array([1]), [0, 0, 0, 0])),
      /magic/i,
    )
    assert.throws(
      () => assembler.accept(makeFrame(
        { totalBytes: 10 * 1024 * 1024 + 1 },
        new Uint8Array([1]),
      )),
      /too large/i,
    )
  })

  it('rejects conflicting duplicate chunks', () => {
    const assembler = new FabricImageAssembler()
    assembler.accept(makeFrame(
      { imageId: 'dup.jpg', chunkIndex: 0, totalChunks: 2, totalBytes: 2 },
      new Uint8Array([1]),
    ))

    assert.throws(
      () => assembler.accept(makeFrame(
        { imageId: 'dup.jpg', chunkIndex: 0, totalChunks: 2, totalBytes: 2 },
        new Uint8Array([2]),
      )),
      /conflicting duplicate/i,
    )
  })

  it('assembles matching live and replay chunks for the same image', async () => {
    const assembler = new FabricImageAssembler()
    const replayChunk = makeFrame(
      { source: 'replay', chunkIndex: 0, totalChunks: 2, totalBytes: 2 },
      new Uint8Array([1]),
    )
    const liveChunk = makeFrame(
      { source: 'live', chunkIndex: 1, totalChunks: 2, totalBytes: 2 },
      new Uint8Array([2]),
    )

    assert.equal(assembler.accept(replayChunk), null)
    const completed = assembler.accept(liveChunk)

    assert.deepEqual(
      new Uint8Array(await completed!.blob.arrayBuffer()),
      new Uint8Array([1, 2]),
    )
  })

  it('clears incomplete transfers after 30 seconds', () => {
    const assembler = new FabricImageAssembler()
    assembler.accept(makeFrame(
      { chunkIndex: 0, totalChunks: 2, totalBytes: 2 },
      new Uint8Array([1]),
    ), 1_000)

    assembler.clearExpired(31_001)

    assert.equal(assembler.pendingCount, 0)
  })
})
