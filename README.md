# 配置文件注入脚本

这是一个用于 QuantumultX、Loon 等工具配置文件自动注入自定义内容的 Cloudflare Worker 脚本，支持多平台、多作者、KV 配置存储、Token 安全校验、自动构建部署、Web 管理后台等功能。

## 🚀 快速开始

按下面的部署步骤即可完成基础部署。

## 功能特点

- 支持 `QuantumultX`、`Loon` 等多平台配置文件注入
- 多作者、多平台灵活管理
- 平台注入内容直接存储在 Cloudflare KV 中
- 配置文件订阅访问和管理后台分别使用独立 `Token`，安全性高，支持 `secret` 环境变量
- 错误页面美观友好，自动提示
- 构建脚本自动生成 `wrangler.toml`，环境变量一键写入
- **Web 管理后台**：在线管理平台配置内容和配置源，无需修改代码
- **Cloudflare KV 存储**：所有配置内容统一存储在 KV 中，便于在线管理

## 访问方式

> **配置文件订阅访问必须携带 token，且 token 必须与环境变量 `ACCESS_TOKEN` 完全一致；管理后台使用独立的 `ADMIN_TOKEN` 登录。**

### 配置文件订阅访问

- 访问 URL 格式：
  ```
  https://your-worker.workers.dev/:platform/:author/:token
  ```
  例如：
  ```
  https://your-worker.workers.dev/QuantumultX/bmqy/yourtoken
  ```

- 其中：
  - `platform`：平台名（如 QuantumultX、Loon；兼容历史别名 quanx）
  - `author`：作者名
  - `token`：访问密钥，需与 `ACCESS_TOKEN` 环境变量一致

### 管理后台访问

- 访问管理后台：
  ```
  https://your-worker.workers.dev/admin
  ```
- 使用 `ADMIN_TOKEN` 登录后，可以在线管理：
  - **平台配置管理**：增删改查各平台的注入配置内容
  - **配置源管理**：增删改查第三方配置文件（平台、作者、URL）
- 管理后台的数据存储在 Cloudflare KV 中
- Worker 运行时只从 KV 读取配置内容；`ACCESS_TOKEN` 仅用于订阅地址访问验证，`ADMIN_TOKEN` 仅用于管理后台验证

## 部署步骤

### 1. 克隆仓库并安装依赖

```bash
git clone <repository-url>
cd conf-inject-script
npm install
```

### 2. 创建 KV 命名空间

```bash
# 创建 KV 命名空间
npx wrangler kv namespace create CONFIG_KV

# 记录输出的 id，写入 .env 的 KV_NAMESPACE_ID
```

不需要初始化表结构，也不需要执行迁移。管理后台首次保存数据时会自动写入 KV。

平台字段统一使用官方名称的全小写形式写入 KV，例如 `quantumultx`、`loon`，方便后续支持更多平台。

### 3. 配置环境变量

复制 `env.example` 为 `.env` 并按需修改，或直接在 Cloudflare Workers 控制台中设置环境变量：

- `ACCESS_TOKEN`：订阅访问密钥（必填，建议使用 secret 类型，仅用于 `/:platform/:author/:token`）
- `ADMIN_TOKEN`：管理后台密钥（必填，建议使用 secret 类型，仅用于 `/admin` 和 `/admin/api/*`）
- `KV_NAMESPACE_ID`：KV 命名空间 ID（必填，用于动态生成 `wrangler.toml`）
- `TELEGRAM_BOT_TOKEN`：Telegram Bot Token（可选，设置后用于发送配置变更通知）
- `TELEGRAM_CHAT_ID`：Telegram Chat ID（可选，设置后用于发送配置变更通知）

> 配置源和平台注入内容统一通过管理后台写入 KV，环境变量中需要设置 `ACCESS_TOKEN` 和 `ADMIN_TOKEN`。

生成 `wrangler.toml`：

```bash
npm run generate:wrangler
```

`npm run dev` 和 `npm run deploy` 会自动先执行 `generate:wrangler`。

### 4. 部署到 Cloudflare Workers

```bash
npx wrangler deploy
```

### 5. 使用管理后台（推荐）

1. 访问 `https://your-worker.workers.dev/admin`
2. 使用 `ADMIN_TOKEN` 登录
3. 在"平台配置管理"标签页中，添加各平台的注入配置内容
4. 在"配置源管理"标签页中，添加第三方配置文件信息

完成以上步骤后，就可以通过 `https://your-worker.workers.dev/:platform/:author/:token` 访问合并后的配置文件了。

