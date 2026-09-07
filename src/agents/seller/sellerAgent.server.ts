import { toPolicy, type SellerListingRow, type SellerNegotiationPolicy } from "./sellerPolicy.server";
import { sellerOpening, sellerRespond, type SellerDecision } from "./sellerStrategy.server";

/**
 * Adapter boundary between DealMate and any seller.
 * The buyer agent only ever sees what these methods return, so swapping in a
 * real merchant agent later requires no change to the orchestrator.
 */
export interface SellerAgentAdapter {
  readonly kind: "simulation" | "connected";
  connect(): Promise<void>;
  opening(): Promise<{ amount: number; line: string }>;
  submitOffer(input: {
    buyerOffer: number;
    currentSellerOffer: number;
    round: number;
    flexibilityHint?: number;
  }): Promise<SellerDecision>;
}

/** Deterministic in-house seller used for demos and development. */
export class MockSellerAgent implements SellerAgentAdapter {
  readonly kind = "simulation" as const;
  private policy: SellerNegotiationPolicy;

  constructor(listing: SellerListingRow) {
    this.policy = toPolicy(listing);
  }

  get maxRounds(): number {
    return this.policy.maxRounds;
  }

  get listedPrice(): number {
    return this.policy.listedPrice;
  }

  get shippingFee(): number {
    return this.policy.shippingFee;
  }

  async connect(): Promise<void> {
    /* nothing to negotiate over the wire */
  }

  async opening() {
    return {
      amount: sellerOpening(this.policy),
      line: "Happy to talk. Here's where we can start.",
    };
  }

  async submitOffer(input: {
    buyerOffer: number;
    currentSellerOffer: number;
    round: number;
    flexibilityHint?: number;
  }): Promise<SellerDecision> {
    return sellerRespond(
      this.policy,
      input.buyerOffer,
      input.currentSellerOffer,
      input.round,
      input.flexibilityHint ?? 0.5,
    );
  }
}

/**
 * Integration point for a real merchant-operated seller agent.
 * Speaks the same structured protocol over HTTP; the orchestrator cannot tell
 * the difference. Merchants register an endpoint on their seller record.
 */
export class ExternalSellerAgent implements SellerAgentAdapter {
  readonly kind = "connected" as const;

  constructor(
    private endpoint: string,
    private negotiationId: string,
    private productId: string,
  ) {}

  private async call(path: string, body: Record<string, unknown>) {
    const res = await fetch(`${this.endpoint.replace(/\/$/, "")}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        negotiationId: this.negotiationId,
        productId: this.productId,
        ...body,
      }),
    });
    if (!res.ok) throw new Error(`Seller agent unreachable (${res.status})`);
    return (await res.json()) as Record<string, unknown>;
  }

  async connect() {
    await this.call("connect", {});
  }

  async opening() {
    const data = await this.call("start", {});
    return { amount: Number(data['amount']), line: String(data['reasoning'] ?? "") };
  }

  async submitOffer(input: {
    buyerOffer: number;
    currentSellerOffer: number;
    round: number;
  }): Promise<SellerDecision> {
    const data = await this.call("offer", input);
    return {
      type: (data['type'] as SellerDecision["type"]) ?? "counter_offer",
      amount: Number(data['amount']),
      line: String(data['reasoning'] ?? ""),
    };
  }
}
