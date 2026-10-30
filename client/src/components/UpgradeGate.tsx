import { useEffect, useState, type ReactNode } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { APP_VERSION, downloadUrlFor, openExternal, refreshClientConfig, upgradeRequired, type ClientConfig } from '../services/clientConfig';

const RECHECK_MS = 5 * 60 * 1000;

// Blocks the whole app when the admin console has raised the minimum version
// above this build. Offline or unreachable config never blocks.
export function UpgradeGate({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let active = true;
    const check = () => { void refreshClientConfig().then(next => { if (active && next) setConfig(next); }); };
    check();
    const timer = window.setInterval(check, RECHECK_MS);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  if (!config || !upgradeRequired(config)) return <>{children}</>;
  const url = downloadUrlFor(config);
  async function recheck() {
    setChecking(true);
    const next = await refreshClientConfig();
    if (next) setConfig(next);
    setChecking(false);
  }
  return <div className="upgrade-gate" role="alertdialog" aria-modal="true" aria-labelledby="upgrade-title">
    <div className="upgrade-card">
      <img src="/brand/weavia-icon.png" alt="" width={48} height={48} />
      <h1 id="upgrade-title">需要升级到新版本</h1>
      <p>当前版本 {APP_VERSION} 已停止使用，请升级到 {config.latestVersion || config.minVersion} 或更高版本后继续。</p>
      {config.releaseNotes && <div className="upgrade-notes"><strong>更新内容</strong><p>{config.releaseNotes}</p></div>}
      <div className="upgrade-actions">
        {url ? <button type="button" className="btn btn-primary" onClick={() => void openExternal(url)}><Download size={16} aria-hidden="true" />下载新版本</button> : <p className="muted">下载地址暂未配置，请联系客服获取安装包。</p>}
        <button type="button" className="btn btn-secondary" disabled={checking} onClick={() => void recheck()}><RefreshCw size={16} aria-hidden="true" />{checking ? '检查中…' : '重新检查'}</button>
      </div>
      <small>安装新版本后，旧版本可直接删除；作品和商品数据保留在本机。</small>
    </div>
  </div>;
}
