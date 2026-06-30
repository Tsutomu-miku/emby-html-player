export interface EmbyAuthState {
  serverOrigin: string
  accessToken: string
  deviceId: string
}

export const EMBY_CLIENT_NAME = 'Emby Web'
export const EMBY_CLIENT_VERSION = '4.7.10.0'
export const EMBY_USER_AGENT = `${EMBY_CLIENT_NAME}/${EMBY_CLIENT_VERSION}`

export function emptyEmbyAuth(): EmbyAuthState {
  return {
    serverOrigin: '',
    accessToken: '',
    deviceId: '',
  }
}

export function normalizeOrigin(url: string): string {
  return url.replace(/\/+$/, '')
}

export function parseEmbyAuth(input: unknown): EmbyAuthState | undefined {
  if (!input || typeof input !== 'object') return undefined
  const auth = input as Record<string, unknown>
  if (
    typeof auth.server !== 'string' ||
    typeof auth.accessToken !== 'string' ||
    typeof auth.deviceId !== 'string'
  ) {
    return undefined
  }
  return {
    serverOrigin: normalizeOrigin(auth.server),
    accessToken: auth.accessToken,
    deviceId: auth.deviceId,
  }
}

export function isMediaRequest(url: string): boolean {
  if (!URL.canParse(url)) return false
  const { pathname } = new URL(url)
  return /^\/(videos|audio|livestreams)\//i.test(pathname)
}

export function isServerRequest(url: string, auth: EmbyAuthState): boolean {
  return auth.serverOrigin.length > 0 &&
    url.toLowerCase().startsWith(auth.serverOrigin.toLowerCase())
}

export function applyEmbyApiIdentity(
  headers: Record<string, string>,
  auth: EmbyAuthState,
): Record<string, string> {
  applyEmbyPlayerIdentity(headers, auth)
  deleteBrowserFingerprintHeaders(headers)
  return headers
}

export function applyEmbyMediaIdentity(
  headers: Record<string, string>,
  auth: EmbyAuthState,
  requestUrl: string,
): Record<string, string> {
  applyEmbyUserAgent(headers)
  if (isServerRequest(requestUrl, auth)) {
    applyEmbyPlayerIdentity(headers, auth)
  } else {
    deleteEmbyAuthHeaders(headers)
  }
  if (auth.serverOrigin) headers['Referer'] = `${auth.serverOrigin}/`
  delete headers['Origin']
  delete headers['origin']
  headers['Accept'] = '*/*'
  headers['Sec-Fetch-Dest'] = 'video'
  headers['Sec-Fetch-Mode'] = 'no-cors'
  headers['Sec-Fetch-Site'] = getMediaFetchSite(requestUrl, auth)
  delete headers['sec-fetch-dest']
  delete headers['sec-fetch-mode']
  delete headers['sec-fetch-site']
  return headers
}

export function applyEmbyNativeMediaIdentity(
  headers: Record<string, string>,
  auth: EmbyAuthState,
): Record<string, string> {
  applyEmbyPlayerIdentity(headers, auth)
  if (auth.serverOrigin) headers['Referer'] = `${auth.serverOrigin}/`
  headers['Accept'] = '*/*'
  return headers
}

export function buildEmbyNativeMediaHeaders(
  auth: EmbyAuthState,
  cookieHeader?: string,
): Record<string, string> {
  const headers = applyEmbyNativeMediaIdentity({}, auth)
  if (cookieHeader) headers['Cookie'] = cookieHeader
  return headers
}

function getMediaFetchSite(_requestUrl: string, _auth: EmbyAuthState): 'same-site' {
  return 'same-site'
}

function applyEmbyPlayerIdentity(
  headers: Record<string, string>,
  auth: EmbyAuthState,
): void {
  applyEmbyUserAgent(headers)
  deleteEmbyAuthHeaders(headers)
  if (auth.accessToken) headers['X-Emby-Token'] = auth.accessToken
  if (auth.deviceId) {
    headers['X-Emby-Authorization'] = buildEmbyAuthorization(auth)
  }
}

function applyEmbyUserAgent(headers: Record<string, string>): void {
  headers['User-Agent'] = EMBY_USER_AGENT
  delete headers['user-agent']
}

function deleteEmbyAuthHeaders(headers: Record<string, string>): void {
  delete headers['Authorization']
  delete headers['X-Emby-Token']
  delete headers['X-Emby-Authorization']
  delete headers['authorization']
  delete headers['x-emby-token']
  delete headers['x-emby-authorization']
}

function buildEmbyAuthorization(auth: EmbyAuthState): string {
  const parts = [
    `MediaBrowser Client="${EMBY_CLIENT_NAME}"`,
    `Device="${detectDeviceName()}"`,
    `DeviceId="${auth.deviceId}"`,
    `Version="${EMBY_CLIENT_VERSION}"`,
  ]
  if (auth.accessToken) parts.push(`Token="${auth.accessToken}"`)
  return parts.join(', ')
}

function detectDeviceName(): string {
  if (process.platform === 'darwin') return 'macOS'
  if (process.platform === 'win32') return 'Windows'
  if (process.platform === 'linux') return 'Linux'
  return 'Desktop'
}

function deleteBrowserFingerprintHeaders(headers: Record<string, string>): void {
  delete headers['Sec-Ch-Ua']
  delete headers['Sec-Ch-Ua-Mobile']
  delete headers['Sec-Ch-Ua-Platform']
  delete headers['Sec-Fetch-Site']
  delete headers['Sec-Fetch-Mode']
  delete headers['Sec-Fetch-User']
  delete headers['Sec-Fetch-Dest']
  delete headers['sec-ch-ua']
  delete headers['sec-ch-ua-mobile']
  delete headers['sec-ch-ua-platform']
  delete headers['sec-fetch-site']
  delete headers['sec-fetch-mode']
  delete headers['sec-fetch-user']
  delete headers['sec-fetch-dest']
}
