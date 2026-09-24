ALTER TABLE public.reservas ALTER COLUMN status_pagamento DROP DEFAULT;
ALTER TABLE public.reservas ALTER COLUMN status_pagamento TYPE boolean USING (status_pagamento IN ('true','Pago','Confirmado'));
ALTER TABLE public.reservas ALTER COLUMN status_pagamento SET DEFAULT false;

DROP FUNCTION IF EXISTS public.reserva_por_codigo(text);
CREATE FUNCTION public.reserva_por_codigo(p_codigo text)
RETURNS TABLE(codigo_reserva text, onibus text, tipo_poltrona text, preferencia_poltrona text, nome text, forma_pagamento text, valor_total numeric, valor_pagamento numeric, status_pagamento boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT codigo_reserva, onibus, tipo_poltrona, preferencia_poltrona, nome,
         forma_pagamento, valor_total, valor_pagamento, status_pagamento
  FROM public.reservas WHERE codigo_reserva = upper(trim(p_codigo));
$$;
GRANT EXECUTE ON FUNCTION public.reserva_por_codigo(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.criar_reserva(p_onibus text, p_tipo_poltrona text, p_preferencia_poltrona text, p_nome text, p_cpf text, p_celular text, p_igreja text, p_forma_pagamento text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$DECLARE
  v_prefixo text; v_total int; v_ocupadas int; v_capacidade int;
  v_valor_total numeric; v_valor_pagamento numeric; v_codigo text;
BEGIN
  IF p_onibus NOT IN ('Floriano', 'Guadalupe') THEN RAISE EXCEPTION 'Ônibus inválido'; END IF;
  IF p_preferencia_poltrona NOT IN ('Janela', 'Corredor') THEN RAISE EXCEPTION 'Preferência inválida'; END IF;
  IF p_forma_pagamento NOT IN ('PIX - Completo', 'PIX - Parcelado 2x', 'CARTÃO') THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
  IF coalesce(trim(p_nome), '') = '' OR coalesce(trim(p_cpf), '') = ''
     OR coalesce(trim(p_celular), '') = '' OR coalesce(trim(p_igreja), '') = '' THEN
    RAISE EXCEPTION 'Preencha todos os campos obrigatórios';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('reservas_' || p_onibus));
  IF p_onibus = 'Floriano' THEN
    IF p_tipo_poltrona NOT IN ('Leito', 'Comum') OR p_tipo_poltrona IS NULL THEN RAISE EXCEPTION 'Selecione o tipo de poltrona'; END IF;
    v_prefixo := 'FLR';
    v_capacidade := CASE WHEN p_tipo_poltrona = 'Leito' THEN 20 ELSE 40 END;
    v_valor_total := CASE WHEN p_tipo_poltrona = 'Leito' THEN 420 ELSE 350 END;
    SELECT count(*) INTO v_ocupadas FROM public.reservas WHERE onibus = 'Floriano' AND tipo_poltrona = p_tipo_poltrona;
  ELSE
    p_tipo_poltrona := NULL; v_prefixo := 'GLP'; v_capacidade := 6; v_valor_total := 293;
    SELECT count(*) INTO v_ocupadas FROM public.reservas WHERE onibus = 'Guadalupe';
  END IF;
  IF v_ocupadas >= v_capacidade THEN RAISE EXCEPTION 'ESGOTADO'; END IF;
  v_valor_pagamento := CASE WHEN p_forma_pagamento = 'PIX - Parcelado 2x' THEN round(v_valor_total / 2, 2) ELSE v_valor_total END;
  SELECT count(*) INTO v_total FROM public.reservas WHERE onibus = p_onibus;
  v_codigo := v_prefixo || '-' || lpad((v_total + 1)::text, 2, '0');
  INSERT INTO public.reservas (codigo_reserva, onibus, tipo_poltrona, preferencia_poltrona, nome, cpf,
    celular, igreja, forma_pagamento, valor_total, valor_pagamento, status_pagamento)
  VALUES (v_codigo, p_onibus, p_tipo_poltrona, p_preferencia_poltrona, trim(p_nome), trim(p_cpf),
    trim(p_celular), trim(p_igreja), p_forma_pagamento, v_valor_total, v_valor_pagamento, false);
  RETURN v_codigo;
END;$function$;

CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

DROP POLICY IF EXISTS "Authenticated can read reservas" ON public.reservas;
GRANT SELECT, UPDATE ON public.reservas TO authenticated;
CREATE POLICY "Admins read reservas" ON public.reservas FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update reservas" ON public.reservas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));