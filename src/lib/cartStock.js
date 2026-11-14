export const MAX_PRODUCT_PRICE = 2000000;

export const clampQuantityToStock = (currentQuantity, stock, delta = 0) => {
  if (stock <= 0) return 0;

  return Math.min(Math.max(currentQuantity + delta, 0), stock);
};

export const normalizePriceValue = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return 0;

  return Math.min(Math.max(numericValue, 0), MAX_PRODUCT_PRICE);
};

export const readStoredCart = (rawCart) => {
  if (!rawCart || typeof rawCart !== 'string') return [];

  try {
    const parsed = JSON.parse(rawCart);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item) => {
      if (!item || typeof item !== 'object') return false;
      if (item.id === undefined || item.id === null) return false;

      const quantity = Number(item.quantity);
      return Number.isFinite(quantity) && quantity >= 0;
    });
  } catch {
    return [];
  }
};

export const getCartStockIssue = (cart, products) => {
  const productLookup = new Map(products.map((product) => [product.id, product.stock]));

  return cart.filter((item) => {
    const availableStock = productLookup.get(item.id) ?? 0;
    return item.quantity > availableStock;
  });
};
