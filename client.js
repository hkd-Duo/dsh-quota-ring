/**
 * dsh-quota-ring — Client half.
 *
 * Renders iPhone Duo style notched battery rings below the composer — one per configured
 * AI provider, side by side, each with its own selectable visual style, and a per-provider
 * show/hide toggle (how many rings show). The provider the session's current model belongs
 * to carries a highlight dot.
 *
 * Preferences live in localStorage; the same panel is reachable from the gear button next
 * to the rings and from the plugin's own page in Settings → Plugins (plugins.bundle.config).
 */

window.__ModuleLoader__.load({
  id: 'dsh-quota-ring',
  // v0.3.4: style panel expands in flow (no fixed positioning, no extra runtime deps).
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'dsh-quota-ring';
    const PKG = 'dsh-quota-ring';
    const STYLE_ID = 'dsh-quota-ring-style';
    const CACHE_KEY = 'dsh-quota-ring:last';
    const PREFS_KEY = 'dsh-quota-ring:prefs';
    const POLL_MS = 3000;

    const ZH = {
      title: '额度',
      cash: '可用余额',
      total: '总额',
      spent: '已用',
      thrown: '赠送',
      toppedUp: '充值',
      estimated: '圆环电量按参考额度估算',
      unavailable: '账户余额不可用',
      updated: '更新于',
      stale: '正在刷新…',
      error: '额度暂不可用',
      reset: '重置',
      left: '剩余',
      current: '当前模型正在使用',
      window5h: '5小时',
      window7d: '7天',
      window30d: '30天',
      'style.duo': 'Duo 缺口环',
      'style.ring': '闭合圆环',
      'style.segments': '分段电量',
      'style.gauge': '半圆仪表',
      'style.battery': '电池条',
      'style.double': '双环',
      'panel.title': '圆环样式',
      'panel.show': '显示此圆环',
      'panel.hint': '设置保存在本地浏览器；每个圆环可选用不同样式。',
      'panel.empty': '等待额度数据加载后即可配置…',
      'panel.styleOf': '{name} 的样式',
      'panel.billing': '打开账单页',
    };

    const EN = {
      title: 'Quota',
      cash: 'Available',
      total: 'Total',
      spent: 'Spent',
      thrown: 'Granted',
      toppedUp: 'Topped up',
      estimated: 'Ring fill is estimated against a reference budget',
      unavailable: 'Account balance unavailable',
      updated: 'Updated',
      stale: 'refreshing…',
      error: 'Quota unavailable',
      reset: 'resets',
      left: 'left',
      current: 'Active model',
      window5h: '5h',
      window7d: '7d',
      window30d: '30d',
      'style.duo': 'Duo notched ring',
      'style.ring': 'Closed ring',
      'style.segments': 'Segmented',
      'style.gauge': 'Semicircle gauge',
      'style.battery': 'Battery bar',
      'style.double': 'Double ring',
      'panel.title': 'Ring styles',
      'panel.show': 'Show this ring',
      'panel.hint': 'Saved in this browser; each ring can use its own style.',
      'panel.empty': 'Waiting for quota data before rings can be configured…',
      'panel.styleOf': 'Style of {name}',
      'panel.billing': 'Open billing page',
    };

    const cssText =
      '.dqr-wrap { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 6px; max-width: 100%; } ' +
      '.dqr-row { display: inline-flex; align-items: center; gap: 2px; flex-wrap: nowrap; flex: none; ' +
      'max-width: 100%; vertical-align: middle; } ' +
      '.dqr { display: inline-flex; align-items: center; gap: 5px; padding: 1px 7px 1px 3px; ' +
      'border-radius: 999px; font-size: 11px; line-height: 1; color: var(--dsw-alias-label-secondary); ' +
      'font-variant-numeric: tabular-nums; user-select: none; white-space: nowrap; cursor: pointer; ' +
      'transition: background-color .15s ease, opacity .15s ease; } ' +
      '.dqr:hover { background: var(--dsw-alias-interactive-bg-hover); } ' +
      '.dqr--stale { opacity: .55; } ' +
      '.dqr--error { color: var(--dsw-alias-state-error-primary); } ' +
      '.dqr__dot { width: 5px; height: 5px; border-radius: 50%; flex: none; ' +
      'background: var(--dsw-alias-brand-primary); } ' +
      '.dqr__ring { flex: none; display: block; overflow: visible; } ' +
      '.dqr__track { stroke: var(--dsw-alias-border-l2); opacity: .65; } ' +
      '.dqr__arc { transition: stroke-dasharray .6s cubic-bezier(.22, 1, .36, 1), stroke .2s ease; } ' +
      '.dqr__center { fill: var(--dsw-alias-label-secondary); font-weight: 600; } ' +
      '.dqr__label { font-weight: 600; color: var(--dsw-alias-label-primary); white-space: nowrap; } ' +
      '.dqr__value { color: var(--dsw-alias-label-secondary); white-space: nowrap; } ' +
      '.dqr__gear { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; ' +
      'border: 0; background: 0 0; border-radius: 6px; color: var(--dsw-alias-label-tertiary); cursor: pointer; ' +
      'padding: 0; transition: background-color .15s ease, color .15s ease; } ' +
      '.dqr__gear:hover, .dqr__gear--on { background: var(--dsw-alias-interactive-bg-hover); ' +
      'color: var(--dsw-alias-label-primary); } ' +
      '.dqr-pop { position: static; box-sizing: border-box; ' +
      'background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l2); ' +
      'border-radius: 10px; box-shadow: var(--dsw-shadow-lv2); padding: 10px 12px; color: var(--dsw-alias-label-primary); } ' +
      '.dqr-pop--flow { width: 100%; min-width: 280px; } ' +
      '.dqr-card { width: 100%; box-sizing: border-box; color: var(--dsw-alias-label-primary); } ' +
      '.dqr-panel__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; ' +
      'margin-bottom: 8px; font-size: 12px; font-weight: 600; } ' +
      '.dqr-panel__close { border: 0; background: 0 0; cursor: pointer; color: var(--dsw-alias-label-tertiary); ' +
      'font-size: 14px; line-height: 1; padding: 2px 4px; border-radius: 6px; } ' +
      '.dqr-panel__close:hover { background: var(--dsw-alias-interactive-bg-hover); ' +
      'color: var(--dsw-alias-label-primary); } ' +
      '.dqr-fam { display: flex; align-items: center; gap: 10px; padding: 7px 2px; ' +
      'border-top: 1px solid var(--dsw-alias-border-l1); } ' +
      '.dqr-fam:first-of-type { border-top: 0; } ' +
      '.dqr-fam--off { opacity: .55; } ' +
      '.dqr-fam__name { font-size: 11.5px; font-weight: 600; flex: none; min-width: 64px; ' +
      'display: inline-flex; align-items: center; gap: 5px; } ' +
      '.dqr-fam__dot { width: 5px; height: 5px; border-radius: 50%; flex: none; ' +
      'background: var(--dsw-alias-brand-primary); } ' +
      '.dqr-fam__styles { display: flex; align-items: center; gap: 4px; flex: 1; flex-wrap: wrap; } ' +
      '.dqr-fam__link { flex: none; color: var(--dsw-alias-label-tertiary); text-decoration: none; ' +
      'font-size: 11px; line-height: 1; padding: 3px 4px; border-radius: 5px; ' +
      'transition: color .15s ease, background-color .15s ease; } ' +
      '.dqr-fam__link:hover { color: var(--dsw-alias-brand-primary); ' +
      'background: var(--dsw-alias-interactive-bg-hover); } ' +
      '.dqr-stylebtn { border: 1.5px solid transparent; background: 0 0; cursor: pointer; border-radius: 8px; ' +
      'padding: 2px 3px 1px; display: inline-flex; flex-direction: column; align-items: center; gap: 1px; ' +
      'color: var(--dsw-alias-label-tertiary); font-size: 9px; line-height: 1.2; } ' +
      '.dqr-stylebtn:hover { background: var(--dsw-alias-interactive-bg-hover); ' +
      'color: var(--dsw-alias-label-secondary); } ' +
      '.dqr-stylebtn--on { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary); ' +
      'background: var(--dsw-alias-interactive-bg-hover); } ' +
      '.dqr-switch { position: relative; flex: none; width: 26px; height: 15px; border-radius: 999px; ' +
      'border: 0; padding: 0; cursor: pointer; background: var(--dsw-alias-border-l2); ' +
      'transition: background-color .15s ease; } ' +
      '.dqr-switch[aria-checked="true"] { background: var(--dsw-alias-button-primary-fill); } ' +
      '.dqr-switch__knob { position: absolute; top: 2px; left: 2px; width: 11px; height: 11px; ' +
      'border-radius: 50%; background: var(--dsw-alias-bg-layer-1); transition: left .15s ease; } ' +
      '.dqr-switch[aria-checked="true"] .dqr-switch__knob { left: 13px; ' +
      'background: var(--dsw-alias-label-primary-foreground); } ' +
      '.dqr-panel__hint { margin-top: 8px; font-size: 10px; line-height: 1.5; ' +
      'color: var(--dsw-alias-label-tertiary); } ' +
      '.dqr-panel__empty { padding: 10px 0; font-size: 11px; color: var(--dsw-alias-label-secondary); } ';

    function ensureStyle() {
      let el = document.getElementById(STYLE_ID);
      if (el === null) {
        el = document.createElement('style');
        el.id = STYLE_ID;
        document.head.appendChild(el);
      }
      // HMR can re-run this module against a head that still holds the previous
      // generation's stylesheet — always sync the text so CSS matches the running JS.
      if (el.textContent !== cssText) el.textContent = cssText;
    }

    // ── preferences store (localStorage + pub-sub) ───────────────────────────

    const STYLE_IDS = ['duo', 'ring', 'segments', 'gauge', 'battery', 'double'];

    let prefsCache = loadPrefs();
    const prefListeners = new Set();

    function loadPrefs() {
      try {
        const raw = localStorage.getItem(PREFS_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    }

    function savePrefs() {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefsCache));
      } catch {
        // Storage may be unavailable; the in-memory store still works.
      }
    }

    function notifyPrefs() {
      for (const listener of prefListeners) listener();
    }

    function subscribePrefs(listener) {
      prefListeners.add(listener);
      return function () {
        prefListeners.delete(listener);
      };
    }

    function familyPref(family) {
      const raw = prefsCache.families && typeof prefsCache.families === 'object' ? prefsCache.families[family] : null;
      const enabled = !raw || raw.enabled !== false;
      const style = raw && STYLE_IDS.includes(raw.style) ? raw.style : 'duo';
      return { enabled, style };
    }

    function setFamilyPref(family, patch) {
      const families = typeof prefsCache.families === 'object' && prefsCache.families ? prefsCache.families : {};
      const current = familyPref(family);
      prefsCache = {
        ...prefsCache,
        families: { ...families, [family]: { ...current, ...patch } },
      };
      savePrefs();
      notifyPrefs();
    }

    // Known families (filled in as poll results arrive; shared by all mounts).
    const familyRegistry = new Map();

    function registerFamilies(items) {
      let changed = false;
      for (const item of items) {
        if (item && item.family && !familyRegistry.has(item.family)) {
          familyRegistry.set(item.family, item.label || item.family);
          changed = true;
        }
      }
      if (changed) notifyPrefs();
    }

    // ── formatting helpers ───────────────────────────────────────────────────

    function toNum(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }

    function clampPct(value) {
      const n = toNum(value);
      if (n === null) return null;
      return Math.max(0, Math.min(100, n));
    }

    function currencySymbol(code) {
      if (code === 'CNY') return '¥';
      if (code === 'USD') return '$';
      if (code === 'EUR') return '€';
      return code ? code + ' ' : '';
    }

    function fmtMoney(code, value) {
      const n = toNum(value);
      if (n === null) return '—';
      const symbol = currencySymbol(code);
      const digits = Math.abs(n) > 0 && Math.abs(n) < 0.01 ? 4 : 2;
      return symbol + n.toFixed(digits);
    }

    function fmtPct(value) {
      const n = toNum(value);
      return n === null ? '—' : Math.round(n) + '%';
    }

    function fmtClock(ms) {
      const n = toNum(ms);
      if (n === null) return '—';
      try {
        return new Date(n).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch {
        return '—';
      }
    }

    function countdown(iso) {
      if (typeof iso !== 'string' || iso === '') return null;
      const t = Date.parse(iso);
      if (!Number.isFinite(t)) return null;
      const diff = t - Date.now();
      if (diff <= 0) return null;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      if (hours > 24) return Math.floor(hours / 24) + 'd' + (hours % 24) + 'h';
      if (hours > 0) return hours + 'h' + minutes + 'm';
      return minutes + 'm';
    }

    function windowLabel(key, fallback, t) {
      if (key === '5h' || key === 'rolling') return t('window5h');
      if (key === '7d' || key === 'weekly') return t('window7d');
      if (key === '30d' || key === 'monthly') return t('window30d');
      return fallback || key;
    }

    // ── provider logos (embedded; no network) ────────────────────────────────
    // DeepSeek whale from Simple Icons (CC0). Other providers use original
    // lettermarks in their brand colors because no redistributable vector logo
    // ships with them.

    const LOGO_DEEPSEEK_PATH =
      'M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45';

    // Zhipu "Z" mark traced from the official 智谱 BigModel logo bitmap into three
    // solid pieces (top-left bar, long diagonal band, bottom-right bar). Filled with
    // the theme's primary label color so it stays visible in light and dark themes.
    const LOGO_ZHIPU_PATH =
      'M0.3 1.7 L12.7 1.7 L10.2 5 L0.3 5 Z ' +
      'M14.4 1.7 L23.9 1.7 L21.4 5 L10.6 22.3 L0.7 22.3 L11.9 5 Z ' +
      'M13.5 19 L24.3 19 L24.3 22.3 L11.9 22.3 Z';

    // Provider billing / usage consoles opened from the panel's ↗ link.
    const BILLING_URLS = {
      deepseek: 'https://platform.deepseek.com/usage',
      glm: 'https://open.bigmodel.cn/usercenter',
      kimi: 'https://platform.moonshot.cn/console/account',
      minimax: 'https://platform.minimaxi.com',
      opencode: 'https://opencode.ai',
      openrouter: 'https://openrouter.ai/credits',
      codex: 'https://chatgpt.com',
    };

    const LOGOS = {      deepseek: { path: LOGO_DEEPSEEK_PATH, color: '#4d6bfe' },
      glm: { path: LOGO_ZHIPU_PATH, color: 'var(--dsw-alias-label-primary)' },
      kimi: { text: 'K', color: '#111111' },
      minimax: { text: 'M', color: '#ff4d4d' },
      opencode: { text: 'O', color: '#16a34a' },
      openrouter: { text: 'R', color: '#8b5cf6' },
      codex: { text: 'X', color: '#10a37f' },
    };

    function logoNode(logo, placement) {
      const size = placement.size || 11;
      if (logo && logo.path) {
        const scale = size / 24;
        const offset = 24 * scale;
        return h(
          'g',
          {
            transform:
              'translate(' + (placement.x - offset / 2) + ' ' + (placement.y - offset / 2) + ') scale(' + scale + ')',
            fill: logo.color,
          },
          h('path', { d: logo.path }),
        );
      }
      if (logo && logo.text) {
        return h(
          'text',
          {
            x: placement.x,
            y: placement.y,
            textAnchor: 'middle',
            dominantBaseline: 'central',
            fontSize: size,
            fontWeight: 700,
            fill: logo.color,
          },
          logo.text,
        );
      }
      return null;
    }

    // ── ring style renderers ─────────────────────────────────────────────────

    const RADIUS = 14.4;
    const STROKE = 3.2;

    function toneColor(pct) {
      const p = clampPct(pct);
      if (p === null) return 'var(--dsw-alias-label-tertiary)';
      if (p >= 50) return 'var(--dsw-alias-state-success-primary)';
      if (p >= 20) return 'var(--dsw-alias-state-warn-primary)';
      return 'var(--dsw-alias-state-error-primary)';
    }

    function baseSvg(props, children) {
      return h(
        'svg',
        {
          className: 'dqr__ring',
          viewBox: '0 0 36 36',
          width: props.size,
          height: props.size,
          'aria-hidden': true,
        },
        children,
      );
    }

    function centerText(text, fontSize) {
      return h(
        'text',
        {
          className: 'dqr__center',
          x: 18,
          y: 18,
          textAnchor: 'middle',
          dominantBaseline: 'central',
          fontSize: fontSize || 11.5,
        },
        text,
      );
    }

    function SvgDuo(pct, size, mc) {
      const circumference = 2 * Math.PI * RADIUS;
      const gapDeg = 64;
      const gapLength = (gapDeg / 360) * circumference;
      const usable = circumference - gapLength;
      const ratio = clampPct(pct) === null ? 0 : clampPct(pct) / 100;
      const arcLength = Math.max(ratio * usable, 0);
      const rotation = -90 + gapDeg / 2;
      return baseSvg({ size }, [
        h('circle', {
          className: 'dqr__track',
          cx: 18, cy: 18, r: RADIUS, fill: 'none', strokeWidth: STROKE,
          strokeDasharray: usable + ' ' + (circumference - usable),
          transform: 'rotate(' + rotation + ' 18 18)',
        }),
        h('circle', {
          className: 'dqr__arc',
          cx: 18, cy: 18, r: RADIUS, fill: 'none',
          stroke: toneColor(pct), strokeWidth: STROKE, strokeLinecap: 'round',
          strokeDasharray: arcLength + ' ' + (circumference - arcLength),
          transform: 'rotate(' + rotation + ' 18 18)',
        }),
        mc({ x: 18, y: 18, size: 11, fontSize: 11.5 }),
      ]);
    }

    function SvgRing(pct, size, mc) {
      const circumference = 2 * Math.PI * RADIUS;
      const ratio = clampPct(pct) === null ? 0 : clampPct(pct) / 100;
      const arcLength = Math.max(ratio * circumference, 0);
      return baseSvg({ size }, [
        h('circle', {
          className: 'dqr__track', cx: 18, cy: 18, r: RADIUS, fill: 'none', strokeWidth: STROKE,
        }),
        h('circle', {
          className: 'dqr__arc', cx: 18, cy: 18, r: RADIUS, fill: 'none',
          stroke: toneColor(pct), strokeWidth: STROKE, strokeLinecap: 'round',
          strokeDasharray: arcLength + ' ' + (circumference - arcLength),
          transform: 'rotate(-90 18 18)',
        }),
        mc({ x: 18, y: 18, size: 11, fontSize: 11.5 }),
      ]);
    }

    function SvgSegments(pct, size, mc) {
      const circumference = 2 * Math.PI * RADIUS;
      const count = 10;
      const segment = circumference / count;
      const gapPx = 2.6;
      const lit = clampPct(pct) === null ? 0 : Math.round((clampPct(pct) / 100) * count);
      const children = [];
      for (let i = 0; i < count; i++) {
        children.push(
          h('circle', {
            key: 'seg' + i,
            cx: 18, cy: 18, r: RADIUS, fill: 'none',
            stroke: i < lit ? toneColor(pct) : 'var(--dsw-alias-border-l2)',
            strokeWidth: STROKE, strokeLinecap: 'round',
            opacity: i < lit ? 1 : 0.65,
            strokeDasharray: segment - gapPx + ' ' + (circumference - segment + gapPx),
            transform: 'rotate(' + (-90 + i * (360 / count)) + ' 18 18)',
          }),
        );
      }
      children.push(mc({ x: 18, y: 18, size: 11, fontSize: 11.5 }));
      return baseSvg({ size }, children);
    }

    function SvgGauge(pct, size, mc) {
      const radius = 12;
      const centerX = 18;
      const centerY = 22;
      const p = clampPct(pct);
      const children = [
        h('path', {
          className: 'dqr__track',
          d: 'M ' + (centerX - radius) + ' ' + centerY + ' A ' + radius + ' ' + radius + ' 0 0 1 ' + (centerX + radius) + ' ' + centerY,
          fill: 'none', strokeWidth: STROKE, strokeLinecap: 'round',
        }),
      ];
      if (p !== null && p > 0) {
        const endAngle = 180 - 1.8 * p;
        const rad = (endAngle * Math.PI) / 180;
        const endX = centerX + radius * Math.cos(rad);
        const endY = centerY - radius * Math.sin(rad);
        children.push(
          h('path', {
            className: 'dqr__arc',
            d: 'M ' + (centerX - radius) + ' ' + centerY + ' A ' + radius + ' ' + radius + ' 0 0 1 ' + endX + ' ' + endY,
            fill: 'none', stroke: toneColor(pct), strokeWidth: STROKE, strokeLinecap: 'round',
          }),
        );
      }
      children.push(mc({ x: centerX, y: 32.5, size: 9, fontSize: 10 }));
      return baseSvg({ size }, children);
    }

    function SvgBattery(pct, size) {
      const p = clampPct(pct);
      const fillWidth = p === null ? 0 : Math.max((p / 100) * 21, p > 0 ? 2.5 : 0);
      return baseSvg({ size }, [
        h('rect', {
          x: 3.5, y: 12, width: 25, height: 12.5, rx: 3.5,
          fill: 'none', stroke: 'var(--dsw-alias-border-l2)', strokeWidth: 2.5, opacity: 0.65,
        }),
        h('rect', {
          x: 30.5, y: 15, width: 3, height: 6.5, rx: 1.2,
          fill: 'var(--dsw-alias-border-l2)', opacity: 0.65,
        }),
        h('rect', {
          x: 5.5, y: 14, width: fillWidth, height: 8.5, rx: 2,
          fill: toneColor(pct),
          className: 'dqr__arc',
        }),
      ]);
    }

    function SvgDouble(pct, size, mc) {
      const circumference = 2 * Math.PI * RADIUS;
      const innerRadius = 9.5;
      const innerCircumference = 2 * Math.PI * innerRadius;
      const ratio = clampPct(pct) === null ? 0 : clampPct(pct) / 100;
      const arcLength = Math.max(ratio * circumference, 0);
      const usedRatio = clampPct(pct) === null ? 0 : 1 - ratio;
      const usedLength = Math.max(usedRatio * innerCircumference, 0);
      return baseSvg({ size }, [
        h('circle', {
          className: 'dqr__track', cx: 18, cy: 18, r: RADIUS, fill: 'none', strokeWidth: STROKE,
        }),
        h('circle', {
          className: 'dqr__arc', cx: 18, cy: 18, r: RADIUS, fill: 'none',
          stroke: toneColor(pct), strokeWidth: STROKE, strokeLinecap: 'round',
          strokeDasharray: arcLength + ' ' + (circumference - arcLength),
          transform: 'rotate(-90 18 18)',
        }),
        h('circle', {
          className: 'dqr__track', cx: 18, cy: 18, r: innerRadius, fill: 'none',
          strokeWidth: 2.5, opacity: 0.5,
        }),
        h('circle', {
          className: 'dqr__arc', cx: 18, cy: 18, r: innerRadius, fill: 'none',
          stroke: 'var(--dsw-alias-label-tertiary)', strokeWidth: 2.5, strokeLinecap: 'round', opacity: 0.8,
          strokeDasharray: usedLength + ' ' + (innerCircumference - usedLength),
          transform: 'rotate(-90 18 18)',
        }),
        mc({ x: 18, y: 18, size: 9, fontSize: 8.5 }),
      ]);
    }

    const RENDERERS = {
      duo: SvgDuo,
      ring: SvgRing,
      segments: SvgSegments,
      gauge: SvgGauge,
      battery: SvgBattery,
      double: SvgDouble,
    };

    function RingArt(props) {
      const renderer = RENDERERS[props.style] || SvgDuo;
      const logo = props.logoFamily ? LOGOS[props.logoFamily] : null;
      const makeCenter = function (placement) {
        if (logo) return logoNode(logo, placement);
        return centerText(props.centerText, placement.fontSize);
      };
      return renderer(props.pct, props.size, makeCenter);
    }

    // ── session data cache (localStorage) ────────────────────────────────────

    function readCache() {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    }

    function writeCache(sessionId, data) {
      try {
        const all = readCache();
        const key = sessionId || '__global__';
        all[key] = { data, at: Date.now() };
        const keys = Object.keys(all);
        if (keys.length > 12) {
          keys.sort((a, b) => (all[a].at || 0) - (all[b].at || 0));
          for (const stale of keys.slice(0, keys.length - 12)) delete all[stale];
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(all));
      } catch {
        // Storage may be unavailable; the in-memory state still works.
      }
    }

    function cachedFor(sessionId) {
      const entry = readCache()[sessionId || '__global__'];
      if (!entry || !entry.data || typeof entry.data !== 'object') return null;
      return entry.data;
    }

    function buildTooltip(item, t) {
      const lines = [];
      lines.push(item.label || item.family || '—');
      if (item.kind === 'quota' && Array.isArray(item.windows)) {
        for (const win of item.windows) {
          const label = windowLabel(win.key, win.label, t);
          const cd = countdown(win.resetsAt);
          let line = label + '：' + t('left') + ' ' + fmtPct(win.remainingPct);
          if (cd) line += '，' + t('reset') + ' ' + cd;
          lines.push(line);
        }
      } else if (item.kind === 'cash') {
        lines.push(t('cash') + '：' + fmtMoney(item.currency, item.remaining));
        if (toNum(item.total) !== null) lines.push(t('total') + '：' + fmtMoney(item.currency, item.total));
        if (toNum(item.spent) !== null) lines.push(t('spent') + '：' + fmtMoney(item.currency, item.spent));
        if (toNum(item.toppedUp) !== null) lines.push(t('toppedUp') + '：' + fmtMoney(item.currency, item.toppedUp));
        if (toNum(item.granted) !== null && toNum(item.granted) > 0) {
          lines.push(t('thrown') + '：' + fmtMoney(item.currency, item.granted));
        }
      }
      if (item.note === 'estimated') lines.push(t('estimated'));
      if (item.note === 'unavailable') lines.push(t('unavailable'));
      if (item.error) lines.push(t('error') + '：' + item.error);
      if (item.updatedAt) lines.push(t('updated') + ' ' + fmtClock(item.updatedAt));
      return lines.join('\n');
    }

    function RingChip(props) {
      const item = props.item;
      const t = props.t;
      const isCurrent = props.isCurrent;
      const stale = props.stale;
      const pct = clampPct(item.remainingPct);
      const isCash = item.kind === 'cash';
      const centerTextValue = isCash ? currencySymbol(item.currency) : pct === null ? '—' : String(Math.round(pct));

      if (item.error && !item.kind) {
        return h(
          'span',
          {
            className: 'dqr dqr--error' + (stale ? ' dqr--stale' : ''),
            title: (item.label || '') + '\n' + t('error') + '：' + item.error,
            'aria-label': (item.label || '') + ' ' + t('error'),
            role: 'button',
            'aria-haspopup': 'dialog',
            onClick: props.onToggle,
          },
          isCurrent ? h('span', { className: 'dqr__dot' }) : null,
          h('span', { className: 'dqr__label' }, item.label || 'AI'),
          h('span', { className: 'dqr__value' }, t('error')),
        );
      }

      const valueText = isCash ? fmtMoney(item.currency, item.remaining) : pct === null ? '—' : fmtPct(pct);
      const tooltip = buildTooltip(item, t);
      const title = isCurrent ? tooltip + '\n— ' + t('current') : tooltip;

      return h(
        'span',
        {
          className: 'dqr' + (stale ? ' dqr--stale' : ''),
          title: title,
          'aria-label': (item.label || '') + ' ' + (isCash ? t('cash') : t('left')) + ' ' + valueText,
          role: 'button',
          'aria-haspopup': 'dialog',
          'aria-expanded': props.panelOpen ? 'true' : 'false',
          onClick: props.onToggle,
        },
        isCurrent ? h('span', { className: 'dqr__dot' }) : null,
        h(RingArt, { style: props.style, pct, size: 26, centerText: centerTextValue, logoFamily: item.family }),
        h('span', { className: 'dqr__label' }, item.label || 'AI'),
        h('span', { className: 'dqr__value' }, valueText),
      );
    }

    // ── preferences panel (shared by popover and plugin settings page) ───────

    function Switch(props) {
      return h(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': props.checked ? 'true' : 'false',
          'aria-label': props.label,
          className: 'dqr-switch',
          onClick: props.onToggle,
        },
        h('span', { className: 'dqr-switch__knob' }),
      );
    }

    function PrefsPanel(props) {
      const t = props.t;
      const variant = props.variant || 'popover';
      const [, force] = React.useState(0);
      React.useEffect(function () {
        return subscribePrefs(function () {
          force(function (x) {
            return x + 1;
          });
        });
      }, []);

      const families = [];
      for (const [family, label] of familyRegistry.entries()) families.push({ family, label });

      const head = h(
        'div',
        { className: 'dqr-panel__head' },
        h('span', null, t('panel.title')),
        variant === 'popover'
          ? h(
              'button',
              { type: 'button', className: 'dqr-panel__close', onClick: props.onClose, 'aria-label': 'Close' },
              '✕',
            )
          : null,
      );

      if (families.length === 0) {
        return h(
          'div',
          { className: variant === 'popover' ? 'dqr-pop' : 'dqr-card' },
          head,
          h('div', { className: 'dqr-panel__empty' }, t('panel.empty')),
        );
      }

      const rows = families.map(function (entry) {
        const pref = familyPref(entry.family);
        const styleButtons = STYLE_IDS.map(function (styleId) {
          return h(
            'button',
            {
              key: styleId,
              type: 'button',
              className: 'dqr-stylebtn' + (pref.style === styleId ? ' dqr-stylebtn--on' : ''),
              title: t('style.' + styleId),
              'aria-pressed': pref.style === styleId ? 'true' : 'false',
              onClick: function () {
                setFamilyPref(entry.family, { style: styleId });
              },
            },
            h(RingArt, { style: styleId, pct: 62, size: 22, centerText: '62' }),
            h('span', null, t('style.' + styleId)),
          );
        });
        return h(
          'div',
          { key: entry.family, className: 'dqr-fam' + (pref.enabled ? '' : ' dqr-fam--off') },
          h(
            'span',
            { className: 'dqr-fam__name' },
            entry.isCurrent ? h('span', { className: 'dqr-fam__dot', title: t('current') }) : null,
            entry.label,
          ),
          h(Switch, {
            checked: pref.enabled,
            label: entry.label + ' · ' + t('panel.show'),
            onToggle: function () {
              setFamilyPref(entry.family, { enabled: !pref.enabled });
            },
          }),
          h('span', { className: 'dqr-fam__styles' }, styleButtons),
          BILLING_URLS[entry.family]
            ? h(
                'a',
                {
                  className: 'dqr-fam__link',
                  href: BILLING_URLS[entry.family],
                  target: '_blank',
                  rel: 'noreferrer',
                  title: entry.label + ' · ' + t('panel.billing'),
                  'aria-label': entry.label + ' ' + t('panel.billing'),
                },
                '↗',
              )
            : null,
        );
      });

      return h(
        'div',
        { className: variant === 'popover' ? 'dqr-pop' : 'dqr-card' },
        head,
        rows,
        h('div', { className: 'dqr-panel__hint' }, t('panel.hint')),
      );
    }

    // ── gear button + popover in the dock row ────────────────────────────────

    function GearIcon() {
      return h(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 16 16', 'aria-hidden': true, fill: 'none' },
        h('circle', { cx: 8, cy: 8, r: 2.4, stroke: 'currentColor', strokeWidth: 1.5 }),
        h('path', {
          d: 'M8 1.6v2M8 12.4v2M1.6 8h2M12.4 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M12.5 3.5l-1.4 1.4M4.9 11.1l-1.4 1.4',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
        }),
      );
    }

    // ── dock component ───────────────────────────────────────────────────────

    function QuotaRings(props) {
      const t = props.t;
      const sessionId = props.sessionId ? String(props.sessionId) : '';
      const [view, setView] = React.useState(() => {
        const cached = cachedFor(sessionId);
        return cached
          ? { data: cached, fresh: false, forSession: sessionId }
          : { data: null, fresh: false, forSession: sessionId };
      });
      const [, force] = React.useState(0);
      React.useEffect(function () {
        return subscribePrefs(function () {
          force(function (x) {
            return x + 1;
          });
        });
      }, []);

      // Style panel: expands IN FLOW above the ring row (no fixed positioning, so no
      // containing-block or clipping issues inside the docked composer).
      const [panel, setPanel] = React.useState(false);
      const panelRef = React.useRef(null);
      const rowRef = React.useRef(null);

      function togglePanelFor() {
        setPanel(function (prev) {
          return !prev;
        });
      }

      React.useEffect(function () {
        if (!panel) return;
        function onDown(event) {
          const target = event.target;
          if (target instanceof Node) {
            if (panelRef.current && panelRef.current.contains(target)) return;
            if (rowRef.current && rowRef.current.contains(target)) return;
          }
          setPanel(false);
        }
        function onKey(event) {
          if (event.key === 'Escape') setPanel(false);
        }
        window.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onKey);
        return function () {
          window.removeEventListener('mousedown', onDown);
          window.removeEventListener('keydown', onKey);
        };
      }, [panel]);

      React.useEffect(
        function () {
          let alive = true;
          const cached = cachedFor(sessionId);
          // Seed the family registry from the cache so the panel is configurable
          // even before (or without) a successful poll in this page load.
          if (cached && Array.isArray(cached.items)) registerFamilies(cached.items);
          setView({ data: cached, fresh: false, forSession: sessionId });

          function load() {
            const qs = sessionId ? '?sessionId=' + encodeURIComponent(sessionId) : '';
            fetch('/dsh-quota-ring/status' + qs)
              .then(function (response) {
                return response.json();
              })
              .then(function (data) {
                if (!alive || !data || data.ok !== true || !Array.isArray(data.items)) return;
                registerFamilies(data.items);
                writeCache(sessionId, data);
                setView({ data: data, fresh: true, forSession: sessionId });
              })
              .catch(function () {
                if (!alive) return;
                if (cached && Array.isArray(cached.items)) registerFamilies(cached.items);
                setView(function (prev) {
                  if (prev && prev.data) return { data: prev.data, fresh: false, forSession: prev.forSession };
                  return prev;
                });
              });
          }

          load();
          const timer = setInterval(load, POLL_MS);
          return function () {
            alive = false;
            clearInterval(timer);
          };
        },
        [sessionId],
      );

      const data = view.data;
      if (!data || !Array.isArray(data.items) || data.items.length === 0) return null;

      const stale = !view.fresh || view.forSession !== sessionId;
      const currentFamily = data.current && data.current.family ? data.current.family : null;
      const visible = data.items.filter(function (item) {
        return familyPref(item.family).enabled;
      });

      const gear = h(
        'button',
        {
          key: 'gear',
          type: 'button',
          className: 'dqr__gear' + (panel ? ' dqr__gear--on' : ''),
          onClick: togglePanelFor,
          'aria-expanded': panel ? 'true' : 'false',
          'aria-haspopup': 'dialog',
          'aria-label': t('panel.title'),
          title: t('panel.title'),
        },
        h(GearIcon),
      );

      // In-flow layout: the panel expands as a normal block above the ring row, so the
      // docked composer cannot clip or misplace it, and no portal is needed.
      return h(
        'span',
        { className: 'dqr-wrap', ref: rowRef },
        panel
          ? h(
              'div',
              { ref: panelRef, role: 'dialog', className: 'dqr-pop dqr-pop--flow' },
              h(PrefsPanel, { t: t, variant: 'popover', onClose: function () { setPanel(false); } }),
            )
          : null,
        h(
          'span',
          { className: 'dqr-row' },
          visible.map(function (item) {
            return h(RingChip, {
              key: item.family || item.label,
              item: item,
              style: familyPref(item.family).style,
              t: t,
              isCurrent: item.family === currentFamily,
              stale: stale,
              panelOpen: panel,
              onToggle: togglePanelFor,
            });
          }),
          visible.length === 0 ? h('span', { className: 'dqr__value' }, t('title')) : null,
          gear,
        ),
      );
    }

    // ── plugin wiring ────────────────────────────────────────────────────────

    function apply(ctx) {
      ensureStyle();
      const t = ctx.locale.bind(NS);
      ctx.effect(
        function () {
          const disposeZh = ctx.locale.register(NS, 'zh', ZH);
          const disposeEn = ctx.locale.register(NS, 'en', EN);
          return function () {
            disposeZh();
            disposeEn();
          };
        },
        'dsh-quota-ring: locale dictionaries',
      );

      ctx.slots.inject('conversation.composer.dock', function () {
        return ctx.slots.register(
          {
            name: 'conversation.composer.dock',
            id: 'quota-ring',
            order: 2,
            label: 'Quota',
          },
          function (props) {
            return h(QuotaRings, { sessionId: props && props.sessionId, t: t });
          },
        );
      });

      // The plugin's own configuration card on its Settings → Plugins page.
      ctx.slots.inject('plugins.bundle.config', function () {
        return ctx.slots.register(
          {
            name: 'plugins.bundle.config',
            key: PKG,
            locale: NS,
          },
          function () {
            return h(PrefsPanel, { t: t, variant: 'card' });
          },
        );
      });
    }

    return {
      id: PKG,
      inject: ['slots', 'locale'],
      apply: apply,
      __internals: { RENDERERS, registerFamilies, familyPref, setFamilyPref, LOGOS, logoNode },
    };
  },
});
