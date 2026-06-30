# Emby Desktop Player

面向 **Emby Server** 的 Electron 桌面客户端。渲染层沿用 React + Vite + TypeScript，桌面能力由 Electron 主进程统一承接：窗口生命周期、跨域响应头注入、Emby 播放器身份头、IPC，以及 libmpv 原生播放后端。

> 应用不需要自建后端，也不会经过第三方服务器。账号凭据和本地偏好保存在本机应用数据中；需要多端共享的偏好必须由用户显式同步到 Emby Server。

## 功能

| 模块 | 完成度 |
|------|--------|
| 🔐 登录与认证 | ✅ 服务器地址 + 用户名密码；连接测试（`/System/Info/Public`）；凭据本地持久化 |
| 🗂️ 媒体库浏览 | ✅ 侧栏列出用户视图；首页（继续观看 / 下一集 / 最近添加 / 推荐）；媒体库筛选、搜索、排序、无限滚动 |
| 🎬 详情页 | ✅ 系列 / 季 / 集 / 电影 / 合集差异化渲染；季选择器 + 剧集列表；相似推荐；演职员 |
| 🎥 视频播放 | ✅ HTMLVideo + hls.js；DirectPlay / DirectStream / 转码；libmpv 原生嵌入后端；进度续播；控制条；快捷键 |
| 🔇 音轨 / 字幕 | ✅ 下拉切换；文本字幕外挂；位图字幕烧录；libmpv 后端支持原生轨道切换 |
| 📺 服务端交互 | ✅ 播放开始 / 每 10s 进度 / 停止上报；收藏与标记已看；下一集自动播放 |
| 🧩 Electron 桌面能力 | ✅ 主进程统一注入 CORS 与 Emby 身份头；preload 安全暴露 `window.ehp`；禁用 renderer Node API |
| ⌨️ 键盘快捷键 | ✅ Space/K 播放暂停、←→ 跳转、↑↓ 音量、M/F/C/N/P/Esc 等 |
| ⚙️ 设置 & 本地偏好 | ✅ 播放、字幕/音轨、片头片尾、体验、本地 5 大分组；默认只存在本机，显式同步才写入 Emby 用户配置 |

## 快速开始

```bash
pnpm install
pnpm dev        # 启动 electron-vite dev（主进程 + preload + renderer）
pnpm build      # 构建 Electron 产物到 out/
pnpm package    # 打包桌面安装包到 release/
```

平台打包命令：

```bash
pnpm package:mac
pnpm package:linux
pnpm package:win
```

`package` 会先校验原生播放资源。macOS 当前还会构建 `ehp_mpv_player.node` 并检查 bundled `libmpv.2.dylib`；缺少原生资源时会在打包前失败。

仍保留的 `dev:web` / `build:web` / `preview` / `deploy` 只用于调试渲染层或历史 GitHub Pages 产物，不是当前主发布路径。

## 使用流程

1. 启动桌面应用，进入 **登录页**。
   - **服务器地址**：填写你的 Emby Server，例如 `https://emby.example.com`、`http://192.168.1.10:8096`，也可以裸填 `host:port`（会自动补 `http://`）。
   - Electron 主进程会统一处理跨域响应头和 Emby 请求身份，渲染进程不需要自行绕 CORS。
2. 登录成功后进入**首页**：继续观看、下一集、最近添加、推荐。
3. 侧栏切换**媒体库**：筛选排序、搜索、无限滚动。
4. 点任一卡片进入**详情页**：播放按钮跳到 `/player/:id`；剧集支持季选择器、单集列表、收藏、标记已看、分享。
5. **播放页**：
   - 控制条：进度拖拽 + 缓冲条、音量、倍速、音轨、字幕、媒体源切换、画中画、全屏。
   - HTMLVideo 可播放浏览器/Chromium 支持的直链、DirectStream 与 HLS 转码源。
   - Chromium 无法直接解码的容器会走 libmpv 原生嵌入后端；原生后端不启动外部 mpv 进程。
   - 剧集播放距结束 40 秒时弹出「下一集」倒计时卡片，可立即播放或取消；播放结束自动跳下一集。
   - 播放进度每 10s 上报到服务端，关闭页面或切换源时上报停止。

