<div align="center">

<img src="./icon.svg" width="72" alt="dsh-quota-ring"/>

# dsh-quota-ring

**iPhone Duo 风格的 AI 额度圆环，for [DeepSeek Harness](https://www.deepseek.com/harness/).**

*Notched battery rings for every AI provider you use — right beside the composer.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-22c55e)](https://github.com/hkd-Duo/dsh-quota-ring/releases)
[![GitHub stars](https://img.shields.io/github/stars/hkd-Duo/dsh-quota-ring?style=social)](https://github.com/hkd-Duo/dsh-quota-ring/stargazers)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek-Harness-4D6BFE)](https://www.deepseek.com/harness/)
[![Providers](https://img.shields.io/badge/providers-8-3859ff)](#-支持的供应商)

</div>

---

在输入框编辑区下方并排展示每一个已配置 AI 供应商的剩余额度 / 余额——像 iPhone Duo 的缺口电量环：**弧长即剩余比例，环中心是供应商 logo**，多个供应商的环同时显示，当前会话模型对应的环带高亮点。

## ✨ 特性

- **多供应商并排** — DeepSeek、GLM（智谱）、Kimi、MiniMax、OpenCode、OpenRouter、Codex，配了 Key 的自动出现，没配的自动隐藏；
- **6 种圆环样式** — Duo 缺口环 / 闭合圆环 / 分段电量 / 半圆仪表 / 电池条 / 双环，**每个环独立选择**；
- **展示数量自选** — 每个供应商一个显示开关，开关数量就是圆环数量；
- **点击即设置** — 点击圆环行任意位置弹出样式面板；面板内每家供应商还有 **↗ 直达账单页**；
- **跟随当前模型** — 当前会话模型对应的环带蓝点高亮，悬停可看完整明细；
- **双入口配置** — 圆环旁的 ⚙ 弹出面板 + 「设置 → 插件 → dsh-quota-ring」页面内嵌面板，偏好保存在浏览器本地；
- **轻量无依赖** — 纯 JS + 内嵌 SVG logo（DeepSeek 鲸鱼标、智谱 Z 标），离线可用，不改任何 Harness 配置。

## 🟢 支持的供应商

| provider id | 供应商 | 查询接口 | 凭据 |
| --- | --- | --- | --- |
| `deepseek` / `deepseek-official` / `deepseek-account` / `deepseek-vision` | DeepSeek 官方 | `GET api.deepseek.com/user/balance` | `DEEPSEEK_API_KEY` |
| `zai` / `zai-coding-plan` | GLM（智谱国际站） | Coding Plan 配额 → 回落标准 API 现金余额 | `ZAI_API_KEY` |
| `zai-coding-cn` / `zhipuai` / `zhipuai-coding-plan` | GLM（智谱国内站） | 同上（open.bigmodel.cn） | `ZAI_CODING_CN_API_KEY` |
| `kimi-coding` | Kimi Coding | `GET api.kimi.com/coding/v1/usages` | `KIMI_CODING_API_KEY` |
| `minimax` / `minimax-cn` | MiniMax Coding Plan | `/v1/api/openplatform/coding_plan/remains` | `MINIMAX_CN_API_KEY` / `MINIMAX_API_KEY` |
| `opencode-go` | OpenCode Go | `GET opencode.ai/zen/go/v1/usage` | `OPENCODE_GO_API_KEY` |
| `openrouter` | OpenRouter | `GET openrouter.ai/api/v1/credits` | `OPENROUTER_API_KEY` |
| `openai-codex` | ChatGPT Codex | `GET chatgpt.com/backend-api/wham/usage` | `OPENAI_CODEX_ACCESS_TOKEN` |

> 未配置对应凭据的供应商不会显示；插件通过 Harness 凭据 seam **只读**凭据，不改任何配置。

## 📦 安装 / 更新

### 方式一：GitHub 依赖（推荐）

在本机 profile 的 `package.json`（如 `%DSH_HOME%\profiles\desktop\package.json`）中加入依赖与 bundle：

```jsonc
{
  "dependencies": {
    "dsh-quota-ring": "github:hkd-Duo/dsh-quota-ring"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "dsh-quota-ring"
      ]
    }
  }
}
```

然后：

```sh
cd %DSH_HOME%\profiles\desktop
pnpm install
```

重启 DeepSeek Harness 即生效。更新 = 把版本指向最新 tag（如 `github:hkd-Duo/dsh-quota-ring#v1.0.1`）后再次 `pnpm install`。

### 方式二：本地目录安装

```sh
git clone https://github.com/hkd-Duo/dsh-quota-ring.git
```

克隆到任意目录后在 Harness 插件管理中按目录安装该 bundle（或将其链接为 profile 依赖），适合开发调试——改代码即生效。

## 🎨 使用

| 入口 | 功能 |
| --- | --- |
| **点击圆环行任意位置** | 打开 / 关闭样式面板（环、名称、金额、⚙ 均可点） |
| **样式面板** | 每个供应商一行：显示开关（决定展示几个环）+ 6 种样式小预览（点击即换）+ ↗ 账单页 |
| **悬停圆环** | 完整明细：余额、总额、已用、充值、配额窗口与重置倒计时、更新时间 |
| **蓝点** | 标识当前会话模型对应的供应商，悬停标注「当前模型正在使用」 |
| **设置 → 插件** | 同一套样式面板也内嵌在 dsh-quota-ring 的插件页面内 |

圆环颜色即剩余比例：<kbd>≥50%</kbd> 绿 · <kbd>≥20%</kbd> 橙 · <kbd><20%</kbd> 红。

## 📐 数据口径

- **配额类**（Kimi / MiniMax / OpenCode / Codex / GLM Coding Plan）：圆环取所有窗口中**剩余比例最小**的一个；
- **现金余额类**（DeepSeek / GLM 标准 API / OpenRouter）：有总额按 `剩余 / 总额`；无总额按参考额度估算（悬停标注「估算」）；
- **GLM 币种**：智谱余额接口不返回币种字段，且国内 / 国际站为同一账户——插件**优先查国内站并按 CNY 显示**，仅当国内站不可用时回落国际站按 USD 显示；
- **缓存与轮询**：Host 端按供应商缓存 5 分钟，页面 3 秒轮询，带 localStorage 缓存防闪烁；
- **安全**：Host 路由 `GET /dsh-quota-ring/status` 只放行同源 / loopback 请求；插件通过 Harness 凭据 seam 只读凭据，不存储、不上传任何密钥。

## 🧩 环境要求

- DeepSeek Harness（桌面版或 Web 版）
- 对应供应商的 API Key 已在 Harness 中配置（模型设置或凭据）

## ⚠️ 注意事项

- 金额与配额均来自各供应商官方接口的实时查询，「估算」标记的电量基于参考额度换算，非账单口径；
- Codex / OpenCode 等订阅制供应商的接口返回窗口用量百分比，无金额字段；
- 卸载：从 profile 的 `bundles` 与 `dependencies` 移除 `dsh-quota-ring`，`pnpm install` 后重启。

## 🙏 致谢

- [dsh-context](https://github.com/bowenliang123/dsh-context) —— DSH 插件生态的标杆与本项目安装形态的参照；
- [dsh-balance](https://github.com/GeekRicardo/dsh-balance)、[cc-switch](https://github.com/GeekRicardo/cc-switch) —— 各供应商余额 / 配额接口的公开实现参考；
- [Simple Icons](https://simpleicons.org)（CC0）—— DeepSeek 鲸鱼标矢量。

## 📄 License

[MIT](./LICENSE) © 2026 dsh-quota-ring contributors