## 环境变量设置指南

### 必填环境变量

- `ACCESS_TOKEN`：订阅访问密钥，建议使用 secret 类型，仅用于订阅地址访问验证
- `ADMIN_TOKEN`：管理后台密钥，建议使用 secret 类型，用于管理后台登录验证和 API 请求验证

### 配置数据

- 平台注入配置内容：通过管理后台写入 KV key `platform_injections`
- 配置源信息：通过管理后台写入 KV key `source_configs`
- Workers 环境变量不再读取 `INJECT_PLATFORM_LIST`、`INJECT_SOURCE_CONFIG_LIST` 或 GitHub 相关配置

### Token 示例

```
ACCESS_TOKEN=your_secret_token
ADMIN_TOKEN=your_admin_token
KV_NAMESPACE_ID=YOUR_KV_NAMESPACE_ID
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

如果 `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_CHAT_ID` 均已设置，管理后台新增、更新或删除平台配置/配置源后会发送 Telegram 通知；任一项为空时不会发送通知。

### wrangler.toml 动态生成

生成脚本位于 `scripts/generate-wrangler.js`，会读取 `.env` 和当前进程环境变量，环境变量优先级高于 `.env`。

支持的配置项：

- `ACCESS_TOKEN`：本地开发用订阅访问令牌
- `ADMIN_TOKEN`：本地开发用管理后台令牌
- `TELEGRAM_BOT_TOKEN`：Telegram Bot Token，生成到 `[vars]`，为空则不发送通知
- `TELEGRAM_CHAT_ID`：Telegram Chat ID，生成到 `[vars]`，为空则不发送通知
- `KV_NAMESPACE_ID`：KV 命名空间 ID

以下动态生成项已有默认值，通常不需要写入 `.env`：`WRANGLER_NAME`、`WRANGLER_MAIN`、`WRANGLER_COMPATIBILITY_DATE`、`WRANGLER_COMPATIBILITY_FLAGS`、`WRANGLER_KEEP_VARS`、`WRANGLER_OUTPUT_FILE`、`OBSERVABILITY_ENABLED`、`KV_BINDING`。

兼容保留的可选项：

- `D1_DATABASE_ID`：D1 数据库 ID，设置后会生成 D1 绑定（当前项目默认不需要）
- `D1_DATABASE_NAME`：D1 数据库名称，默认 `app_db`
- `D1_BINDING`：D1 绑定名称，默认 `DB`

## 注入配置内容说明

- 注入内容直接保存在 KV key `platform_injections` 对应记录的 `content` 字段中。
- Worker 会读取请求平台对应的 KV 内容，按分区合并注入到原始配置文件。

## 管理后台使用指南

### 访问管理后台

访问 `https://your-worker.workers.dev/admin`，使用 `ADMIN_TOKEN` 登录。

### 平台配置管理

在"平台配置管理"标签页中，可以：

- **新增平台**：点击"新增平台"按钮，选择平台名称（QuantumultX 或 Loon）并填写注入配置内容
- **编辑平台**：点击"编辑"按钮，修改注入配置内容
- **删除平台**：点击"删除"按钮，删除该平台配置

### 配置源管理

在"配置源管理"标签页中，可以：

- **新增配置源**：点击"新增配置源"按钮，填写：
  - 平台名称（QuantumultX 或 Loon）
  - 作者名称（如 bmqy）
  - 配置文件 URL（第三方配置文件地址）
- **编辑配置源**：点击"编辑"按钮，修改配置信息
- **删除配置源**：点击"删除"按钮，删除该配置源

配置源 URL 示例：
```
https://example.com/quanx-config.conf
```

### 数据存储说明

- 管理后台的数据存储在 Cloudflare KV 中
- Worker 只读取 KV 中的配置内容
- 环境变量仅用于 `ACCESS_TOKEN` 和 `ADMIN_TOKEN`

### 安全说明

- 管理后台使用 `ADMIN_TOKEN` 进行身份验证
- 所有 API 请求都需要验证 token
- 建议将 `ACCESS_TOKEN` 和 `ADMIN_TOKEN` 设置为不同的强密码，并使用 Cloudflare secret 方式存储

## 其它说明

- 支持的分区、注释、顺序、空行等均严格保留，适配 QuantumultX/Loon 配置文件格式。
- 如需自定义更多平台或分区，请修改 `platform-conf-parser.js` 中的 `PLATFORM_SECTIONS`。
- 如遇问题请先查看 Cloudflare Worker 日志，或反馈 issue。
