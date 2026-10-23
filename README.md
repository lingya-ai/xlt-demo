# XLT Demo：一句话生成 Agent 项目

本仓库是基于 [xlt-agent-ui](https://github.com/lingya-ai/xlt-agent-ui) 的“一句话生成 Agent 项目”示例：向 AI 编程助手描述需求，使用 XLT Agent UI 的组件与接入能力，生成独立、可运行的 Agent 对话应用。

例如，可以用这样一句话描述需求：

> 基于 https://github.com/lingya-ai/xlt-agent-ui 生成一个 Next.js Agent 对话项目，支持流式回复、新建会话和刷新后恢复历史，并通过服务端安全接入 OpenAPI 渠道。

本项目通过 [XLT Agent UI Registry](https://lingya-ai.github.io/xlt-agent-ui/) 安装聊天组件与服务端接入代码，使用官方 SDK `@lingya-ai/agents-sdk`，由服务端用 AK/SK 签发一次性令牌，再经受限同源代理访问 OpenAPI 渠道。运行真实对话前，仍需按下文准备已发布的智能体、OpenAPI 渠道和环境变量。

## 技术栈与版本

| 项目 | 版本 / 来源 |
| --- | --- |
| Next.js | 16.1.6（App Router） |
| React | 19.2.3 |
| Tailwind CSS | 4.x |
| shadcn CLI | 4.22.1（`radix-nova` 初始化） |
| XLT Agent UI Registry | 0.2.0，`https://lingya-ai.github.io/xlt-agent-ui/r/0.2.0/` |
| 官方 SDK | `@lingya-ai/agents-sdk@0.7.1`（npm） |
| 本地端口 | 4612（仅监听 `127.0.0.1`） |

## 前置准备

1. 选择平台：已上线的 [灵涯 SaaS](https://lingya.cloud/) 或可访问的私有化部署平台。
2. 在平台创建或选择智能体，完成配置、调试并**发布**目标版本。
3. 为该智能体配置可用的 **OpenAPI 渠道**，取得：
   - 实际 OpenAPI 网关地址（保留租户域名）
   - 渠道 ID
   - AK / SK
4. 区分**平台访问地址**与 **OpenAPI 网关地址**。不要直接把平台控制台地址当作 `OPENAPI_BASE_URL`。

## 安装

需要 Node.js 22+ 与 pnpm。

```sh
pnpm install
cp .env.example .env.local   # Windows: Copy-Item .env.example .env.local
```

### 重新安装 Registry 组件

项目保留可重复执行的安装命令：

```sh
pnpm registry:add
```

等价于：

```sh
pnpm dlx shadcn@4.22.1 add \
  https://lingya-ai.github.io/xlt-agent-ui/r/0.2.0/agent-chat.json \
  https://lingya-ai.github.io/xlt-agent-ui/r/0.2.0/agent-server.json \
  https://lingya-ai.github.io/xlt-agent-ui/r/0.2.0/agent-files.json \
  --yes --overwrite
```

Registry 未部署时可从相邻的 `xlt-agent-ui` 仓库启动本地服务：

```sh
# 在 xlt-agent-ui 仓库中
pnpm install
pnpm registry:build
pnpm registry:serve
# 然后把上面的 URL 换成 http://localhost:4602/r/0.2.0/...
# 并在 xlt-demo 中执行：
pnpm dlx shadcn@4.22.1 add \
  http://localhost:4602/r/0.2.0/agent-chat.json \
  http://localhost:4602/r/0.2.0/agent-server.json \
  http://localhost:4602/r/0.2.0/agent-files.json \
  --yes --overwrite
```

> 注意：公开 Registry 0.2.0 尚未包含本次上传 Hook 修复。当前项目是从 `xlt-agent-ui` 本地构建的 0.2.0 安装的；在 Registry 递增版本并重新发布前，重装请使用本地 4602 地址，否则会恢复旧 Hook。

本项目初始化时使用 shadcn 的 Radix 基础（`radix-nova`），以匹配 Registry 组件的 Radix 原语。若用 Base UI 预设重新初始化，CLI 会把 `asChild` 改写为 `render`，与 Registry 的 Radix 包装不兼容。

## 环境变量

复制 `.env.example` 为 `.env.local`，填写以下服务端变量：

| 变量 | 说明 |
| --- | --- |
| `OPENAPI_BASE_URL` | OpenAPI 网关地址，保留租户域名；也可带网关路径前缀 |
| `OPENAPI_CHANNEL_ID` | 已发布智能体对应的 OpenAPI 渠道 ID |
| `OPENAPI_AK` | Access Key，仅服务端读取 |
| `OPENAPI_SK` | Secret Key，仅服务端读取 |
| `OPENAPI_EXTERNAL_USER_ID` | 示例用户稳定标识；正式接入改为宿主登录态中的用户 ID |

`.env.local` 已被 `.gitignore` 忽略；`.env.example` 只含占位符。AK/SK 不会进入 `NEXT_PUBLIC_*`、客户端代码、页面属性或日志。

## 启动

```sh
pnpm dev            # http://127.0.0.1:4612
```

生产构建与启动：

```sh
pnpm build
pnpm start          # http://127.0.0.1:4612
```

## 请求链路

```text
浏览器
  │  1. POST /api/agent-token（同源，no-store）
  ▼
Next.js Route Handler（Node.js）
  │  2. SDK 用 AK/SK 对 POST /chat/presign 做 HMAC 签名
  ▼
OpenAPI 网关
  │  3. 返回短期、一次性 token
  ▼
浏览器 AgentsClient
  │  4. 每次请求 / SSE 重连都重新申请新 token
  │     GET/POST/PATCH /api/agent/api/agents/channel/openapi/v1/{channelId}/...
  ▼
Next.js 受限同源代理
  │  5. 校验路径必须属于当前渠道，透传 SSE ReadableStream
  ▼
OpenAPI 网关（保留原租户域名与 Host 语义）
```

关键约束：

- 浏览器只拿到短期 token，不接触 AK/SK。
- 每个 HTTP 请求、手动重试、SSE 重连都独立调用 `tokenProvider`，不缓存或共享令牌。
- 代理只放行 `/api/agents/channel/openapi/v1/{OPENAPI_CHANNEL_ID}/...`，不是任意 URL 代理。
- SSE 响应直接透传，不缓冲、不重新解析业务事件；`request.signal` 传递给上游以处理断开。
- 前端不自动重放可能已被后端接受的发送、审批等写请求。

## 页面能力

- 消息输入与发送（Enter 发送，Shift+Enter 换行）
- SSE 流式回复与停止生成
- 新建对话
- 会话 ID 写入 URL（`/?conversation=...`）
- 刷新后按 URL 中的会话 ID 恢复历史
- 加载、错误与空状态反馈
- 使用 Registry `AgentChat` 组合组件，保留其交互与宿主 shadcn 语义令牌
- 通过 Registry `agent-files` 与 `AgentFilePreviewsProvider` 支持 DOCX、PDF、Excel、PPTX、图片、音视频、HTML、Markdown 等文件预览
- 注意：文件预览和直传都依赖对象存储 CORS；未允许页面源时会显示加载/上传失败

## 示例身份接入

当前示例在服务端固定读取 `OPENAPI_EXTERNAL_USER_ID`，浏览器不能提交任意用户 ID。正式接入时：

1. 将 `src/app/api/agent-token/route.ts` 中的 `authenticate` 替换为宿主会话认证函数。
2. 只允许已登录用户获取其有权访问的渠道令牌。
3. 令牌接口保持 `no-store`，必要时增加 CSRF 防护。
4. 未接入宿主认证前，不要把本地令牌接口暴露到公网；本项目仅监听回环地址。

## Chromium 102 兼容

- 主题变量使用十六进制 / RGB 语义色，不使用 `oklch`。
- `postcss.config.mjs` 启用 Registry 附带的 `postcss-chromium102.cjs`，补充 `@property` 初始值并降级 `color-mix`。
- 组件侧避免 `:has`、容器查询、`field-sizing` 和动态视口单位。

## 验证

```sh
pnpm typecheck
pnpm lint
pnpm build
```

浏览器验证脚本：

```sh
node scripts/browser-smoke.mjs # 打开页面、截图、输出控制台信息
node scripts/verify-chat.mjs   # 真实发送、刷新恢复、新建对话
node scripts/verify-stop.mjs   # 长回复中点击“停止生成”
node scripts/verify-upload.mjs # 真实附件预签名与直传；直传需要 COS 桶允许当前源
```

脚本使用本机 Chrome，截图输出到 `artifacts/`。`verify-chat.mjs` 与 `verify-stop.mjs` 会向真实渠道发送测试消息，需要 `.env.local` 中的网关、渠道和 AK/SK。`verify-upload.mjs` 会向当前渠道上传一个 28 字节的测试文本。

### 本次验证结果（2026-10-23）

| 项目 | 结果 |
| --- | --- |
| `pnpm typecheck` | 通过 |
| `pnpm lint` | 通过 |
| `pnpm build` | 通过（Next.js 16.1.6，3 个动态路由） |
| 真实渠道对话 | 通过，助手返回：“你好，我是小灵通，一个能调用工具、搜索和分析信息、帮你完成多步骤任务的智能助手。” |
| 流式回复与停止生成 | 通过：流式过程中出现“停止生成”，点击后文本停止增长 |
| 会话 ID 写入 URL | 通过（`/?conversation=<id>`） |
| 刷新恢复历史 | 通过（刷新后仍为 2 条消息，内容一致） |
| 新建对话 | 通过（URL 清空、消息数归零、输入框可用） |
| 附件预签名 | 通过：`201`、`support: true`、`uploadMethod: POST_FORM`、`maximumBytes: 28` |
| 附件直传 | 未通过：腾讯 COS 桶未允许 `http://127.0.0.1:4612`，浏览器被 CORS 拦截；需配置桶 CORS 或改用已允许的页面源 |
| 文件预览 Provider | 已安装：原“安装文件预览能力后可在此查看文件”兜底消失，DOCX 预览器已加载 |
| DOCX 预览加载 | 未通过：预览器请求 COS 签名 URL 时同样被 CORS 拦截，需与上传共用同一 CORS 配置 |
| 对话验证浏览器控制台 | 0 个错误 |
| 对话验证失败网络请求 | 0 个 |
| 构建产物密钥扫描 | 通过：`AK/SK` 未出现在 `.next`、`src`、文档或 `.env.example` |

截图：

- `artifacts/chat-response.png`：真实助手回复
- `artifacts/chat-history.png`：刷新后的历史
- `artifacts/chat-new.png`：新建对话后的空状态
- `artifacts/chat-stop.png`：停止生成后的界面
- `artifacts/chat-upload-failure.png`：附件预签名成功但 COS 直传被 CORS 拦截
- `artifacts/chat-preview.png`：DOCX 预览器已加载，但签名 URL 被 COS CORS 拦截

验证期间上游网关曾短暂返回 `503 GATEWAY_SERVICE_UNAVAILABLE`，恢复后完成上述真实联调；本地令牌、SSE 透传和渠道路径校验也分别验证通过。

## 常见问题

| 现象 | 排查 |
| --- | --- |
| 页面提示“缺少渠道配置” | `.env.local` 未填写 `OPENAPI_CHANNEL_ID`，或修改后未重启服务 |
| 令牌接口 503 | `OPENAPI_BASE_URL` / `CHANNEL_ID` / `AK` / `SK` / `EXTERNAL_USER_ID` 不完整 |
| 令牌接口 502 | 网关不可达、AK/SK 错误、渠道未发布或 `/chat/presign` 返回非 2xx |
| 代理 403 | 请求路径不属于当前渠道，或渠道 ID 不匹配 |
| 附件预签名成功但直传失败 | 对象存储 CORS 未允许页面源。为 COS 桶添加当前源、`POST`/`PUT` 方法和所需请求头；或把页面部署到已允许的源 |
| SSE 看起来被缓冲 | 检查代理是否部署在会缓冲的网关后；本项目已设置 `X-Accel-Buffering: no` 并直接透传流 |
| Node 无法解析 `*.localhost` | 在服务端连接层把该域名解析到回环地址，同时保留请求中的原域名；不要直接改写为 IP |

## 安全说明

- 不提交 `.env.local`，不把 AK/SK 写入文档、截图、日志或聊天。
- 生产环境必须把固定示例身份替换为宿主认证身份。
- 令牌一次性有效；不要缓存、合并或复用。
- 本地示例只监听 `127.0.0.1`；接入宿主认证前不要对外开放。

## 来源与许可证

本项目采用 [MIT 协议](./LICENSE)，版权归属为 `Copyright (c) 2026 lingya-ai`。第三方组件与依赖保留各自的版权声明和许可证，项目的 MIT 协议不替代这些许可。

- 基础项目：[xlt-agent-ui](https://github.com/lingya-ai/xlt-agent-ui)，提供本示例使用的 Agent UI 组件与服务端接入能力。
- Registry：XLT Agent UI 0.2.0（MIT）。
- SDK：`@lingya-ai/agents-sdk@0.7.1`（MIT，npm 发布）。
- 安装后的组件源码与第三方许可文件位于 `src/components/xlt-agent/`。
