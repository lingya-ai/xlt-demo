# Repository Guidelines

## 项目定位

本仓库是基于 [xlt-agent-ui](https://github.com/lingya-ai/xlt-agent-ui) 的“一句话生成 Agent 项目”示例：通过自然语言需求，让 AI 编程助手使用上游组件与接入能力生成独立的 Agent 对话应用。维护代码和文档时保持这一定位，说明上游来源；运行真实对话仍需配置已发布的智能体、OpenAPI 渠道及服务端凭据。

## 项目结构与模块组织

本项目使用 Next.js 16 App Router、React 19、TypeScript 和 Tailwind CSS 4，集成 XLT Agent UI 与官方 SDK。

- `src/app/`：页面、布局和全局样式；`api/agent-token/route.ts` 签发令牌，`api/agent/[...path]/route.ts` 代理渠道请求。
- `src/components/chat-app.tsx`：宿主聊天界面、SDK 初始化和会话 URL 同步。
- `src/components/xlt-agent/`：Registry 安装的组件、服务端工具、样式及第三方许可；`src/components/ui/` 存放宿主 UI 组件。
- `src/lib/`：通用工具；`public/`：静态资源；`scripts/`：浏览器验证和诊断脚本。
- `artifacts/`：本地验证截图，已忽略；当前没有独立测试目录。

## 安装、开发与构建

使用 Node.js 22+ 和 pnpm，依赖变更同步更新 `pnpm-lock.yaml`。

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev        # 在 http://127.0.0.1:4612 启动开发服务
pnpm typecheck  # TypeScript 类型检查
pnpm lint       # ESLint 检查
pnpm build      # 生产构建
pnpm start      # 启动已构建的生产服务，同样监听 4612
```

`pnpm registry:add` 重新安装 Registry 组件，带有 `--overwrite`；执行前检查本地组件修改，执行后审阅差异并保留许可证。

## 代码风格与命名

宿主代码使用两空格缩进、双引号和分号，遵循相邻文件风格。启用 TypeScript 严格模式；使用 `@/` 引用 `src/`。组件名采用 PascalCase，变量和函数采用 camelCase，组件文件采用 kebab-case，例如 `chat-app.tsx`；Hook 使用 `use-` 文件名前缀。

ESLint 使用 Next.js Core Web Vitals 和 TypeScript 配置，目前排除 `src/components/xlt-agent/**` 和 `src/components/ui/**`；修改这些目录仍须执行类型检查和构建。未配置独立格式化工具。保持 Chromium 102 兼容，避免引入 `oklch`、`:has`、容器查询和动态视口单位。

## 测试与验证

提交前运行 `pnpm typecheck`、`pnpm lint` 和 `pnpm build`。当前无单元测试框架、`pnpm test` 命令或覆盖率门槛。

启动本地服务后运行：

```powershell
node scripts/browser-smoke.mjs # 截图并输出页面和控制台信息
node scripts/verify-chat.mjs   # 实际发送消息，验证回复、会话 URL 和刷新恢复
```

脚本使用 Playwright 和本机 Chrome，可通过 `APP_URL`、`CHROME_PATH` 覆盖默认配置。真实对话验证需要有效的 `.env.local` 配置；检查控制台输出和 `artifacts/` 截图。新增验证脚本使用描述性的 kebab-case `.mjs` 文件名。

## 提交与 Pull Request

Git 历史目前只有 `Initial commit from Create Next App`，尚无既定提交规范。新增提交使用简短、明确的祈使句，例如 `Fix conversation history restoration`，每次提交聚焦一个改动。

PR 应说明改动目的、影响范围、验证命令及结果；有关联问题时附链接，界面变更附脱敏截图。注明环境变量或 Registry 版本变化，以及未完成的真实渠道验证。

## 安全与配置约束

仅在 `.env.local` 保存 AK/SK，禁止写入客户端、`NEXT_PUBLIC_*`、日志或截图。每次请求及 SSE 重连均获取新的一次性令牌，不缓存或复用。代理仅允许当前渠道路径，直接透传 SSE 和取消信号；不要自动重放发送、审批等写请求。接入宿主认证前保持回环地址监听，正式环境以登录用户身份替换固定示例身份。
