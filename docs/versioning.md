<!-- Copyright © 2026 Mcont. -->

# Versioning Strategy

- 适用范围：Mconet Web SDK 的全部公开 workspace package
- 版本模型：Lockstep Semantic Versioning

## 目标

本策略定义 Mconet Web SDK 如何选择、同步和解释版本号，使 package 版本、公共 TypeScript API、运行时行为、Schema、错误目录和条件导出表达同一个兼容性承诺。

本策略不修改当前 `0.0.0` 私有工程版本，不授权发布，也不定义实验 API 的标记与移除规则。

## Lockstep 版本

所有公开 `@evolutos/mconet-*` package 使用同一个版本号并作为一个 SDK release train 发布，包括 Core、SPI、Runtime、Codec、Authorization、Browser/Node Transport、Integration、Client 和 Testing。

采用 lockstep 的原因：

- 已实现的组件通过显式 type contract、Schema、错误语义和固定 Runtime 管线共同形成一个兼容单元；
- 单包行为变化可能影响其他包的可连接性，即使 TypeScript 签名未变化；
- 使用者可以从任意 package 版本直接识别整套 SDK 的协议基线；
- 发布验证、Golden Fixture、API snapshot 和 tarball consumer 只需对应一个 release identifier。

未修改的 package 也随 release train 升到相同版本。不得只提升某个公开 package 而留下混合版本矩阵，也不得用运行时兼容分支掩盖未验证的跨版本组合。

## SemVer 规则

稳定版本使用 `MAJOR.MINOR.PATCH`：

| 版本部分 | 使用条件                                                     |
| -------- | ------------------------------------------------------------ |
| MAJOR    | 对已发布稳定公共契约产生不向后兼容的变化                     |
| MINOR    | 增加向后兼容的能力，现有有效调用无需修改即可保持语义         |
| PATCH    | 修复缺陷、安全问题、文档或内部实现，不扩展或破坏稳定公共契约 |

版本提升按最高影响级别决定；一次 release 同时包含 patch、minor 和 major 变化时，只提升 major。

## 稳定版本与预发布版本

- 仓库骨架和未发布实现保持 `0.0.0` 与 `private: true`，不代表可消费版本。
- 第一个稳定公开版本目标为 `1.0.0`。
- 稳定前的可安装验证版本使用 `1.0.0-alpha.N`、`1.0.0-beta.N`、`1.0.0-rc.N`。
- `alpha` 可包含尚未完成的计划内行为，只用于受控开发验证。
- `beta` 必须完成 Text Unary Scope 支持项，但允许根据测试修正尚未冻结的兼容细节。
- `rc` 必须通过 Release Gate，除阻断发布的修复外不得增加范围。
- 预发布版本不使用 `latest` dist-tag；只有正式稳定版本可以成为 `latest`。

预发布版本之间可以发生兼容性变化，但每项变化仍必须记录并更新 API/Schema/Fixture snapshot。进入 `1.0.0` 后按稳定 SemVer 规则执行。

## 公共兼容面

以下内容均属于版本判定的公共契约，不只看 TypeScript 导出：

- package 名称、根入口、公开 subpath 与 Browser/Node/default 条件导出；
- 公开类型、函数、类、构造器、常量和其泛型约束；
- 参数、返回值、readonly/optional 语义与判别联合分支；
- Runtime pipeline 的可观察顺序、组件优先级、资源所有权和取消/超时语义；
- Text Unary Scope、Task/Message/Artifact 数据约束和兼容模式行为；
- JSON Schema、Golden Fixture、序列化格式、默认值与资源限制；
- 稳定 Error category、code、phase、恢复提示和安全脱敏行为；
- SPI 方法、type contract、capability、Resolver 匹配和 Contract Suite；
- Client 生命周期、并发隔离、幂等 close 与注入资源处理；
- 声明的最低 Node.js、TypeScript 和浏览器运行环境。

README 措辞、内部文件路径、未导出的实现、测试工具内部结构和性能优化不自动构成公共契约，除非已有文档明确承诺其行为。

## MAJOR 变化

稳定版本中的下列变化通常需要提升 MAJOR：

- 删除或重命名公开 export、package、条件入口或受支持 subpath；
- 删除公开字段，新增必填字段，收窄参数/返回类型或改变 optional/null/empty 语义；
- 改变判别字段含义，删除联合分支，或让既有合法值变为非法；
- 改变 `interact`、取消、deadline、close、资源所有权或并发的可观察语义；
- 改变组件优先级、显式不兼容时的失败规则或 Resolver 确定性；
- 删除或改变稳定 error code/category/phase 的含义；
- 使既有合法 Schema/Fixture 无法通过，或改变 canonical serialization；
- 更改默认 wire format、Transport、Authorization 语义或安全边界；
- 提高最低运行时要求，使声明支持的环境不能继续使用；
- 将原本在凭据读取或 I/O 前失败的输入延后到 I/O 后处理；
- 放宽 Secret、Header、redirect、response limit 等安全不变量。

