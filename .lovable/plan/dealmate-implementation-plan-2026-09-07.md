# DealMate — Implementation Plan

**Tagline:** Shop smarter. Negotiate better.

Two things worth flagging up front:

1. **This project workspace is empty** — it's a fresh Lovable template (React + TypeScript + Vite + Tailwind + TanStack Router). The GitHub repo you referenced isn't connected here, so nothing exists to inspect or preserve. I'll build DealMate from scratch, then layer the agent-to-agent negotiation engine on top, in one continuous plan.
2. **No logo image came through.** Please attach it and I'll wire it in; otherwise I'll design a wordmark that matches the dark gold aesthetic and swap it later.

---

## Key decisions (flagging before I build)

- **Backend:** Lovable Cloud (managed Postgres, auth, storage, realtime, server-side AI). Negotiation logic runs in server code, never in the browser.
- **Router:** The template uses TanStack Router, not React Router. Same capabilities; React Router can't be swapped in on this stack.
- **AI:** Lovable AI (server-side only, no keys in the browser). The model *proposes* negotiation moves and writes the natural language; a deterministic engine validates every rupee. The model can never set a final price.
- **Anti-fake guarantee:** all offers, counters, acceptance and the final price are computed and persisted server-side, round by round. The UI only renders stored state.

---

## PHASE 1 — Design system + shell
Dark "premium dealmaking" palette as semantic tokens (bg `#15120E`, panel `#1F1B15`, gold `#E8A33D`, sage `#7FA88A`, coral `#E88C6B`, text `#F4EFE6`). Display sans for headings, grotesk body, mono for prices/IDs/agent labels. Motion primitives + reduced-motion support. App shell, nav, toasts.
Files: `src/styles.css`, `src/components/layout/*`, `src/lib/motion.ts`.

## PHASE 2 — Database + security
Tables: `products`, `live_offers`, `sellers`, `seller_agents`, `negotiation_sessions`, `negotiation_messages`, `negotiation_offers`, `conversation_messages`, `deals`, `orders`, `agent_events`, `user_roles`.
Enums for status/stage/sender/type. Foreign keys, indexes, timestamps, check constraints. Row-level security so each user reads only their own sessions, messages, deals and orders; products and active offers are publicly readable; seller policy rows are server-only and never reach the browser. Admin gated by a separate roles table.
Seed: 8+ products across exactly two categories (Running Shoes, Earbuds) with generated product imagery, realistic INR prices, tags, stock; 2–3 active offers with short expiry.

## PHASE 3 — Auth
Email/password signup, login, logout, persistent session, validation, loading/error/success states. Split-screen auth page in the DealMate visual language.

## PHASE 4 — Landing page
Hero with eyebrow, "Don't just shop. Make a deal.", both CTAs, and an animated negotiation preview (marketing demo data, clearly the only simulated surface). Trust strip; three agent cards (Preference/gold, Deal-Hunter/sage, Negotiation/coral); "Watch the price move" visualization; conversation-to-checkout flow; final CTA. SEO head tags.

## PHASE 5 — Chat workspace
`ChatSessionView`: conversation left (~55%), deal workspace right (~45%), mobile stacks conversation-first with a compact deal panel. Agent-labelled messages, typing indicator, natural entrance animation.

## PHASE 6 — Preference Agent
Server-side, max 3 questions (category / budget min-max INR / 1–2 must-haves). Strict JSON output, schema-validated, one retry on malformed output, graceful error. Returns a structured preference object.

## PHASE 7 — Deal-Hunter
Deterministic — no model. Filters by category and budget ±15%, cross-references active offers, ranks by relevance, budget fit, tags, effective price and offers. Returns top 3. Animated ranked `ProductGrid` with hover, stock, offer countdown from `expires_at`.

## PHASE 8 — Negotiation data models + protocol
Typed `NegotiationSession` and `NegotiationMessage` (structured: sender, type, amount, currency, reasoning, conditions). Every negotiation gets a `negotiationId` and is fully reconstructible from its stored messages and events.

## PHASE 9 — Buyer Agent
`buyerAgent` / `buyerStrategy` / `buyerPolicy`. Computes target price, opening offer, concession rate and walk-away price from listed price, market band, budget and round history. Opens below target, concedes gradually, never repeats an offer, never exceeds the user's maximum, never leaks the budget or strategy into outbound messages.

## PHASE 10 — Seller Agent
`sellerAgent` / `sellerStrategy` / `sellerPolicy` + `mockSellerAgent`, behind a `SellerAgent` interface (`getProductDetails`, `startNegotiation`, `submitOffer`). Private policy: listed/minimum/preferred price, max discount, inventory, demand, urgency, max rounds — stored server-side, never serialized to the client. Responds realistically without revealing its floor. Also stubs `ExternalSellerAgent` as the real-merchant adapter, plus a clear "Simulation" vs "Connected" label in the UI.

## PHASE 11 — Orchestrator + safeguards
`negotiationEngine` runs the loop server-side: model proposes → policy validation → budget validation → state validation → execution → seller response → state update → persist message, offer and event. Hard clamps on every amount. Terminal states: accepted, rejected, walked away, expired. Also enforces the retail rules from the original spec (15% single-item, 20% bundle at 2+ items) as server-side ceilings.

## PHASE 12 — Live negotiation UI
`NegotiationTimeline`, `AgentStatus`, `OfferCard`, `PriceBattle`, `NegotiationProgress`, `FinalDealCard`, plus a pre-negotiation setup panel (max budget, target, auto-accept threshold, max rounds, quantity, shipping/warranty, preferred seller). "Start AI Negotiation" streams rounds live. Agent Activity event log panel. Short user-safe status lines only — never raw model reasoning. Final deal screen with savings and percent; failure screen showing the gap and "DealMate protected your budget", with walk-away / increase budget / alternatives.

## PHASE 13 — Multi-seller
Negotiate the same product with several sellers in parallel, then a comparison view naming the best deal and total savings.

## PHASE 14 — Orders + realtime
`OrderModal` (quantity stepper, negotiated unit price, address, totals) → server-side order placement: validate user, revalidate negotiated price against stored state, check stock, atomically decrement, insert order, return real order ID. Success state with order number and copy action. `OrdersHistoryPage` with past orders and negotiation sessions, plus empty/loading/error states. Realtime subscriptions on offers and stock — no polling.

## PHASE 15 — Admin/seller view
Focused seller dashboard: view products, edit stock, create/update/toggle live offers with expiry, basic order visibility. Role-protected.

## PHASE 16 — Polish, tests, accessibility
Responsive 360px→desktop, keyboard navigation, focus states, ARIA, accessible modals, contrast, reduced motion. Tests: budget ceiling, seller floor, no duplicate offers, round-limit termination, successful deal, rejection, cancellation, auto-accept limits, no seller private data in client payloads, session reconstruction from events.

---

## What you'll be able to demo
Sign in → tell DealMate what you want → answer three questions → see ranked real products with live offers → set your budget and hit Start AI Negotiation → watch the two agents trade offers round by round with real, server-computed numbers → accept or walk away → place a real order that decrements real stock → change an offer in the seller view and watch the shopper screen update instantly.

Approve and I'll start with Phase 1.
