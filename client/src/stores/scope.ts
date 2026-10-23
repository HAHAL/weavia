// 本机数据作用域：商品、素材、任务、作品按登录账号分区，避免同设备换号串数据。
export const ANONYMOUS_SCOPE = 'anonymous';
export const STATE_STORAGE_NAME = 'weavia.state.v2';

let scope = ANONYMOUS_SCOPE;

export function currentScope(): string {
  return scope;
}

export function setScope(next: string | null | undefined): void {
  const value = typeof next === 'string' ? next.trim() : '';
  scope = value || ANONYMOUS_SCOPE;
}

export function partitionKey(scopeId: string = scope, name: string = STATE_STORAGE_NAME): string {
  return `${name}.${scopeId}`;
}
