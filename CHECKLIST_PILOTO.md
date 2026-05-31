# Checklist Piloto

## Antes de instalar

- Restaurante criado com slug definitivo.
- Plano correto selecionado.
- Mesas criadas com quantidade correta.
- QR Codes testados em celular.
- Usuários reais criados: dono/admin, cozinha, caixa e garçom se o plano permitir.
- Senhas demo removidas.
- WhatsApp de suporte configurado.
- Executar checklist de `QA_FUNCIONAL.md` para o restaurante piloto.
- Confirmar `/health` do Render antes do treinamento.
- Confirmar rotas Vercel do slug real: admin, garçom, cozinha, caixa, TV e mesa.

## Cardápio

- Categorias revisadas.
- Produtos, preços e disponibilidade conferidos.
- Observações e adicionais testados quando houver.
- Pedido de teste criado pela mesa.

## Operação

- Cozinha recebe pedido.
- Cozinha avança para em preparo, pronto e entregue.
- Garçom vê mesas e chamados.
- Caixa abre turno.
- Caixa fecha conta com pagamento simples.
- Caixa fecha conta com pagamento misto.
- Admin vê histórico financeiro e fechamento do caixa.
- Validar login/logout de todos os perfis usados no restaurante.
- Validar alteração de senha do dono/admin.
- Validar estado offline simulando falha de API ou conexão.
- Validar tela em celular e tablet no salão.

## Segurança

- `CORS_ORIGINS` limitado aos domínios reais.
- Nenhuma chave privada no frontend.
- Super-admin protegido por senha forte.
- Usuários inativos removidos ou desativados.
- Usuário de outro restaurante não acessa o slug do piloto.
- Perfil cashier não acessa admin completo.
- Perfil kitchen não acessa caixa/admin.
- Restaurante bloqueado em teste perde acesso conforme regra configurada.

## Financeiro SaaS

- Mensalidade configurada.
- Data de vencimento configurada.
- Teste grátis, se houver, com data final.
- Registrar pagamento teste e conferir mudança para em dia.
- Simular vencido em alerta.
- Simular bloqueado e desbloquear antes de iniciar operação real.
- Conferir limite de caixas do plano.

## Limites do plano

- Confirmar limite de mesas.
- Confirmar limite de usuários.
- Confirmar limite de produtos.
- Confirmar limite de caixas.
- Tentar exceder um limite em ambiente de teste e validar mensagem.

## Estoque comercial

- Schema `backend/supabase_inventory_schema.sql` aplicado no Supabase.
- Owner/manager acessa aba `Estoque`.
- Caixa, garcom, cozinha e TV nao conseguem alterar estoque.
- Cadastrar insumo QA.
- Editar insumo QA.
- Registrar entrada QA.
- Registrar perda QA.
- Configurar estoque minimo.
- Ver alerta baixo/zerado.
- Criar ficha tecnica de produto QA.
- Entregar pedido QA e confirmar baixa automatica.
- Cancelar pedido QA ja entregue e confirmar estorno quando aplicavel.
- Confirmar isolamento de estoque entre dois restaurantes QA.

## Playwright E2E

- Rodar `npm install`.
- Rodar `npx playwright install chromium`.
- Rodar `npx playwright test`.
- Para fluxo autenticado, usar apenas variaveis `E2E_*` de restaurante temporario QA.

## Pós-instalação

- Fazer pedido real acompanhado.
- Validar impressão ou envio de comprovante, se aplicável.
- Registrar dúvidas do restaurante.
- Revisar chamados no super-admin.
- Fazer backup/exportação inicial dos dados.