### 键盘快捷键

| 按键 | 功能 |
|------|------|
| Space / K | 播放 / 暂停 |
| ← / → | 后退 / 前进 10s（按住 Shift = 30s） |
| ↑ / ↓ | 音量 ±10% |
| M | 静音切换 |
| F | 全屏切换 |
| Esc | 退出全屏 |
| N / P | 下一集 / 上一集（仅剧集） |
| C | 循环切换字幕（关 → 第一条 → 第二条） |
| < / > | 播放速度 -/+ 0.25 |

## 架构

```
┌──────────────────────────── Electron 桌面应用 ────────────────────────────┐
│                                                                            │
│  electron/main/                                                            │
│  ├─ BrowserWindow 创建与生命周期                                            │
│  ├─ session.webRequest：CORS 响应头、OPTIONS 预检、Emby 身份头              │
│  ├─ embeddedMpv.ts：MPV IPC 服务                                            │
│  └─ libMpvBackend.ts：加载 ehp_mpv_player.node + libmpv                    │
│                                                                            │
│  electron/preload/                                                         │
│  └─ contextBridge 暴露 window.ehp                                           │
│     ├─ setEmbyAuth / setServerOrigin                                       │
│     ├─ mpvCreate / mpvLoad / mpvCommand / mpvDestroy                       │
│     └─ onMpvEvent / onNetworkDebug                                         │
│                                                                            │
│  src/ renderer                                                             │
│  ├─ api/：Emby API、camelCase ⇄ PascalCase 转换、播放地址解析              │
│  ├─ components/：布局、卡片、播放器、控制条                                 │
│  ├─ pages/：登录、首页、媒体库、详情、播放、设置                            │
│  ├─ hooks/：播放上报、快捷键、Media Session                                 │
│  └─ store/：zustand auth/settings，本机持久化                               │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 安全边界

- `nodeIntegration: false`，`contextIsolation: true`。
- 渲染进程不直接使用 Node / Electron API，需要桌面能力时走 preload 暴露的 `window.ehp`。
- 主进程统一修改跨域响应头和请求身份，渲染进程只发普通 API 请求。
- 外部链接用系统浏览器打开，不在 Electron 窗口内跳转。

### Emby API 约定

- **入参**：业务层使用 **camelCase**（`startIndex`、`sortBy`、`userId` 等）。`src/api/http.ts` 发请求前递归转换为 Emby 的 PascalCase。
- **出参**：`http.ts` 解析 JSON 后递归 PascalCase → **camelCase**，与 `src/api/types/` 类型定义保持一致。
- **鉴权**：保留 query `api_key` / `DeviceId` 的兼容路径，同时由主进程注入 Emby 官方客户端形态的请求头。
- **CORS**：主进程在 `app.ready` 后注册 `defaultSession.webRequest.onHeadersReceived`，对 HTTP(S) 响应统一追加 `Access-Control-Allow-*`。

### 播放流程

```
/player/:itemId
  ├─ 1) getItem → userData.playbackPositionTicks
  ├─ 2) getPlaybackInfo(userId, itemId, { deviceProfile, startTimeTicks, audioIdx, subtitleIdx })
  │     → mediaSources[] + playSessionId
  ├─ 3) pickDefaultSource (DirectPlay → DirectStream → Transcode → fallback)
  ├─ 4) resolveMediaPlayback → { url, method, liveStreamId }
  ├─ 5) HTML 后端：<video src={url}> 或 hls.js loadSource(url)
  ├─ 6) 原生后端：window.ehp.mpvCreate → mpvLoad(url, headers, startSeconds)
  ├─ 7) loadedmetadata / mpv started → seek 到起始位置
  ├─ 8) usePlaybackReporting / useMpvReporting：Start → Progress → Stop
  └─ 9) onBeforeEnded(40s) → 下一集倒计时卡片
