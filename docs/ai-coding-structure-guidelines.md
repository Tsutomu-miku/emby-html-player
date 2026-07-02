# AI Coding 代码结构准则

## 目标

AI Coding 下的代码结构首先服务语义可读性：人类能判断整体，AI 才能稳定修改局部。
好的结构应满足：

- 人类能快速判断改动是否合理。
- AI 能快速定位应该修改的地方。
- 测试能证明业务契约没有被破坏。
- 模块边界能阻止无意的跨层耦合。

不要为了让单个文件变短而拆散业务概念；也不要把复杂流程堆在入口层。

## 核心原则

- 人类语义可读和 AI 语义可读基本一致。文件、模块和测试名称应表达真实业务概念。
- 模块默认按业务概念划分，不按技术动作划分。
- 文件可以大，但不能散。行数只是 review 提醒，认知跨度才是拆分依据。
- 大文件不是问题，多个变化原因混在一个文件里才是问题。
- 入口薄，业务厚，副作用靠边。
- 纯业务模型和流程编排要分开：前者表达规则，后者协调生命周期和副作用。
- 业务层不直接依赖全局 store、SDK、API client，应依赖明确的 port/adapter。
- 只给高风险、高变化、难测试、跨流程的副作用抽 port，避免接口迷宫。
- 测试保护业务契约，不保护文件结构。
- 设计文档记录当前真实约束和模块边界，不记录历史流水账。

## 模块边界

优先使用业务名词命名模块，例如 `projectVideoModel`、`projectVideoResourceLoader`、
`projectVideoEditorSession`。避免把稳定业务概念拆成只描述技术动作的碎片文件，例如
`filterPlayable`、`buildPending`、`parseMetadata`。

技术动作只有在满足以下条件时才适合独立成模块：

- 有明显副作用，例如网络、SDK、文件系统、缓存、上报。
- 失败分支多，需要独立测试。
- 会被多个业务入口复用。
- 变化频率和主业务模型不同。
- 抽出去后主流程更接近业务语言，而不是更像拼装流水线。

不适合拆分的情况：

- 只是因为文件超过某个行数。
- 只是为了把 helper 单独放出去。
- 拆分后主流程更难阅读。
- 拆分后的文件名只能表达技术动作，不能表达业务含义。

## 入口与业务层

View、Hook、路由、API handler、CLI command 都属于入口层。入口层只负责取上下文、组装参数、调用业务层、
映射 UI 状态和展示少量交互事件。

入口层不应承载：

- 多阶段异步流程。
- 复杂生命周期、取消、重试和资源清理。
- SDK、API、store 混合调用。
- 大量业务失败策略。

业务层应承载：

- 状态转换。
- 业务规则。
- 流程阶段。
- 失败处理策略。
- 幂等、取消、重试。
- 可测试的业务契约。

简单入口可以直接调用纯 model/domain 函数；只有出现多阶段流程、生命周期或复杂副作用时，才需要 workflow/session/service。

## 副作用边界

业务层应依赖明确的能力接口，而不是直接绑定全局 store 或外部 SDK。

例如业务流程需要写编辑器状态时，优先依赖 `ProjectVideoEditorStatePort` 这类能力接口：

```ts
type ProjectVideoEditorStatePort = {
  setMedia(state: ProjectVideoEditorState): void;
  replaceSource(sourceId: string, source: LocalVideoSource): void;
  markSourceError(sourceId: string, error: string): void;
  getSnapshot(): ProjectVideoEditorState;
};
```

不是所有副作用都需要抽 port。普通稳定工具函数可以直接使用；高风险、高变化、难测试、跨流程的副作用才需要
明确边界。

Port 应表达业务流程需要的外部能力，而不是包装整个外部系统。避免 `setState(state)`、`dispatch(action: unknown)` 这类把 store 透传进业务层的接口。

## Shared 与 Contract

`shared` 是高风险目录，只放稳定、无业务归属、被多个模块真实复用的代码。不要把不知道放哪里的业务逻辑、
临时 helper、只有一个调用方的抽象放进 `shared`、`utils`、`common` 或 `helpers`。

越靠近边界，类型越要明确。API request/response、事件结构、持久化结构、URL 参数、跨模块公开类型、
第三方 SDK 适配和重要业务错误都应有清晰 contract，避免使用宽泛的 `string`、`any` 或随意扩展字段。

## 测试边界

测试应跟业务契约走，而不是跟文件结构走。重构文件和模块时，只要业务契约不变，测试不应大面积重写。

优先测试：

- 给定输入后的状态变化。
- 关键流程的阶段顺序和失败策略。
- 对外协议、持久化结构和兼容边界。
- 高风险副作用是否在正确条件下触发。

避免测试：

- 私有 helper 的调用次数。
- 文件拆分后的中间对象。
- 只服务当前实现的临时函数名。
- 普通 UI 文案和配置常量，除非它们是对外契约。

如果一个 helper 重要到需要直接测试，通常说明它已经承载稳定业务规则，应考虑提升为明确的 domain 函数。

## AI 修改规则

- 优先修改已有业务模块，不要为了小改动新建抽象层。
- 新增文件前，先寻找同一业务概念下的现有 model、workflow、session、port、adapter。
- 不要把业务代码放入 `shared/utils`、`common` 或 `helpers`。
- 不要绕过现有 port 直接 import store、SDK 或 API client。
- 不要在 View、Hook、Handler 中堆复杂业务流程。
- 改变业务行为时必须新增或更新测试。
- 改变对外协议、持久化结构、事件结构时必须同步更新 contract、schema、migration 或兼容逻辑。
- 新增 shared 代码时必须确认已有真实复用方。
- 新增 port 时必须说明隔离的真实变化点。
- 优先复用项目现有模式，不要引入风格不一致的新架构。

## Review Checklist

- 这个模块边界是业务概念，还是技术动作？
- 文件变小以后，认知跨度真的降低了吗？
- 读懂一个核心流程是否需要在过多文件间跳转？
- 入口是否只负责取上下文、组参数、调用业务层和映射 UI？
- 复杂流程是否沉到明确业务层，而不是沉到 View/Hook/Handler？
- 业务层是否直接依赖全局 store、SDK、API client？
- 副作用是否在明确边界内？
- 抽象是否隔离了真实变化点，而不是制造接口迷宫？
- 新增 shared 代码是否已有真实复用方？
- 对外协议、持久化结构或事件结构变化时，contract、schema、migration 和测试是否同步更新？
- 测试是在保护业务契约，还是保护实现细节？
- 设计文档是否记录当前真实约束和模块边界？
