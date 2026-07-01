# AGENTS.md — 本项目工程规范

> 所有 AI agent（含 Relay / Claude Code / Codex 等）和人类贡献者在本仓库工作时**必须**遵守以下规范。规范冲突时以本文件为准。

## 1. 单文件行数限制：≤ 300 行

- **硬性上限**：任何 `.ts` / `.tsx` 文件**不得超过 300 行**（不含空行和纯注释行也算）。
- 由 ESLint `max-lines` 规则强制：`["error", { max: 300, skipBlankLines: true, skipComments: true }]`。
- **特殊情况下可绕过**，但必须满足以下全部条件：
  1. 文件顶部的 `/* eslint-disable max-lines */` 之前，有一行注释说明**为什么**无法拆分（例：单一 React 组件高内聚、第三方生成的类型定义）；
  2. 该文件行数 ≤ 400 行（绕过不等于无限放宽）；
  3. PR / commit message 中明确列出该文件名并说明理由。
- **不允许的绕过借口**：「太麻烦」「以后再拆」「重构风险大」。
- 拆分指导：
  - React 组件超长 → 拆子组件到同目录 `parts/` 或 `sections/`；
  - Hook 超长 → 按职责拆分到多个 hook 文件再聚合；
  - 类型定义超长 → 按 domain 拆分（`types/item.ts` / `types/playback.ts` …），用 `types/index.ts` 再导出；
  - 工具函数超长 → 按主题分组到多个文件。

## 2. 修复 bug 时禁止写兼容性代码

- **绝对禁止**通过 try/catch 吞错、`as any`、`?? defaultValue`、可选链兜底、`@ts-ignore`、`eslint-disable` 等方式**掩盖 bug 的表面症状**。
- 必须找到根因（root cause）并直接修复根因。
- **提前暴露问题比静默吞错更重要**：让用户/开发者立刻看到崩溃、看到错误堆栈，比"看似能跑"有价值得多。
- 具体到本项目的表现：
  - ❌ `catch (e) { /* ignore */ }` —— 必须至少 `throw e` 或上报错误边界。
  - ❌ `data?.items ?? []` 当 `data` 在契约上不可能为 undefined 时 —— 直接 `data.items`，让 TypeScript 和运行时一起把问题暴露。
  - ❌ `as BaseItemDto` 强转 —— 修类型定义，不要骗编译器。
  - ❌ `if (!response.ok) { return null }` —— 应当 `throw new Error(\`HTTP ${status}\`)`。
  - ❌ `setTimeout(() => {}, 0)` 兜底时序问题 —— 找到为什么时序不对。
- 唯一允许的「兼容」场景：调用**第三方不可控** API（如 Emby Server 不同版本字段差异），且已经在代码里**显式注释**了为何如此处理、对应的 Emby 版本号、以及 fallback 触发时的可观测日志。

## 3. 项目类型：Electron 桌面应用

- 本项目是 **Electron** 桌面应用（不再是纯 H5），主要进程结构：
  - `electron/main/` —— 主进程，负责窗口创建、CORS 头注入（`session.webRequest.onHeadersReceived`）、菜单、IPC；
  - `electron/preload/` —— preload 脚本，通过 `contextBridge` 向渲染进程暴露安全 API；
  - `src/` —— 渲染进程，React + Vite + TS，与原 H5 版本共用。
- **渲染进程禁止直接使用 Node API**：`nodeIntegration: false`，`contextIsolation: true`。所有需要 Node 能力的操作走 IPC。
- **CORS 由主进程统一注入**：渲染进程不需要也不能自行处理 CORS。主进程在 `app.ready` 后给 `defaultSession` 注册 `onHeadersReceived`，对所有响应追加 `Access-Control-Allow-*` 头。
- **Electron 视觉验证不得默认使用系统全屏截图**：调试播放器、页面或设计还原时，优先使用 Chrome DevTools Protocol / Electron WebContents 对目标窗口或目标 target 截图，或读取 DOM/主进程日志。禁止默认使用 `screencapture` 全屏截图影响用户日常桌面；只有用户明确要求或 CDP 不可用且必须确认原生层画面时，才允许临时使用系统截图，并需提前说明。
- 构建命令：
  - `pnpm dev` —— 启动 electron-vite dev（主进程 + 渲染进程同时热重载）；
  - `pnpm build` —— 构建渲染进程到 `out/renderer/`，主进程到 `out/main/`；
  - `pnpm package` —— 用 electron-builder 打成 `.dmg` / `.AppImage` / `.exe` 安装包。

## 4. TypeScript 规范

- `strict: true`，禁用 `any`（必要时用 `unknown` + 类型守卫）。
- 禁用 `@ts-ignore` / `@ts-expect-error`（除非有行内注释说明对应的 TS issue 编号）。
- 接口字段命名：camelCase（与 Emby PascalCase 的转换由 `src/api/http.ts` 统一处理，业务层不感知 PascalCase）。

## 5. 提交规范

- commit message 用 `feat(scope):` / `fix(scope):` / `refactor(scope):` / `chore(scope):` / `docs(scope):` 之一。
- 单个 commit 尽量聚焦一个目的；跨多个目的的改动拆成多个 commit。
- **禁止** `--no-verify` 跳过 pre-commit hook（除非用户明确要求）。

## 6. 遗留重构进度（已完成）

Electron 化时计划的 7 个超长文件已全部重构完毕，按功能边界拆分（非为拆而拆）。
每处拆出的 `parts/` / `sections/` / `types/` 子文件都在 300 行以内；主组件文件在无法继续拆分（高内聚场景）时使用
`/* eslint-disable max-lines -- REASON */` 按 §1 规则兜底，均未超过 400 行。

| 文件 | 重构前 | 拆分方式（已完成） | 主文件重构后 |
|------|--------|-------------------|-------------|
| `src/components/player/Player.tsx` | 1302 | 拆 `parts/{selectors,subtitles,hls,introSkip,overlays,Controls,Icons,Menus}.tsx` + `useIntroSkip` / `useControlsVisibility` 钩子；doLoad + 切源逻辑因高内聚保留 | 410 (eslint-disable，≤400 特殊阈值) |
| `src/pages/SettingsPage.tsx` | 850 | 拆 `settings/{constants.ts,controls.tsx}` + `settings/sections/{Play,SubtitleAudio,IntroCredits,PlaybackExperience,Local,Footer}Section.tsx` | 80 |
| `src/components/player/Controls.tsx` | 746 | 拆 `parts/Icons.tsx`（16 SVG）+ `parts/Menus.tsx`（菜单 UI + formatters） | 398 (eslint-disable) |
| `src/pages/ItemDetailPage.tsx` | 682 | 拆 `item-detail/{HeroSection,InfoPanel,CastList,SeasonEpisodePanel,SimilarSection,ChildrenGrid}.tsx` + `useEpisodeData` 钩子 | 235 |
| `src/pages/PlayerPage.tsx` | 551 | 拆 `player/hooks/{useEpisodeData,useNextEpisode}.ts` + `player/parts/{NextEpisodeCard,AdjacentEpisodes}.tsx` | 346 (eslint-disable) |
| `src/api/types.ts` | 532 | 按 domain 拆 `types/{user,item,playback}.ts`，barrel 由 `types/index.ts` + `types.ts` 提供（旧导入路径保持兼容） | 2 (barrel) |
| `src/api/playback.ts` | 354 | 拆 `playback/{device.ts,resolve.ts,http.ts}`；旧路径通过 barrel 保持兼容 | 4 (barrel) |
