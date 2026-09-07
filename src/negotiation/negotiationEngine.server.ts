import { MockSellerAgent, ExternalSellerAgent, type SellerAgentAdapter } from "@/agents/seller/sellerAgent.server";
import type { SellerListingRow } from "@/agents/seller/sellerPolicy.server";
import { decide, openingOffer } from "@/agents/buyer/buyerStrategy.server";
import { marketBand } from "@/services/marketPrice.server";
import { getNegotiationAdvice } from "@/services/negotiationLlm.server";
import {
  MAX_SINGLE_ITEM_DISCOUNT_PCT,
  MAX_BUNDLE_DISCOUNT_PCT,
  BUNDLE_MIN_ITEMS,
  type NegotiationSetup,
  type NegotiationStatus,
} from "./negotiationTypes";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const num = (v: unknown) => Number(v ?? 0);

/** Absolute floor any negotiated price must respect, regardless of agents. */
export function platformFloor(catalogPrice: number, quantity: number): number {
  const pct = quantity >= BUNDLE_MIN_ITEMS ? MAX_BUNDLE_DISCOUNT_PCT : MAX_SINGLE_ITEM_DISCOUNT_PCT;
  return Math.round(catalogPrice * (1 - pct / 100));
}

async function adapterFor(admin: Admin, sellerId: string, productId: string, negotiationId: string) {
  const [{ data: seller }, { data: listing }] = await Promise.all([
    admin.from("sellers").select("*").eq("id", sellerId).maybeSingle(),
    admin.from("seller_listings").select("*").eq("seller_id", sellerId).eq("product_id", productId).maybeSingle(),
  ]);
  if (!seller || !listing) throw new Error("This seller is not listing that product.");

  const adapter: SellerAgentAdapter =
    seller.agent_kind === "connected" && seller.endpoint_url
      ? new ExternalSellerAgent(seller.endpoint_url, negotiationId, productId)
      : new MockSellerAgent(listing as unknown as SellerListingRow);

  return { adapter, seller, listing: listing as unknown as SellerListingRow };
}

async function logEvent(admin: Admin, negotiationId: string, actor: string, event: string, detail?: string) {
  await admin.from("agent_events").insert({ negotiation_id: negotiationId, actor, event, detail: detail ?? null });
}

async function logMessage(
  admin: Admin,
  negotiationId: string,
  round: number,
  sender: "buyer_agent" | "seller_agent" | "system",
  type: string,
  amount: number | null,
  reasoning: string,
  conditions: Record<string, unknown> = {},
) {
  await admin.from("negotiation_messages").insert({
    negotiation_id: negotiationId,
    round,
    sender,
    type: type as never,
    amount,
    reasoning,
    conditions,
  });
}

