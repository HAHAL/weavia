import { Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AppShell } from '../layouts/AppShell';
import { HomePage } from '../pages/HomePage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { CreationPage } from '../pages/CreationPage';
import { TasksPage } from '../pages/TasksPage';
import { AssetsPage } from '../pages/AssetsPage';
import { CreateTaskPage } from '../pages/CreateTaskPage';
import { SettingsPage } from '../pages/SettingsPage';
import { AccountPage } from '../pages/AccountPage';
import { AuthBootstrap } from '../components/AuthBootstrap';
import { ProjectWorkspacePage } from '../pages/ProjectWorkspacePage';
import { ResultCenterPage } from '../pages/ResultCenterPage';
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
          <Route path="/create" element={<CreateTaskPage />} />
          <Route path="/create/model" element={<Navigate to="/projects" replace />} />
          <Route path="/create/commercial" element={<Navigate to="/projects" replace />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/results" element={<ResultCenterPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/history" element={<Navigate to="/results" replace />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
