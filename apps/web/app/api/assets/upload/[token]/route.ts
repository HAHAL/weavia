import { failure } from '../../../auth/_response';
import { objectStorage } from '../../../../../lib/storage/runtime';

export async function PUT(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const contentType = request.headers.get('content-type')?.split(';', 1)[0] ?? '';
    const body = new Uint8Array(await request.arrayBuffer());
    await objectStorage.upload(`localmock://upload/${token}`, body, contentType);
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error);
  }
}
