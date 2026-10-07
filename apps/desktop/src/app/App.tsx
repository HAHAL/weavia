import { Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AppShell } from '../layouts/AppShell';
import { HomePage } from '../pages/HomePage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { CreationPage } from '../pages/CreationPage';
import { TasksPage } from '../pages/TasksPage';
import { PlaceholderPage } from '../pages/PlaceholderPage';
import { SettingsPage } from '../pages/SettingsPage';
import { AccountPage } from '../pages/AccountPage';
import { AuthBootstrap } from '../components/AuthBootstrap';
import { ProjectWorkspacePage } from '../pages/ProjectWorkspacePage';
export function App() {
  return (
    <ErrorBoundary>
      <AuthBootstrap />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectWorkspacePage />} />
          <Route path="/projects/:projectId/create/model" element={<CreationPage kind="model" />} />
          <Route
            path="/projects/:projectId/create/commercial"
            element={<CreationPage kind="commercial" />}
          />
          <Route path="/projects/:projectId/tasks" element={<TasksPage />} />
          <Route path="/create/model" element={<Navigate to="/projects" replace />} />
          <Route path="/create/commercial" element={<Navigate to="/projects" replace />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route
            path="/assets"
            element={
              <PlaceholderPage
                title="素材库"
                description="项目素材将在接入本地数据库后显示在这里。"
              />
            }
          />
          <Route
            path="/history"
            element={
              <PlaceholderPage
                title="历史记录"
                description="已完成的生成记录将在这里按项目与时间组织。"
              />
            }
          />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
