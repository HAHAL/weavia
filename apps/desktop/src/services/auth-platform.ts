import { invoke, isTauri } from '@tauri-apps/api/core';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { DeviceInfo } from '@weavia/shared';

export interface SecureTokenStore {
  getAccessToken(): Promise<string | undefined>;
  setAccessToken(token: string): Promise<void>;
  getRefreshToken(): Promise<string | undefined>;
  setRefreshToken(token: string): Promise<void>;
  clearTokens(): Promise<void>;
}

export interface DesktopPlatform {
  openExternal(url: string): Promise<void>;
  getDeviceInfo(): Promise<DeviceInfo>;
  onDeepLink(handler: (url: string) => void): Promise<() => void>;
}

export class TauriSecureTokenStore implements SecureTokenStore {
  async getAccessToken() {
    return (await invoke<string | null>('get_secure_token', { kind: 'access' })) ?? undefined;
  }
  async setAccessToken(token: string) {
    await invoke('set_secure_token', { kind: 'access', token });
  }
  async getRefreshToken() {
    return (await invoke<string | null>('get_secure_token', { kind: 'refresh' })) ?? undefined;
  }
  async setRefreshToken(token: string) {
    await invoke('set_secure_token', { kind: 'refresh', token });
  }
  async clearTokens() {
    await invoke('clear_secure_tokens');
  }
}

export class MemorySecureTokenStore implements SecureTokenStore {
  private access: string | undefined;
  private refresh: string | undefined;
  async getAccessToken() {
    return this.access;
  }
  async setAccessToken(token: string) {
    this.access = token;
  }
  async getRefreshToken() {
    return this.refresh;
  }
  async setRefreshToken(token: string) {
    this.refresh = token;
  }
  async clearTokens() {
    this.access = undefined;
    this.refresh = undefined;
  }
}

class BrowserDevelopmentPlatform implements DesktopPlatform {
  private readonly deviceId = crypto.randomUUID();
  async openExternal(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  async getDeviceInfo(): Promise<DeviceInfo> {
    return {
      deviceId: this.deviceId,
      deviceName: 'WEAVIA Browser Preview',
      platform: navigator.platform,
      osVersion: 'development',
      appVersion: '0.1.0',
    };
  }
  async onDeepLink() {
    return () => undefined;
  }
}

export const secureTokenStore: SecureTokenStore = isTauri()
  ? new TauriSecureTokenStore()
  : new MemorySecureTokenStore();
export const desktopPlatform: DesktopPlatform = isTauri()
  ? {
      openExternal: (url) => openUrl(url),
      getDeviceInfo: () => invoke<DeviceInfo>('get_device_info'),
      onDeepLink: (handler) =>
        onOpenUrl((urls) => {
          for (const url of urls) handler(url);
        }),
    }
  : new BrowserDevelopmentPlatform();
