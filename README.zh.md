# dsh-admin

DeepSeek Harness Web GUI 管理插件：**手动重启** + **自动检查最新版本**。UI 直接内嵌在 Web 界面里（右上角按钮 + 设置页），嵌入方式参考 [dsh-usage-stats](https://github.com/Ychris12138/dsh-usage-stats)。

## 功能

- **手动重启** — 会话头部右上角按钮（session log 旁边）：点击后双重确认，调度一次干净的 dsh web 重启（走本机惯例脚本 `systemd-run + dsh-plugin-op restart`：systemd 停机 → 清 3080 孤儿实例 → 干净启动 → 健康验证）。
- **自动检查最新版本** — 对比本地已装的 `@deepseek-ai/dsh` 与 npm `latest`（semver 感知：stable > rc）。加载时检查一次，之后 Host 每 6 小时复查；面板显示 当前/最新/上次检查 时间与状态圆点（绿=已是最新，黄=有新版本，红=检查失败）。
- **一键更新** — 检测到新版本时，出现蓝色「更新到最新版」按钮：执行 `npm install -g @deepseek-ai/dsh@latest`（带 `--allow-scripts` 授权原生依赖）后自动重启服务，让新版本生效。
- **内嵌 UI，无独立页面**：
  - 右上角胶囊按钮 `🟢 0.1.1`（会话头部工具槽位，与 session log 并排、不遮挡任何内容）→ 点击浮出面板（置于最上层，z-index 9999）：版本状态 / 立即检查 / 更新按钮（有新版本时）/ 服务信息 / 重启按钮。
  - 设置 → **DSH 管理** 完整页面（同内容，大布局）。

## 后端路由（host 半身）

| 路由 | 说明 |
|---|---|
| `GET /plugin/dshadmin/status` | JSON：当前/最新版本、`isNewer`、服务信息（pid、systemd、重启命令） |
| `GET /plugin/dshadmin/health` | `{ok:true}` |
| `POST /plugin/dshadmin/check` | 立即重新检查 npm 最新版 |
| `POST /plugin/dshadmin/update` | 升级 `@deepseek-ai/dsh` 到 npm latest 后自动重启（body 必须是 `{"confirm":true}`） |
| `POST /plugin/dshadmin/restart` | 调度重启（body 必须是 `{"confirm":true}`） |

重启优先级：① `systemd-run` + `dsh-plugin-op restart`（独立 cgroup——`dsh.service` 是 `KillMode=control-group`，直接 spawn 会被其内部的 `systemctl stop dsh` 连带杀死；transient unit 才能完整跑完：停机→清 3080 孤儿→干净启动→健康验证）→ ② 直接 `dsh-plugin-op restart` → ③ `systemctl --no-block restart dsh` → ④ 杀 socket pid + 原参数拉起。

## 安装

本包是一个 [profile bundle](https://github.com/deepseek-ai/deepseek-harness)（清单声明了 `dsh.bundle.patch`）。

```bash
# 方式 A — 插件管理器安装
dsh plugin --profile web add xiaokang6/dsh-admin

# 方式 B — 手动拷贝（⚠️ 绝不要在 profile 目录里直接 npm install）
git clone https://github.com/xiaokang6/dsh-admin /tmp/dsh-admin
cp -r /tmp/dsh-admin ~/.dsh/profiles/web/node_modules/dsh-admin
```

然后在 `~/.dsh/profiles/web/cordis.patch.yml` 加入：

```yaml
- insert:
    - id: dsh-admin
      name: 'dsh-admin'
```

重启 `dsh web`（或用本机重启命令）并硬刷新浏览器。Host 改动需重启服务；client 改动由 client-modules HMR 在刷新页面时拾取。

## 环境要求

- DeepSeek Harness（`@deepseek-ai/dsh`）npm 全局安装（重启链在存在 `dsh-plugin-op` 时优先使用）
- Linux + systemd（重启路径；版本检查与 UI 任意平台可用）

## 许可

MIT
