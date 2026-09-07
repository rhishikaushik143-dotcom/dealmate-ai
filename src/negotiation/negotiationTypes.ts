/**
 * Shared negotiation contract.
 * Client-safe: types only. No seller-private fields appear here.
 */

export type NegotiationStatus =
  | "initiated"
  | "negotiating"
  | "countered"
  | "accepted"
  | "rejected"
  | "walked_away"
  | "expired";

export type NegotiationSender = "buyer_agent" | "seller_agent" | "system";

export type NegotiationMessageType =
  | "offer"
  | "counter_offer"
  | "accept"
  | "reject"
  | "information_request"
  | "final_offer"
  | "status";

export interface NegotiationMessage {
  id: string;
  negotiation_id: string;
  round: number;
  sender: NegotiationSender;
  type: NegotiationMessageType;
  amount: number | null;
  currency: string;
  reasoning: string | null;
  conditions: Record<string, unknown>;
  created_at: string;
}

export interface AgentEvent {
  id: string;
  negotiation_id: string;
  actor: string;
  event: string;
  detail: string | null;
  created_at: string;
}

/** What the client is allowed to know about a negotiation. */
export interface NegotiationState {
  id: string;
  product_id: string;
  seller_id: string;
  seller_name: string;
  seller_agent_kind: "simulation" | "connected";
  listed_price: number;
  buyer_budget: number;
  target_price: number;
  auto_accept_at: number | null;
  quantity: number;
  current_buyer_offer: number | null;
  current_seller_offer: number | null;
  round: number;
  max_rounds: number;
  status: NegotiationStatus;
  final_price: number | null;
  savings: number | null;
  savings_pct: number | null;
  started_at: string;
  completed_at: string | null;
}

export interface NegotiationSnapshot {
  negotiation: NegotiationState;
  messages: NegotiationMessage[];
  events: AgentEvent[];
}

export interface NegotiationSetup {
  productId: string;
  sellerId: string;
  buyerBudget: number;
  targetPrice: number;
  autoAcceptAt: number | null;
  maxRounds: number;
  quantity: number;
  shippingIncluded: boolean;
  warrantyIncluded: boolean;
}

export const TERMINAL_STATUSES: NegotiationStatus[] = [
  "accepted",
  "rejected",
  "walked_away",
  "expired",
];

export function isTerminal(status: NegotiationStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Platform-wide ceilings. Enforced server-side; mirrored here for display copy. */
export const MAX_SINGLE_ITEM_DISCOUNT_PCT = 15;
export const MAX_BUNDLE_DISCOUNT_PCT = 20;
export const BUNDLE_MIN_ITEMS = 2;
