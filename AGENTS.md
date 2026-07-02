# AGENTS.md — 本项目工程规范

> 所有 AI agent（含 Relay / Claude Code / Codex 等）和人类贡献者在本仓库工作时**必须**遵守以下规范。
> 代码结构与拆分决策同时遵守 `docs/ai-coding-structure-guidelines.md`，且以该文档为准；
> TypeScript、Electron 安全边界、提交流程等项目约束仍以本文为准。

## 1. 代码结构与文件规模

- 代码结构首先服务语义可读性，具体准则见 `docs/ai-coding-structure-guidelines.md`。
- 行数是 review 提醒，不是机械拆分依据；拆分应以业务概念、变化原因、认知跨度和副作用边界为依据。
- 不要为了让单个文件变短而拆散稳定业务概念，也不要把复杂流程堆在入口层。
- 新增文件前，先寻找同一业务概念下的现有 model、workflow、session、port、adapter。
- 新增 shared/common/utils/helper 代码前，必须确认已有真实复用方；不要把“不知道放哪里”的业务逻辑放进去。
- 当前 ESLint 仍可能保留 `max-lines` 检查；若它与结构准则冲突，应优先调整 lint 配置或补充豁免说明，而不是为过 lint 牺牲业务边界。

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

## 6. 遗留重构记录（参考）

以下记录仅说明历史重构背景，不作为继续按行数拆分的依据。后续调整以 `docs/ai-coding-structure-guidelines.md`
中的业务概念、认知跨度、入口/业务层职责和副作用边界为准。

| 文件 | 历史问题 | 重构方式 |
|------|----------|----------|
| `src/components/player/Player.tsx` | 播放入口承载过多职责 | 拆出播放器选择器、字幕、HLS、跳片头、overlay、控制条和相关 hook；高内聚的加载/切源流程保留在业务上下文内 |
| `src/pages/SettingsPage.tsx` | 设置页章节和控件混杂 | 拆为设置常量、控件和按设置分组命名的 sections |
| `src/components/player/Controls.tsx` | 控件、图标、菜单混杂 | 拆出图标和菜单 UI，保留控制条组合职责 |
| `src/pages/ItemDetailPage.tsx` | 详情页多个业务区块混杂 | 拆为 hero、信息、演职员、季集、相似内容等业务区块 |
| `src/pages/PlayerPage.tsx` | 播放页和剧集导航流程混杂 | 拆出剧集数据、下一集逻辑和相邻剧集展示 |
| `src/api/types.ts` | 多个 API domain 类型混杂 | 按 user、item、playback domain 拆分并保留 barrel |
| `src/api/playback.ts` | 播放解析、设备信息和请求混杂 | 按播放业务职责拆分为 device、resolve、http |
