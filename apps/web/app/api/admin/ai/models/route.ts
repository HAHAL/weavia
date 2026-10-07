import { sanitizedAdminSnapshot } from '../../../../../lib/ai/runtime';
export function GET() {
  const snapshot = sanitizedAdminSnapshot();
  return Response.json({
    data: { providerModels: snapshot.models, logicalModels: snapshot.logicalModels },
  });
}
