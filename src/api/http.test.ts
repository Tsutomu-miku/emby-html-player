import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configureEmbyApiSession } from './embyApiSession'
import { request } from './http'

describe('request', () => {
  const onUnauthorized = vi.fn()

  beforeEach(() => {
    onUnauthorized.mockReset()
    configureEmbyApiSession(() => ({
      server: 'https://emby.example.test/',
      accessToken: 'token-123',
      deviceId: 'device-abc',
      userId: 'user-1',
      onUnauthorized,
    }))
  })

  it('builds Emby URLs, auth query, authorization header, and PascalCase JSON body', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      () => Promise.resolve(new Response(JSON.stringify({ ItemId: 'item-1' }), {
        headers: { 'content-type': 'application/json' },
      })),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await request<{ itemId: string }>('/Items/item-1/PlaybackInfo', {
      method: 'POST',
      params: { startTimeTicks: 42, userId: 'user-1' },
      body: { mediaSourceId: 'source-1', enableDirectPlay: true },
    })

    expect(result).toEqual({ itemId: 'item-1' })
    const firstCall = fetchMock.mock.calls[0]
    if (!firstCall) throw new Error('fetch was not called')
    const [url, init] = firstCall
    expect(readRequestUrl(url)).toBe(
      'https://emby.example.test/Items/item-1/PlaybackInfo?StartTimeTicks=42&UserId=user-1&api_key=token-123&DeviceId=device-abc',
    )
    expect(init?.body).toBe('{"MediaSourceId":"source-1","EnableDirectPlay":true}')
    expect(init?.headers).toBeInstanceOf(Headers)
    const headers = init?.headers as Headers
    expect(headers.get('X-Emby-Token')).toBeNull()
    expect(headers.get('X-Emby-Authorization')).toContain('Client="Emby Web"')
    expect(headers.get('X-Emby-Authorization')).toContain('Token="token-123"')
  })

  it('uses the unauthorized session port instead of importing auth store', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(
      () => Promise.resolve(new Response('expired', { status: 401, statusText: 'Unauthorized' })),
    ))

    await expect(request('/Users/me')).rejects.toThrow('HTTP 401 Unauthorized')
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })
})

function readRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}
