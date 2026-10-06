<!-- Copyright © 2026 Mcont. -->

# Experimental API Policy

- 适用范围：所有公开 `@evolutos/mconet-*` package
- 核心原则：稳定默认、显式选择、完整实现、可追踪退出

## 目的

本策略定义实验 API 的资格、隔离、标记、质量要求、稳定化、弃用和移除规则。实验状态用于收集真实使用反馈，不能用于绕过 Text Unary Scope、类型安全、安全约束、测试或文档完成标准。

未明确符合本文全部要求的公开 export 一律视为稳定 API，并受 Versioning Strategy 的完整兼容性承诺约束。

## 实验 API 的资格

只有满足以下至少一项且已经具备可用实现的能力，才可以申请实验状态：

- 需要真实消费者反馈才能确定长期形态的新交互模型；
- 依赖仍在演进的浏览器、Node.js 或外部协议能力；
- 已有完整生命周期与安全设计，但命名、组合方式或性能约束尚需验证；
- 面向小范围高级扩展者，尚不足以纳入稳定 Core/SPI；
- 是后续能力的完整最小切片，并且不会改变稳定默认路径。

以下内容不得以实验状态公开：

- 空实现、始终抛出 unsupported 的占位方法或只有类型没有行为的 API；
- 使用 `any`、无类型 Hook、万能 Interceptor 或未定义输入输出契约的扩展点；
- 尚未解决资源释放、取消、背压、并发、Secret 或输入校验问题的能力；
- 绕过 CORS、CSP、TLS、认证授权、Header 校验、响应上限或脱敏策略的选项；
- 为避免 MAJOR 版本而把已有稳定 API 的破坏性修改重新标记为 experimental；
- 默认启用或会静默改变稳定执行路径的功能开关。

## 导出隔离

实验 API 必须通过显式 subpath 导入：

```ts
import { experimentalFeature } from "@evolutos/mconet-client/experimental/feature-name";
```

对应 package manifest 必须声明精确 subpath，不使用通配符暴露整个内部目录：

```json
{
  "exports": {
    "./experimental/feature-name": {
      "types": "./dist/experimental/feature-name.d.ts",
      "default": "./dist/experimental/feature-name.js"
    }
  }
}
```

隔离规则：

- 稳定根入口不得直接或间接 re-export 实验符号；
- 默认 Client factory 不得自动装配实验组件；
- 稳定类型不得要求实验类型作为必填参数或返回值；
- 实验模块可以依赖稳定模块，稳定模块不得依赖实验模块；
- Browser/Node 实验入口仍使用静态条件导出，不使用运行时平台探测；
- 一个 experimental subpath 只对应一个有边界的能力，不建立 `experimental/all` 聚合入口；
- 未在 exports 中声明的内部文件不是实验 API，也不是公共 API。

## 源码与文档标记

每个实验导出必须同时具备：

1. 显式 `/experimental/` import path；
2. 英文 JSDoc `@experimental` 标记；
3. 首次公开版本 `@since`；
4. 不稳定维度、已知限制和反馈目标；
5. release notes 中的 Experimental 小节；
6. experimental API inventory 与独立 API snapshot 记录。

标记示例：

```ts
/**
 * Opens a bounded preview interaction for evaluation.
 *
 * @experimental The lifecycle shape may change after consumer feedback.
 * @since 1.2.0
 */
export function openPreviewInteraction(): PreviewInteraction {
  // The implementation must still enforce the documented lifecycle contract.
  return createPreviewInteraction();
}
```

不得只在 README 中写“实验性”而省略源码标记，也不得只使用 `Experimental` 名称前缀代替独立导出路径和 JSDoc。

## Inventory 记录

每个 release 的 experimental inventory 至少记录：

| 字段                | 要求                                        |
| ------------------- | ------------------------------------------- |
| API/subpath         | 完整 package import path 与导出符号         |
| Owner               | 负责评审反馈和生命周期的维护者              |
| Since               | 首次公开的 SDK 版本                         |
| Status              | `experimental` 或 `deprecated-experimental` |
| Unstable dimensions | 可能变化的类型、行为或限制                  |
| Stable dependencies | 依赖的稳定契约与最低环境                    |
| Exit criteria       | 稳定化或移除所需证据                        |
| Target review       | 下一次必须评审的 release 或日期             |
| Replacement         | 弃用时的替代 API 与迁移链接                 |

不存在 owner、exit criteria 或 target review 的提案不得公开。实验状态不能无限期保留；每个 MINOR release 都必须复核 inventory。

## 质量与安全要求

实验 API 与稳定 API 使用相同的实现完成定义：

- strict TypeScript，无 `any`、双重断言或无依据非空断言；
- 外部输入进行运行时验证；
- 完整 Unit、Contract、Conformance 和适用的平台测试；
- 明确取消、deadline、资源所有权、关闭与并发语义；
- 有界内存、响应大小、队列和监测捕获；
- Secret、日志、错误、redirect 和 Header 安全测试通过；
- ESM、声明、tree-shaking、条件导出和 tarball consumer 验证通过；
- 公共实体具有英文文档与关键逻辑注释；
- 失败使用稳定或明确标为实验的错误语义，不泄漏内部异常或 Secret。

