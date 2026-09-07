-- Run after supabase_checkout_atomic.sql, inside BEGIN / ROLLBACK.
DO $$
DECLARE
  rid uuid := gen_random_uuid(); mid uuid := gen_random_uuid(); sid uuid := gen_random_uuid();
  oid uuid := gen_random_uuid(); result jsonb; shifts jsonb; payments jsonb;
  order_payments jsonb; rejected boolean;
BEGIN
  INSERT INTO restaurants(id,name,slug) VALUES(rid,'QA transacional','qa-' || rid::text);
  INSERT INTO mesas(id,restaurant_id,numero,status) VALUES(mid,rid,1,'ocupada');
  INSERT INTO sessao_mesa(id,restaurant_id,mesa_id,status) VALUES(sid,rid,mid,'aberta');
  INSERT INTO pedidos(id,restaurant_id,mesa_id,sessao_mesa_id,status,subtotal,total)
    VALUES(oid,rid,mid,sid,'entregue',30,30);
  shifts = '[{"id":"qa-shift","register_id":"qa-register","status":"open","opened_by":"qa-user","sales_total":0,"transactions_count":0}]';
  PERFORM save_cash_shifts_checked(rid,'[]',shifts);
  payments = '[{"forma_pagamento":"pix","valor":10},{"forma_pagamento":"dinheiro","valor":20}]';
  order_payments = jsonb_build_array(jsonb_build_object('id',oid,'forma_pagamento','dinheiro','payments',payments));

  rejected = false;
  BEGIN
    PERFORM checkout_table_atomic(gen_random_uuid(),sid,30,payments,order_payments,'{}',NULL,NULL);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN rejected = true; END;
  ASSERT rejected, 'Cross-tenant checkout must fail';

  rejected = false;
  BEGIN
    PERFORM checkout_table_atomic(rid,sid,29,payments,order_payments,'{}','qa-shift','qa-user');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN rejected = true; END;
  ASSERT rejected, 'Changed total must fail';

  rejected = false;
  BEGIN
    PERFORM checkout_table_atomic(rid,sid,30,'[{"forma_pagamento":"pix","valor":29}]',order_payments,'{}','qa-shift','qa-user');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN rejected = true; END;
  ASSERT rejected, 'Wrong payment must fail';
  ASSERT (SELECT status='aberta' FROM sessao_mesa WHERE id=sid), 'Failed checkout must leave session open';
  ASSERT (SELECT status_pagamento<>'aprovado' FROM pedidos WHERE id=oid), 'Failed checkout must not pay order';

  rejected = false;
  BEGIN
    PERFORM checkout_table_atomic(rid,sid,30,payments,order_payments,'{}','qa-shift','other-user');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN rejected = true; END;
  ASSERT rejected, 'Cashier must own shift';

  UPDATE pedidos SET status='em_preparo' WHERE id=oid;
  rejected = false;
  BEGIN
    PERFORM checkout_table_atomic(rid,sid,30,payments,order_payments,'{}','qa-shift','qa-user');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN rejected = true; END;
  ASSERT rejected, 'Open order must block checkout';
  UPDATE pedidos SET status='entregue' WHERE id=oid;

  result = checkout_table_atomic(rid,sid,30,payments,order_payments,'{}','qa-shift','qa-user');
  ASSERT result->>'total'='30.00' OR (result->>'total')::numeric=30, 'Total mismatch';
  ASSERT (result->'cash_shift'->>'sales_total')::numeric=30, 'Shift total mismatch';
  ASSERT (result->'cash_shift'->'payments_by_method'->>'pix')::numeric=10, 'Pix split missing';
  ASSERT (result->'cash_shift'->'payments_by_method'->>'dinheiro')::numeric=20, 'Cash split missing';
  ASSERT (SELECT status='fechada' FROM sessao_mesa WHERE id=sid), 'Session must be closed';
  ASSERT (SELECT status='livre' FROM mesas WHERE id=mid), 'Table must be free';
  ASSERT (SELECT status_pagamento='aprovado' FROM pedidos WHERE id=oid), 'Order must be paid';
  ASSERT (SELECT payment_breakdown=payments FROM pedidos WHERE id=oid), 'Order split must be preserved';

  rejected = false;
  BEGIN
    PERFORM checkout_table_atomic(rid,sid,30,payments,order_payments,'{}','qa-shift','qa-user');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN rejected = true; END;
  ASSERT rejected, 'Duplicate checkout must fail';
  ASSERT (SELECT (valor::jsonb->0->>'sales_total')::numeric=30 FROM configuracoes WHERE restaurant_id=rid AND chave='cash_shifts'), 'Duplicate must not double sales';

  rejected = false;
  BEGIN
    PERFORM save_cash_shifts_checked(rid,shifts,shifts);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN rejected = true; END;
  ASSERT rejected, 'Stale shift write must fail';

  rejected = false;
  BEGIN
    INSERT INTO pedidos(restaurant_id,mesa_id,sessao_mesa_id,status,total) VALUES(rid,mid,sid,'pendente',10);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN rejected = true; END;
  ASSERT rejected, 'New order on closed session must fail';
  ASSERT NOT has_function_privilege('anon','checkout_table_atomic(uuid,uuid,numeric,jsonb,jsonb,jsonb,text,text)','EXECUTE'), 'Anonymous checkout forbidden';
  ASSERT has_function_privilege('service_role','checkout_table_atomic(uuid,uuid,numeric,jsonb,jsonb,jsonb,text,text)','EXECUTE'), 'Backend checkout required';
END;
$$;
SELECT 'checkout_database: passed' AS result;
