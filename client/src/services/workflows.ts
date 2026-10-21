import { apiRequest } from './api';

export type WorkflowRecord = {
  id: string;
  name: string;
  graph: { nodes: unknown[]; edges: unknown[] };
  createdAt: string;
  updatedAt: string;
};
export type WorkflowRun = { id: string; workflowId: string; status: string; result?: unknown; error?: string; startedAt: string; finishedAt?: string };

export function listWorkflows() { return apiRequest<WorkflowRecord[]>('/api/workflows'); }
export function saveWorkflow(id: string | null, name: string, graph: { nodes: unknown[]; edges: unknown[] }) {
  return apiRequest<WorkflowRecord>(id ? `/api/workflows/${id}` : '/api/workflows', { method: id ? 'PUT' : 'POST', body: JSON.stringify({ name, graph }) });
}
export function listWorkflowRuns(workflowId: string) { return apiRequest<WorkflowRun[]>(`/api/workflows/${workflowId}/runs`); }
export function deleteWorkflow(id: string) { return apiRequest<{ deleted: boolean }>(`/api/workflows/${id}`, { method: 'DELETE' }); }
export function startWorkflowRun(workflowId: string, graph: { nodes: unknown[]; edges: unknown[] }) {
  return apiRequest<WorkflowRun>(`/api/workflows/${workflowId}/runs`, { method: 'POST', body: JSON.stringify({ graph }) });
}
export function finishWorkflowRun(workflowId: string, runId: string, status: 'success' | 'failed', result: unknown, error = '') {
  return apiRequest<{ saved: boolean }>(`/api/workflows/${workflowId}/runs/${runId}`, { method: 'PUT', body: JSON.stringify({ status, result, error }) });
}