/** Creates the negotiation, opens the buyer's position and takes the seller's first reply. */
export async function startNegotiation(admin: Admin, userId: string, setup: NegotiationSetup) {
  const { data: product } = await admin.from("products").select("*").eq("id", setup.productId).maybeSingle();
  if (!product) throw new Error("That product is no longer available.");

  const { data: allListings } = await admin
    .from("seller_listings")
    .select("listed_price")
    .eq("product_id", setup.productId);
  const { data: offer } = await admin
    .from("live_offers")
    .select("discount_pct")
    .eq("product_id", setup.productId)
    .eq("active", true)
    .gt("expires_at", new Date().toISOString())
    .order("discount_pct", { ascending: false })
    .limit(1)
    .maybeSingle();

  const band = marketBand(
    (allListings ?? []).map((l) => num(l.listed_price)),
    num(product.price),
    num(offer?.discount_pct),
  );

  const { data: created, error } = await admin
    .from("negotiations")
    .insert({
      user_id: userId,
      product_id: setup.productId,
      seller_id: setup.sellerId,
      listed_price: 0,
      buyer_budget: setup.buyerBudget,
      target_price: setup.targetPrice,
      auto_accept_at: setup.autoAcceptAt,
      quantity: setup.quantity,
      max_rounds: setup.maxRounds,
      status: "initiated",
    })
    .select()
    .single();
  if (error || !created) throw new Error(error?.message ?? "Could not start the negotiation.");

  const { adapter, listing } = await adapterFor(admin, setup.sellerId, setup.productId, created.id);
  await adapter.connect();

  const listedPrice = num(listing.listed_price);
  const maxRounds = Math.min(setup.maxRounds, listing.max_rounds);

  await logEvent(admin, created.id, "buyer_agent", "Buyer Agent initialised");
  await logEvent(
    admin,
    created.id,
    "buyer_agent",
    "Market price analysed",
    `Comparable listings ${band.low}–${band.high}`,
  );

  const opening = openingOffer({
    listedPrice,
    targetPrice: setup.targetPrice,
    budget: setup.buyerBudget,
  });

  const sellerOpen = await adapter.opening();
  await logMessage(admin, created.id, 0, "seller_agent", "offer", sellerOpen.amount, sellerOpen.line, {
    shippingIncluded: setup.shippingIncluded,
    warrantyIncluded: setup.warrantyIncluded,
    quantity: setup.quantity,
  });
  await logEvent(admin, created.id, "seller_agent", "Seller agent connected", `Opening position received`);

  await logMessage(
    admin,
    created.id,
    1,
    "buyer_agent",
    "offer",
    opening,
    "Opening on the strength of comparable listings for this product.",
    { quantity: setup.quantity, shippingIncluded: setup.shippingIncluded },
  );
  await logEvent(admin, created.id, "buyer_agent", "Opening offer generated");

  await admin
    .from("negotiations")
    .update({
      listed_price: listedPrice,
      current_buyer_offer: opening,
      current_seller_offer: sellerOpen.amount,
      round: 1,
      max_rounds: maxRounds,
      status: "negotiating",
    })
    .eq("id", created.id);

  return created.id;
}

/** Runs exactly one round: seller replies, then the buyer agent decides. */
export async function advanceNegotiation(admin: Admin, userId: string, negotiationId: string) {
  const { data: neg } = await admin
    .from("negotiations")
    .select("*")
    .eq("id", negotiationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!neg) throw new Error("Negotiation not found.");
  if (["accepted", "rejected", "walked_away", "expired"].includes(neg.status)) return;

  const { data: product } = await admin.from("products").select("*").eq("id", neg.product_id).maybeSingle();
  if (!product) throw new Error("That product is no longer available.");

  const { adapter } = await adapterFor(admin, neg.seller_id, neg.product_id, neg.id);

  const round = neg.round;
  const buyerOffer = num(neg.current_buyer_offer);
  const sellerOffer = num(neg.current_seller_offer);
  const listedPrice = num(neg.listed_price);
  const floor = platformFloor(num(product.price), neg.quantity);

  const advice = await getNegotiationAdvice({
    productName: product.name,
    round,
    maxRounds: neg.max_rounds,
    listedPrice,
    lastBuyerOffer: buyerOffer,
    lastSellerOffer: sellerOffer,
    sellerName: "the seller",
  });

  await logEvent(admin, neg.id, "seller_agent", "Reviewing buyer offer");

  const sellerDecision = await adapter.submitOffer({
    buyerOffer,
    currentSellerOffer: sellerOffer,
    round,
    flexibilityHint: advice.seller_flexibility,
  });

  // Policy gate: nothing the seller agent returns may breach the platform floor.
  const sellerAmount = Math.max(floor, Math.round(sellerDecision.amount));

  if (sellerDecision.type === "accept") {
    await finalise(admin, neg.id, buyerOffer, listedPrice, "accepted", advice.seller_line);
    return;
  }

  await logMessage(
    admin,
    neg.id,
    round,
    "seller_agent",
    sellerDecision.type,
    sellerAmount,
    advice.seller_line || sellerDecision.line,
  );
  await logEvent(admin, neg.id, "seller_agent", "Counteroffer sent");

  await logEvent(admin, neg.id, "buyer_agent", "Analysing seller response");

  const buyerDecision = decide(
    {
      listedPrice,
      fairPrice: num(neg.target_price),
      budget: num(neg.buyer_budget),
      targetPrice: num(neg.target_price),
      autoAcceptAt: neg.auto_accept_at === null ? null : num(neg.auto_accept_at),
      round,
      maxRounds: neg.max_rounds,
      previousOffers: [buyerOffer],
      currentSellerOffer: sellerAmount,
    },
    advice.buyer_aggressiveness,
  );

  // Budget gate: the buyer agent can never be talked past the shopper's maximum.
  const budget = num(neg.buyer_budget);
  const buyerAmount = Math.min(Math.round(buyerDecision.amount), budget);

  if (buyerDecision.type === "accept") {
    await logMessage(admin, neg.id, round, "buyer_agent", "accept", buyerAmount, buyerDecision.line);
    await finalise(admin, neg.id, buyerAmount, listedPrice, "accepted", buyerDecision.line);
    return;
  }

  if (buyerDecision.type === "reject") {
    await logMessage(admin, neg.id, round, "buyer_agent", "reject", sellerAmount, buyerDecision.line);
    await finalise(admin, neg.id, null, listedPrice, "walked_away", buyerDecision.line);
    return;
  }

  await logMessage(
    admin,
    neg.id,
    round + 1,
    "buyer_agent",
    buyerDecision.type,
    buyerAmount,
    advice.buyer_line || buyerDecision.line,
  );
  await logEvent(admin, neg.id, "buyer_agent", `Counteroffer generated for round ${round + 1}`);

  await admin
    .from("negotiations")
    .update({
      current_seller_offer: sellerAmount,
      current_buyer_offer: buyerAmount,
      round: round + 1,
      status: "countered",
    })
    .eq("id", neg.id);
}

