import http from './http'

export interface PersonFlowRecordRespVO {
  id: number
  chipId: string | null
  source: string
  personCount: number
  confidence: number
  processingTime: number
  detectTime: string
  imageName: string | null
  createTime: string
}

interface CommonResult<T> {
  code: number
  msg: string
  data: T
}

export async function getPersonFlowRecent(limit = 10): Promise<PersonFlowRecordRespVO[]> {
  const res = await http.get<CommonResult<PersonFlowRecordRespVO[]>>(
    '/admin/person-flow-record/recent',
    { params: { limit } },
  )
  return res.data.data || []
}

export interface PersonFlowListParams {
  startTime?: string
  endTime?: string
  chipId?: string
  pageNo?: number
  pageSize?: number
}

export async function getPersonFlowList(params: PersonFlowListParams): Promise<PersonFlowRecordRespVO[]> {
  const res = await http.get<CommonResult<PersonFlowRecordRespVO[]>>(
    '/admin/person-flow-record/list',
    { params },
  )
  return res.data.data || []
}

export async function getPersonFlowImageObjectUrl(imageName: string): Promise<string> {
  const encodedName = imageName.split('/').map(encodeURIComponent).join('/')
  const res = await http.get<Blob>(
    `/admin/device/cam/upload/${encodedName}`,
    { responseType: 'blob' },
  )
  return URL.createObjectURL(res.data)
}
