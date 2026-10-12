import { useEffect, useState } from 'react';
import { ApiClient } from '@weavia/api-client';
import { secureTokenStore } from './auth-platform';
import { useAuthStore } from '../stores/auth';

export interface AccountSummary {
  planName: string;
  planCode: string;
  credits: number;
}

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/';
const client = new ApiClient(
  baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
  () => secureTokenStore.getAccessToken(),
);

export function useAccountSummary() {
  const auth = useAuthStore();
  const [summary, setSummary] = useState<AccountSummary & { userId: string }>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (auth.status !== 'authenticated') return;
    let active = true;
    void Promise.all([
      client.request<{ plan: { name: string; code: string } }>('membership'),
      client.request<{ available: number }>('credits'),
    ])
      .then(([membership, credits]) => {
        if (!active) return;
        setSummary({
          userId: auth.user?.id ?? '',
          planName: membership.data.plan.name,
          planCode: membership.data.plan.code,
          credits: credits.data.available,
        });
        setError(undefined);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : '账户信息暂时无法加载');
      });
    return () => { active = false; };
  }, [auth.status, auth.user?.id]);

  return auth.status === 'authenticated' && summary?.userId === auth.user?.id
    ? { summary, error }
    : { summary: undefined, error: auth.status === 'authenticated' ? error : undefined };
}
