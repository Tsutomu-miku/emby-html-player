export interface EmbyApiSession {
  server: string
  accessToken: string
  deviceId: string
  userId: string
  onUnauthorized?: () => void
}

let readSession: (() => EmbyApiSession) | undefined

export function configureEmbyApiSession(reader: () => EmbyApiSession): void {
  readSession = reader
}

export function getEmbyApiSession(): EmbyApiSession {
  if (!readSession) {
    throw new Error('Emby API session has not been configured')
  }
  return readSession()
}
