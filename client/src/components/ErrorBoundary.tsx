import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { log } from '../lib/logger';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    log('error', 'react.boundary', `${error.message} ${info.componentStack ?? ''}`);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <div className="state-panel state-error" role="alert">
          <strong>界面遇到错误</strong>
          <p>{this.state.error.message || '未知错误，请重新加载'}</p>
          <div className="dialog-actions">
            <button className="btn btn-secondary" type="button" onClick={() => window.location.reload()}>重新加载</button>
            <button className="btn btn-primary" type="button" onClick={() => { void navigator.clipboard?.writeText(JSON.stringify({ message: this.state.error?.message, stack: this.state.error?.stack }, null, 2)); }}>复制错误信息</button>
          </div>
        </div>
      </div>
    );
  }
}
