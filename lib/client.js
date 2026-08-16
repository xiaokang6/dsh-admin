// dsh-admin — Client half (web module bundle, ModuleLoader format).
// 嵌入形态：
//   1) 右上角入口：conversation.session.header.utilities（会话头部右侧工具区，
//      与 session-log-download 并排，互不遮挡；不是 fixed 悬浮层，不压任何内容）。
//      入口显示版本状态圆点 + 版本号，点击浮出管理面板（fixed 定位在头部下方，
//      仅点击时出现）。
//   2) 设置页「DSH 管理」：settings.section（设置 → DSH 管理，完整面板）。
// 后端路由由 lib/index.js（Host half）提供 /plugin/dshadmin/{status,health,check,restart}。
window.__ModuleLoader__.load({
  id: 'dsh-admin',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    let react = require('react');

    // ── 样式注入（幂等）──────────────────────────────────────────
    if (
      typeof document !== 'undefined' &&
      document.querySelector('style[data-plugin-css="dsh-admin"]') === null
    ) {
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-admin';
      tag.dataset.pluginCss = 'dsh-admin';
      tag.textContent =
        '.dsa_headerBtn{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;' +
        'background:var(--dsw-alias-bg-layer-2,#374151);color:var(--dsw-alias-label-primary,#f3f4f6);' +
        'border:1px solid var(--dsw-alias-border-l1,#4b5563);font-size:12px;cursor:pointer;user-select:none;' +
        'white-space:nowrap;pointer-events:auto}' +
        '.dsa_headerBtn:hover{border-color:var(--dsw-alias-brand-primary,#4f8cff)}' +
        '.dsa_panel{z-index:40;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);width:400px;max-width:calc(100vw - 24px);max-height:74vh;box-shadow:var(--dsw-shadow-lv2);border-radius:12px;flex-direction:column;display:flex;position:fixed;top:48px;right:12px;overflow:hidden}' +
        '.dsa_header{box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);flex:none;justify-content:space-between;align-items:center;min-height:44px;padding:10px 12px;display:flex}' +
        '.dsa_headerLeft{align-items:center;gap:8px;display:flex}' +
        '.dsa_headerActions{align-items:center;gap:2px;display:flex}' +
        '.dsa_title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}' +
        '.dsa_iconButton{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}' +
        '.dsa_iconButton:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}' +
        '.dsa_body{box-sizing:border-box;flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}' +
        '.dsa_box{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:4px}' +
        '.dsa_row{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px}' +
        '.dsa_k{color:var(--dsw-alias-label-secondary);flex:none}' +
        '.dsa_v{color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.dsa_hint{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5}' +
        '.dsa_msg{font-size:12px;line-height:1.5;padding:6px 8px;border-radius:6px}' +
        '.dsa_msg.ok{color:#34d399;background:rgba(52,211,153,.1)}' +
        '.dsa_msg.bad{color:#f87171;background:rgba(248,113,113,.1)}' +
        '.dsa_actions{display:flex;gap:8px;align-items:center;margin-top:2px}' +
        '.dsa_btn{background:var(--dsw-alias-bg-layer-2,#374151);color:var(--dsw-alias-label-primary,#f3f4f6);border:1px solid var(--dsw-alias-border-l1,#4b5563);border-radius:6px;padding:4px 12px;font-size:12px;cursor:pointer}' +
        '.dsa_btn:hover{border-color:var(--dsw-alias-brand-primary,#4f8cff)}' +
        '.dsa_btn:disabled{opacity:.5;cursor:default}' +
        '.dsa_btnDanger{background:transparent;color:#f87171;border:1px solid rgba(248,113,113,.6);border-radius:6px;padding:4px 12px;font-size:12px;cursor:pointer}' +
        '.dsa_btnDanger:hover{background:rgba(248,113,113,.12)}' +
        '.dsa_btnDanger:disabled{opacity:.5;cursor:default}' +
        '.dsa_dot{width:8px;height:8px;border-radius:50%;flex:none;display:inline-block}' +
        '.dsa_page{display:flex;flex-direction:column;gap:10px;max-width:640px}';
      document.head.appendChild(tag);
    }

    // ── i18n 词典（与 usage-stats/update-checker 相同的注册模式）──
    const NS = 'dsh-admin';
    const ZH = {
      'entry.label': 'DSH 管理',
      'panel.title': 'DSH 管理',
      'panel.status': '版本状态',
      'panel.current': '当前版本',
      'panel.latest': 'npm 最新',
      'panel.checked': '上次检查',
      'panel.check': '立即检查',
      'panel.checking': '检查中…',
      'panel.pid': '进程 PID',
      'panel.mgr': '托管方式',
      'panel.mgrSystemd': 'systemd（dsh.service）',
      'panel.mgrManual': '手动进程',
      'panel.restartCmd': '重启方式',
      'panel.restartHint': '重启会短暂中断 Harness 服务与当前会话（约 5–15 秒恢复），走本机惯例命令 dsh-plugin-op restart。',
      'panel.restart': '重启 DeepSeek Harness',
      'panel.close': '关闭',
      'state.checking': '检查中…',
      'state.latest': '已是最新',
      'state.update': '有新版本',
      'state.fail': '检查失败',
      'state.unknown': '未知',
      'msg.checkDone': '检查完成',
      'msg.restartSent': '重启已发送，服务将短暂中断，请在约 15 秒后刷新页面…',
      'msg.restartScheduled': '重启已调度',
      'msg.loadFail': '加载失败：',
      'confirm.restart1': '确认重启 DeepSeek Harness？服务将中断数秒。',
      'confirm.restart2': '再次确认：现在执行重启？',
    };
    const EN = {
      'entry.label': 'DSH Admin',
      'panel.title': 'DSH Admin',
      'panel.status': 'Status',
      'panel.current': 'Current version',
      'panel.latest': 'npm latest',
      'panel.checked': 'Last check',
      'panel.check': 'Check now',
      'panel.checking': 'Checking…',
      'panel.pid': 'PID',
      'panel.mgr': 'Managed by',
      'panel.mgrSystemd': 'systemd (dsh.service)',
      'panel.mgrManual': 'manual process',
      'panel.restartCmd': 'Restart via',
      'panel.restartHint': 'Restart briefly interrupts the Harness service (5–15s). Uses the local dsh-plugin-op restart command.',
      'panel.restart': 'Restart DeepSeek Harness',
      'panel.close': 'Close',
      'state.checking': 'Checking…',
      'state.latest': 'Up to date',
      'state.update': 'Update available',
      'state.fail': 'Check failed',
      'state.unknown': 'Unknown',
      'msg.checkDone': 'Check complete',
      'msg.restartSent': 'Restart sent; the page will reload in ~15s…',
      'msg.restartScheduled': 'Restart scheduled',
      'msg.loadFail': 'Load failed: ',
      'confirm.restart1': 'Restart DeepSeek Harness? The service will drop for a few seconds.',
      'confirm.restart2': 'Confirm again: restart now?',
    };

    function fallbackT(key) {
      return ZH[key] !== undefined ? ZH[key] : key;
    }

    // ── 常量与工具 ───────────────────────────────────────────────
    const BASE = '/plugin/dshadmin';
    const CHECK_INTERVAL = 60 * 60 * 1000; // 客户端 1 小时复查一次（Host 每 6h 自动查）

    function fmtTime(t) {
      if (!t) return '—';
      return new Date(t).toLocaleString('zh-CN', { hour12: false });
    }

    function fetchStatus(force) {
      return fetch(BASE + '/status' + (force ? '?fresh=1' : ''), { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('HTTP ' + res.status))));
    }

    function postJson(url, extra) {
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ confirm: true }, extra || {})),
      }).then((res) => res.json());
    }

    // 状态徽章：loading=0 最新=1 有更新=2 失败=3 未知=4
    function badgeOf(data, loading, error, t) {
      if (loading) return { text: t('state.checking'), cls: '#9ca3af' };
      if (error || (data && data.error)) return { text: t('state.fail'), cls: '#f87171' };
      if (data && data.isNewer) return { text: t('state.update'), cls: '#f5b53a' };
      if (data && data.latest) return { text: t('state.latest'), cls: '#3ddc84' };
      return { text: t('state.unknown'), cls: '#9ca3af' };
    }

    // ═══════════════ 右上角入口 + 浮出面板 ═══════════════
    function AdminHeaderButton() {
      const t = fallbackT;
      const [open, setOpen] = react.useState(false);
      const [data, setData] = react.useState(null);
      const [loading, setLoading] = react.useState(true);
      const [error, setError] = react.useState(null);
      const [msg, setMsg] = react.useState(null);

      const load = (force) => {
        setLoading(true);
        fetchStatus(force)
          .then((d) => { setData(d); setError(null); })
          .catch((e) => setError(String(e && e.message ? e.message : e)))
          .finally(() => setLoading(false));
      };

      react.useEffect(() => {
        load(false);
        const timer = setInterval(() => load(false), CHECK_INTERVAL);
        return () => clearInterval(timer);
      }, []);

      const doCheck = () => {
        postJson(BASE + '/check')
          .then((d) => {
            setData({ ...(data || {}), ...d });
            setError(d.error || null);
            setMsg({ ok: !d.error, text: d.error ? t('state.fail') + '：' + d.error : t('msg.checkDone') });
          })
          .catch((e) => setMsg({ ok: false, text: String(e && e.message ? e.message : e) }));
      };

      const doRestart = () => {
        if (typeof window === 'undefined') return;
        if (!window.confirm(t('confirm.restart1'))) return;
        if (!window.confirm(t('confirm.restart2'))) return;
        setMsg({ ok: true, text: t('msg.restartSent') });
        postJson(BASE + '/restart')
          .then((r) => {
            if (!r || !r.ok) throw new Error((r && (r.msg || r.error)) || 'restart failed');
            setMsg({ ok: true, text: r.message || t('msg.restartScheduled') });
          })
          .catch((e) => setMsg({ ok: false, text: String(e && e.message ? e.message : e) }));
      };

      const b = badgeOf(data, loading, error, t);
      const el = react.createElement;
      const v = data && data.current ? data.current : '';

      return el('div', null,
        el('button', {
          type: 'button',
          className: 'dsa_headerBtn',
          title: t('panel.title') + '（点击展开）',
          'aria-label': t('panel.title'),
          onClick: () => setOpen((value) => !value),
        },
          el('span', { className: 'dsa_dot', style: { background: b.cls } }, null),
          v),
        open
          ? el('section', { className: 'dsa_panel', 'data-dsh-admin-panel': true, 'aria-label': t('panel.title') },
              el('header', { className: 'dsa_header' },
                el('div', { className: 'dsa_headerLeft' },
                  el('span', { className: 'dsa_dot', style: { background: b.cls } }, null),
                  el('span', { className: 'dsa_title' }, t('panel.title'))),
                el('div', { className: 'dsa_headerActions' },
                  el('button', {
                    type: 'button',
                    className: 'dsa_iconButton',
                    'aria-label': t('panel.close'),
                    title: t('panel.close'),
                    onClick: () => setOpen(false),
                  }, '✕'))),
              el('div', { className: 'dsa_body' },
                el('div', { className: 'dsa_box' },
                  el('div', { className: 'dsa_row' },
                    el('span', { className: 'dsa_k' }, t('panel.status')),
                    el('span', { className: 'dsa_v', style: { color: b.cls, fontWeight: 600 } }, b.text)),
                  el('div', { className: 'dsa_row' },
                    el('span', { className: 'dsa_k' }, t('panel.current')),
                    el('span', { className: 'dsa_v' }, data && data.current ? data.current : '—')),
                  el('div', { className: 'dsa_row' },
                    el('span', { className: 'dsa_k' }, t('panel.latest')),
                    el('span', { className: 'dsa_v' }, data && data.latest ? data.latest : '—')),
                  el('div', { className: 'dsa_row' },
                    el('span', { className: 'dsa_k' }, t('panel.checked')),
                    el('span', { className: 'dsa_v' }, data && data.lastCheckedAt ? fmtTime(data.lastCheckedAt) : '—')),
                  el('div', { className: 'dsa_actions' },
                    el('button', { type: 'button', className: 'dsa_btn', onClick: doCheck, disabled: loading }, loading ? t('panel.checking') : t('panel.check')))),
                el('div', { className: 'dsa_box' },
                  el('div', { className: 'dsa_row' },
                    el('span', { className: 'dsa_k' }, t('panel.pid')),
                    el('span', { className: 'dsa_v' }, data && data.service ? String(data.service.pid) : '—')),
                  el('div', { className: 'dsa_row' },
                    el('span', { className: 'dsa_k' }, t('panel.mgr')),
                    el('span', { className: 'dsa_v' }, data && data.service ? (data.service.managedBySystemd ? t('panel.mgrSystemd') : t('panel.mgrManual')) : '—')),
                  el('div', { className: 'dsa_row' },
                    el('span', { className: 'dsa_k' }, t('panel.restartCmd')),
                    el('span', { className: 'dsa_v' }, data && data.service ? data.service.restartCommand : '—'))),
                msg ? el('div', { className: 'dsa_msg ' + (msg.ok ? 'ok' : 'bad') }, msg.text) : null,
                error && !msg ? el('div', { className: 'dsa_msg bad' }, t('msg.loadFail') + error) : null,
                el('div', { className: 'dsa_box' },
                  el('div', { className: 'dsa_hint' }, t('panel.restartHint')),
                  el('div', { className: 'dsa_actions', style: { marginTop: 6 } },
                    el('button', { type: 'button', className: 'dsa_btnDanger', onClick: doRestart }, t('panel.restart'))))))
          : null);
    }

    // ═══════════════ 设置页「DSH 管理」═══════════════
    function AdminSettingsPage(props) {
      const t = (props && props.t) || fallbackT;
      const [data, setData] = react.useState(null);
      const [loading, setLoading] = react.useState(true);
      const [error, setError] = react.useState(null);
      const [msg, setMsg] = react.useState(null);

      const load = (force) => {
        setLoading(true);
        fetchStatus(force)
          .then((d) => { setData(d); setError(null); })
          .catch((e) => setError(String(e && e.message ? e.message : e)))
          .finally(() => setLoading(false));
      };

      react.useEffect(() => { load(false); }, []);

      const doCheck = () => {
        postJson(BASE + '/check')
          .then((d) => {
            setData({ ...(data || {}), ...d });
            setError(d.error || null);
            setMsg({ ok: !d.error, text: d.error ? t('state.fail') + '：' + d.error : t('msg.checkDone') });
          })
          .catch((e) => setMsg({ ok: false, text: String(e && e.message ? e.message : e) }));
      };

      const doRestart = () => {
        if (typeof window === 'undefined') return;
        if (!window.confirm(t('confirm.restart1'))) return;
        if (!window.confirm(t('confirm.restart2'))) return;
        setMsg({ ok: true, text: t('msg.restartSent') });
        postJson(BASE + '/restart')
          .then((r) => {
            if (!r || !r.ok) throw new Error((r && (r.msg || r.error)) || 'restart failed');
            setMsg({ ok: true, text: r.message || t('msg.restartScheduled') });
          })
          .catch((e) => setMsg({ ok: false, text: String(e && e.message ? e.message : e) }));
      };

      const b = badgeOf(data, loading, error, t);
      const el = react.createElement;

      return el('div', { className: 'dsa_page' },
        el('div', { className: 'dsa_box' },
          el('div', { className: 'dsa_title' }, t('panel.status')),
          el('div', { className: 'dsa_row' },
            el('span', { className: 'dsa_k' }, t('panel.status')),
            el('span', { className: 'dsa_v', style: { color: b.cls, fontWeight: 600 } }, b.text)),
          el('div', { className: 'dsa_row' },
            el('span', { className: 'dsa_k' }, t('panel.current')),
            el('span', { className: 'dsa_v' }, data && data.current ? data.current : '—')),
          el('div', { className: 'dsa_row' },
            el('span', { className: 'dsa_k' }, t('panel.latest')),
            el('span', { className: 'dsa_v' }, data && data.latest ? data.latest : '—')),
          el('div', { className: 'dsa_row' },
            el('span', { className: 'dsa_k' }, t('panel.checked')),
            el('span', { className: 'dsa_v' }, data && data.lastCheckedAt ? fmtTime(data.lastCheckedAt) : '—')),
          el('div', { className: 'dsa_actions' },
            el('button', { type: 'button', className: 'dsa_btn', onClick: doCheck, disabled: loading }, loading ? t('panel.checking') : t('panel.check')))),
        el('div', { className: 'dsa_box' },
          el('div', { className: 'dsa_title' }, t('panel.pid') + ' / ' + t('panel.mgr')),
          el('div', { className: 'dsa_row' },
            el('span', { className: 'dsa_k' }, t('panel.pid')),
            el('span', { className: 'dsa_v' }, data && data.service ? String(data.service.pid) : '—')),
          el('div', { className: 'dsa_row' },
            el('span', { className: 'dsa_k' }, t('panel.mgr')),
            el('span', { className: 'dsa_v' }, data && data.service ? (data.service.managedBySystemd ? t('panel.mgrSystemd') : t('panel.mgrManual')) : '—')),
          el('div', { className: 'dsa_row' },
            el('span', { className: 'dsa_k' }, t('panel.restartCmd')),
            el('span', { className: 'dsa_v' }, data && data.service ? data.service.restartCommand : '—'))),
        msg ? el('div', { className: 'dsa_msg ' + (msg.ok ? 'ok' : 'bad') }, msg.text) : null,
        error && !msg ? el('div', { className: 'dsa_msg bad' }, t('msg.loadFail') + error) : null,
        el('div', { className: 'dsa_box' },
          el('div', { className: 'dsa_title' }, t('panel.restart')),
          el('div', { className: 'dsa_hint' }, t('panel.restartHint')),
          el('div', { className: 'dsa_actions', style: { marginTop: 8 } },
            el('button', { type: 'button', className: 'dsa_btnDanger', onClick: doRestart }, t('panel.restart')))));
    }

    // ── 注册到 slots（模式与 dsh-usage-stats 完全一致）──
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'dsh-admin: dictionaries');
      ctx.inject(['slots'], (scope) => {
        // 右上角入口：会话头部右侧工具区，与 session-log-download 并排（互不遮挡）
        scope.slots.inject('conversation.session.header.utilities', () =>
          scope.slots.register({
            name: 'conversation.session.header.utilities',
            id: 'dsh-admin',
            locale: NS,
            order: 20,
          }, AdminHeaderButton)
        );
        // 设置页「DSH 管理」
        scope.slots.inject('settings.section', () =>
          scope.slots.register({
            name: 'settings.section',
            id: 'dsh-admin-settings',
            locale: NS,
            order: 50,
            label: () => fallbackT('entry.label'),
          }, AdminSettingsPage)
        );
      });
    }

    exports.apply = apply;
    exports.inject = ['slots', 'locale'];
    exports.AdminHeaderButton = AdminHeaderButton;
    exports.AdminSettingsPage = AdminSettingsPage;
    return module.exports;
  },
});