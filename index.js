/**
 * dsh-quota-ring — Host half.
 *
 * Answers GET /dsh-quota-ring/status?sessionId=... with the balance / quota of EVERY
 * configured provider (one ring each in the Client), so DeepSeek and GLM show side by
 * side instead of only the currently selected model's provider. The response also marks
 * which family the session's current provider belongs to, so the Client can highlight it.
 *
 * Providers: DeepSeek, GLM (z.ai / open.bigmodel.cn), Kimi, MiniMax, OpenCode, OpenRouter,
 * ChatGPT Codex. A family without a resolvable credential is omitted entirely.
 *
 * GLM cash accounts are queried against open.bigmodel.cn first and labeled CNY (the
 * 智谱 domestic account billing currency; both hosts serve the same account), falling
 * back to api.z.ai labeled USD for international-only accounts. Coding-plan quota is
 * tried on both hosts before the cash fallback.
 */

export const inject = ['webServer', 'credentials'];

const CACHE_TTL_MS = 5 * 60 * 1000;
const ERROR_TTL_MS = 30 * 1000;
const HTTP_TIMEOUT_MS = 12 * 1000;

/** Ring fill is relative to a reference budget when the provider exposes no total. */
const REFERENCE_BALANCE = { CNY: 100, USD: 100 };

const DEEPSEEK_PROVIDER_IDS = new Set([
  'deepseek',
  'deepseek-official',
  'deepseek-account',
  'deepseek-vision',
]);
const ZHIPU_PROVIDER_IDS = new Set([
  'zai',
  'zai-coding',
  'zai-coding-plan',
  'zai-coding-cn',
  'zhipuai',
  'zhipuai-coding-plan',
  'bigmodel',
]);
const KIMI_PROVIDER_IDS = new Set(['kimi-coding', 'kimi-code-plan-global', 'kimi-code-plan-cn']);
const MINIMAX_PROVIDER_IDS = new Set(['minimax', 'minimax-cn', 'minimax-coding-plan', 'minimax-cn-coding-plan']);
const OPENCODE_PROVIDER_IDS = new Set(['opencode-go']);
const OPENROUTER_PROVIDER_IDS = new Set(['openrouter']);
const CODEX_PROVIDER_IDS = new Set(['openai-codex', 'codex']);

const KIMI_DEFAULT_BASE = 'https://api.kimi.com/coding';
const KIMI_USAGE_PATH = '/v1/usages';
const OPENCODE_USAGE_URL = 'https://opencode.ai/zen/go/v1/usage';
const OPENCODE_LIMITS_USD = { rolling: 12, weekly: 30, monthly: 60 };
const OPENROUTER_CREDITS_URL = 'https://openrouter.ai/api/v1/credits';
const CODEX_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage';
const ZHIPU_QUOTA_PATH = '/api/monitor/usage/quota/limit';
const ZHIPU_ACCOUNT_PATH = '/api/biz/account/query-customer-account-report';
const ZHIPU_BASES = {
  cn: 'https://open.bigmodel.cn',
  intl: 'https://api.z.ai',
};
const MINIMAX_BASES = {
  cn: 'https://api.minimaxi.com',
  intl: 'https://api.minimax.io',
};
const MINIMAX_USAGE_PATH = '/v1/api/openplatform/coding_plan/remains';