/** Shopper-driven close: accept the seller's number, or stop. */
export async function resolveNegotiation(
  admin: Admin,
  userId: string,
  negotiationId: string,
  action: "accept" | "walk_away",
) {
  const { data: neg } = await admin
    .from("negotiations")
    .select("*")
    .eq("id", negotiationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!neg) throw new Error("Negotiation not found.");
  if (["accepted", "rejected", "walked_away"].includes(neg.status)) return;

  if (action === "walk_away") {
    await finalise(admin, neg.id, null, num(neg.listed_price), "walked_away", "You chose to walk away.");
    return;
  }

  const sellerOffer = num(neg.current_seller_offer);
  if (sellerOffer > num(neg.buyer_budget)) {
    throw new Error("That price is above your maximum budget.");
  }
  await logMessage(admin, neg.id, neg.round, "buyer_agent", "accept", sellerOffer, "Accepted on your instruction.");
  await finalise(admin, neg.id, sellerOffer, num(neg.listed_price), "accepted", "Deal accepted.");
}

async function finalise(
  admin: Admin,
  negotiationId: string,
  finalPrice: number | null,
  listedPrice: number,
  status: NegotiationStatus,
  detail: string,
) {
  const savings = finalPrice === null ? null : Math.max(0, listedPrice - finalPrice);
  const savingsPct = savings === null || listedPrice <= 0 ? null : Number(((savings / listedPrice) * 100).toFixed(2));

  await admin
    .from("negotiations")
    .update({
      status,
      final_price: finalPrice,
      savings,
      savings_pct: savingsPct,
      completed_at: new Date().toISOString(),
      ...(finalPrice !== null ? { current_seller_offer: finalPrice, current_buyer_offer: finalPrice } : {}),
    })
    .eq("id", negotiationId);

  await logMessage(
    admin,
    negotiationId,
    0,
    "system",
    "status",
    finalPrice,
    status === "accepted" ? "Deal secured." : detail,
  );
  await logEvent(admin, negotiationId, "system", status === "accepted" ? "Deal accepted" : "Negotiation closed", detail);
}
