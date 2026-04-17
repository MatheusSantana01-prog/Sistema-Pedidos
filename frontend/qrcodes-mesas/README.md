# Projeto QRCODES-MESAS - Gerador de QR Codes para Impressão

## 📱 Estrutura

```
qrcodes-mesas/
├── index.html                           # HTML principal
├── css/
│   ├── variables.css      # Variáveis de tema
│   ├── base.css          # Estilos base
│   ├── grid.css          # Layout grid de cards
│   ├── qr-display.css    # Exibição do QR code
│   ├── cards.css         # Estilos dos cards
│   ├── modals.css        # Modais (customização, preview)
│   ├── print.css         # Estilos para impressão
│   └── utilities.css     # Copy feedback, loading, etc
│
├── js/
│   ├── config.js         # Configuração API
│   ├── qrcode.min.js     # Biblioteca QR code
│   ├── api.js            # Cliente HTTP
│   ├── state.js          # Estado das mesas
│   ├── grid.js           # Renderização do grid
│   ├── qr-generator.js   # Geração de QR codes
│   ├── copy-clipboard.js # Copiar para clipboard
│   ├── print.js          # Lógica de impressão
│   ├── customization.js  # Customização de mesas
│   └── utils.js          # Utilitários
│
└── README.md (este arquivo)
```

## 🎯 O que é

Gerador de QR codes para mesas do restaurante com suporte a impressão, customização e clipboard.

**Recursos:**
- ✅ Grid responsivo de cards de mesas
- ✅ Geração de QR code dinâmica (QRCode.js)
- ✅ QR codes que redirecionam para cardápio digital
- ✅ Botão copiar QR (base64 ou URL)
- ✅ Preview antes de imprimir
- ✅ Layout print-friendly otimizado
- ✅ Impressão em lote (todas as mesas ou selecionadas)
- ✅ Customização de tamanho (A4, A5, 10x10cm)
- ✅ Suporte a diferentes formatos (PNG, SVG)

## 🚀 Como desenvolver

### Adicionar novo formato de impressão (ex: Etiqueta adesiva)

1. Editar `js/customization.js` para adicionar novo tamanho
2. Atualizar `css/print.css` com media queries e dimensões
3. Criar template em `index.html` para novo formato
4. Testar impressão em navegador

### Estrutura básica de módulo

```javascript
// js/qr-generator.js
export function gerarQR(mesaId) {
  const url = `${config.cardapioUrl}?mesa=${mesaId}`;
  
  const qr = new QRCode(document.getElementById(`qr-${mesaId}`), {
    text: url,
    width: 200,
    height: 200,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
  
  return qr;
}

export function imprimirMesa(mesaId) {
  const janela = window.open('', '_blank');
  janela.document.write(getTemplatePrint(mesaId));
  janela.print();
}

export const qrModule = {
  gerarQR,
  imprimirMesa,
};
```

### Estrutura de mesa

```javascript
{
  id: 1,
  numero: '01',
  area: 'Sala Principal',
  capacidade: 4,
  qrUrl: 'https://app.restaurante.com.br?mesa=1',
  qrData: 'data:image/png;base64,...', // QR em base64
}
```

## 📋 Próximos passos

- [ ] Separar CSS (8 arquivos)
- [ ] Modularizar JavaScript
- [ ] Criar HTML limpo
- [ ] Integração com biblioteca QRCode.js
- [ ] Templates de impressão (A4, A5, adesivo)
- [ ] Download como imagem (PNG/SVG)
- [ ] Sincronização com banco de dados
- [ ] Testes de impressão em diferentes impressoras

## 🔧 Testing

```bash
# Em desenvolvimento
python -m http.server 8080

# Acessar gerador
http://localhost:8080
```

## 📦 Deploy

Deploy automático para `qrcodes-mesas/index.html` quando commitado em main.
