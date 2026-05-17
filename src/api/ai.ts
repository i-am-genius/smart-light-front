import http from './http'

interface CommonResult<T> {
  code: number
  msg: string
  data: T | null
}

interface ImageCompressionResult {
  file: File
  originalSize: number
  compressedSize: number
  originalWidth: number
  originalHeight: number
  compressedWidth: number
  compressedHeight: number
}

const FABRIC_UPLOAD_MAX_SIDE = 2000
const FABRIC_UPLOAD_JPEG_QUALITY = 0.9

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('image load failed'))
    }
    image.src = objectUrl
  })
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('canvas toBlob failed'))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      FABRIC_UPLOAD_JPEG_QUALITY,
    )
  })
}

async function compressFabricUploadImage(file: File): Promise<ImageCompressionResult> {
  const image = await loadImageFromFile(file)
  const originalWidth = image.naturalWidth || image.width
  const originalHeight = image.naturalHeight || image.height
  const longSide = Math.max(originalWidth, originalHeight)
  const scale = longSide > FABRIC_UPLOAD_MAX_SIDE ? FABRIC_UPLOAD_MAX_SIDE / longSide : 1
  const compressedWidth = Math.max(1, Math.round(originalWidth * scale))
  const compressedHeight = Math.max(1, Math.round(originalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = compressedWidth
  canvas.height = compressedHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('canvas context unavailable')
  }

  ctx.drawImage(image, 0, 0, compressedWidth, compressedHeight)
  const blob = await canvasToJpegBlob(canvas)
  const baseName = file.name.replace(/\.[^.]*$/, '') || 'fabric-image'
  const compressedFile = new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  })

  return {
    file: compressedFile,
    originalSize: file.size,
    compressedSize: compressedFile.size,
    originalWidth,
    originalHeight,
    compressedWidth,
    compressedHeight,
  }
}

async function prepareFabricUploadFile(file: File): Promise<File> {
  try {
    const result = await compressFabricUploadImage(file)
    console.info(
      '[fabricRecognize] image upload compression',
      {
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        originalSizeText: `${(result.originalSize / 1024 / 1024).toFixed(2)}MB`,
        compressedSizeText: `${(result.compressedSize / 1024 / 1024).toFixed(2)}MB`,
        originalDimensions: `${result.originalWidth}x${result.originalHeight}`,
        compressedDimensions: `${result.compressedWidth}x${result.compressedHeight}`,
      },
    )
    return result.file
  } catch (error) {
    console.warn('[fabricRecognize] image compression failed, fallback to original file', error)
    return file
  }
}
export interface FabricRecognizeRespVO {
  chipId?: string

  fabric?: string
  label?: string
  confidence?: number
  fabricConfidence?: number

  mainColorRgb?: string
  recommendedBrightness?: number
  recommendedTemp?: number

  clothDetected?: boolean
  clothX?: number
  clothY?: number
  clothW?: number
  clothH?: number

  annotatedImageBase64?: string
  clothMaskedPngBase64?: string

  originalImagePath?: string
  annotatedImagePath?: string
  combinedImagePath?: string
  originalImageUrl?: string
  annotatedImageUrl?: string
  combinedImageUrl?: string

  imageUrl?: string
  [key: string]: any
}


export async function fabricRecognize(file: File, chipId?: string): Promise<FabricRecognizeRespVO> {
  const formData = new FormData()
  const uploadFile = await prepareFabricUploadFile(file)
  formData.append('file', uploadFile)

  const res = await http.post<CommonResult<FabricRecognizeRespVO>>(
    '/admin/ai/fabric-recognize',
    formData,
    {
      params: chipId ? { chipId } : {},
    }
  )

  if (res.data.code !== 200 || !res.data.data) {
    throw new Error(res.data.msg || '面料识别失败，后端未返回识别结果')
  }

  return res.data.data
}

