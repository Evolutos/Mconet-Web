<!-- Copyright © 2026 Mcont. -->

# Text Unary Scope

- 目标运行时：现代浏览器、Web Worker、Node.js 20+
- 发布主题：单次、非流式的文本对话交互

## 目的

本文定义 Mconet Web SDK 单次、非流式文本交互的能力边界。实现、测试、示例和发布验收必须以此范围为准；尚未完成的能力必须被明确拒绝，不能通过空实现、静默忽略或永远返回 `unsupported` 的占位 API 冒充支持。

本文只定义功能范围，不定义版本号与兼容升级规则，也不定义实验 API 的标记和移除规则。最终发布范围在全部发布门禁通过后冻结。

## 核心闭环

当前功能范围支持以下完整执行闭环：

```text
ModelRequest
→ 输入规范化与运行时校验
→ 解析 ModelTarget、Task 和 unary InteractionMode
→ 选择模型集成与 TaskProtocolAdapter
→ 生成无副作用 ProtocolExecutionPlan
→ 固化 Codec、Transport、Authorization 等组件
→ 校验组件能力与类型契约
→ 构造并编码协议请求
→ 应用授权
→ 通过 fetch 执行单次 HTTP/HTTPS 请求
→ 解码并解析协议响应
→ ModelOutput
```

SDK 准确执行一次交互并报告结果。失败后的重试、降级和业务处置由调用方决定。

## 支持矩阵

| 维度             | 支持                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------- |
| Task             | `conversation.generate`                                                                 |
| Message role     | system、user、assistant                                                                 |
| Message content  | 有序文本内容，包括 Unicode、emoji、换行和约定允许的空文本                               |
| Interaction mode | `unary`                                                                                 |
| Wire format      | JSON                                                                                    |
| Transport        | 基于标准 `fetch` 的 HTTP/HTTPS                                                          |
| Authorization    | NoAuth、Header API Key、Bearer                                                          |
| 默认集成         | 一个显式选择的 OpenAI-compatible 文本协议                                               |
| 配置             | Client 默认值与单次 Interaction 覆盖；显式组件注入                                      |
| 扩展             | 通过已实现的 SPI 显式注入 Adapter、Codec、Transport、Authorization、Resolver 与 Monitor |
| 兼容模式         | `strict`、默认 `compatible`、显式 `permissive`；三者均保留安全不变量                    |
| 输出             | 文本、finish reason、usage、模型标识、响应元数据和脱敏 diagnostics                      |
| 取消与超时       | 调用方 `AbortSignal`；由 Runtime 合成的 deadline signal                                 |
| Raw response     | 默认关闭；显式开启时只提供有界、只读、脱敏快照                                          |
| 部署             | Browser、Web Worker、Node.js 20+、SSR/BFF 服务端入口                                    |
| 包格式           | ESM-first、类型声明、Browser/Node 静态条件导出                                          |

## 部署与凭据范围

### Browser 与 Web Worker

- 推荐由 Browser SDK 调用应用自己的 BFF/Proxy；长期供应商密钥只保存在服务端。
- 只有供应商明确支持 CORS，且凭据短期、最小权限、可撤销时，才允许 Browser 直连。
- Browser 包不得包含 Node 内置模块或 polyfill，不得把 Secret 写入 bundle、source map、URL、Storage、可读 Cookie、日志、错误或 analytics。
- Core 与 Browser Transport 必须可在 Web Worker 中运行，不依赖 DOM。
- SDK 不承诺绕过服务端 CORS、CSP、Mixed Content、TLS 或浏览器凭据策略。

### Node.js 与 SSR

- Node 入口可用于 BFF、SSR route handler、CLI 和测试。
- 服务端 Secret 只能从服务端运行时注入，不得序列化到页面、Client Component props 或 Browser bundle。
- SSR 不得在模块级保存请求级身份；每次交互解析独立 `ServiceAccess`。

## 公共 API 范围

最小交互能力是单一 `interact` 方法和幂等关闭契约：

```ts
export interface ModelInteractor {
  interact(request: ModelRequest, options?: InteractionOptions): Promise<ModelOutput>;
}

export interface ModelClient extends ModelInteractor {
  close(): Promise<void>;
}
```

在运行时与 TypeScript lib 兼容时，`ModelClient` 可以同时实现 `AsyncDisposable`；该语法能力不得提高最低运行时门槛。

便利构造器和文本便利 API 只能构造标准领域对象并委托同一个 Core Runtime，不得建立绕过校验、解析、授权或错误归一化的第二条执行路径。

## 必须在 I/O 前拒绝的输入

下列输入必须在读取动态凭据和执行网络 I/O 之前失败。失败必须使用稳定的 `ModelInteractionError` category/code，并保证 Transport 未被调用。

