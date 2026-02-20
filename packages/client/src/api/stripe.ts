import { apiFetch } from './client';
import { BillingStatus } from '../types';

export function createCheckoutSession(priceId: string): Promise<{ sessionUrl: string }> {
  return apiFetch<{ sessionUrl: string }>('/stripe/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify({ priceId }),
  });
}

export function getBillingStatus(): Promise<BillingStatus> {
  return apiFetch<BillingStatus>('/stripe/billing-status');
}
