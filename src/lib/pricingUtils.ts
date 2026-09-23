import { Product, CartItem, GlobalQtyRules } from '../types';

export function calculateProductDiscount(
  product: Product,
  quantity: number,
  variantId?: string,
  globalRules?: GlobalQtyRules
): number {
  if (quantity <= 0) return 0;
  let rules = variantId ? product.variants?.find(v => v.id === variantId)?.qtyRules : null;
  if (!rules || rules.length === 0) {
    rules = product.qtyRules;
  }
  
  let bestDiscount = 0;
  if (rules && rules.length > 0) {
    const applicableRules = rules.filter(r => r.quantity <= quantity).sort((a, b) => b.quantity - a.quantity);
    if (applicableRules.length > 0) {
      bestDiscount = applicableRules[0].price;
    }
  }
  
  // If product has rules but none matched, or product has no rules, fallback to global
  if (bestDiscount > 0) {
    return bestDiscount;
  }
  
  if (globalRules?.enabled && quantity >= globalRules.minQuantity) {
    return globalRules.discountPerPiece;
  }
  
  return 0;
}

export function getProductQtyRules(
  product: Product,
  variantId?: string,
  globalRules?: GlobalQtyRules
): { quantity: number; price: number }[] {
  let rules = variantId ? product.variants?.find(v => v.id === variantId)?.qtyRules : null;
  if (!rules || rules.length === 0) {
    rules = product.qtyRules;
  }
  if (rules && rules.length > 0) {
    return [...rules].sort((a, b) => a.quantity - b.quantity);
  }
  if (globalRules?.enabled && globalRules.minQuantity > 0 && globalRules.discountPerPiece > 0) {
    return [{ quantity: globalRules.minQuantity, price: globalRules.discountPerPiece }];
  }
  return [];
}

export function calculateItemDiscount(item: CartItem, productTotalQty: number, globalRules?: GlobalQtyRules): number {
  return calculateProductDiscount(item.product, productTotalQty, item.variantId, globalRules);
}

export function getCartTotal(cart: CartItem[], globalRules?: GlobalQtyRules): { 
  total: number, 
  itemDiscounts: Record<string, number> 
} {
  const productQuantities = cart.reduce((acc, item) => {
    acc[item.product.id] = (acc[item.product.id] || 0) + item.quantity;
    return acc;
  }, {} as Record<string, number>);

  let total = 0;
  const itemDiscounts: Record<string, number> = {};

  cart.forEach(item => {
    const productTotalQty = productQuantities[item.product.id] || 0;
    const discountPerPiece = calculateItemDiscount(item, productTotalQty, globalRules);
    itemDiscounts[item.id] = discountPerPiece;
    
    const basePrice = item.variantPrice ?? item.product.price;
    const finalPrice = Math.max(0, basePrice - discountPerPiece);
    total += finalPrice * item.quantity;
  });

  return { total, itemDiscounts };
}
