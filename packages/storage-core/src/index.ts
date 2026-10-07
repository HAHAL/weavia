export interface UploadUrlRequest {
  objectKey: string;
  contentType: string;
  size: number;
  expiresInSeconds?: number;
}

export interface UploadUrlResult {
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
}

export interface StoredObjectMetadata {
  objectKey: string;
  contentType: string;
  size: number;
  createdAt: string;
}

export interface ObjectStorage {
  createUploadUrl(input: UploadUrlRequest): Promise<UploadUrlResult>;
  upload(uploadUrl: string, body: Uint8Array, contentType: string): Promise<void>;
  createDownloadUrl(objectKey: string, expiresInSeconds?: number): Promise<string>;
  delete(objectKey: string): Promise<void>;
}

interface UploadTicket extends UploadUrlRequest {
  token: string;
  expiresAtMs: number;
}

interface StoredObject extends StoredObjectMetadata {
  body: Uint8Array;
}

export class LocalMockStorage implements ObjectStorage {
  private readonly tickets = new Map<string, UploadTicket>();
  private readonly objects = new Map<string, StoredObject>();

  constructor(private readonly now: () => number = Date.now) {}

  async createUploadUrl(input: UploadUrlRequest): Promise<UploadUrlResult> {
    if (!input.objectKey || input.objectKey.startsWith('/') || input.objectKey.includes('..'))
      throw new Error('Invalid object key');
    if (input.size <= 0) throw new Error('Invalid object size');
    const token = crypto.randomUUID();
    const expiresAtMs = this.now() + (input.expiresInSeconds ?? 600) * 1000;
    this.tickets.set(token, { ...input, token, expiresAtMs });
    return {
      uploadUrl: `localmock://upload/${token}`,
      objectKey: input.objectKey,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  async upload(uploadUrl: string, body: Uint8Array, contentType: string): Promise<void> {
    const token = tokenFromUrl(uploadUrl, 'upload');
    const ticket = this.tickets.get(token);
    if (!ticket) throw new Error('Upload ticket not found');
    if (ticket.expiresAtMs <= this.now()) {
      this.tickets.delete(token);
      throw new Error('Upload ticket expired');
    }
    if (ticket.contentType !== contentType) throw new Error('Upload content type mismatch');
    if (ticket.size !== body.byteLength) throw new Error('Upload size mismatch');
    this.objects.set(ticket.objectKey, {
      objectKey: ticket.objectKey,
      contentType,
      size: body.byteLength,
      createdAt: new Date(this.now()).toISOString(),
      body: new Uint8Array(body),
    });
    this.tickets.delete(token);
  }

  async createDownloadUrl(objectKey: string, expiresInSeconds = 600): Promise<string> {
    if (!this.objects.has(objectKey)) throw new Error('Object not found');
    const expiresAt = this.now() + expiresInSeconds * 1000;
    return `localmock://download/${encodeURIComponent(objectKey)}?expires=${expiresAt}`;
  }

  async delete(objectKey: string): Promise<void> {
    this.objects.delete(objectKey);
  }

  getMetadata(objectKey: string): StoredObjectMetadata | undefined {
    const object = this.objects.get(objectKey);
    if (!object) return undefined;
    return {
      objectKey: object.objectKey,
      contentType: object.contentType,
      size: object.size,
      createdAt: object.createdAt,
    };
  }
}

function tokenFromUrl(value: string, operation: 'upload') {
  const url = new URL(value);
  if (url.protocol !== 'localmock:' || url.hostname !== operation)
    throw new Error('Invalid local mock storage URL');
  const token = url.pathname.slice(1);
  if (!token) throw new Error('Missing upload token');
  return token;
}
