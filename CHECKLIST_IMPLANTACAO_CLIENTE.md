# Checklist de Implantacao em Cliente

## Preparacao

- Confirmar plano comercial fechado: Basico, Pro ou Premium.
- Registrar mensalidade, vencimento e valor de implantacao.
- Definir se o cliente tera 7 dias de teste acompanhado.
- Criar backup/exportacao antes de qualquer ajuste em cliente real.
- Criar restaurante no super-admin.
- Escolher o tipo de negocio correto no super-admin.
- Conferir quais modulos devem ficar ativos para o perfil.
- Definir plano, mensalidade e vencimento.
- Criar usuario owner do restaurante.
- Criar usuarios reais por perfil.
- Remover ou trocar qualquer senha demo.
- Exigir troca de senha do owner no primeiro acesso assistido.
- Configurar mesas e tokens QR.
- Configurar categorias e produtos.
- Aplicar schema de estoque no Supabase, se ainda nao aplicado.
- Aplicar schema de business_type/modules_config no Supabase, se ainda nao aplicado.

## Operacao

- Testar login owner.
- Testar login caixa.
- Testar login cozinha.
- Testar login garcom, se contratado.
- Abrir mesa por QR Code no celular.
- Fazer pedido real de teste.
- Confirmar pedido na cozinha.
- Marcar em preparo, pronto e entregue.
- Fechar conta no caixa.
- Conferir dashboard admin.

## Estoque

- Cadastrar fornecedores principais.
- Cadastrar insumos principais.
- Registrar estoque inicial.
- Configurar estoque minimo.
- Configurar ficha tecnica dos produtos mais vendidos.
- Fazer pedido de teste e conferir baixa automatica.
- Conferir alertas baixo/zerado.

## Go-live

- Validar contrato/aceite comercial.
- Confirmar WhatsApp de suporte do responsavel.
- Fixar QR Codes nas mesas.
- Treinar cozinha por 15 minutos.
- Treinar caixa por 20 minutos.
- Treinar dono/admin por 30 minutos.
- Deixar suporte via WhatsApp visivel.
- Fazer primeiro fechamento acompanhado.
- Revisar logs e auditoria apos o primeiro turno.

## Criterio minimo para piloto

- Caixa abre e fecha turno sem erro.
- Pedido entra na cozinha sem duplicar tela.
- Conta fecha com pagamento correto.
- Admin consegue alterar produtos.
- Restaurante bloqueado perde acesso conforme regra.
- Backup/exportacao foi validado.
- Nenhuma chave secreta foi exposta no frontend.
- O tipo de negocio foi conferido antes do go-live.

## Primeiro cliente recomendado

- Comecar com Plano Pro.
- Implantacao acompanhada com desconto: R$ 397.
- Mensalidade inicial: R$ 199/mês por 3 meses.
- Mensalidade apos validacao: R$ 249/mês.
- Escopo do piloto: QR, cozinha, caixa, usuarios, cardapio, estoque basico e dashboard do dono.
- Nao incluir fiscal real, iFood, balanca ou automacao WhatsApp no primeiro contrato.

