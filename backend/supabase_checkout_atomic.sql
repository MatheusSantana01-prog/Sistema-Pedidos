-- Backend-only RPCs. All financial writes succeed or roll back together.
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS payment_breakdown jsonb;
CREATE OR REPLACE FUNCTION public.save_cash_shifts_checked(
  p_restaurant_id uuid, p_expected jsonb, p_shifts jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE current_shifts jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text || ':cash_shifts', 0));
  SELECT valor::jsonb INTO current_shifts FROM configuracoes
    WHERE restaurant_id = p_restaurant_id AND chave = 'cash_shifts' FOR UPDATE;
  IF COALESCE(current_shifts, '[]'::jsonb) IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Caixa atualizado por outra operacao. Atualize a tela e tente novamente';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_shifts) WHERE value->>'status' = 'open'
    GROUP BY value->>'register_id' HAVING count(*) > 1) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Este caixa ja esta aberto';
  END IF;
  INSERT INTO configuracoes(restaurant_id, chave, valor, descricao, updated_at)
    VALUES(p_restaurant_id, 'cash_shifts', p_shifts::text, 'Aberturas e fechamentos de caixa', now())
    ON CONFLICT (restaurant_id, chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now();
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_order_session_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE session_status text; session_table uuid;
BEGIN
  IF NEW.sessao_mesa_id IS NULL THEN RETURN NEW; END IF;
  SELECT status, mesa_id INTO session_status, session_table FROM sessao_mesa
    WHERE id = NEW.sessao_mesa_id AND restaurant_id = NEW.restaurant_id FOR UPDATE;
  IF NOT FOUND OR session_status <> 'aberta' OR session_table IS DISTINCT FROM NEW.mesa_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Sessao da mesa invalida ou fechada';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_order_session_write ON public.pedidos;
CREATE TRIGGER guard_order_session_write BEFORE INSERT OR UPDATE OF status ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_session_write();

CREATE OR REPLACE FUNCTION public.checkout_table_atomic(
  p_restaurant_id uuid, p_session_id uuid, p_expected_total numeric,
  p_payments jsonb, p_order_payments jsonb, p_closure jsonb,
  p_shift_id text DEFAULT NULL, p_cashier_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  s sessao_mesa; total numeric; shifts jsonb; shift jsonb; shift_index int;
  entry record; methods jsonb; payment_total numeric; order_count int;
BEGIN
  -- Use the same lock as shift opening/closing to prevent lost sales totals.
  IF p_shift_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text || ':cash_shifts', 0));
    SELECT valor::jsonb INTO shifts FROM configuracoes
      WHERE restaurant_id = p_restaurant_id AND chave = 'cash_shifts' FOR UPDATE;
    SELECT value, (ordinality - 1)::int INTO shift, shift_index
      FROM jsonb_array_elements(COALESCE(shifts, '[]'::jsonb)) WITH ORDINALITY
      WHERE value->>'id' = p_shift_id;
    IF shift IS NULL OR shift->>'status' <> 'open' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Turno de caixa nao esta aberto';
    END IF;
    IF p_cashier_id IS NOT NULL AND shift->>'opened_by' IS DISTINCT FROM p_cashier_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Este turno pertence a outro caixa';
    END IF;
  END IF;
  SELECT * INTO s FROM sessao_mesa
    WHERE id = p_session_id AND restaurant_id = p_restaurant_id FOR UPDATE;
  IF NOT FOUND OR s.status <> 'aberta' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Conta ja fechada ou sessao invalida';
  END IF;
  PERFORM id FROM pedidos WHERE sessao_mesa_id = s.id AND restaurant_id = p_restaurant_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM pedidos WHERE sessao_mesa_id = s.id AND restaurant_id = p_restaurant_id
    AND status NOT IN ('entregue', 'cancelado')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Ainda existem pedidos em aberto';
  END IF;
  SELECT COALESCE(sum(p.total), 0), count(*) INTO total, order_count FROM pedidos p
    WHERE sessao_mesa_id = s.id AND restaurant_id = p_restaurant_id AND status <> 'cancelado';
  IF total IS DISTINCT FROM p_expected_total THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Total da conta mudou. Atualize a tela';
  END IF;
  SELECT COALESCE(sum((value->>'valor')::numeric), 0) INTO payment_total FROM jsonb_array_elements(p_payments);
  IF payment_total IS DISTINCT FROM total OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_payments) WHERE (value->>'valor')::numeric <= 0
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Pagamentos nao conferem com o total';
  END IF;
  IF jsonb_array_length(p_order_payments) <> order_count OR EXISTS (
    SELECT 1 FROM pedidos p WHERE p.sessao_mesa_id = s.id AND p.restaurant_id = p_restaurant_id AND p.status <> 'cancelado'
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_order_payments) x WHERE x->>'id' = p.id::text)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Pedidos da conta mudaram. Atualize a tela';
  END IF;
  UPDATE pedidos p SET forma_pagamento = x.value->>'forma_pagamento', payment_breakdown = x.value->'payments', status_pagamento = 'aprovado', updated_at = now()
    FROM jsonb_array_elements(p_order_payments) x
    WHERE p.id::text = x.value->>'id' AND p.restaurant_id = p_restaurant_id AND p.sessao_mesa_id = s.id AND p.status <> 'cancelado';
  IF p_shift_id IS NOT NULL THEN
    methods = COALESCE(shift->'payments_by_method', '{}'::jsonb);
    FOR entry IN SELECT value->>'forma_pagamento' AS code, sum((value->>'valor')::numeric) AS amount
      FROM jsonb_array_elements(p_payments) GROUP BY value->>'forma_pagamento'
    LOOP
      methods = jsonb_set(methods, ARRAY[entry.code], to_jsonb(COALESCE((methods->>entry.code)::numeric, 0) + entry.amount));
    END LOOP;
    shift = shift || jsonb_build_object(
      'sales_total', COALESCE((shift->>'sales_total')::numeric, 0) + total,
      'transactions_count', COALESCE((shift->>'transactions_count')::int, 0) + 1,
      'payments_by_method', methods, 'updated_at', now(),
      'account_closures', COALESCE(shift->'account_closures', '[]'::jsonb) || jsonb_build_array(
        p_closure || jsonb_build_object('sessao_id', s.id, 'total', total, 'pagamentos', p_payments))
    );
    shifts = jsonb_set(shifts, ARRAY[shift_index::text], shift);
    UPDATE configuracoes SET valor = shifts::text, updated_at = now()
      WHERE restaurant_id = p_restaurant_id AND chave = 'cash_shifts';
  END IF;
  UPDATE sessao_mesa SET status = 'fechada', fechada_em = now(), total_consumido = total,
    observacao = COALESCE(p_closure->>'observacao', observacao), updated_at = now() WHERE id = s.id;
  UPDATE mesas SET status = 'livre', updated_at = now() WHERE id = s.mesa_id AND restaurant_id = p_restaurant_id;
  RETURN jsonb_build_object('total', total, 'cash_shift', shift);
END;
$$;

REVOKE ALL ON FUNCTION public.save_cash_shifts_checked(uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.checkout_table_atomic(uuid,uuid,numeric,jsonb,jsonb,jsonb,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_order_session_write() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_cash_shifts_checked(uuid,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.checkout_table_atomic(uuid,uuid,numeric,jsonb,jsonb,jsonb,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_order_session_write() TO service_role;
