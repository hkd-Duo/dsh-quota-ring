# dsh-quota-ring

**iPhone Duo 风格的 AI 额度圆环，for DeepSeek Harness.**

在输入框编辑区下方并排显示每一个已配置 AI 供应商的剩余额度 / 余额圆环——像 iPhone Duo 的缺口电量环一样，弧长即剩余比例，环中心是供应商 logo。

- DeepSeek、GLM（智谱）等**多个供应商的环同时显示**，当前会话模型对应的环带高亮点；
- 每个圆环可独立选择 **6 种样式**（Duo 缺口环 / 闭合圆环 / 分段电量 / 半圆仪表 / 电池条 / 双环），显示开关控制展示几个环；
- 点击圆环行任意位置弹出样式面板；面板内还能直达各供应商账单页；
- 偏好保存在浏览器本地。

## 支持的供应商

| provider id | 供应商 | 查询接口 | 凭据 |
| --- | --- | --- | --- |
| `deepseek` / `deepseek-official` / `deepseek-account` / `deepseek-vision` | DeepSeek 官方 | `GET https://api.deepseek.com/user/balance` | `DEEPSEEK_API_KEY` |
| `zai` / `zai-coding-plan` | GLM（智谱国际站） | Coding Plan 配额 → 回落标准 API 现金余额 | `ZAI_API_KEY` |
| `zai-coding-cn` / `zhipuai` / `zhipuai-coding-plan` | GLM（智谱国内站） | 同上（open.bigmodel.cn） | `ZAI_CODING_CN_API_KEY` |
| `kimi-coding` | Kimi Coding | `GET https://api.kimi.com/coding/v1/usages` | `KIMI_CODING_API_KEY` |
| `minimax` / `minimax-cn` | MiniMax Coding Plan | `/v1/api/openplatform/coding_plan/remains` | `MINIMAX_CN_API_KEY` / `MINIMAX_API_KEY` |
| `opencode-go` | OpenCode Go | `GET https://opencode.ai/zen/go/v1/usage` | `OPENCODE_GO_API_KEY` |
| `openrouter` | OpenRouter | `GET https://openrouter.ai/api/v1/credits` | `OPENROUTER_API_KEY` |
| `openai-codex` | ChatGPT Codex | `GET https://chatgpt.com/backend-api/wham/usage` | `OPENAI_CODEX_ACCESS_TOKEN` |

未配置对应凭据的供应商不显示；插件只读凭据（凭据引用由 Harness 凭据 seam 解析），不修改任何配置。

## 安装

### 方式一：GitHub 依赖（推荐）

在本机 profile 的 `package.json`（如 `%DSH_HOME%\profiles\desktop\package.json`）中加入依赖与 bundle：

```json
{
  "dependencies": {
    "dsh-quota-ring": "github:<你的用户名>/dsh-quota-ring"
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

重启 DeepSeek Harness 即生效。

### 方式二：本地目录安装

把仓库克隆到任意目录，然后在 Harness 的插件管理中按目录安装该 bundle（或直接把目录链接为 profile 依赖）。

## 使用

- **点击圆环行任意位置**（环 / 名称 / 金额 / ⚙）打开样式面板；
- 面板里每个供应商一行：**显示开关**（决定展示几个环）+ **6 种样式小预览**（点击即换）+ **↗ 打开账单页**；
- 悬停圆环查看明细：余额、总额、已用、充值、配额窗口与重置倒计时、更新时间；
- 当前会话模型对应的环带蓝点，悬停标注「当前模型正在使用」；
- 设置也出现在「设置 → 插件 → dsh-quota-ring」页面内。

## 数据口径

- **配额类**（Kimi / MiniMax / OpenCode / Codex / GLM Coding Plan）：圆环取所有窗口中剩余比例最小的一个；
- **现金余额类**（DeepSeek / GLM 标准 API / OpenRouter）：有总额按 `剩余/总额`；无总额按参考额度估算（tooltip 标注）；
- **GLM 币种**：智谱余额接口不返回币种字段，且国内/国际站为同一账户。插件**优先查国内站并按 CNY 显示**，仅当国内站不可用时回落国际站按 USD 显示；
- Host 端按供应商缓存 5 分钟，页面 3 秒轮询，带 localStorage 缓存防闪烁；
- Host 路由 `GET /dsh-quota-ring/status?sessionId=...` 只放行同源 / loopback 请求。

## 环境要求

- DeepSeek Harness（桌面版或 Web 版）
- 对应供应商的 API Key 已在 Harness 中配置（模型设置或凭据）

## 卸载

从 profile 的 `bundles` 列表与 `dependencies` 中移除 `dsh-quota-ring`，执行 `pnpm install` 并重启。

## License

[MIT](./LICENSE)
