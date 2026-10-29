import { apiRequest } from './api';

export type QuoteLineItem = {
  model: string;
  quantity: number;
  unitCredits: number;
  totalCredits: number;
  note?: string;
};

export type Quote = {
  id: string;
  currency: string;
  totalCredits: number;
  expiresAt: string;
  lineItems?: QuoteLineItem[];
};

export type QuoteInput = {
  model: string;
  mode: 'text_to_image' | 'image_to_image' | 'image_edit' | 'text_to_video' | 'image_to_video';
  prompt: string;
  size: string;
  numberOfImages: number;
  referenceAssetIds?: string[];
};

// The server is the only source of truth for price. The client used to
// multiply creditBase × count × resolution, which could drift from the
// amount actually reserved at submit time.
export async function createQuote(input: QuoteInput): Promise<Quote> {
  return apiRequest<Quote>('/api/ai/quotes', {
    method: 'POST',
    body: JSON.stringify({
      model: input.model,
      mode: input.mode,
      prompt: input.prompt,
      size: input.size,
      numberOfImages: input.numberOfImages,
      referenceAssetIds: input.referenceAssetIds || [],
    }),
  });
}

export function quoteValid(quote: Quote | null | undefined): quote is Quote {
  if (!quote) return false;
  const expires = new Date(quote.expiresAt).getTime();
  if (!Number.isFinite(expires)) return false;
  return expires > Date.now() + 5_000;
}

export function quoteExpiryLabel(quote: Quote): string {
  const expires = new Date(quote.expiresAt);
  if (Number.isNaN(expires.getTime())) return '';
  return expires.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
