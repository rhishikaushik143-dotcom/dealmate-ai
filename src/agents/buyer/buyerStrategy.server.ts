/**
 * DealMate buyer strategy. Pure arithmetic — deterministic and testable.
 * The model may suggest how hard to push; these functions decide the number.
 */

export interface BuyerContext {
  listedPrice: number;
  fairPrice: number;
  budget: number;
  targetPrice: number;
  autoAcceptAt: number | null;
  round: number;
  maxRounds: number;
  previousOffers: number[];
  currentSellerOffer: number;
}

export interface BuyerDecision {
  type: "offer" | "counter_offer" | "accept" | "final_offer" | "reject";
  amount: number;
  line: string;
}

const round10 = (v: number) => Math.round(v / 10) * 10;

/** Where DealMate opens: below target, never anchored to the user's ceiling. */
export function openingOffer(ctx: Pick<BuyerContext, "listedPrice" | "targetPrice" | "budget">): number {
  const anchored = Math.min(ctx.targetPrice * 0.93, ctx.listedPrice * 0.78);
  return round10(Math.max(1, Math.min(anchored, ctx.budget)));
}

/** The point past which DealMate stops and protects the shopper. */
export function walkAwayPrice(ctx: Pick<BuyerContext, "budget">): number {
  return ctx.budget;
}

export function decide(ctx: BuyerContext, aggressiveness = 0.5): BuyerDecision {
  const seller = ctx.currentSellerOffer;
  const acceptCeiling = Math.min(ctx.budget, ctx.autoAcceptAt ?? ctx.budget);
  const last = ctx.previousOffers[ctx.previousOffers.length - 1] ?? openingOffer(ctx);
  const roundsLeft = ctx.maxRounds - ctx.round;

  // Seller already inside the shopper's happy zone — take it.
  if (seller <= acceptCeiling && (seller <= ctx.targetPrice * 1.04 || roundsLeft <= 1)) {
    return { type: "accept", amount: seller, line: "That's a good place to stop. Locking it in." };
  }

  // Out of rounds and still above the ceiling — protect the budget.
  if (roundsLeft <= 0) {
    if (seller <= ctx.budget) {
      return { type: "accept", amount: seller, line: "This is the best available inside your limit." };
    }
    return {
      type: "reject",
      amount: seller,
      line: "The seller's best is above your maximum. I'm not going past your limit.",
    };
  }

  const gap = Math.max(0, seller - last);
  // Concede more slowly early, faster as rounds run out.
  const progress = ctx.round / Math.max(1, ctx.maxRounds);
  const push = Math.min(1, Math.max(0, aggressiveness));
  const step = gap * (0.22 + 0.3 * progress) * (1.2 - 0.4 * push);

  let next = round10(last + step);
  next = Math.min(next, ctx.budget, seller);

  // Never repeat or regress — that's not a negotiation, it's a loop.
  if (next <= last) {
    const nudge = round10(Math.min(last + Math.max(50, gap * 0.15), ctx.budget, seller));
    if (nudge <= last) {
      if (seller <= ctx.budget) {
        return { type: "accept", amount: seller, line: "We've squeezed what's here. Taking the seller's number." };
      }
      return {
        type: "reject",
        amount: seller,
        line: "There's no more room here and the seller is above your maximum.",
      };
    }
    next = nudge;
  }

  const isFinal = roundsLeft <= 1 || next >= ctx.budget;
  return {
    type: isFinal ? "final_offer" : "counter_offer",
    amount: next,
    line: isFinal
      ? "This is as far as I can go for you."
      : "I can move up a little, but not all the way.",
  };
}

/** A defensible target from listed price and observed market band. */
export function fairPriceEstimate(listedPrice: number, marketLow: number, marketHigh: number): number {
  const midMarket = (marketLow + marketHigh) / 2;
  return round10(Math.min(listedPrice * 0.88, midMarket));
}
