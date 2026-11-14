import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampQuantityToStock,
  getCartStockIssue,
  readStoredCart,
  normalizePriceValue,
} from './cartStock.js';

test('clamps a quantity increase to the product stock limit', () => {
  assert.equal(clampQuantityToStock(10, 12, 5), 12);
  assert.equal(clampQuantityToStock(10, 12, -2), 8);
  assert.equal(clampQuantityToStock(10, 0, 5), 0);
});

test('detects cart entries that exceed current stock', () => {
  const cart = [
    { id: 1, quantity: 13 },
    { id: 2, quantity: 2 },
  ];

  const products = [
    { id: 1, stock: 12 },
    { id: 2, stock: 3 },
  ];

  assert.deepEqual(getCartStockIssue(cart, products), [{ id: 1, quantity: 13 }]);
});

test('reads and normalizes stored cart data safely', () => {
  assert.deepEqual(readStoredCart('[]'), []);
  assert.deepEqual(readStoredCart('[{"id":1,"quantity":2}]'), [{ id: 1, quantity: 2 }]);
  assert.deepEqual(readStoredCart('not-json'), []);
  assert.deepEqual(readStoredCart('{"id":1}'), []);
});

test('caps product pricing at a realistic 2,000,000 maximum', () => {
  assert.equal(normalizePriceValue('2500000'), 2000000);
  assert.equal(normalizePriceValue('499999'), 499999);
  assert.equal(normalizePriceValue('-50'), 0);
  assert.equal(normalizePriceValue('invalid'), 0);
});
