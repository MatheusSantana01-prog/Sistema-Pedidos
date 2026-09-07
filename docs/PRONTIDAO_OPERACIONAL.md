# Prontidao operacional: mesas, QR, cozinha e caixa

## Publicacao desta revisao

1. Executar testes Python e navegador local (E2E_LOCAL=1).
2. Validar backend/supabase_checkout_atomic.sql e tests/checkout_database.sql em uma transacao com ROLLBACK.
3. Aplicar backend/supabase_checkout_atomic.sql como migracao no Supabase.
4. Publicar frontend/ na Vercel. Conferir rewrites e headers de frontend/vercel.json.
5. Publicar backend no Render pela branch produto-comercial-restaurantes.
6. Conferir /health, novas telas e login na URL real. Homologar atendimento completo antes de abrir ao publico.

A migracao adiciona uma coluna opcional e funcoes restritas ao backend. Nao remove dados. O backend antigo continua compativel; em caso de falha de publicacao, retornar a ultima versao do Render e da Vercel sem apagar dados financeiros.

## Mudancas de acesso

Sessoes antigas expiram nesta publicacao. Cada pessoa deve entrar novamente. Senhas fracas exigem troca por uma senha de pelo menos 12 caracteres antes de operar. Nao cadastrar contas compartilhadas ou repetir senhas de demonstracao.

Desativacao de usuario, remocao de permissao e troca de senha invalidam sessoes existentes. Donos de restaurante nao podem redefinir contas da plataforma, de outro estabelecimento ou compartilhadas entre estabelecimentos.

## Fechamento financeiro

Pedidos, pagamentos, turno e liberacao da mesa sao atualizados na mesma transacao. Pedidos em andamento bloqueiam fechamento. Tentativas duplicadas e alteracoes concorrentes retornam conflito, sem duplicar vendas. Atualizar a tela antes de repetir uma tentativa rejeitada.

Pagamentos divididos sao preservados em centavos por pedido e por turno. Historico anterior sem detalhamento continua usando a forma principal original; nao foi inventada uma distribuicao retroativa.

## Limites de homologacao

- Os testes do navegador local usam respostas simuladas; nao substituem a passagem completa na publicacao real.
- O teste SQL usa o banco real e desfaz os dados de teste. Nao representa um pagamento bancario ou teste de maquininha.
- Pix e cartoes sao confirmados pelo operador. A chave Pix cadastrada nao cria conciliacao bancaria automatica.
- Nao chamar recibo de nota fiscal. A configuracao fiscal existente nao equivale a emissao autorizada pela SEFAZ.
- Impressao do resumo de turno via navegador ja existe. Impressora termica fisica e emissao fiscal precisam de homologacao especifica.
- Taxa de servico permanece desativada no primeiro estabelecimento. Seu calculo entre comanda e fechamento ainda precisa de revisao antes de ativar.
- Balcao rapido nao recebeu a mesma transacao atomica de mesas; nao habilitar como fluxo principal antes dessa revisao.
- Hospedagem gratuita com suspensao por inatividade nao e adequada para atendimento continuo. Validar plano sem suspensao, backups e restauracao antes da operacao comercial.
- O cardapio de demonstracao, equipe, mesas, precos e formas de pagamento precisam refletir o estabelecimento real.

## Aceite no estabelecimento

Abrir turno, ler QR de uma mesa, enviar pedido, preparar na cozinha, marcar entrega, dividir pagamento, fechar conta, conferir liberacao da mesa e fechar turno com conferencia do dinheiro. Repetir com cancelamento, dois atendentes e celular. Confirmar que outro restaurante nao acessa esses registros.

Registrar data, responsavel, equipamentos e resultados do aceite. Nao declarar o produto fiscalmente pronto ou aprovado para todos os segmentos apenas com os testes automatizados desta revisao.
