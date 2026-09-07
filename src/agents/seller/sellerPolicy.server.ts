/**
 * Seller-private negotiation policy.
 * SERVER ONLY. None of these values may ever be serialized to the browser
 * or handed to the buyer agent — the buyer must infer flexibility from
 * the seller's observable responses.
 */

export type DemandLevel = "low" | "medium" | "high";

export interface SellerNegotiationPolicy {
  sellerId: string;
  productId: string;
  listedPrice: number;
  minimumPrice: number;
  preferredPrice: number;
  maxDiscountPercentage: number;
  inventoryLevel: number;
  demandLevel: DemandLevel;
  urgency: DemandLevel;
  maxRounds: number;
  shippingFee: number;
}

export interface SellerListingRow {
  seller_id: string;
  product_id: string;
  listed_price: number | string;
  minimum_price: number | string;
  preferred_price: number | string;
  max_discount_pct: number | string;
  inventory_level: number;
  demand_level: DemandLevel;
  urgency: DemandLevel;
  max_rounds: number;
  shipping_fee: number | string;
}

const num = (v: number | string) => Number(v);

export function toPolicy(row: SellerListingRow): SellerNegotiationPolicy {
  const listed = num(row.listed_price);
  const maxDiscount = num(row.max_discount_pct);
  // Platform ceiling: a seller can never be pushed past the configured discount.
  const floorFromDiscount = listed * (1 - maxDiscount / 100);
  return {
    sellerId: row.seller_id,
    productId: row.product_id,
    listedPrice: listed,
    minimumPrice: Math.max(num(row.minimum_price), floorFromDiscount),
    preferredPrice: num(row.preferred_price),
    maxDiscountPercentage: maxDiscount,
    inventoryLevel: row.inventory_level,
    demandLevel: row.demand_level,
    urgency: row.urgency,
    maxRounds: row.max_rounds,
    shippingFee: num(row.shipping_fee),
  };
}

/** How readily this seller gives ground, 0.18 (stubborn) .. 0.5 (eager). */
export function concessionRate(policy: SellerNegotiationPolicy): number {
  let rate = 0.3;
  if (policy.demandLevel === "high") rate -= 0.08;
  if (policy.demandLevel === "low") rate += 0.06;
  if (policy.urgency === "high") rate += 0.1;
  if (policy.urgency === "low") rate -= 0.05;
  if (policy.inventoryLevel > 30) rate += 0.05;
  if (policy.inventoryLevel < 12) rate -= 0.05;
  return Math.min(0.5, Math.max(0.18, rate));
}
