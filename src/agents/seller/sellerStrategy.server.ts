import { concessionRate, type SellerNegotiationPolicy } from "./sellerPolicy.server";

export interface SellerDecision {
  type: "counter_offer" | "accept" | "final_offer" | "reject";
  amount: number;
  /** User-safe explanation. Never leaks the seller's floor. */
  line: string;
}

const round10 = (v: number) => Math.round(v / 10) * 10;

/** The price at which this seller will say yes on a given round. */
function acceptThreshold(policy: SellerNegotiationPolicy, round: number): number {
  const span = Math.max(0, policy.preferredPrice - policy.minimumPrice);
  const progress = Math.min(1, round / Math.max(1, policy.maxRounds - 1));
  return policy.preferredPrice - span * progress;
}

/** The seller's opening position before the buyer has said anything. */
export function sellerOpening(policy: SellerNegotiationPolicy): number {
  const softener = policy.urgency === "high" ? 0.955 : 0.985;
  return round10(Math.max(policy.preferredPrice, policy.listedPrice * softener));
}

/**
 * Deterministic seller response to a buyer offer.
 * `flexibility` (0..1) is an optional model-proposed nudge; it can only move
 * the concession rate inside a narrow band and can never breach the floor.
 */
export function sellerRespond(
  policy: SellerNegotiationPolicy,
  buyerOffer: number,
  currentSellerOffer: number,
  round: number,
  flexibility = 0.5,
): SellerDecision {
  const threshold = acceptThreshold(policy, round);
  const isLastRound = round >= policy.maxRounds - 1;

  if (buyerOffer >= threshold && buyerOffer >= policy.minimumPrice) {
    return {
      type: "accept",
      amount: buyerOffer,
      line: "That works for us. Consider it done.",
    };
  }

  const flex = Math.min(1, Math.max(0, flexibility));
  const rate = concessionRate(policy) * (0.8 + 0.4 * flex);
  const gap = Math.max(0, currentSellerOffer - Math.max(buyerOffer, policy.minimumPrice));
  let next = currentSellerOffer - gap * rate;

  if (isLastRound) next = Math.max(policy.minimumPrice, threshold);

  // Hard floor. No model output, no round count, nothing gets below this.
  next = round10(Math.max(policy.minimumPrice, Math.min(next, currentSellerOffer)));

  if (next >= currentSellerOffer && !isLastRound) {
    return {
      type: "counter_offer",
      amount: currentSellerOffer,
      line: "We've already sharpened this one. We're holding here for now.",
    };
  }

  if (isLastRound || next <= policy.minimumPrice + 1) {
    return {
      type: "final_offer",
      amount: next,
      line: `We can do this at the quoted figure, and that is genuinely the end of our range.`,
    };
  }

  return {
    type: "counter_offer",
    amount: next,
    line: "We can move a little on this. Here's where we land.",
  };
}
