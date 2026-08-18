// dsh-admin — Host half.
// 路由：
//   GET  /plugin/dshadmin/status    状态 JSON（当前/最新版本、服务信息、isNewer 判定）
//   GET  /plugin/dshadmin/health    健康检查 {ok:true}
//   POST /plugin/dshadmin/check     立即重新检查版本
//   POST /plugin/dshadmin/update    一键更新 @deepseek-ai/dsh 到 npm latest（body {confirm:true}）
//   POST /plugin/dshadmin/restart   调度重启（body 必须 {confirm:true}）
// 重启优先级：
//   1) systemd-run + dsh-plugin-op restart（本机惯例，独立 cgroup，防被 Stop 连带杀死）
//   2) 直接 dsh-plugin-op restart
//   3) systemctl --no-block restart dsh
//   4) 杀 3080 socket pid + 原参数拉起
// 版本检查：npm registry @deepseek-ai/dsh latest vs 本地 package.json version，
// 用 semver 感知比较（stable > rc；同核心下 rc 号大者新）。默认每 6h 复查一次，
// 环境变量 DSH_ADMIN_CHECK_HOURS 可覆盖间隔。
import { spawn, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

const ROUTE = '/plugin/dshadmin';
const PKG_PATH = '/usr/local/lib/node_modules/@deepseek-ai/dsh/package.json';
const NPM_LATEST = 'https://registry.npmjs.org/@deepseek-ai/dsh/latest';
const PACKAGE = '@deepseek-ai/dsh';
const UNIT = 'dsh';
const CHECK_MS = (Number(process.env.DSH_ADMIN_CHECK_HOURS) || 6) * 3600_000;
const USE_SYSTEMD = existsSync('/run/systemd/system');
// 更新锁：npm install 进行中时拒绝并发请求（10 分钟超时接管）
let updateInFlight = false;
let updateStartedAt = 0;

export const name = 'dsh-admin';
export const inject = ['webServer'];

// ---------------- 状态缓存 ----------------
let state = { current: null, latest: null, lastCheckedAt: 0, error: null };
let startedAt = Date.now();

function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-(?:rc\.)?(\d+))?$/.exec(String(v || '').trim());
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], rc: m[4] != null ? +m[4] : Infinity };
}

/** a 是否比 b 新（stable > rc，同核心下 rc 数字大者新） */
function isNewer(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return a !== b;
  if (pa.major !== pb.major) return pa.major > pb.major;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor;
  if (pa.patch !== pb.patch) return pa.patch > pb.patch;
  return pa.rc > pb.rc;
}

// ---------------- 版本检查 ----------------
async function readCurrentVersion() {
  try {
    const pkg = JSON.parse(await readFile(PKG_PATH, 'utf8'));
    return typeof pkg.version === 'string' && pkg.version ? pkg.version : null;
  } catch {
    return null;
  }
}

async function checkNow() {
  const next = { ...state, error: null };
  try {
    const current = await readCurrentVersion();
    next.current = current;
    const res = await fetch(NPM_LATEST, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`npm registry HTTP ${res.status}`);
    const data = await res.json();
    next.latest = typeof data.version === 'string' ? data.version : null;
    next.lastCheckedAt = Date.now();
    if (!next.latest) throw new Error('npm latest 响应缺少 version 字段');
  } catch (e) {
    next.error = e instanceof Error ? e.message : String(e);
  }
  state = next;
  return next;
}

// ---------------- 服务状态 ----------------
function restartCommandLabel() {
  if (existsSync('/usr/local/bin/dsh-plugin-op') && existsSync('/usr/bin/systemd-run')) {
    return 'systemd-run + dsh-plugin-op restart';
  }
  if (existsSync('/usr/local/bin/dsh-plugin-op')) return 'dsh-plugin-op restart';
  if (USE_SYSTEMD) return `systemctl --no-block restart ${UNIT}`;
  return 'socket-pid kill + relaunch';
}

function serviceInfo() {
  return {
    unit: UNIT,
    managedBySystemd: USE_SYSTEMD,
    pid: process.pid,
    node: process.version,
    platform: process.platform,
    startedAt,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    restartCommand: restartCommandLabel(),
  };
}

