import type { DeviceProfile } from '../types'

/** 浏览器/设备播放能力描述，用于 PlaybackInfo 转码协商。
 * 注意：这里字段均使用 camelCase，http.ts 会在发送前递归转换为 PascalCase。
 * （嵌套类型条件 Condition/Property 等枚举值本身是 Emby 服务端约定的字符串，保持 PascalCase。）
 */
export function buildDeviceProfile(): DeviceProfile {
  // 检测容器/编码支持（简化版）
  const video = document.createElement('video')
  // h264 是浏览器基础能力，默认加入 directPlay，无需 canPlayType 探测
  const canPlayHevc = !!video.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0, mp4a.40.2"').replace(/^no$/, '')
  const canPlayVp9 = !!video.canPlayType('video/webm; codecs="vp9"').replace(/^no$/, '')
  const canPlayAv1 = !!video.canPlayType('video/mp4; codecs="av01.0.05M.08"').replace(/^no$/, '')
  const canPlayAac = !!video.canPlayType('audio/mp4; codecs="mp4a.40.2"').replace(/^no$/, '')
  const canPlayMp3 = !!video.canPlayType('audio/mpeg').replace(/^no$/, '')
  const canPlayFlac = !!video.canPlayType('audio/flac').replace(/^no$/, '')
  const canPlayOpus = !!video.canPlayType('audio/opus').replace(/^no$/, '')
  const canNativeHls = !!video.canPlayType('application/vnd.apple.mpegurl').replace(/^no$/, '')

  const directPlayVideoCodecs = ['h264']
  const directPlayContainers = ['mp4', 'm4v', 'mov']
  if (canPlayHevc) directPlayVideoCodecs.push('hevc', 'h265')
  if (canPlayVp9) directPlayVideoCodecs.push('vp9')
  if (canPlayAv1) directPlayVideoCodecs.push('av1')
  if (canNativeHls) {
    directPlayContainers.push('m3u8', 'm4v')
  }

  const directAudioCodecs: string[] = []
  if (canPlayAac) directAudioCodecs.push('aac')
  if (canPlayMp3) directAudioCodecs.push('mp3', 'mp2')
  if (canPlayFlac) directAudioCodecs.push('flac')
  if (canPlayOpus) directAudioCodecs.push('opus')
  directAudioCodecs.push('ac3', 'eac3', 'dts') // 浏览器可能直接透传

  const transcodeVideoCodec = 'h264'
  const transcodeAudioCodec = 'aac'

  return {
    name: 'Emby Web',
    maxStreamingBitrate: 20_000_000,
    maxStaticBitrate: 40_000_000,
    musicStreamingTranscodingBitrate: 384_000,
    directPlayProfiles: [
      {
        container: directPlayContainers.join(','),
        type: 'Video',
        videoCodec: directPlayVideoCodecs.join(','),
        audioCodec: directAudioCodecs.join(','),
      },
      {
        container: 'mp3',
        type: 'Audio',
        audioCodec: 'mp3',
      },
      {
        container: 'aac',
        type: 'Audio',
        audioCodec: 'aac',
      },
      {
        container: 'flac',
        type: 'Audio',
        audioCodec: 'flac',
      },
      {
        container: 'opus',
        type: 'Audio',
        audioCodec: 'opus',
      },
    ],
    transcodingProfiles: [
      // 视频转码：统一用 HLS（m3u8 + hls.js），不使用渐进式 TS。
      // Electron/Chromium 不原生支持 HLS，但 hls.js 通用可用。
      // 之前有一个 container: canNativeHls ? 'ts' : 'aac' 的渐进式 profile，
      // 在 Electron 下 canNativeHls=false → container 变成 aac（音频容器），导致 Emby 返回错误的转码 URL。
      {
        container: 'm3u8',
        type: 'Video',
        audioCodec: transcodeAudioCodec,
        videoCodec: transcodeVideoCodec,
        protocol: 'hls',
        maxAudioChannels: '6',
        minSegments: 2,
        enableSubtitlesInManifest: true,
        breakOnNonKeyFrames: true,
      },
      {
        container: 'aac',
        type: 'Audio',
        audioCodec: 'aac',
        protocol: 'http',
      },
      {
        container: 'mp3',
        type: 'Audio',
        audioCodec: 'mp3',
        protocol: 'http',
      },
    ],
    subtitleProfiles: [
      // 注意：format / didlMode 是字符串值，保持 Emby 约定（不是 key，不会被转换）
      { format: 'vtt', method: 'External', didlMode: 'SUBTITLE' },
      { format: 'subrip', method: 'External' },
      { format: 'srt', method: 'External' },
      { format: 'ass', method: 'External' },
      { format: 'ssa', method: 'External' },
      { format: 'pgssub', method: 'Hls' },
      { format: 'dvdsub', method: 'Hls' },
      { format: 'sub', method: 'External' },
      { format: 'ttml', method: 'External' },
    ],
    codecProfiles: [
      {
        type: 'Video',
        codec: 'h264',
        conditions: [
          // Condition/Property/Value 是字符串枚举（非字段名），保持 PascalCase
          { condition: 'LessThanEqual', property: 'Width', value: '3840', isRequired: false },
          { condition: 'LessThanEqual', property: 'Height', value: '2160', isRequired: false },
          { condition: 'LessThanEqual', property: 'VideoLevel', value: '52', isRequired: false },
        ],
      },
      {
        type: 'VideoAudio',
        codec: 'aac,mp3,mp2,opus,flac',
        conditions: [
          { condition: 'LessThanEqual', property: 'AudioChannels', value: '8', isRequired: false },
        ],
      },
    ],
  }
}

export function buildMpvDeviceProfile(): DeviceProfile {
  const videoCodecs = [
    'h264',
    'hevc',
    'h265',
    'av1',
    'vp9',
    'vp8',
    'mpeg2video',
    'mpeg4',
    'vc1',
    'theora',
  ].join(',')
  const audioCodecs = [
    'aac',
    'mp3',
    'mp2',
    'opus',
    'flac',
    'vorbis',
    'ac3',
    'eac3',
    'dts',
    'truehd',
    'alac',
    'pcm',
  ].join(',')
  return {
    ...buildDeviceProfile(),
    name: 'Emby Web',
    directPlayProfiles: [
      {
        container: 'mkv,webm,mp4,m4v,mov,avi,ts,m2ts,mpg,mpeg,flv,wmv',
        type: 'Video',
        videoCodec: videoCodecs,
        audioCodec: audioCodecs,
      },
      {
        container: 'mp3,aac,flac,opus,ogg,m4a,wav',
        type: 'Audio',
        audioCodec: audioCodecs,
      },
    ],
  }
}

export type { MediaStream, DeviceProfile } from '../types'
