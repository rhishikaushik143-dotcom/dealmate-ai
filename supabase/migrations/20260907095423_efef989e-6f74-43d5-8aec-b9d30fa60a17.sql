-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TYPE public.negotiation_status AS ENUM ('initiated','negotiating','countered','accepted','rejected','walked_away','expired');
CREATE TYPE public.negotiation_sender AS ENUM ('buyer_agent','seller_agent','system');
CREATE TYPE public.negotiation_msg_type AS ENUM ('offer','counter_offer','accept','reject','information_request','final_offer','status');
CREATE TYPE public.order_status AS ENUM ('placed','confirmed','shipped','delivered','cancelled');
CREATE TYPE public.shop_stage AS ENUM ('greeting','category','budget','preferences','matching','negotiating','ordered');
CREATE TYPE public.demand_level AS ENUM ('low','medium','high');

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PRODUCTS
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  price numeric(10,2) NOT NULL CHECK (price > 0),
  tags text[] NOT NULL DEFAULT '{}',
  image_url text NOT NULL,
  stock_count integer NOT NULL DEFAULT 0 CHECK (stock_count >= 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON public.products(category);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products readable" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage products" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- LIVE OFFERS
CREATE TABLE public.live_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'LIVE DEAL',
  discount_pct numeric(5,2) NOT NULL CHECK (discount_pct > 0 AND discount_pct <= 40),
  expires_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX live_offers_product_idx ON public.live_offers(product_id);
GRANT SELECT ON public.live_offers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.live_offers TO authenticated;
GRANT ALL ON public.live_offers TO service_role;
ALTER TABLE public.live_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offers readable" ON public.live_offers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage offers" ON public.live_offers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- SELLERS
CREATE TABLE public.sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  agent_kind text NOT NULL DEFAULT 'simulation' CHECK (agent_kind IN ('simulation','connected')),
  endpoint_url text,
  verified boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sellers TO anon, authenticated;
GRANT ALL ON public.sellers TO service_role;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sellers readable" ON public.sellers FOR SELECT TO anon, authenticated USING (true);

-- SELLER LISTINGS (private policy; server-only)
CREATE TABLE public.seller_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  listed_price numeric(10,2) NOT NULL,
  minimum_price numeric(10,2) NOT NULL,
  preferred_price numeric(10,2) NOT NULL,
  max_discount_pct numeric(5,2) NOT NULL DEFAULT 15,
  inventory_level integer NOT NULL DEFAULT 20,
  demand_level public.demand_level NOT NULL DEFAULT 'medium',
  urgency public.demand_level NOT NULL DEFAULT 'medium',
  max_rounds integer NOT NULL DEFAULT 6,
  shipping_fee numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_id, product_id)
);
GRANT ALL ON public.seller_listings TO service_role;
ALTER TABLE public.seller_listings ENABLE ROW LEVEL SECURITY;

-- Public-safe projection of seller listings
CREATE VIEW public.seller_listings_public AS
  SELECT sl.id, sl.seller_id, sl.product_id, sl.listed_price, sl.shipping_fee,
         s.name AS seller_name, s.agent_kind, s.verified
  FROM public.seller_listings sl JOIN public.sellers s ON s.id = sl.seller_id;
GRANT SELECT ON public.seller_listings_public TO anon, authenticated;

-- SHOPPING SESSIONS
CREATE TABLE public.negotiation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text,
  budget_min numeric(10,2),
  budget_max numeric(10,2),
  preferences text[] NOT NULL DEFAULT '{}',
  stage public.shop_stage NOT NULL DEFAULT 'greeting',
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  final_price numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX negotiation_sessions_user_idx ON public.negotiation_sessions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.negotiation_sessions TO authenticated;
GRANT ALL ON public.negotiation_sessions TO service_role;
ALTER TABLE public.negotiation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own shopping sessions" ON public.negotiation_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.negotiation_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','agent')),
  agent text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversation_messages_session_idx ON public.conversation_messages(session_id, created_at);
GRANT SELECT, INSERT ON public.conversation_messages TO authenticated;
GRANT ALL ON public.conversation_messages TO service_role;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own conversation messages" ON public.conversation_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.negotiation_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.negotiation_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));

