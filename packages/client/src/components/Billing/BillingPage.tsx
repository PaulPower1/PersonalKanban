import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { BillingStatus } from '../../types';
import { getBillingStatus, createCheckoutSession } from '../../api/stripe';
import { useToast } from '../../contexts/ToastContext';

const PLANS = [
  { tier: 'FREE' as const, name: 'Free', price: '$0', limit: 10, priceId: null },
  { tier: 'STARTER' as const, name: 'Starter', price: '$5', limit: 50, priceId: 'STRIPE_STARTER_PRICE_ID' },
  { tier: 'PRO' as const, name: 'Pro', price: '$10', limit: 100, priceId: 'STRIPE_PRO_PRICE_ID' },
];

const TIER_ORDER = { FREE: 0, STARTER: 1, PRO: 2 };

const FEATURES = [
  { name: 'Total Cards', free: '10', starter: '50', pro: '100' },
  { name: 'Boards', free: 'Unlimited', starter: 'Unlimited', pro: 'Unlimited' },
  { name: 'CSV Export', free: true, starter: true, pro: true },
  { name: 'Voice Dictation', free: true, starter: true, pro: true },
  { name: 'Priority Support', free: false, starter: false, pro: true },
];

export function BillingPage() {
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const status = searchParams.get('status');

  useEffect(() => {
    getBillingStatus()
      .then(setBilling)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (status === 'success') {
      showToast('Payment successful! Your plan has been upgraded.');
      // Refresh billing status
      getBillingStatus().then(setBilling);
    } else if (status === 'cancelled') {
      showToast('Payment was cancelled. No charge was made.');
    }
  }, [status, showToast]);

  const handleUpgrade = async (priceId: string, tierName: string) => {
    setUpgrading(tierName);
    try {
      const { sessionUrl } = await createCheckoutSession(priceId);
      window.location.href = sessionUrl;
    } catch {
      showToast('Failed to start checkout. Please try again.');
      setUpgrading(null);
    }
  };

  const renderCellValue = (val: string | boolean) => {
    if (typeof val === 'string') return val;
    if (val) {
      return (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="var(--neon-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 8 6.5 11.5 13 5" />
        </svg>
      );
    }
    return (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
        <line x1="4" y1="8" x2="12" y2="8" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="billing-page">
        <div className="billing-page__header">
          <button className="toolbar__btn" onClick={() => navigate('/')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 12L6 8l4-4" />
            </svg>
            Back
          </button>
          <h1 className="billing-page__title">Billing</h1>
        </div>
        <div className="billing-page__skeleton">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      </div>
    );
  }

  if (!billing) return null;

  const currentTierOrder = TIER_ORDER[billing.tier];

  return (
    <div className="billing-page">
      <div className="billing-page__header">
        <button className="toolbar__btn" onClick={() => navigate('/')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back
        </button>
        <h1 className="billing-page__title">Billing</h1>
      </div>

      <div className="billing-page__usage">
        <span className="billing-page__usage-label">Total cards across all boards</span>
        <span className="billing-page__usage-count">
          {billing.cardCount} / {billing.cardLimit}
        </span>
        <div className="billing-page__usage-bar">
          <div
            className="billing-page__usage-fill"
            style={{ width: `${Math.min(100, (billing.cardCount / billing.cardLimit) * 100)}%` }}
          />
        </div>
      </div>

      <div className="billing-page__plans">
        {PLANS.map((plan) => {
          const planOrder = TIER_ORDER[plan.tier];
          const isCurrent = plan.tier === billing.tier;
          const isLower = planOrder <= currentTierOrder;

          return (
            <div
              key={plan.tier}
              className={`billing-plan${isCurrent ? ' billing-plan--current' : ''}`}
            >
              {isCurrent && <span className="billing-plan__badge">Current</span>}
              <h3 className="billing-plan__name">{plan.name}</h3>
              <div className="billing-plan__price">{plan.price}</div>
              <div className="billing-plan__detail">
                {plan.limit} cards {plan.price !== '$0' ? '(one-time)' : ''}
              </div>
              {plan.priceId && !isLower ? (
                <button
                  className="billing-plan__btn"
                  disabled={!!upgrading}
                  onClick={() => handleUpgrade(plan.priceId!, plan.name)}
                >
                  {upgrading === plan.name ? 'Redirecting...' : `Upgrade to ${plan.name}`}
                </button>
              ) : plan.tier === 'PRO' && isCurrent ? (
                <div className="billing-plan__max">Highest tier</div>
              ) : (
                <button className="billing-plan__btn" disabled>
                  {isCurrent ? 'Current Plan' : 'Included'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="billing-page__comparison">
        <h2 className="billing-page__comparison-title">Feature Comparison</h2>
        <table className="billing-table">
          <thead>
            <tr>
              <th className="billing-table__feature-header">Feature</th>
              <th>Free</th>
              <th>Starter</th>
              <th>Pro</th>
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((feature) => (
              <tr key={feature.name}>
                <td className="billing-table__feature-name">{feature.name}</td>
                <td>{renderCellValue(feature.free)}</td>
                <td>{renderCellValue(feature.starter)}</td>
                <td>{renderCellValue(feature.pro)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