安全修复如果必须破坏兼容性，仍按 MAJOR 评估；若需要在旧 major 上紧急修复，必须选择能维持既有公共契约的最小安全变更，或明确发布安全例外说明。

## MINOR 变化

下列变化在保持现有行为与安全不变量时通常提升 MINOR：

- 增加新的可选能力、公开函数或独立 package；
- 为现有接口增加真正可选且具有稳定默认行为的字段；
- 增加新的 Task、MessageContent、InteractionMode 或 Transport 插件，而不改变已发布分支语义；
- 增加新的稳定 error code，用于区分过去归入更宽泛错误的全新场景；
- 增加新的条件导出或显式 subpath，不改变现有解析结果；
- 扩大已验证的运行环境范围；
- 增加 opt-in 配置、Monitor 事件或诊断字段，默认路径保持不变。

新增联合分支或 error code 可能影响调用方的穷尽检查。只有相关公共类型和文档已经声明为开放标识/开放集合时，才可按 MINOR；封闭判别联合增加分支默认按 MAJOR 处理。

## PATCH 变化

下列变化在不改变公共契约时通常提升 PATCH：

- 修复实现与既有文档、Schema、Fixture 或 Contract Suite 的偏差；
- 修复错误归一化、资源释放、取消竞态、内存泄漏或错误诊断；
- 在既有上限和语义内进行性能或包体积优化；
- 修正文档、示例、类型注释和非规范性措辞；
- 更新开发、测试或构建工具且发布产物和最低环境不变；
- 收紧内部校验以拒绝本来就不属于公开合法输入的值；
- 增加测试、监测和安全扫描而不改变正常调用结果。

“Bug fix”不是自动选择 PATCH 的理由。若使用者依赖的已发布可观察行为发生不兼容变化，应按 MAJOR 处理，除非该行为明确属于安全漏洞、未定义行为或从未满足公开输入契约，并在 release notes 中说明。

## 弃用与移除

- 稳定公共 API 在移除前必须先发布带替代方案的弃用说明。
- 弃用本身在保持行为时可以是 MINOR；实际删除或语义破坏必须是 MAJOR。
- 弃用期至少跨越一个后续 MINOR release；高风险迁移应延长并提供迁移文档。
- 不得仅通过控制台 warning、运行时日志或静默行为变化完成弃用。
- 稳定 error code、Schema 字段和 package export 的弃用遵循与 TypeScript API 相同的规则。
- 安全漏洞、法律合规或外部平台紧急下线可以缩短弃用期，但必须记录原因、受影响版本和迁移路径。

实验 API 的资格、标记、发布位置和移除规则由独立 Experimental API Policy 定义；未标记的公开 export 一律按稳定契约处理。

## 内部依赖与消费者范围

- 同一 release train 的内部 package 依赖必须解析到同一 SDK 版本，不支持任意混装。
- 发布前必须验证全新临时消费项目只从 tarball 安装，不读取 monorepo 源码或 workspace link。
- Browser consumer 必须解析 Browser 条件且不包含 Node 内置模块；Node consumer 必须解析 Node 条件。
- TypeScript consumer 必须解析对应 `.d.ts`，ESM consumer 必须解析对应 `.js`。
- package manager lockfile 不能替代正确的 package dependency range；正式发布前必须审查生成后的 manifest。

内部依赖在源码 manifest 中采用何种 workspace protocol 属于实施细节，但打包后的依赖范围必须与 lockstep 策略一致并通过独立消费验证。

## 版本判定流程

每个 release candidate 按以下顺序判定版本：

1. 生成所有公开 package 的 API snapshot、Schema snapshot、默认值目录、错误目录和 exports 清单；
2. 与最近一个稳定版本比较类型和运行时可观察契约；
3. 对每项变化标注 MAJOR、MINOR、PATCH 或不影响发布；
4. 选择所有变化中的最高级别，并同步应用到全部公开 package；
5. 更新 changelog、迁移说明、弃用状态和 release checklist；
6. 从 tarball 建立独立 Browser/Node/TypeScript 消费项目并运行全部 Release Gate；
7. 只有版本号、产物内容和验证报告一致时才允许发布。

无法确认兼容性的变化不得默认归为 PATCH；在补充 API diff、Contract Test 或 consumer fixture 之前视为潜在 MAJOR。

## 验收规则

版本策略检查满足以下条件时通过：

- 10 个公开 package 使用同一版本；
- 版本提升与最高影响变化一致；
- public API、Schema、错误目录、默认值和 exports diff 均已审查；
- 稳定移除项具有符合要求的弃用和迁移记录；
- 预发布 dist-tag 与稳定版本隔离；
- tarball manifest 的版本和内部依赖范围一致；
- Release Gate 与独立消费验证全部通过；
- release notes 明确列出 breaking change、feature、fix、deprecation 和 security note。
