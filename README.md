# Emby H5 Player

纯前端 H5 客户端，用于在浏览器里直接浏览和播放你的 **Emby** 媒体库（Emby 官方没有可用的纯 Web 播放端，Jellyfin 网页体验又和 Emby Server 不完全兼容）。风格参考 Jellyfin Web。

> 完全在浏览器里运行，零后端，不经过任何第三方服务器。凭据只保存在 `localStorage`。

## 功能

| 模块 | 完成度 |
|------|--------|
| 🔐 登录与认证 | ✅ 服务器地址 + 用户名密码；连接测试（`/System/Info/Public`）；凭据本地持久化 |
| 🗂️ 媒体库浏览 | ✅ 侧栏列出用户视图；首页（继续观看 / 下一集 / 最近添加 / 推荐）；媒体库筛选+搜索+排序+无限滚动 |
| 🎬 详情页 | ✅ 系列 / 季 / 集 / 电影 / 合集差异化渲染；季选择器 + 剧集列表；相似推荐；演职员 |
| 🎥 视频播放 | ✅ HLS (hls.js + Safari 原生)；直链 DirectPlay；服务端转码；进度续播；控制条；快捷键 |
| 🔇 音轨 / 字幕 | ✅ 下拉切换；字幕支持外挂（VTT/SRT/ASS 等文本）与烧录（位图字幕）；多语言 |
| 📺 服务端交互 | ✅ 播放开始 / 每 10s 进度 / 停止 上报；收藏与标记已看（乐观更新）；下一集自动播放 |
| ⌨️ 键盘快捷键 | ✅ Space/K 播放暂停、←→ 跳转、↑↓ 音量、M/F/C/N/P/Esc… |
| 📱 响应式 | ✅ 移动 / 桌面端布局；移动端控制条适配；PIP；全屏；Media Session |
| 🔎 全局搜索 | ✅ 顶栏 debounce 搜索 `Search/Hints`，下拉直达条目 |
| ⚙️ 设置 &amp; 本地偏好 | ✅ 播放/字幕/片头片尾/体验/本地 5 大分组 29 项；默认只存本浏览器，不写入 Emby 用户配置；显式「同步到服务器」按钮一键写入 |

## 快速开始

```bash
pnpm install          # 安装依赖
pnpm dev              # 本地开发 http://localhost:5173
pnpm build            # 构建生产版本到 dist/
pnpm preview          # 本地预览构建产物
```

生产部署：把 `dist/` 扔到任意静态服务器（Nginx / Cloudflare Pages / Vercel / GitHub Pages…）。

## 使用流程

1. 打开网页 → **登录页**：
   - **服务器地址**：填你的 Emby Server。支持 `https://emby.example.com`、`http://192.168.1.10:8096`，也可以裸填 `host:port`（会自动补 `http://`）。
   - 注意：如果网页部署在 **HTTPS**，Emby Server 也必须是 HTTPS（混合内容会被浏览器拦截）。
2. 登录成功后跳转**首页**：继续观看、下一集、最近添加、推荐。
3. 侧栏切换**媒体库**：筛选排序、搜索、无限滚动。
4. 点任一卡片进**详情页**：播放按钮直接跳到 `/player/:id`；季选择器 + 单集列表；收藏 / 标记已看 / 分享。
5. **播放页**：
   - 控制条：进度拖拽 + 缓冲条、音量、倍速、音轨、字幕（外挂 / 烧录）、媒体源切换、画中画、全屏。
   - 剧集播放距结束 40 秒时，弹出「下一集 · 10 秒倒计时」卡片，可立即播放或取消；播放结束自动跳下一集。
   - 播放进度每 10s 上报到服务端，关闭页面时立即上报停止，下次继续看能无缝续播。

### 键盘快捷键

| 按键 | 功能 |
|------|------|
| Space / K | 播放 / 暂停 |
| ← / → | 上/下 跳 10s（按住 Shift = 30s） |
| ↑ / ↓ | 音量 ±10% |
| M | 静音切换 |
| F | 全屏切换 |
| Esc | 退出全屏 |
| N / P | 下一集 / 上一集（仅剧集） |
| C | 循环切换字幕（关→第一条→第二条…） |
| < / > | 播放速度 -/+ 0.25 |