实验 API 可以改变兼容形态，但不能降低 Web 安全不变量、静默丢失数据或破坏稳定 API 的行为。

## 使用与默认行为

- 消费者必须通过实验 subpath 主动 import；安装稳定 package 本身不代表选择实验功能。
- 实验能力默认关闭，不能由环境探测、全局 Registry 或 package 顶层副作用自动启用。
- 启用实验能力必须是局部、显式、可测试的配置或 factory 调用。
- 实验配置不得写回 Client 默认值或影响并发中的其他请求。
- 实验 telemetry 默认关闭；启用时遵守与稳定 Monitor 相同的脱敏和限长规则。
- 示例必须显示实验标记、适用版本、风险、退出方式和生产使用建议。

## 允许的兼容变化

在稳定 package 的 MINOR release 中，可以对明确标记且隔离的实验 API 做以下变化：

- 调整实验函数、类型、字段或生命周期形态；
- 重命名 experimental subpath 或导出；
- 修改实验默认值、限制或错误 code；
- 将实验 API 提升为稳定 API；
- 按本文流程弃用或移除实验 API。

这些变化不得放入 PATCH release。每次变化必须更新 inventory、API snapshot、测试、release notes 和迁移说明，并且不得改变稳定入口的既有行为。

如果实验类型泄漏到稳定签名、实验实现改变稳定默认路径，或消费者无法仅通过不导入实验 subpath 来规避变化，则该变化不再享有实验兼容例外，必须按稳定 SemVer 评估。

## 稳定化流程

实验 API 提升为稳定 API 前必须满足：

1. exit criteria 全部完成并有真实消费者或集成证据；
2. 生命周期、错误、取消、资源、安全和并发语义已经冻结；
3. API、Schema、Fixture、默认值和限制具有稳定 snapshot；
4. Unit、Contract、Conformance、Integration、平台与 tarball consumer Gate 全部通过；
5. 完成命名、依赖方向、包体积和 tree-shaking 评审；
6. 在 MINOR release 中增加稳定 import path；
7. 提供从 experimental path 到稳定 path 的迁移文档。

稳定化不是原路径的静默改名。稳定入口先作为新公共契约增加；原 experimental path 至少在同一 release 中继续工作并标记迁移。默认情况下，它在至少一个后续 MINOR release 后才能移除。

## 弃用与移除流程

### 稳定 package release

实验 API 的正常移除流程：

1. 在一个 MINOR release 中将状态改为 `deprecated-experimental`；
2. JSDoc 增加 `@deprecated`，说明原因、替代方案和最早移除版本；
3. release notes 与 inventory 提供迁移说明；
4. 保留至少一个完整 MINOR release 的迁移窗口；
5. 在后续 MINOR release 中移除 subpath、导出、声明、实现和测试；
6. consumer fixture 验证旧路径按预期不再导出，新路径可用。

如果没有替代 API，也必须明确说明能力被撤回的原因和调用方恢复策略。不得用运行时永久 warning 代替导出移除，也不得保留永远抛错的兼容壳。

### 预发布 release

在 `alpha`、`beta` 或 `rc` 序列中，实验 API 可以在后续预发布版本直接变化或移除，但必须更新 release notes、inventory 和 snapshot。进入 `rc` 后只允许为 Release Gate 阻断问题做此类变化。

### 紧急移除

存在可利用的安全漏洞、法律合规风险或外部平台紧急下线时，可以跳过一个 MINOR 的迁移窗口，但必须：

- 立即停止默认或示例使用；
- 发布 security advisory 或等价通知；
- 记录受影响版本、风险、缓解方式和替代路径；
- 在不扩大风险的前提下提供最小迁移支持；
- 将原因和批准记录纳入 release checklist。

紧急移除不能通过 PATCH 破坏稳定入口；若问题已经影响稳定契约，按 Versioning Strategy 的安全例外与 MAJOR 规则处理。

## 禁止的生命周期操作

- 不得把稳定 API 重新降级为 experimental 以规避 SemVer；
- 不得在 PATCH 中无说明地改变或删除实验 API；
- 不得让 experimental path 永久 re-export 已删除或始终失败的实现；
- 不得在没有迁移说明时把实验符号移动到另一个 package；
- 不得在 stable root 与 experimental subpath 同时维护语义不同的同名 API；
- 不得通过 feature flag 隐藏未导出的未来 API 并把它视为公共承诺；
- 不得因“实验性”跳过安全审查、错误归一化、类型声明或测试。

## 评审与验收

一个 experimental API release 只有在以下检查全部通过时才允许进入 release candidate：

- import path 明确包含 `/experimental/` 且未从稳定根入口泄漏；
- 每个公开符号具有 `@experimental`、`@since` 和不稳定维度说明；
- inventory 的 owner、status、exit criteria、target review 完整；
- API snapshot 将稳定与实验面分开；
- 实现不是占位，并通过适用的 Unit、Contract、Conformance 和平台测试；
- 安全、取消、资源、并发、体积与 package consumer Gate 通过；
- release notes 明确列出新增、变化、弃用、稳定化或移除；
- SemVer 至少为 MINOR，或处于明确的预发布序列；
- 稳定 API consumer 在不导入实验 subpath 时行为和产物保持不变。
