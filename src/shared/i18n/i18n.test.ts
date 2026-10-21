import { t } from '.';

describe('t', () => {
  it('fills {name} holes with the given values', () => {
    expect(t('paywall.perYear', { price: '$24.99' })).toBe('$24.99 a year');
  });
  it('leaves a hole in place when its value is missing', () => {
    expect(t('paywall.perMonth')).toBe('{price} a month');
  });
});
