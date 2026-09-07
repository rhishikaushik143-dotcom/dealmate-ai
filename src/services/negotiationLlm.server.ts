import { z } from "zod";

/**
 * The model advises on tone and how hard to push. It never sets a price:
 * the engine takes only these two bounded numbers plus display copy, then
 * runs its own arithmetic.
 */
const AdviceSchema = z.object({
  buyer_aggressiveness: z.number(),
  seller_flexibility: z.number(),
  buyer_line: z.string(),
  seller_line: z.string(),
});

export type NegotiationAdvice = z.infer<typeof AdviceSchema>;

export interface AdviceInput {
  productName: string;
  round: number;
  maxRounds: number;
  listedPrice: number;
  lastBuyerOffer: number | null;
  lastSellerOffer: number | null;
  sellerName: string;
}

const SYSTEM = `You coach two negotiating agents in an Indian retail marketplace.
Return STRICT JSON only, no prose, matching exactly:
{"buyer_aggressiveness": number 0-1, "seller_flexibility": number 0-1, "buyer_line": string, "seller_line": string}
buyer_line is what the buyer's agent says while pushing for a better price.
seller_line is the seller agent's reply.
Both lines: one short sentence, under 110 characters, plain professional English, no emoji,
no rupee figures, no mention of budgets, limits, floors or internal strategy.`;

function fallback(input: AdviceInput): NegotiationAdvice {
  return {
    buyer_aggressiveness: 0.5,
    seller_flexibility: 0.5,
    buyer_line: "I think there's still room here — let's meet closer to my side.",
    seller_line: `${input.sellerName} can move a little, but not far.`,
  };
}

async function callGateway(input: AdviceInput, strictRetry: boolean): Promise<string | null> {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) return null;

  const user = `Product: ${input.productName}. Seller: ${input.sellerName}.
Round ${input.round} of ${input.maxRounds}. Listed price ${input.listedPrice}.
Buyer's last offer: ${input.lastBuyerOffer ?? "none"}. Seller's last offer: ${input.lastSellerOffer ?? "none"}.
${strictRetry ? "Your previous reply was not valid JSON. Reply with the JSON object only." : ""}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-lite",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    console.error("AI gateway error", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? null;
}

function parse(raw: string | null): NegotiationAdvice | null {
  if (!raw) return null;
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
    const parsed = AdviceSchema.safeParse(JSON.parse(cleaned));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Never throws — a model outage degrades to deterministic phrasing. */
export async function getNegotiationAdvice(input: AdviceInput): Promise<NegotiationAdvice> {
  try {
    let advice = parse(await callGateway(input, false));
    if (!advice) advice = parse(await callGateway(input, true));
    if (!advice) return fallback(input);

    const clamp = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);
    const trim = (s: string, f: string) => {
      const t = s.trim();
      return t.length > 0 && t.length <= 160 ? t : f;
    };
    const fb = fallback(input);
    return {
      buyer_aggressiveness: clamp(advice.buyer_aggressiveness),
      seller_flexibility: clamp(advice.seller_flexibility),
      buyer_line: trim(advice.buyer_line, fb.buyer_line),
      seller_line: trim(advice.seller_line, fb.seller_line),
    };
  } catch (error) {
    console.error("negotiation advice failed", error);
    return fallback(input);
  }
}
