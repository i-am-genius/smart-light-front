export function getErrorMessage(error: unknown, fallback = '操作失败'): string {
  const anyError = error as any

  const msg = anyError?.response?.data?.msg
  if (msg) return msg

  const responseMessage = anyError?.response?.data?.message
  if (responseMessage) return responseMessage

  if (error instanceof Error && error.message) {
    return error.message
  }

  if (anyError?.message) return anyError.message

  return fallback
}
