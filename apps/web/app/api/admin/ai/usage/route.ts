import { sanitizedAdminSnapshot } from '../../../../../lib/ai/runtime';
export function GET() {
  const snapshot = sanitizedAdminSnapshot();
  return Response.json({ data: { usage: snapshot.usage, estimatedCost: snapshot.estimatedCost } });
}