| 输入或配置                                                 | 行为 | 代表性稳定 code                                                                                                          |
| ---------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------ |
| 非 `conversation.generate` Task                            | 拒绝 | `unsupported_task`                                                                                                       |
| Tool、图片、音频、视频或文件 MessageContent                | 拒绝 | `unsupported_message_content`                                                                                            |
| 非空 ArtifactCatalog 或需要读取、上传、转换的 Artifact     | 拒绝 | `unsupported_message_content` 或更具体的稳定 code                                                                        |
| `server_stream`、`client_stream`、`duplex`、`long_running` | 拒绝 | `unsupported_interaction_mode`                                                                                           |
| Protobuf、XML、自定义二进制 wire format                    | 拒绝 | `unsupported_capability`                                                                                                 |
| WebSocket、WebTransport、gRPC Transport plan               | 拒绝 | `unsupported_capability`                                                                                                 |
| OAuth 自动刷新、Body/Chunk signing                         | 拒绝 | `unsupported_capability` 或 `unsupported_body_signing`                                                                   |
| 无唯一匹配的集成或组件                                     | 拒绝 | `unsupported_model_integration`、`ambiguous_model_integration`、`component_not_found` 或 `ambiguous_component_selection` |
| 组件 type contract 不兼容                                  | 拒绝 | `invalid_component_type_contract` 或 `component_type_mismatch`                                                           |
| 重复 Artifact ID 或悬空引用                                | 拒绝 | `duplicate_artifact_id` 或 `artifact_reference_not_found`                                                                |
| Header CR/LF、非法 URL scheme 或其他安全错误               | 拒绝 | 对应稳定 validation/security code                                                                                        |

兼容模式不得放宽必需能力、引用完整性、Secret 风险或组件歧义。未知但可无损保真的数据可以保留；未知且会造成有损映射的数据必须按兼容策略失败或产生明确 warning。

## 明确不支持

当前不支持以下行为，也不为其发布占位方法：

- Embedding、Rerank、图像、音频、视频和自定义二进制 Task；
- Tool 调用或 Agent Loop，以及工具实际执行；
- Server Stream、Client Stream、Duplex 和 Long Running 生命周期；
- Artifact 读取、下载、上传、转换或多模态传输；
- Protobuf、XML、自定义二进制、multipart 或 streaming request body；
- WebSocket、WebTransport 和 gRPC；
- OAuth 自动刷新、Body signing 和 Chunk signing；
- 自动重试、退避、熔断、负载均衡和业务限流；
- 模型或协议自动切换，以及多供应商协议猜测；
- 会话持久化、历史裁剪、长期记忆和 RAG；
- 业务 Schema 自动修复；
- 默认在 Browser 保存长期模型服务密钥；
- 全局可变组件 Registry、公共组件 ID、动态 Binding 注册和运行时插件热加载；
- 为未来能力预建无类型 Hook、万能 Interceptor 或包含所有未来方法的扩展接口；
- 绕过 CORS、CSP、Mixed Content、TLS 校验或宿主应用的认证授权策略。

## 保留但不执行的领域边界

公共领域模型可以定义 Artifact、开放标识和后续模式所需的稳定数据边界，但 Runtime 不执行这些未来能力。存在类型不等于运行时支持；非空 ArtifactCatalog 和非文本内容仍按前述规则在 I/O 前拒绝。

当前 `TransportBody` 只允许 bytes 分支。未来增加 stream 或 multipart 分支时，不得改变已发布 bytes 分支语义。

## 后续增量

以下能力只有在各自生命周期、背压、安全约束、Contract Test 和 Conformance Case 完成后才能公开：

1. Server Stream；
2. Artifact 与多模态输入；
3. Embedding 与 Rerank；
4. Client Stream；
5. Duplex；
6. Long Running。

每个增量定义自己的最小能力接口和结果/句柄类型，不修改已发布的 Text Unary 语义。

## 范围验收

范围门禁满足以下全部条件时才通过：

- 支持矩阵中的每一项都有完整实现和对应自动化测试；
- 不支持项在凭据读取和网络 I/O 前返回稳定错误；
- 没有流式、Artifact 执行或 Operation 占位 API；
- Browser、Worker、Node 和 SSR 边界符合凭据与平台隔离规则；
- 默认 OpenAI-compatible JSON/fetch 文本闭环通过 Unit、Contract、Conformance、Integration、Browser 和受控 Live 验证；
- ESM、类型声明、条件导出、tree-shaking 和独立 tarball 消费验证通过；
- Secret、Header 注入、重定向、响应上限、取消、超时和并发隔离安全测试通过。
