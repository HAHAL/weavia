import { sanitizedAdminSnapshot } from '../../../../../lib/ai/runtime';
export function GET() {
  const snapshot = sanitizedAdminSnapshot();
  return Response.json({
    data: { logicalModels: snapshot.logicalModels, bindings: snapshot.bindings },
  });
}