-- AGENT NEGOTIATIONS
CREATE TABLE public.negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.negotiation_sessions(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  listed_price numeric(10,2) NOT NULL,
  buyer_budget numeric(10,2) NOT NULL,
  target_price numeric(10,2) NOT NULL,
  auto_accept_at numeric(10,2),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  current_buyer_offer numeric(10,2),
  current_seller_offer numeric(10,2),
  round integer NOT NULL DEFAULT 0,
  max_rounds integer NOT NULL DEFAULT 6,
  status public.negotiation_status NOT NULL DEFAULT 'initiated',
  final_price numeric(10,2),
  savings numeric(10,2),
  savings_pct numeric(5,2),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX negotiations_user_idx ON public.negotiations(user_id, started_at DESC);
GRANT SELECT ON public.negotiations TO authenticated;
GRANT ALL ON public.negotiations TO service_role;
ALTER TABLE public.negotiations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own negotiations" ON public.negotiations FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.negotiation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id uuid NOT NULL REFERENCES public.negotiations(id) ON DELETE CASCADE,
  round integer NOT NULL DEFAULT 0,
  sender public.negotiation_sender NOT NULL,
  type public.negotiation_msg_type NOT NULL,
  amount numeric(10,2),
  currency text NOT NULL DEFAULT 'INR',
  reasoning text,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX negotiation_messages_neg_idx ON public.negotiation_messages(negotiation_id, created_at);
GRANT SELECT ON public.negotiation_messages TO authenticated;
GRANT ALL ON public.negotiation_messages TO service_role;
ALTER TABLE public.negotiation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own negotiation messages" ON public.negotiation_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.negotiations n WHERE n.id = negotiation_id AND n.user_id = auth.uid()));

CREATE TABLE public.agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id uuid NOT NULL REFERENCES public.negotiations(id) ON DELETE CASCADE,
  actor text NOT NULL,
  event text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_events_neg_idx ON public.agent_events(negotiation_id, created_at);
GRANT SELECT ON public.agent_events TO authenticated;
GRANT ALL ON public.agent_events TO service_role;
ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agent events" ON public.agent_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.negotiations n WHERE n.id = negotiation_id AND n.user_id = auth.uid()));

-- ORDERS
CREATE SEQUENCE public.order_ref_seq START 1042;
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref text NOT NULL UNIQUE DEFAULT ('DM-' || lpad(nextval('public.order_ref_seq')::text, 4, '0')),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  negotiation_id uuid REFERENCES public.negotiations(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  negotiated_price numeric(10,2) NOT NULL CHECK (negotiated_price > 0),
  total numeric(10,2) NOT NULL,
  delivery_address text NOT NULL,
  status public.order_status NOT NULL DEFAULT 'placed',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_idx ON public.orders(user_id, created_at DESC);
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ATOMIC ORDER PLACEMENT
CREATE OR REPLACE FUNCTION public.place_order(
  p_product_id uuid, p_quantity integer, p_negotiated_price numeric,
  p_address text, p_negotiation_id uuid DEFAULT NULL
) RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_product public.products%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_price numeric(10,2);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 10 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;

  UPDATE public.products SET stock_count = stock_count - p_quantity
  WHERE id = p_product_id AND stock_count >= p_quantity
  RETURNING * INTO v_product;
  IF NOT FOUND THEN RAISE EXCEPTION 'OUT_OF_STOCK'; END IF;

  IF p_negotiation_id IS NOT NULL THEN
    SELECT final_price INTO v_price FROM public.negotiations
    WHERE id = p_negotiation_id AND user_id = v_user AND status = 'accepted' AND product_id = p_product_id;
    IF v_price IS NULL THEN RAISE EXCEPTION 'NEGOTIATION_NOT_VALID'; END IF;
  ELSE
    v_price := v_product.price;
  END IF;

  IF v_price < v_product.price * 0.60 THEN RAISE EXCEPTION 'PRICE_OUT_OF_BOUNDS'; END IF;

  INSERT INTO public.orders (user_id, product_id, negotiation_id, quantity, negotiated_price, total, delivery_address)
  VALUES (v_user, p_product_id, p_negotiation_id, p_quantity, v_price, v_price * p_quantity, p_address)
  RETURNING * INTO v_order;

  RETURN v_order;
END; $$;
GRANT EXECUTE ON FUNCTION public.place_order(uuid,integer,numeric,text,uuid) TO authenticated;

-- REALTIME
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.live_offers REPLICA IDENTITY FULL;
ALTER TABLE public.negotiation_messages REPLICA IDENTITY FULL;
ALTER TABLE public.negotiations REPLICA IDENTITY FULL;
ALTER TABLE public.agent_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.negotiation_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.negotiations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_events;

-- SEED PRODUCTS
INSERT INTO public.products (id, name, category, price, tags, image_url, stock_count, description) VALUES
('11111111-0000-4000-8000-000000000001','Stride Aero 4 Running Shoes','Running Shoes',4999,ARRAY['lightweight','comfort','daily trainer','breathable'],'/products/stride-aero-4.jpg',18,'A responsive daily trainer with a breathable knit upper and a soft rebound midsole.'),
('11111111-0000-4000-8000-000000000002','Trailform GTX Running Shoes','Running Shoes',6499,ARRAY['durability','trail','grip','water resistant'],'/products/trailform-gtx.jpg',9,'Rugged trail runner with a lugged outsole and a water-resistant shell.'),
('11111111-0000-4000-8000-000000000003','Cloudline Pace Running Shoes','Running Shoes',3799,ARRAY['comfort','cushioned','lightweight','everyday'],'/products/cloudline-pace.jpg',24,'Plush cushioning tuned for long easy miles without extra weight.'),
('11111111-0000-4000-8000-000000000004','Velo Carbon Race Running Shoes','Running Shoes',8999,ARRAY['lightweight','race day','carbon plate','speed'],'/products/velo-carbon-race.jpg',6,'A carbon-plated race shoe built for personal-best attempts.'),
('11111111-0000-4000-8000-000000000005','Nimbus Air Pro Earbuds','Earbuds',2999,ARRAY['battery life','low latency','microphone','noise cancelling'],'/products/nimbus-air-pro.jpg',32,'Compact ANC earbuds with 38 hours of total battery and a clear call mic.'),
('11111111-0000-4000-8000-000000000006','Pulse Sport Earbuds','Earbuds',2199,ARRAY['sweat resistant','secure fit','battery life','sport'],'/products/pulse-sport.jpg',27,'Sweat-resistant sport buds with a locking fin and fast charging.'),
('11111111-0000-4000-8000-000000000007','Quietwave Studio Earbuds','Earbuds',5499,ARRAY['noise cancelling','microphone','premium','battery life'],'/products/quietwave-studio.jpg',14,'Studio-tuned buds with adaptive noise cancelling and a three-mic array.'),
('11111111-0000-4000-8000-000000000008','Echo Lite Earbuds','Earbuds',1499,ARRAY['lightweight','low latency','budget','microphone'],'/products/echo-lite.jpg',41,'Featherweight everyday buds with a low-latency gaming mode.');

-- SEED SELLERS
INSERT INTO public.sellers (id, name, agent_kind, verified) VALUES
('22222222-0000-4000-8000-000000000001','Northline Retail','simulation',true),
('22222222-0000-4000-8000-000000000002','Kavya Sports Depot','simulation',true),
('22222222-0000-4000-8000-000000000003','Meridian Audio Co.','simulation',true);

-- SEED SELLER LISTINGS (private negotiation policy)
INSERT INTO public.seller_listings (seller_id, product_id, listed_price, minimum_price, preferred_price, max_discount_pct, inventory_level, demand_level, urgency, max_rounds, shipping_fee)
SELECT s.id, p.id,
  round(p.price * m.listed_mult, 0),
  round(p.price * m.min_mult, 0),
  round(p.price * m.pref_mult, 0),
  m.maxdisc, m.inv, m.demand::public.demand_level, m.urg::public.demand_level, m.rounds, m.ship
FROM public.products p
CROSS JOIN LATERAL (VALUES
  ('22222222-0000-4000-8000-000000000001'::uuid, 1.00, 0.855, 0.94, 15, 24, 'medium','medium', 6, 0),
  ('22222222-0000-4000-8000-000000000002'::uuid, 1.03, 0.875, 0.95, 13, 11, 'high','low', 5, 99),
  ('22222222-0000-4000-8000-000000000003'::uuid, 0.97, 0.865, 0.93, 14, 40, 'low','high', 7, 0)
) AS m(seller, listed_mult, min_mult, pref_mult, maxdisc, inv, demand, urg, rounds, ship)
JOIN public.sellers s ON s.id = m.seller;

-- SEED LIVE OFFERS
INSERT INTO public.live_offers (product_id, label, discount_pct, expires_at, active) VALUES
('11111111-0000-4000-8000-000000000003','LIVE DEAL',12,now() + interval '45 minutes',true),
('11111111-0000-4000-8000-000000000005','FLASH OFFER',10,now() + interval '20 minutes',true),
('11111111-0000-4000-8000-000000000002','WEEKEND DEAL',8,now() + interval '3 hours',true);