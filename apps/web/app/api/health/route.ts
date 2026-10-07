import { defaultCatalog } from '../../../lib/ai/runtime';

export function GET() {
  const antDigital = defaultCatalog.providers.find((provider) => provider.code === 'antdigital');
  return Response.json({
    service: 'weavia-cloud-api',
    status: 'ok',
    version: '0.1.0',
    providers: { antdigital: { configured: antDigital?.configured ?? false } },
  });
}
