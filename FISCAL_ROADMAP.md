# Fiscal Roadmap

## Escopo atual

O sistema está preparado para controle fiscal manual e integração futura. Não emite NFC-e, SAT, NFS-e ou NF-e real.

## Implementado/preparado

- Configuração fiscal do restaurante: CNPJ, inscrições, regime, série, ambiente, provedor e modo.
- Documento fiscal manual: número, série, chave, status, valor, XML/DANFE e relação com conta.
- Criação opcional de pendência fiscal ao fechar conta.
- Campos fiscais no produto: NCM, CFOP, CEST, origem e unidade fiscal.

## Próximos passos

P0:
- Validar campos fiscais por UF/regime com contador.
- Escolher provedor fiscal: NFE.io, Focus NFe, PlugNotas ou equivalente.
- Criar serviço abstrato `FiscalProvider` com métodos `emitir`, `cancelar`, `consultar`.

P1:
- Homologar NFC-e/SAT em ambiente de teste.
- Guardar XML/DANFE com storage seguro.
- Criar contingência e tratamento de rejeições.

P2:
- Relatórios fiscais por período.
- Integração contábil.

## Critério de segurança

Não declarar emissão fiscal real até homologar provedor, certificado, CSC/token, regras da UF e contingência.