// ---------------- HTTP 帮助 ----------------
function json(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(obj));
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let chunks = '';
    req.on('data', (c) => {
      if (chunks.length < 1e6) chunks += c;
    });
    req.on('end', () => {
      if (!chunks.trim()) return resolve({});
      try {
        resolve(JSON.parse(chunks));
      } catch {
        resolve({ parseError: true });
      }
    });
    req.on('error', () => resolve({}));
  });
}

// ---------------- 重启执行 ----------------
function doRestart() {
  const opBin = '/usr/local/bin/dsh-plugin-op';
  if (existsSync(opBin)) {
    if (existsSync('/usr/bin/systemd-run')) {
      // systemd-run 独立 cgroup：dsh.service 是 KillMode=control-group，
      // 直接 spawn dsh-plugin-op 会被其内部的 `systemctl stop dsh` 连带杀死；
      // 包进 transient unit 才能完整跑完（停机→清 3080 孤儿→干净启动→健康验证）。
      const child = spawn('/usr/bin/systemd-run', [
        '--collect',
        `--unit=dsh-admin-restart-${Date.now()}`,
        '--quiet',
        opBin,
        'restart',
      ], { detached: true, stdio: 'ignore' });
      child.unref?.();
      return;
    }
    const child = spawn(opBin, ['restart'], { detached: true, stdio: 'ignore' });
    child.unref?.();
    return;
  }
  if (USE_SYSTEMD) {
    const child = spawn('/usr/bin/systemctl', ['--no-block', 'restart', UNIT], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref?.();
    return;
  }
  const kill = spawn('sh', ['-c', `P=$(ss -ltnp | grep ':3080 ' | grep -oP 'pid=\\K[0-9]+' | head -1); [ -n "$P" ] && kill "$P"`], {
    detached: true,
    stdio: 'ignore',
  });
  kill.unref?.();
  const relaunch = spawn('sh', ['-c', 'sleep 1 && setsid nohup node /usr/local/bin/dsh --profile web --patch /root/dsh-plugins/cordis.yml --host 127.0.0.1 --port 3080 --trusted-host 150.230.99.11 --trusted-host 150.230.99.11:80 --trusted-host 150.230.99.11:3081 --trusted-host dsh.304311.xyz --trusted-host dsh.304311.xyz:443 > /root/dsh-web.log 2>&1 &'], {
    detached: true,
    stdio: 'ignore',
  });
  relaunch.unref?.();
}

// ---------------- 一键更新 ----------------
/**
 * 执行 `npm i -g @deepseek-ai/dsh@latest` 把主程序升级到 npm latest。
 * 带 --allow-scripts 授权原生依赖包（npm 11 要求），--no-audit --no-fund 加速。
 * 成功返回新版本号；失败抛错（含 stderr 摘要）。
 */
async function doUpdate() {
  const allowScripts = '@deepseek-ai/dsh-subprocess-local,koffi,node-pty,@google/genai,protobufjs';
  const { stdout, stderr } = await execFileP('npm', [
    'install', '-g', `${PACKAGE}@latest`,
    `--allow-scripts=${allowScripts}`,
    '--no-audit', '--no-fund',
  ], { timeout: 600_000, maxBuffer: 8 * 1024 * 1024 });
  const installed = await readCurrentVersion();
  return { installed, output: String(stdout || '').trim() + String(stderr || '').trim() };
}

// ---------------- 路由 ----------------
async function handle(req, res, sub, log) {
  if (sub === 'status') {
    let fresh = state;
    if (fresh.lastCheckedAt === 0 || Date.now() - fresh.lastCheckedAt > 600_000) {
      fresh = await checkNow();
    }
    json(res, 200, {
      current: fresh.current,
      latest: fresh.latest,
      lastCheckedAt: fresh.lastCheckedAt,
      error: fresh.error,
      isNewer: fresh.current != null && fresh.latest != null && isNewer(fresh.latest, fresh.current),
      service: serviceInfo(),
    });
    return;
  }
  if (sub === 'health') {
    json(res, 200, { ok: true, uptimeSec: Math.round((Date.now() - startedAt) / 1000) });
    return;
  }
  if (sub === 'check') {
    if (req.method !== 'POST') return json(res, 405, { code: 405, msg: 'Method Not Allowed' });
    const t0 = Date.now();
    const fresh = await checkNow();
    json(res, 200, { ...fresh, tookMs: Date.now() - t0 });
    return;
  }
  if (sub === 'update') {
    if (req.method !== 'POST') return json(res, 405, { code: 405, msg: 'Method Not Allowed' });
    const body = await readJsonBody(req);
    if (body && body.parseError) return json(res, 400, { code: 400, msg: 'invalid JSON body' });
    if (!body || body.confirm !== true) return json(res, 400, { code: 400, msg: 'confirm required' });
    if (updateInFlight && Date.now() - updateStartedAt < 600_000) {
      return json(res, 409, { code: 409, msg: 'update already running' });
    }
    updateInFlight = true;
    updateStartedAt = Date.now();
    try {
      log('[dsh-admin] update started');
      const result = await doUpdate();
      await checkNow(); // 更新后立即复查版本
      updateInFlight = false;
      log(`[dsh-admin] update done: installed=${result.installed}`);
      // 更新成功 → 调度重启让新版本生效（同 restart 的 800ms 延迟回包策略）
      json(res, 200, { ok: true, installed: result.installed, latest: state.latest, message: '更新完成，正在重启服务使新版本生效…' });
      setTimeout(() => {
        try {
          doRestart();
          log('[dsh-admin] restart after update scheduled');
        } catch (e) {
          log('[dsh-admin] restart after update failed: ' + String(e instanceof Error ? e.message : e));
        }
      }, 800);
    } catch (e) {
      updateInFlight = false;
      const detail = String(e && e.stderr ? e.stderr : e && e.message ? e.message : e);
      log('[dsh-admin] update failed: ' + detail.slice(0, 500));
      json(res, 500, { ok: false, error: detail.slice(0, 2000) });
    }
    return;
  }
  if (sub === 'restart') {
    if (req.method !== 'POST') return json(res, 405, { code: 405, msg: 'Method Not Allowed' });
    const body = await readJsonBody(req);
    if (body && body.parseError) return json(res, 400, { code: 400, msg: 'invalid JSON body' });
    if (!body || body.confirm !== true) return json(res, 400, { code: 400, msg: 'confirm required' });
    // 先回包，给浏览器留出接收时间，再调度重启
    json(res, 202, { ok: true, message: '重启已调度，服务将短暂中断；页面会自动刷新。' });
    setTimeout(() => {
      try {
        doRestart();
        log('[dsh-admin] restart scheduled');
      } catch (e) {
        log('[dsh-admin] restart failed: ' + String(e instanceof Error ? e.message : e));
      }
    }, 800);
    return;
  }
  json(res, 404, { code: 404, msg: 'not found' });
}

// ---------------- 插件入口 ----------------
export function apply(ctx) {
  const webServer = ctx.webServer;
  const log = (msg) => {
    try {
      ctx.logger?.info?.(msg);
    } catch {
      /* ignore */
    }
  };
  if (!webServer || typeof webServer.register !== 'function') {
    ctx.logger?.warn?.('[dsh-admin] webServer service unavailable; routes disabled');
    return;
  }

  // 启动时检查一次，之后每 CHECK_MS 自动复查
  void checkNow().then((s) => {
    log(`[dsh-admin] version check: current=${s.current} latest=${s.latest} error=${s.error || 'none'}`);
  });
  const timer = setInterval(() => {
    void checkNow().then((s) => {
      log(`[dsh-admin] auto version check: current=${s.current} latest=${s.latest} error=${s.error || 'none'}`);
    });
  }, CHECK_MS);
  ctx.on?.('dispose', () => clearInterval(timer));

  webServer.register({
    kind: 'prefix',
    path: ROUTE,
    handler: async (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      const sub = url.pathname.replace(/^\/plugin\/dshadmin\/?/, '');
      await handle(req, res, sub, log);
    },
  });

  log(`[dsh-admin] routes /plugin/dshadmin/{status,health,check,update,restart} registered; auto-check every ${CHECK_MS / 3600_000}h; systemd=${USE_SYSTEMD}`);
}