## 架构

```
┌────────────────────────────────────────────────────────────────┐
│                          src/                                  │
├──────────────┬───────────────┬─────────────────┬───────────────┤
│   api/       │   components/ │    pages/       │   hooks/      │
│ （纯逻辑）   │  （UI）       │  （页面+路由）  │ （React Hooks）│
├──────────────┼───────────────┼─────────────────┼───────────────┤
│ http.ts      │  ui/          │  LoginPage      │ useAsync      │
│ types.ts     │   PosterCard  │  HomePage       │ usePlayback-  │
│ users.ts     │   HorizontalRow│ LibraryPage     │   Reporting   │
│ library.ts   │   ErrorState  │  ItemDetailPage │ useKeyboard-  │
│ playback.ts  │   Library-    │  PlayerPage     │   Shortcuts   │
│ images.ts    │    FilterBar  │                 │ useMediaSession│
│              │   SeasonPicker│                 │               │
│              │   EpisodeRow  │                 │               │
│              │   SearchSuggest│                │               │
│              │  layout/      │                 │               │
│              │   Sidebar     │                 │               │
│              │   TopBar      │                 │               │
│              │   Layout      │                 │               │
│              │  player/      │                 │               │
│              │   Player      │                 │               │
│              │   Controls    │                 │               │
│              │   ProgressBar │                 │               │
└──────────────┴───────────────┴─────────────────┴───────────────┘
        ▲                    │                    ▲
        │                    ▼                    │
  zustand store/auth    react-router-dom    浏览器 / hls.js
  localStorage persist    7 (createBrowserRouter)  HTMLVideoElement
```

### Emby API 交互核心约定

- **入参**：调用方（UI / hooks）写 **camelCase**（`startIndex`、`sortBy`、`userId`…）。`src/api/http.ts` 在发请求前递归转为 Emby 要求的 PascalCase（`StartIndex` / `SortBy` / `UserId`）。字符串枚举值（例如 `Fields` 的值 `CommunityRating`、`Condition` 的值 `LessThanEqual`）保持原样。
- **出参**：`http.ts` 解析 JSON 后递归 PascalCase → **camelCase**，与 `src/api/types.ts` 里的类型定义严格一致。
- **鉴权**：默认用 query `?api_key=<AccessToken>&DeviceId=xxx`（兼容性最好，避免 CORS 预检），同时保留 `X-Emby-Authorization` Header。
- **绝对 URL**：登录前（没有全局 server）时，`request('https://...', …)` 直接使用该完整 URL，仍自动附加鉴权。

### 播放流程

```
/player/:itemId
  ├─ 1) getItem → userData.playbackPositionTicks
  ├─ 2) getPlaybackInfo(userId, itemId, { deviceProfile, startTimeTicks, audioIdx, subtitleIdx })
  │     → mediaSources[] + playSessionId
  ├─ 3) pickDefaultSource (DirectPlay → DirectStream → Transcode → fallback)
  ├─ 4) resolveMediaPlayback → { url, method, liveStreamId }
  ├─ 5) <video src={url}> 或 new Hls(...).loadSource(url)
  ├─ 6) loadedmetadata → seek 到起始位置
  ├─ 7) usePlaybackReporting：Start → 每 10s Progress → (ended/unload) Stop
  └─ 8) onBeforeEnded(40s) → 倒计时 10s 下一集卡片
```

- **DirectPlay**：`supportsDirectPlay && directStreamUrl` → 直接作为 `video.src`；音轨切换不可用（Chrome 不实现 `audioTracks`）。
- **Transcode**：生成 HLS `master.m3u8?PlaySessionId=…`，hls.js 拉流；切音轨/字幕 → 重新调 `PlaybackInfo` 指定 `audioStreamIndex` / `subtitleStreamIndex` + `SubtitleMethod=Encode` → 重建源。
- **字幕外挂（External）**：文本字幕通过 `<track kind="subtitles">` 加载 `getSubtitleUrl(..., format=vtt)`，通过 `textTracks[i].mode = 'showing'|'disabled'` 精确控制。
- **位图字幕（PGS/DVDSUB…）**：自动走 **烧录（Encode）**，由 Emby 转码时渲染到画面上。

