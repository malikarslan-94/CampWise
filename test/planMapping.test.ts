import { describe, it, expect } from 'vitest';
import { mapPlan } from '../src/adapters/shared.js';

/**
 * Upstream returns a base name/description plus pre-translated variants
 * (`trPlanName` / `trDescription`) when the request carried a language. Both must
 * survive into the canonical shape — previously only `planName` was mapped, so the
 * translated name was discarded before the model ever saw it.
 */
describe('mapPlan', () => {
  const raw = {
    planCode: 'JP-UNL-7D',
    planName: 'Japan Unlimited eSIM',
    trPlanName: 'eSIM Tanpa Had Jepun',
    description: 'Unlimited data, instant activation',
    trDescription: 'Data tanpa had, pengaktifan segera',
    productType: 'esim',
    price: 45,
    currency: 'MYR',
  };

  it('carries both the base and translated name', () => {
    const plan = mapPlan(raw);
    expect(plan.planName).toBe('Japan Unlimited eSIM');
    expect(plan.planNameLocalized).toBe('eSIM Tanpa Had Jepun');
  });

  it('carries both the base and translated description', () => {
    const plan = mapPlan(raw);
    expect(plan.description).toBe('Unlimited data, instant activation');
    expect(plan.descriptionLocalized).toBe('Data tanpa had, pengaktifan segera');
  });

  it('leaves translated fields undefined when upstream omits them', () => {
    const plan = mapPlan({ planCode: 'X', planName: 'X', productType: 'esim', price: 1, currency: 'MYR' });
    expect(plan.planNameLocalized).toBeUndefined();
    expect(plan.descriptionLocalized).toBeUndefined();
  });

  it('treats an empty translated field as absent rather than an empty string', () => {
    const plan = mapPlan({ ...raw, trPlanName: '', trDescription: '' });
    expect(plan.planNameLocalized).toBeUndefined();
    expect(plan.descriptionLocalized).toBeUndefined();
  });

  it('accepts snake_case translated keys too', () => {
    const plan = mapPlan({ ...raw, trPlanName: undefined, tr_plan_name: 'eSIM Tanpa Had Jepun' });
    expect(plan.planNameLocalized).toBe('eSIM Tanpa Had Jepun');
  });
});