function toNum(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampPct(value) {
  const n = toNum(value);
  if (n === null) return null;
  return Math.max(0, Math.min(100, n));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function isoFromEpoch(value, unit) {
  const n = toNum(value);
  if (n === null || n <= 0) return null;
  const ms = unit === 'seconds' ? n * 1000 : n;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function writeJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(payload);
}

function isLoopbackHostname(hostname) {
  if (hostname === 'localhost' || hostname === '::1' || hostname === '[::1]') return true;
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts[0] !== '127') return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function isTrusted(req) {
  const host = req.headers.host;
  if (!host) return false;
  const hostname = host.split(':')[0];
  if (!isLoopbackHostname(hostname)) return false;
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function apply(ctx) {
  const credentials = ctx.credentials;
  const cache = new Map();

  async function resolveCredential(names) {
    for (const name of names) {
      try {
        const resolved = await credentials.resolve(name);
        if (resolved && typeof resolved.value === 'string' && resolved.value !== '') return resolved.value;
      } catch {
        // Try the next candidate name.
      }
    }
    return null;
  }

  async function resolveCredentialWithSource(names) {
    for (const name of names) {
      try {
        const resolved = await credentials.resolve(name);
        if (resolved && typeof resolved.value === 'string' && resolved.value !== '') {
          return { value: resolved.value, source: name };
        }
      } catch {
        // Try the next candidate name.
      }
    }
    return null;
  }

  async function fetchJson(url, headers) {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: response.status, ok: response.ok, json, text };
  }

  // Current provider/model: the session's latest request header wins, then the global default.
  function currentSelection(sessionId) {
    if (sessionId) {
      const agents = ctx.get('agents');
      if (agents) {
        try {
          const agent = agents.get(String(sessionId));
          const header = agent && agent.session ? agent.session.requestHeader() : null;
          const config = header && header.config;
          if (config && typeof config.provider === 'string' && typeof config.model === 'string') {
            return { provider: config.provider, model: config.model };
          }
        } catch {
          // Fall through to the global default.
        }
      }
    }
    const agentDefaultModel = ctx.get('agentDefaultModel');
    if (!agentDefaultModel) return null;
    try {
      const selection = agentDefaultModel.currentSelection();
      if (!selection || typeof selection !== 'object') return null;
      return {
        provider: typeof selection.provider === 'string' ? selection.provider : null,
        model: typeof selection.model === 'string' ? selection.model : null,
      };
    } catch {
      return null;
    }
  }

  function familyOfProvider(provider) {
    if (!provider) return null;
    if (DEEPSEEK_PROVIDER_IDS.has(provider)) return 'deepseek';
    if (ZHIPU_PROVIDER_IDS.has(provider)) return 'glm';
    if (KIMI_PROVIDER_IDS.has(provider)) return 'kimi';
    if (MINIMAX_PROVIDER_IDS.has(provider)) return 'minimax';
    if (OPENCODE_PROVIDER_IDS.has(provider)) return 'opencode';
    if (OPENROUTER_PROVIDER_IDS.has(provider)) return 'openrouter';
    if (CODEX_PROVIDER_IDS.has(provider)) return 'codex';
    return null;
  }

  function cachedFetch(key, loader) {
    const hit = cache.get(key);
    const now = Date.now();
    if (hit && now - hit.at < (hit.error ? ERROR_TTL_MS : CACHE_TTL_MS)) {
      return Promise.resolve(hit.value);
    }
    return loader().then(
      (value) => {
        cache.set(key, { at: Date.now(), value, error: false });
        return value;
      },
      (error) => {
        const value = { error: messageOf(error) };
        cache.set(key, { at: Date.now(), value, error: true });
        return value;
      },
    );
  }

  function messageOf(error) {
    return error && error.message ? error.message : String(error);
  }

  function cashShape({ label, currency, remaining, total, spent, note, extra }) {
    const reference = REFERENCE_BALANCE[currency] ?? 100;
    const pct = total !== null && total > 0 ? (remaining / total) * 100 : (remaining / reference) * 100;
    const resolvedNote = note ?? (total === null ? 'estimated' : null);
    return {
      kind: 'cash',
      label,
      currency,
      remaining: round2(remaining),
      total: total === null ? null : round2(total),
      spent: spent === null || spent === undefined ? null : round2(spent),
      note: resolvedNote,
      ...(extra ?? {}),
      remainingPct: clampPct(pct),
      updatedAt: Date.now(),
      error: null,
    };
  }

  function quotaShape({ label, windows, extra }) {
    const valid = (windows ?? []).filter((w) => toNum(w.remainingPct) !== null);
    const pct = valid.length ? Math.min(...valid.map((w) => w.remainingPct)) : null;
    return {
      kind: 'quota',
      label,
      currency: null,
      remaining: null,
      total: null,
      spent: null,
      note: null,
      ...(extra ?? {}),
      windows: valid,
      remainingPct: clampPct(pct),
      updatedAt: Date.now(),
      error: null,
    };
  }

  // ── DeepSeek ──────────────────────────────────────────────────────────────

  async function deepseekStatus() {
    const key = await resolveCredential(['DEEPSEEK_API_KEY']);
    if (!key) return { error: '未配置 DEEPSEEK_API_KEY' };
    const res = await fetchJson('https://api.deepseek.com/user/balance', {
      authorization: 'Bearer ' + key,
      accept: 'application/json',
    });
    if (!res.ok || !res.json) return { error: 'DeepSeek 余额接口 HTTP ' + res.status };
    const infos = Array.isArray(res.json.balance_infos) ? res.json.balance_infos : [];
    const info = infos.find((item) => item && item.currency === 'CNY') ?? infos[0];
    if (!info) return { error: 'DeepSeek 余额响应缺少 balance_infos' };
    const remaining = toNum(info.total_balance);
    if (remaining === null) return { error: 'DeepSeek 余额响应缺少 total_balance' };
    const currency = typeof info.currency === 'string' && info.currency !== '' ? info.currency : 'CNY';
    return cashShape({
      label: 'DeepSeek',
      currency,
      remaining,
      total: null,
      spent: null,
      note: res.json.is_available === false ? 'unavailable' : 'estimated',
      extra: {
        granted: toNum(info.granted_balance),
        toppedUp: toNum(info.topped_up_balance),
      },
    });
  }

  // ── GLM / 智谱（Coding Plan 配额，其次标准 API 现金余额）─────────────────
  //
  // 国内站优先：智谱账户通常在 open.bigmodel.cn 充值计价（CNY），两个站点查询的是
  // 同一个账户；仅当国内站不可达/拒绝时才回落 api.z.ai（USD）。

  function parseZhipuQuota(json) {
    if (!json || typeof json !== 'object') return null;
    if (json.success === false || (json.code !== undefined && json.code !== 200)) return null;
    const data = json.data;
    if (!data || typeof data !== 'object') return null;
    const limits = Array.isArray(data.limits) ? data.limits : [];
    const fiveHour = [];
    const weekly = [];
    const unclassified = [];
    for (const item of limits) {
      if (!item || typeof item !== 'object') continue;
      const type = typeof item.type === 'string' ? item.type.toLowerCase() : '';
      if (type !== 'tokens_limit') continue;
      const used = toNum(item.percentage);
      if (used === null) continue;
      const entry = {
        remainingPct: clampPct(100 - used),
        usedPct: clampPct(used),
        resetsAt: isoFromEpoch(item.nextResetTime),
      };
      const unit = toNum(item.unit);
      if (unit === 3 && fiveHour.length === 0) fiveHour.push(entry);
      else if (unit === 6 && weekly.length === 0) weekly.push(entry);
      else unclassified.push(entry);
    }
    for (const entry of unclassified) {
      if (fiveHour.length === 0) fiveHour.push(entry);
      else if (weekly.length === 0) weekly.push(entry);
    }
    const windows = [];
    if (fiveHour[0]) windows.push({ key: '5h', label: '5小时', ...fiveHour[0] });
    if (weekly[0]) windows.push({ key: '7d', label: '7天', ...weekly[0] });
    return windows.length > 0 ? windows : null;
  }

  async function zhipuStatus() {
    const resolved = await resolveCredentialWithSource([
      'ZAI_CODING_CN_API_KEY',
      'ZAI_API_KEY',
      'ZHIPUAI_API_KEY',
      'BIGMODEL_API_KEY',
    ]);
    if (!resolved) return { error: '未配置 ZAI_API_KEY' };
    const key = resolved.value;
    const label = 'GLM';

    // 1) Coding Plan 配额（国内站 raw key，国际站 Bearer）。
    for (const [base, authStyle] of [
      [ZHIPU_BASES.cn, 'raw'],
      [ZHIPU_BASES.intl, 'bearer'],
    ]) {
      try {
        const quota = await fetchJson(base + ZHIPU_QUOTA_PATH, {
          authorization: authStyle === 'raw' ? key : 'Bearer ' + key,
          accept: 'application/json',
        });
        const windows = parseZhipuQuota(quota.json);
        if (windows) return quotaShape({ label, windows });
      } catch {
        // Try the next host, then the cash account.
      }
    }

    // 2) 标准 API 现金余额：国内站 → CNY，国际站 → USD。
    for (const [base, currency] of [
      [ZHIPU_BASES.cn, 'CNY'],
      [ZHIPU_BASES.intl, 'USD'],
    ]) {
      try {
        const account = await fetchJson(base + ZHIPU_ACCOUNT_PATH, {
          authorization: 'Bearer ' + key,
          accept: 'application/json',
        });
        const data = account.json && account.json.success !== false ? account.json.data : null;
        if (!data || typeof data !== 'object') continue;
        const remaining = toNum(data.availableBalance) ?? toNum(data.balance);
        if (remaining === null) continue;
        const recharge = toNum(data.rechargeAmount) ?? 0;
        const give = toNum(data.giveAmount) ?? 0;
        const total = recharge + give > 0 ? recharge + give : null;
        return cashShape({
          label,
          currency,
          remaining,
          total,
          spent: toNum(data.totalSpendAmount),
          note: total === null ? 'estimated' : null,
          extra: {
            granted: give,
            toppedUp: recharge,
            frozen: toNum(data.frozenBalance),
          },
        });
      } catch {
        // Try the next host.
      }
    }
    return { error: 'GLM 余额接口不可用' };
  }

  // ── Kimi Coding ───────────────────────────────────────────────────────────

  function kimiTier(limitRaw, remainingRaw, resetTime) {
    const limit = toNum(limitRaw);
    const remaining = toNum(remainingRaw);
    const pct = limit !== null && limit > 0 && remaining !== null ? (remaining / limit) * 100 : null;
    return {
      remainingPct: clampPct(pct),
      resetsAt: typeof resetTime === 'string' && resetTime !== '' ? resetTime : null,
    };
  }

  async function kimiStatus() {
    const key = await resolveCredential(['KIMI_CODING_API_KEY', 'KIMI_CODE_API_KEY', 'KIMI_API_KEY']);
    if (!key) return { error: '未配置 KIMI_CODING_API_KEY' };
    let base = KIMI_DEFAULT_BASE;
    const override = await resolveCredential(['KIMI_CODE_BASE_URL']);
    if (override) base = override.trim();
    const res = await fetchJson(base + KIMI_USAGE_PATH, {
      authorization: 'Bearer ' + key,
      accept: 'application/json',
      'user-agent': 'KimiCLI/1.5',
    });
    const body = res.json;
    if (!res.ok || !body) return { error: 'Kimi 用量接口 HTTP ' + res.status };
    if (body.error) return { error: String(body.error.message || body.error.type || '接口返回错误') };
    const first = Array.isArray(body.limits) && body.limits.length ? body.limits[0] : null;
    const detail = first && first.detail ? first.detail : null;
    const usage = body.usage && typeof body.usage === 'object' ? body.usage : null;
    const windows = [];
    if (detail) {
      const tier = kimiTier(detail.limit, detail.remaining, detail.resetTime);
      if (tier.remainingPct !== null) windows.push({ key: '5h', label: '5小时', ...tier });
    }
    if (usage) {
      const tier = kimiTier(usage.limit, usage.remaining, usage.resetTime);
      if (tier.remainingPct !== null) windows.push({ key: '7d', label: '7天', ...tier });
    }
    if (!windows.length) return { error: 'Kimi 用量响应缺少窗口字段' };
    return quotaShape({ label: 'Kimi', windows });
  }

  // ── MiniMax Coding Plan ───────────────────────────────────────────────────

  async function minimaxStatus() {
    const resolved = await resolveCredentialWithSource(['MINIMAX_CN_API_KEY', 'MINIMAX_API_KEY']);
    if (!resolved) return { error: '未配置 MINIMAX_CN_API_KEY' };
    const base = resolved.source === 'MINIMAX_CN_API_KEY' ? MINIMAX_BASES.cn : MINIMAX_BASES.intl;
    const res = await fetchJson(base + MINIMAX_USAGE_PATH, {
      authorization: 'Bearer ' + resolved.value,
      accept: 'application/json',
    });
    const body = res.json;
    if (!res.ok || !body) return { error: 'MiniMax 用量接口 HTTP ' + res.status };
    const baseResp = body.base_resp;
    if (baseResp && toNum(baseResp.status_code) !== 0) {
      return { error: String(baseResp.status_msg || '接口返回错误') };
    }
    const rows = Array.isArray(body.model_remains) ? body.model_remains : [];
    const item = rows.find((row) => row && row.model_name === 'general');
    if (!item) return { error: 'MiniMax 用量响应缺少 general 条目' };
    const windows = [];
    const fiveRemain = toNum(item.current_interval_remaining_percent);
    if (fiveRemain !== null) {
      windows.push({
        key: '5h',
        label: '5小时',
        remainingPct: clampPct(fiveRemain),
        resetsAt: isoFromEpoch(item.end_time),
      });
    }
    if (toNum(item.current_weekly_status) === 1) {
      const weeklyRemain = toNum(item.current_weekly_remaining_percent);
      if (weeklyRemain !== null) {
        windows.push({
          key: '7d',
          label: '7天',
          remainingPct: clampPct(weeklyRemain),
          resetsAt: isoFromEpoch(item.weekly_end_time),
        });
      }
    }
    if (!windows.length) return { error: 'MiniMax 用量响应缺少窗口字段' };
    return quotaShape({ label: 'MiniMax', windows });
  }

  // ── OpenCode Go ───────────────────────────────────────────────────────────

  async function opencodeStatus() {
    const key = await resolveCredential(['OPENCODE_GO_API_KEY', 'OPENCODE_API_KEY']);
    if (!key) return { error: '未配置 OPENCODE_GO_API_KEY' };
    const res = await fetchJson(OPENCODE_USAGE_URL, {
      authorization: 'Bearer ' + key,
      'x-api-key': key,
      accept: 'application/json',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });
    const body = res.json;
    if (!res.ok || !body) return { error: 'OpenCode 用量接口 HTTP ' + res.status };
    if (body.error) return { error: String(body.error.message || body.error.type || '接口返回错误') };
    const usage = body.usage && typeof body.usage === 'object' ? body.usage : null;
    if (!usage) return { error: 'OpenCode 用量响应缺少 usage 字段' };
    const labels = { rolling: '5小时', weekly: '7天', monthly: '30天' };
    const windows = [];
    for (const name of ['rolling', 'weekly', 'monthly']) {
      const win = usage[name];
      if (!win || typeof win !== 'object') continue;
      const used = toNum(win.percent);
      if (used === null) continue;
      windows.push({
        key: name,
        label: labels[name],
        remainingPct: clampPct(100 - used),
        usedPct: clampPct(used),
        limitUsd: OPENCODE_LIMITS_USD[name] ?? null,
        resetsAt: typeof win.resetsAt === 'string' ? win.resetsAt : null,
      });
    }
    if (!windows.length) return { error: 'OpenCode 用量响应缺少窗口字段' };
    return quotaShape({ label: 'OpenCode', windows });
  }

  // ── OpenRouter ────────────────────────────────────────────────────────────

  async function openrouterStatus() {
    const key = await resolveCredential(['OPENROUTER_API_KEY']);
    if (!key) return { error: '未配置 OPENROUTER_API_KEY' };
    const res = await fetchJson(OPENROUTER_CREDITS_URL, {
      authorization: 'Bearer ' + key,
      accept: 'application/json',
    });
    const data = res.json && res.json.data ? res.json.data : null;
    if (!res.ok || !data || typeof data !== 'object') return { error: 'OpenRouter 余额接口 HTTP ' + res.status };
    const total = toNum(data.total_credits);
    const used = toNum(data.total_usage);
    if (total === null && used === null) return { error: 'OpenRouter 响应缺少 credits 字段' };
    const remaining = total !== null && used !== null ? Math.max(total - used, 0) : null;
    if (remaining === null) return { error: 'OpenRouter 响应缺少剩余额度' };
    return cashShape({
      label: 'OpenRouter',
      currency: 'USD',
      remaining,
      total,
      spent: used,
      note: null,
    });
  }

  // ── ChatGPT Codex ─────────────────────────────────────────────────────────

  function codexWindowName(seconds) {
    if (seconds === 18000) return { key: '5h', label: '5小时' };
    if (seconds === 604800) return { key: '7d', label: '7天' };
    if (seconds === 2592000) return { key: '30d', label: '30天' };
    const hours = Math.floor(seconds / 3600);
    if (hours >= 24) return { key: Math.floor(hours / 24) + 'd', label: Math.floor(hours / 24) + '天' };
    return { key: hours + 'h', label: hours + '小时' };
  }

  async function codexStatus() {
    const key = await resolveCredential(['OPENAI_CODEX_ACCESS_TOKEN']);
    if (!key) return { error: '未配置 OPENAI_CODEX_ACCESS_TOKEN' };
    const accountId = await resolveCredential(['OPENAI_CODEX_ACCOUNT_ID']);
    const headers = {
      authorization: 'Bearer ' + key,
      accept: 'application/json',
      'user-agent': 'codex-cli',
    };
    if (accountId) headers['chatgpt-account-id'] = accountId;
    const res = await fetchJson(CODEX_USAGE_URL, headers);
    const body = res.json;
    if (!res.ok || !body) return { error: 'Codex 用量接口 HTTP ' + res.status };
    const rateLimit = body.rate_limit && typeof body.rate_limit === 'object' ? body.rate_limit : null;
    const windows = [];
    for (const win of [rateLimit && rateLimit.primary_window, rateLimit && rateLimit.secondary_window]) {
      if (!win || typeof win !== 'object') continue;
      const used = toNum(win.used_percent);
      if (used === null) continue;
      const seconds = toNum(win.limit_window_seconds) ?? 0;
      const name = codexWindowName(seconds);
      windows.push({
        key: name.key,
        label: name.label,
        remainingPct: clampPct(100 - used),
        usedPct: clampPct(used),
        resetsAt: isoFromEpoch(win.reset_at, 'seconds'),
      });
    }
    if (!windows.length) return { error: 'Codex 响应缺少 rate_limit 窗口' };
    return quotaShape({ label: 'Codex', windows });
  }

  // ── Families（每个已配置凭据的供应商一个环）───────────────────────────────

  const FAMILIES = [
    { key: 'deepseek', label: 'DeepSeek', envNames: ['DEEPSEEK_API_KEY'], load: () => deepseekStatus() },
    {
      key: 'glm',
      label: 'GLM',
      envNames: ['ZAI_CODING_CN_API_KEY', 'ZAI_API_KEY', 'ZHIPUAI_API_KEY', 'BIGMODEL_API_KEY'],
      load: () => zhipuStatus(),
    },
    {
      key: 'kimi',
      label: 'Kimi',
      envNames: ['KIMI_CODING_API_KEY', 'KIMI_CODE_API_KEY', 'KIMI_API_KEY'],
      load: () => kimiStatus(),
    },
    { key: 'minimax', label: 'MiniMax', envNames: ['MINIMAX_CN_API_KEY', 'MINIMAX_API_KEY'], load: () => minimaxStatus() },
    { key: 'opencode', label: 'OpenCode', envNames: ['OPENCODE_GO_API_KEY', 'OPENCODE_API_KEY'], load: () => opencodeStatus() },
    { key: 'openrouter', label: 'OpenRouter', envNames: ['OPENROUTER_API_KEY'], load: () => openrouterStatus() },
    { key: 'codex', label: 'Codex', envNames: ['OPENAI_CODEX_ACCESS_TOKEN'], load: () => codexStatus() },
  ];

  async function getAllStatuses(sessionId) {
    const selection = currentSelection(sessionId);
    const currentProvider = selection && selection.provider ? selection.provider : null;
    const currentModel = selection && selection.model ? selection.model : null;
    const currentFamily = familyOfProvider(currentProvider);

    const settled = await Promise.all(
      FAMILIES.map(async (family) => {
        try {
          const credential = await resolveCredential(family.envNames);
          if (!credential) return null;
        } catch {
          return null;
        }
        const value = await cachedFetch(family.key, family.load);
        if (!value) return null;
        if (value.error) {
          return { family: family.key, label: family.label, supported: true, error: value.error, kind: null, remainingPct: null };
        }
        return { family: family.key, ...value, error: null };
      }),
    );

    return {
      ok: true,
      items: settled.filter(Boolean),
      current: { provider: currentProvider, model: currentModel, family: currentFamily },
    };
  }

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: '/dsh-quota-ring/status',
        handler: async (req, res) => {
          if (!isTrusted(req)) {
            writeJson(res, 403, { ok: false, error: 'forbidden' });
            return;
          }
          try {
            const url = new URL(req.url ?? '/', 'http://dsh.internal');
            const sessionId = url.searchParams.get('sessionId');
            writeJson(res, 200, await getAllStatuses(sessionId));
          } catch (error) {
            writeJson(res, 500, { ok: false, error: messageOf(error) });
          }
        },
      }),
    'dsh-quota-ring: /dsh-quota-ring/status route',
  );
}
