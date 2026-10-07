import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Badge, Button, Card, PageHeader } from '@weavia/ui';
import { localData, type LocalDataInfo } from '../services/local-data';
interface AppInfo {
  name: string;
  version: string;
  platform: string;
}
export function SettingsPage() {
  const [info, setInfo] = useState<AppInfo>({
    name: 'WEAVIA',
    version: '0.1.0',
    platform: 'Browser preview',
  });
  const [storage, setStorage] = useState<LocalDataInfo>();
  const [defaultProjectPath, setDefaultProjectPath] = useState('');
  const [density, setDensity] = useState('comfortable');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if ('__TAURI_INTERNALS__' in window) {
      void invoke<AppInfo>('get_app_info').then(setInfo);
      void localData.info().then((next) => {
        setStorage(next);
        void localData
          .getSetting<string>('defaultProjectPath')
          .then((value) => setDefaultProjectPath(value ?? `${next.rootPath}/projects`));
      });
      void localData
        .getSetting<{ density: string }>('ui')
        .then((value) => setDensity(value?.density ?? 'comfortable'));
    }
  }, []);
  async function saveLocalSettings() {
    await Promise.all([
      localData.setSetting('defaultProjectPath', defaultProjectPath),
      localData.setSetting('ui', { density }),
    ]);
    setSaved(true);
  }
  return (
    <>
      <PageHeader
        eyebrow="PREFERENCES"
        title="设置"
        description="应用、本地存储和 AI 服务的基础配置入口。"
      />
      <div className="settings-grid">
        <Card>
          <h2>应用信息</h2>
          <dl>
            <div>
              <dt>名称</dt>
              <dd>{info.name}</dd>
            </div>
            <div>
              <dt>版本</dt>
              <dd>{info.version}</dd>
            </div>
            <div>
              <dt>平台</dt>
              <dd>{info.platform}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <h2>本地项目</h2>
          <p>{storage?.rootPath ?? '使用系统标准 App Data 目录'}</p>
          <dl>
            <div>
              <dt>SQLite</dt>
              <dd>{storage ? `Schema v${storage.schemaVersion}` : 'Desktop only'}</dd>
            </div>
          </dl>
          <label className="local-setting-field">
            默认项目路径
            <input
              value={defaultProjectPath}
              onChange={(event) => {
                setDefaultProjectPath(event.target.value);
                setSaved(false);
              }}
              disabled={!storage}
            />
          </label>
          <label className="local-setting-field">
            界面密度
            <select
              value={density}
              onChange={(event) => {
                setDensity(event.target.value);
                setSaved(false);
              }}
              disabled={!storage}
            >
              <option value="comfortable">舒适</option>
              <option value="compact">紧凑</option>
            </select>
          </label>
          <Button onClick={() => void saveLocalSettings()} disabled={!storage}>
            {saved ? '已保存' : '保存本地设置'}
          </Button>
          <Badge tone="success">Local First</Badge>
        </Card>
        <Card>
          <h2>AI Provider</h2>
          <p>本阶段仅使用 MockProvider 生成本地真实结果文件。</p>
          <Badge>Mock only</Badge>
        </Card>
        <Card>
          <h2>账户授权</h2>
          <p>浏览器登录、Deep Link 与 Keychain 继续沿用 Phase 1A。</p>
          <Badge tone="success">Phase 1A</Badge>
        </Card>
      </div>
    </>
  );
}
