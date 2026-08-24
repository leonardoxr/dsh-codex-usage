# dsh-codex-usage

[English](README.md) | 简体中文

一个为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI 打造的精致 OpenAI Codex 套餐用量指示器。

该插件保留标准的 Settings 齿轮图标和标签，同时在最右侧添加一个上下文计量器样式的圆环。圆环内含 OpenAI 标志，并会在鼠标悬停或键盘聚焦时打开详细的配额面板。

## 功能

- 原生风格的用量圆环，采用与对话上下文计量器相同的 28 px 几何尺寸和 DSH 设计令牌。
- 展示每个 Codex 限额分组的完整配额详情：滚动窗口、已用百分比、重置时间、套餐类型、credits、支出控制和重置 credits。
- 默认每五分钟轮询一次，可通过 bundle row 配置。
- 鼠标悬停时获取新鲜数据，并具有 250 ms 防抖、单个进行中的请求、共享的五分钟轮询缓存、较短的强制悬停缓存和失败节流。
- 保留最近一次成功数据作为回退，因此临时的提供商或网络故障不会清除有用数据。
- 浏览器中不存放凭据：OAuth 和凭据刷新仍在官方 Codex app-server 进程内完成。
- 仅限回环的 API 路由，以及会移除 email、IDs、tokens 和未知提供商字段的 allowlist normalizer。
- 支持 Windows、macOS 和 Linux 命令启动，包括 Windows npm PowerShell shims。

## 要求

- Node.js 20 或更新版本
- pnpm 10
- DeepSeek Harness 0.1.1-rc.2 或兼容版本
- 具有稳定 app-server API 的较新 OpenAI Codex CLI（已使用 Codex CLI 0.149.0 测试）
- Codex 已使用 ChatGPT 套餐登录（运行 codex login）

## 从此 checkout 安装

构建软件包：

~~~sh
pnpm install
pnpm run check
~~~

从此目录将其添加到 DSH profile：

~~~sh
dsh plugin --profile web add .
dsh --profile web --dump-config
dsh web
~~~

开发期间，只有在运行 `pnpm run dev` 并重新构建插件输出时，Host 更改才会热重载。浏览器客户端更改需要重新构建，然后刷新现有 Web 页面。client bundle 由 DSH 的 client-module system 加载；既不需要也不应使用单独的 Vite server。

使用以下命令移除：

~~~sh
dsh plugin --profile web remove dsh-codex-usage
~~~

### 安装 packed artifact

tarball 已包含预构建的 Host 和 lazy-CJS client artifacts，从而避免安装时的构建批准：

~~~sh
pnpm pack
dsh plugin --profile web add ./dsh-codex-usage-0.1.8.tgz
~~~

对于 Git-host 安装，pnpm 10 要求 profile 允许此软件包的 prepare script。请固定一个 commit，并严格遵循 DSH/pnpm 输出的 allowBuilds 指令。

## 配置

全部四个字段都可在 **Settings → Plugins → Codex usage** 中使用。更改会先在本地暂存，直到执行 Save；它们通过 DSH Settings 持久化，保存的设置/profile patch 会实时生效，无需重启。profile row 仍作为已保存用户覆盖项之下的基础配置。

bundle 会插入以下 row：

~~~yaml
- id: codex-usage
  name: dsh-codex-usage
  config:
    refreshIntervalMs: 300000
    hoverRefreshMinAgeMs: 30000
    requestTimeoutMs: 15000
    codexCommand: codex
~~~

如需更改 composition-layer base，请在 profile 的 cordis.patch.yml 中覆盖整个 row。后续 layers 会替换一个 row 的完整 config value；已保存的 Settings UI values 会覆盖该 base。

| 字段 | 默认值 | 含义 |
| --- | ---: | --- |
| refreshIntervalMs | 300000 | 后台轮询间隔；最小值为 60 秒。 |
| hoverRefreshMinAgeMs | 30000 | 再次悬停刷新前所需的最小数据年龄；最小值为 5 秒。 |
| requestTimeoutMs | 15000 | 每个 Codex JSON-RPC request 的超时时间。 |
| codexCommand | codex | Codex executable name 或 absolute path。 |

## 工作原理

1. Host plugin 注入 DSH 的 webServer service，并注册 GET /api/plugins/codex-usage。
2. 首次读取时，它会启动一个托管的 codex app-server --listen stdio:// process。
3. 它执行 initialize / initialized，然后调用稳定 methods account/rateLimits/read 和 account/read。
4. strict normalizer 仅向 loopback browser route 返回配额数据。
5. browser 在 sidebar.footer.action 中注册一个独立 action，在 Settings row 的右边缘预留空间，并保持内置 Settings button 及其行为不变。
6. browser 按配置的 cadence 进行轮询，并在 250 ms 悬停防抖后请求一次合并刷新。

client artifact 并非普通的 browser ESM。tsdown.config.ts 会生成 DSH 所需的 lazy-CJS registration。React 和 DSH UI packages 保持 external，并通过 DSH 的 client module table 解析，从而防止重复的 React runtimes。

## 安全与隐私

- 插件绝不会读取 ~/.codex/auth.json，也绝不会直接处理 OAuth tokens。
- Codex 负责 credential storage、keyring support、token refresh 和 account selection。
- Web route 仅接受来自 loopback clients 的 GET，并拒绝跨站 Origin、Referer 和 Fetch Metadata signals。
- 响应会省略 email、account/workspace IDs、user IDs、access tokens、refresh tokens、raw provider payloads 和 unknown fields。
- 错误状态仅保留 normalized last-good snapshot。
- provider route 不可配置，从而避免形成任意 authenticated proxy。

## 开发

~~~sh
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run pack:check
~~~

default suite 会跳过 live provider test。当 Codex 已安装并登录时运行该测试：

~~~powershell
$env:CODEX_LIVE = '1'
pnpm exec vitest run tests/codex-live.spec.ts
~~~

## 参考资料

- [DSH：创建第一个插件](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/)
- [DSH：打包和安装](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish)
- [DSH：添加 settings card](https://deepseek-harness.github.io/deepseek-harness/en/reference/cookbook/adding-a-settings-card)
- [DSH：Client modules](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/client-modules)
- [Codex app-server 文档](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)
- [Codex rate-limit response](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/typescript/v2/GetAccountRateLimitsResponse.ts)
- [Codex snapshot type](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/typescript/v2/RateLimitSnapshot.ts)

## 许可证

MIT