```

- **HTMLVideo / hls.js**：适合 Chromium 可直接处理的 MP4/WebM、DirectStream、HLS 转码源。
- **libmpv 嵌入后端**：用于 Chromium 不支持的容器或编码；通过 native addon 嵌入窗口，不查找系统 `PATH`，不启动 mpv 可执行文件。
- **字幕外挂**：文本字幕通过 `<track kind="subtitles">` 加载；位图字幕走 Emby 烧录转码。
- **音轨/字幕切换**：HTML 后端按 Emby 转码或浏览器能力处理；mpv 后端通过 IPC 直接切换轨道。

## 兼容性

- 桌面运行时：Electron 42 / Chromium 142 级别能力。
- 打包目标：macOS `.dmg` / `.zip`，Linux `.AppImage` / `.deb`，Windows `nsis`。
- 原生播放资源：`resources/native/<platform>/<arch>/` 下必须包含对应平台的 `ehp_mpv_player.node` 与 libmpv 动态库。
- Web 渲染层仍可单独调试，但正式架构按 Electron 桌面应用维护。

## 设置与本地偏好

`/settings` 页面包含 5 大分组：

- **播放**：播放方式、默认转码码率上限、最大音频声道、多源选择策略
- **字幕 & 音轨**：首选语言优先级、自动选择条件、烧录策略、Forced only、字体缩放
- **跳过片头片尾**：固定区间、章节关键字识别、Auto 模式、片尾阈值
- **播放体验**：倍速记忆、默认倍速、自动跳下一集、倒计时阈值、续播回退秒数
- **本地**：主题、静态资源缓存开关、成人内容、卡片纵横比

所有设置默认仅存在本机持久化存储（key=`ehp_settings`），不会自动写入 Emby Server。只有用户点击「同步到 Emby 服务器（当前用户）」并确认后，才会调用 `POST /Users/{userId}/Configuration` 写入可映射字段。

## 常见问题

### 为什么登录成功但看不到任何内容？

1. 确认 Emby 管理后台中该用户有对应媒体库访问权限。
2. 打开 Electron DevTools 的 Network 面板，看 `/Users/{userId}/Views` 是否返回 401/403。
3. 若是权限错误，检查用户的访问计划、远程访问和媒体库授权。

### 为什么某些片子无法播放 / 一直加载？

- 若 `master.m3u8` 返回 4xx，检查 Emby 转码权限和硬件转码配置。
- 若 DirectPlay 源无法由 Chromium 解码，播放器会尝试使用 libmpv 后端。
- 若 libmpv 后端不可用，检查 `resources/native/<platform>/<arch>/` 是否包含 `ehp_mpv_player.node` 和对应 libmpv 动态库，并运行 `pnpm verify:native`。

### 为什么字幕不显示？

- 文本字幕（SRT/VTT/ASS）：优先使用外挂加载。
- 位图字幕（PGS/DVDSUB）：Chromium 不能直接渲染，需要选择烧录或使用 libmpv 后端。
- 字幕语言不匹配：Emby 元数据缺少 `language` 时会显示为 `und`，仍可手动选择。

### 为什么进度不同步 / 服务端没看到播放状态？

- Emby Server 的 `Sessions` 状态依赖 `ReportPlaybackStart/Progress/Stop` 三类请求。
- HTML 后端由 `usePlaybackReporting` 上报；mpv 后端由 `useMpvReporting` 根据原生事件上报。
- 如仍不同步，打开 `EHP_DEBUG_LOGS=1 pnpm dev` 查看主进程网络日志。

## 与 Jellyfin Web 的差异

- 本项目只针对 Emby Server 行为优化，尤其是 `PlaybackInfo`、`TranscodingUrl`、`LiveStreamId`、请求身份头和播放进度上报。
- Jellyfin Web 是完整官方 Web 客户端，本项目是轻量桌面播放器，不追求覆盖 Jellyfin 的全部 Web 功能。

## 许可证

MIT
