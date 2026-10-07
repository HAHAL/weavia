import { sanitizedAdminSnapshot } from '../../../../../lib/ai/runtime';

export function GET() {
  return Response.json({ data: sanitizedAdminSnapshot() });
}
