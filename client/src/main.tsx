import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomePage } from './pages/Home';
import { CreatePage } from './pages/Create';
import { Products } from './pages/Products';
import { Assets } from './pages/Assets';
import { Skills } from './pages/Skills';
import { Tasks } from './pages/Tasks';
import { Works } from './pages/Works';
import { AccountPage } from './pages/System';
import { Applications } from './pages/Applications';
import { ImageEditingPage } from './pages/ImageEditing';
import { VideoStudioPage } from './pages/VideoStudio';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { useAuth } from './stores/auth';
import './styles.css';
import { apiConfig } from './services/api';
import { initDatabase } from './services/database';
const WorkflowPage = React.lazy(() => import('./pages/Workflow').then(m => ({ default: m.WorkflowPage })));

function RequireAuth() {
  const user = useAuth(state => state.user);
  const status = useAuth(state => state.status);
  if(apiConfig.mode==='mock')return <Outlet />;
  if (!user) {
    if (status === 'loading') return <div className="page" role="status">正在检查登录状态…</div>;
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="create" element={<CreatePage />} />
              <Route path="products" element={<Products />} />
              <Route path="assets" element={<Assets />} />
              <Route path="skills" element={<Skills />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="works" element={<Works />} />
              <Route path="workflow" element={<React.Suspense fallback={<div className="page" role="status">正在加载工作流画布…</div>}><WorkflowPage /></React.Suspense>} />
              <Route path="settings" element={<Navigate to="/account?section=settings" replace />} />
              <Route path="diagnostics" element={<Navigate to="/account?section=diagnostics" replace />} />
              <Route path="account" element={<AccountPage />} />
              <Route path="credits" element={<Navigate to="/account?section=credits" replace />} />
              <Route path="orders" element={<Navigate to="/account?section=orders" replace />} />
              <Route path="subscription" element={<Navigate to="/account?section=subscription" replace />} />
              <Route path="security" element={<Navigate to="/account?section=security" replace />} />
              <Route path="applications" element={<Applications />} />
              <Route path="image-editing" element={<ImageEditingPage />} />
              <Route path="video-studio" element={<VideoStudioPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

// Render first, hydrate local state afterwards: a stuck SQLite open must not
// leave the window blank.
void initDatabase();
void useAuth.getState().restore();