## 兼容性

- 浏览器：Chrome / Edge 90+、Firefox 100+、Safari 16+、iOS Safari 16+
- HLS：除 Safari/iOS 使用原生 HLS 外，其它用 `hls.js@1.6`
- 全屏 / PIP / Media Session：现代浏览器全部支持；Safari 的 `audioTracks` 可用（切音轨不需要切源）
- HTTPS / HTTP：如果播放器部署在 HTTPS，Emby Server 必须也是 HTTPS，否则混合内容被拦截。内网部署纯 HTTP 则无此限制。

## 设置 &amp; 本地偏好

新增 `/settings` 页面（侧栏 ⚙️ 设置 / 顶栏用户头像 → 设置），包含 5 大分组共 29 项设置，覆盖：

- **播放**：播放方式（直链/转码）、默认转码码率上限、最大音频声道、多源选择策略
- **字幕 &amp; 音轨**：首选语言优先级列表（tag 多选 + 排序）、自动选择条件、烧录策略、Forced only、字体缩放
- **跳过片头片尾**：固定区间/章节关键字自动识别（OP/ED/PV…）、Auto 模式 vs 显示按钮、片尾阈值
- **播放体验**：倍速记忆、默认倍速、自动跳下一集、倒计时卡片阈值&秒数、续播回退 N 秒
- **本地**：主题、SW 缓存、成人内容、卡片纵横比

> ⚠️ **隐私与多端设计**：所有设置默认只存于浏览器 `localStorage`（key=`ehp_settings`），**不会在任何时机自动写入 Emby 服务器**——`buildRemotePatch()` 是纯函数，只在用户显式点击页面底部「🔗 同步到 Emby 服务器（当前用户）」按钮并 confirm 后，才会调用一次 `POST /Users/{userId}/Configuration`，用于多端共享偏好。

## 与 Jellyfin Web 官方的差异

- Emby 和 Jellyfin API 基本兼容，但某些字段（例如 `PlaybackInfo` 返回的 `TranscodingUrl` 参数、`LiveStreamId` 生命周期）行为不完全一样——本项目按 Emby Server 4.7+ 的实际行为编写。
- Jellyfin 提供的是官方 Web 客户端，体积较大且对 Emby 兼容性没有保证。本项目是**只做 Emby 优化的最小可用客户端**。

## 常见问题

### 为什么登录成功但看不到任何内容？

1. 可能是账号权限：在 Emby 管理后台确认该用户有对应媒体库的访问权限。
2. 浏览器开发者工具 → Network 看 `/Users/{userId}/Views` 是否 401/403。若是，检查该用户的 `Access Schedule` / `Remote Access` 设置。

### 为什么某些片子无法播放 / 一直加载？

- 看 Network 面板，若 `master.m3u8` 返回 4xx：
  1. 若你的 Emby 未开启 **硬件转码**，转码源可能返回错误——在控制条中切换到有 DirectPlay 能力的源试试。
  2. 若是 **远程访问**，检查 Emby 的 `Advanced → Security` 是否允许远程转码。
- 若 200 但视频黑屏：字幕格式太复杂（PGS/ASS），换一个外挂字幕源（或选"烧录"模式）。

### 为什么字幕不显示？

- 文本字幕（SRT/VTT）：请在控制条 → 字幕 → 选 "外挂"。
- 位图字幕（PGS/DVDSUB）：浏览器无法直接渲染，请选 "烧录"（会重新走服务端转码，需要转码能力）。
- 字幕语言不匹配：Emby 中字幕元数据缺少 `language` 字段时，会显示为 `und`，但仍可尝试外挂加载。

### 为什么进度不同步 / 服务端没看到播放状态？

- 页面关闭时浏览器有时来不及发 POST，可改用 PWA / 后台页保持稍长。
- Emby Server 的 `Sessions` 列表需要 `ReportPlaybackStart/Progress/Stop` 三者配合，本项目 `usePlaybackReporting` 已处理开始 / 节流 / 停止 / `pagehide`。
- 若你部署的网页在 HTTPS，`pagehide` 在 iOS Safari 上偶尔不触发，可改用 `visibilitychange`（后续可加）。

## 许可证

MIT
