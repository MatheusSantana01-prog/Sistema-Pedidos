# QA Funcional

Checklist funcional para validar o Sistema-Pedidos antes de piloto com restaurante real.

## Login e sessão

- [ ] Login com usuário salvo marcado.
- [ ] Login com usuário salvo desmarcado.
- [ ] Login inválido mostra mensagem clara.
- [ ] Logout limpa sessão e volta para tela de login.
- [ ] Troca de restaurante impede acesso ao slug incorreto.
- [ ] Token expirado ou inválido redireciona para login.
- [ ] Alterar senha com senha atual correta.
- [ ] Alterar senha com senha atual incorreta.
- [ ] Alterar senha com confirmação divergente.

## Mesa/cliente

- [ ] Abrir `/r/{slug}/mesa/{token}`.
- [ ] Token de mesa inválido mostra erro.
- [ ] Cardápio carrega categorias e produtos.
- [ ] Busca filtra produto.
- [ ] Filtro por categoria funciona.
- [ ] Abrir modal de produto.
- [ ] Adicionar item ao carrinho.
- [ ] Alterar quantidade.
- [ ] Remover item.
- [ ] Enviar pedido.
- [ ] Pedido aparece na conta.
- [ ] Chamar garçom.
- [ ] Pedir conta apenas quando permitido.
- [ ] Conta bloqueia pedido de fechamento se há pedido aberto.
- [ ] Fechar modais por botão e por clique fora.
- [ ] Estados vazios aparecem quando não há produtos.

## Cozinha

- [ ] Login kitchen.
- [ ] Tela bloqueia usuário sem perfil kitchen.
- [ ] Pedido novo aparece em pendente.
- [ ] Confirmar/iniciar preparo.
- [ ] Marcar pronto.
- [ ] Marcar entregue.
- [ ] Pedido entregue aparece em entregues recentes.
- [ ] Pedido entregue some após janela configurada.
- [ ] Botão mostra erro sem duplicar ação se a API falhar.
- [ ] Polling não duplica requisições ao trocar visibilidade.
- [ ] Estado offline aparece após falhas.

## TV

- [ ] Login tv.
- [ ] Preparando, pronto e entregues renderizam corretamente.
- [ ] Botões de avanço funcionam conforme permissão.
- [ ] Pedidos entregues somem após janela configurada.
- [ ] Tela vazia fica legível na TV.

## Garçom

- [ ] Login waiter.
- [ ] Tela bloqueia perfil sem módulo garçom.
- [ ] Lista mesas livres e ocupadas.
- [ ] Filtros de mesa funcionam.
- [ ] Ocupar mesa.
- [ ] Liberar mesa sem consumo.
- [ ] Ver conta/pedidos da mesa.
- [ ] Atender chamado.
- [ ] Marcar pedido pronto como entregue quando permitido.
- [ ] Fechar pagamento pelo garçom quando permitido.
- [ ] Bloquear pagamento/entrega quando plano/configuração não permite.

## Caixa

- [ ] Login cashier.
- [ ] Listar caixas.
- [ ] Abrir turno.
- [ ] Impedir abrir dois turnos no mesmo caixa.
- [ ] Ver mesas com conta.
- [ ] Selecionar mesa.
- [ ] Carregar conta.
- [ ] Pagamento único.
- [ ] Pagamento misto.
- [ ] Impedir pagamento com soma divergente.
- [ ] Fechar conta.
- [ ] Fechar turno.
- [ ] Imprimir resumo do turno.
- [ ] Caixa sem turno aberto mostra orientação.

## Admin restaurante

- [ ] Login owner.
- [ ] Login manager.
- [ ] Navegação entre abas.
- [ ] Criar, editar e remover categoria.
- [ ] Criar, editar, pausar e ativar produto.
- [ ] Criar mesa.
- [ ] Editar mesa.
- [ ] Ocupar/liberar mesa.
- [ ] Ver e fechar conta.
- [ ] Criar usuário.
- [ ] Redefinir senha de usuário.
- [ ] Remover usuário.
- [ ] Alterar configurações visuais.
- [ ] Alterar configurações de atendimento.
- [ ] Criar chamado de suporte.
- [ ] Atualizar suporte.
- [ ] Configurar fiscal.
- [ ] Registrar documento fiscal manual.
- [ ] Ver dashboard com período informado.
- [ ] Ver auditoria.

## Super-admin

- [ ] Login super_admin.
- [ ] Criar restaurante starter, pro e enterprise.
- [ ] Criar restaurante sem categorias/produtos padrão.
- [ ] Criar usuários por perfil.
- [ ] Abrir detalhes do restaurante.
- [ ] Editar plano.
- [ ] Editar mensalidade.
- [ ] Editar vencimento.
- [ ] Registrar pagamento.
- [ ] Marcar em dia.
- [ ] Colocar em teste grátis.
- [ ] Simular vencido em alerta.
- [ ] Simular vencido em bloqueio.
- [ ] Bloquear/desbloquear restaurante.
- [ ] Validar que bloqueio impede acesso conforme regra.
- [ ] Ver QR Codes.
- [ ] Exportar dados.
- [ ] Abrir suporte e alterar status.
- [ ] Ver métricas, operação, auditoria e validação.
- [ ] Deletar restaurante temporário.

## Limites por plano

- [ ] Starter: até 5 usuários.
- [ ] Starter: até 20 mesas.
- [ ] Starter: até 100 produtos.
- [ ] Starter: 1 caixa.
- [ ] Starter: apenas 1 usuário cashier.
- [ ] Pro: até 15 usuários.
- [ ] Pro: até 60 mesas.
- [ ] Pro: até 400 produtos.
- [ ] Pro: até 3 caixas.
- [ ] Enterprise: limites altos.
- [ ] Tentar criar além do limite e confirmar erro claro.

## Permissões

- [ ] Owner acessa admin completo.
- [ ] Manager acessa gestão operacional sem usuários/fiscal restritos.
- [ ] Cashier acessa caixa e fechamento.
- [ ] Waiter acessa garçom, mesas e chamados.
- [ ] Kitchen acessa cozinha.
- [ ] TV acessa TV.
- [ ] Super_admin acessa plataforma.
- [ ] Usuário comum não acessa super-admin.
- [ ] Usuário de um restaurante não acessa outro slug.

## Multi-tenant

- [ ] Criar demo-a.
- [ ] Criar demo-b.
- [ ] Criar usuários separados.
- [ ] Produto de demo-a não aparece em demo-b.
- [ ] Mesa de demo-a não aparece em demo-b.
- [ ] Pedido de demo-a não aparece em demo-b.
- [ ] Caixa/turno de demo-a não aparece em demo-b.
- [ ] Login com slug errado é bloqueado.

## Erros e estados vazios

- [ ] Sem mesas.
- [ ] Sem produtos.
- [ ] Sem pedidos.
- [ ] Sem chamados.
- [ ] Sem caixas.
- [ ] API offline.
- [ ] Permissão negada.
- [ ] Limite do plano atingido.
- [ ] Restaurante bloqueado.
- [ ] Pagamento inválido.
