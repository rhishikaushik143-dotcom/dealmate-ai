/**
 * Fair-price intelligence. Derives a defensible market band from what every
 * seller currently lists the product for, plus any active public offer.
 */

export interface MarketBand {
  low: number;
  high: number;
  fair: number;
}

export function marketBand(listedPrices: number[], catalogPrice: number, bestOfferPct: number): MarketBand {
  const prices = listedPrices.length > 0 ? listedPrices : [catalogPrice];
  const low = Math.min(...prices) * (1 - Math.max(bestOfferPct, 5) / 100);
  const high = Math.max(...prices);
  const fair = Math.round(((low + high) / 2) * 0.96);
  return { low: Math.round(low), high: Math.round(high), fair };
}
