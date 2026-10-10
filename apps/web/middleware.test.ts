import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from './middleware';

describe('Desktop API CORS', () => {
  it('allows reference asset uploads from the Tauri origin', () => {
    const response = middleware(
      new NextRequest('http://localhost:3000/api/assets/upload/token', {
        method: 'OPTIONS',
        headers: { origin: 'tauri://localhost' },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('tauri://localhost');
    expect(response.headers.get('access-control-allow-methods')).toContain('PUT');
  });
});
