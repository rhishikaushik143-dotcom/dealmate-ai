-- Column-level access to seller listings: only the safe columns
GRANT SELECT (id, seller_id, product_id, listed_price, shipping_fee) ON public.seller_listings TO anon, authenticated;
CREATE POLICY "listings readable" ON public.seller_listings FOR SELECT TO anon, authenticated USING (true);

DROP VIEW public.seller_listings_public;
CREATE VIEW public.seller_listings_public WITH (security_invoker = on) AS
  SELECT sl.id, sl.seller_id, sl.product_id, sl.listed_price, sl.shipping_fee,
         s.name AS seller_name, s.agent_kind, s.verified
  FROM public.seller_listings sl JOIN public.sellers s ON s.id = sl.seller_id;
GRANT SELECT ON public.seller_listings_public TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.place_order(uuid,integer,numeric,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_order(uuid,integer,numeric,text,uuid) TO authenticated;