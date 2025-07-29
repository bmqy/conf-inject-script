# 配置文件注入脚本

这是一个用于 QuantumultX、Loon 等工具配置文件自动注入自定义内容的 Cloudflare Worker 脚本，支持多平台、多作者、远程 Gist 注入、Token 安全校验、自动构建部署、bot通知等功能。

## 功能特点

- 支持 `QuantumultX`、`Loon` 等多平台配置文件注入
- 多作者、多平台灵活管理
- 注入内容通过 `Gist` 托管，支持远程动态更新
- 访问需携带 `Token`，安全性高，支持 `secret` 环境变量
- 错误页面美观友好，自动提示
- 构建脚本自动生成 `wrangler.toml`，环境变量一键写入
- `bot`通知

## 访问方式

> **所有请求必须携带 token，且 token 必须与环境变量 `ACCESS_TOKEN` 完全一致，否则无法访问！**

- 访问 URL 格式：
  ```
  https://your-worker.workers.dev/:platform/:author/:token
  ```
  例如：
  ```
  https://your-worker.workers.dev/quanx/bmqy/yourtoken
  ```

- 其中：
  - `platform`：平台名（如 quanx、loon）
  - `author`：作者名
  - `token`：访问密钥，需与 `ACCESS_TOKEN` 环境变量一致

## 部署步骤

1. 克隆本仓库
2. 复制 `env.example` 为 `.env` 并按需修改
3. 运行 `npm install` 安装依赖
4. 根据需要修改 `wrangler.toml` 中的环境变量配置
5. 运行 `npx wrangler deploy` 部署到 Cloudflare Workers

> 注意：如果需要使用 Telegram 通知功能或使用私有 Gist，需要在 Cloudflare Workers 控制台中添加相应的环境变量（如 `TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`、`GITHUB_TOKEN` 等）。

## 环境变量设置指南

必须设置以下环境变量：

- `INJECT_SOURCE_CONFIG_LIST`：配置列表（JSON数组，详见下方示例）
- `INJECT_PLATFORM_LIST`：各平台注入 Gist 地址（JSON对象，key为平台名，value为gist原始链接）
- `ACCESS_TOKEN`：访问密钥，建议使用 secret 类型，所有请求都需携带

可选环境变量：

- `TELEGRAM_BOT_TOKEN`：用于通知的 Telegram Bot Token（可选，启用通知时必填）
- `TELEGRAM_CHAT_ID`：用于通知的 Telegram Chat ID（可选，启用通知时必填）
- `GITHUB_TOKEN`：GitHub访问令牌，用于获取最新的Gist内容（可选）
  - 如果你的Gist是私有的，或者希望确保能获取到最新的Gist版本，建议配置此参数

> **建议：** `ACCESS_TOKEN`、`TELEGRAM_BOT_TOKEN`、`GITHUB_TOKEN` 请在 Cloudflare 控制台以 secret 方式设置，避免泄露。

### INJECT_SOURCE_CONFIG_LIST 示例

```json
[
  {
    "platform": "quanx",
    "author": "bmqy",
    "url": "https://example.com/quanx-config.conf"
  },
  {
    "platform": "loon",
    "author": "bmqy",
    "url": "https://example.com/loon-config.conf"
  }
]
```

### INJECT_PLATFORM_LIST 示例

```json
{
  "quanx": "https://gist.githubusercontent.com/youruser/quanx-gist-raw-url",
  "loon": "https://gist.githubusercontent.com/youruser/loon-gist-raw-url"
}
```

### ACCESS_TOKEN 示例

```
ACCESS_TOKEN=your_secret_token
```

### TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID 示例

```
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=123456789
```

### GITHUB_TOKEN 示例

```
GITHUB_TOKEN=github_personal_access_token
```

## 注入配置内容说明

- 注入内容需托管在 Gist（或其它可公开访问的原始文本地址），并在 `INJECT_PLATFORM_LIST` 中配置。
- Worker 会自动拉取对应平台的 Gist 内容，按分区合并注入到原始配置文件。

## Telegram Bot 通知功能

- 每当有用户请求合并后的配置文件时，系统会自动通过 Telegram Bot 向指定 Chat 发送通知。
- 通知内容包括：平台、源文件地址、使用的 token（以 `||token||` 方式遮罩，防止泄露）。
- 需在 `.env` 或 Cloudflare 环境变量中设置 `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_CHAT_ID`。
- 如不设置这两个变量，则不会发送通知。


## 其它说明

- 支持的分区、注释、顺序、空行等均严格保留，适配 QuantumultX/Loon 配置文件格式。
- 如需自定义更多平台或分区，请修改 `platform-conf-parser.js` 中的 `PLATFORM_SECTIONS`。
- 如遇问题请先查看 Cloudflare Worker 日志，或反馈 issue。
