import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Who has a paid plan — ONE place for the whole app.
 *
 * Today the server writes `user.plan` from the payment webhook, and the
 * payment success page also keeps `austwise_plan` in localStorage (Helix =
 * 'pro' expires after 30 days, Apex = 'premium' after 365). Both are read
 * here. When the server starts storing an expiry date (docs/pricing-plan.md
 * §3), only this file has to change.
 *
 * Note: this is a UI gate. Anything that must be enforced has to be checked
 * on the server too.
 */

export const PAID_PLANS = ['pro', 'premium'];
const PLAN_DAYS = { pro: 30, premium: 365 };
const PLAN_EVENT = 'austwise-plan-change';

function readStoredPlan() {
  try {
    const plan = localStorage.getItem('austwise_plan') || 'free';
    if (!PAID_PLANS.includes(plan)) return 'free';
    const since = Date.parse(localStorage.getItem('austwise_plan_date') || '');
    if (Number.isFinite(since)) {
      const days = (Date.now() - since) / 86_400_000;
      if (days > PLAN_DAYS[plan]) return 'free';
    }
    return plan;
  } catch {
    return 'free';
  }
}

export function isAdminUser(user) {
  return user?.role === 'admin' || (Array.isArray(user?.roles) && user.roles.includes('admin'));
}

/** The user's active plan id: 'free' | 'pro' | 'premium'. */
export function activePlan(user) {
  if (PAID_PLANS.includes(user?.plan)) return user.plan;
  return readStoredPlan();
}

export function hasPaidPlan(user) {
  return isAdminUser(user) || activePlan(user) !== 'free';
}

/** Tell open pages that the stored plan changed (after a payment). */
export function notifyPlanChange() {
  try {
    window.dispatchEvent(new Event(PLAN_EVENT));
  } catch {
    /* no window — nothing to notify */
  }
}

export default function usePlanAccess() {
  const { user } = useAuth() || {};
  const [, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((tick) => tick + 1);
    window.addEventListener(PLAN_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(PLAN_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const plan = activePlan(user);
  return {
    plan,
    isPaid: hasPaidPlan(user),
    isAdmin: isAdminUser(user),
  };
}
