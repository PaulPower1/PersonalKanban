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

  if (loading) {
    return (
      <div className="billing-page">
        <div className="billing-page__header">
          <button className="toolbar__btn" onClick={() => navigate('/')}>
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
    </div>
  );
}
