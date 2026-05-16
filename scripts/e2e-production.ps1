param(
  [string]$BaseUrl = $env:E2E_BASE_URL,
  [string]$SuperEmail = $env:E2E_SUPER_EMAIL,
  [string]$SuperPassword = $env:E2E_SUPER_PASSWORD
)

$ErrorActionPreference = "Stop"

if (-not $BaseUrl) { $BaseUrl = "https://frontend-teal-nine-80.vercel.app" }
if (-not $SuperEmail) { $SuperEmail = "admin@restaurante.com" }
if (-not $SuperPassword) { $SuperPassword = "admin123" }

function Invoke-Json($Method, $Uri, $Body = $null, $Token = $null) {
  $headers = @{}
  if ($Token) { $headers.Authorization = "Bearer $Token" }
  $params = @{
    Method = $Method
    Uri = $Uri
    Headers = $headers
    ContentType = "application/json"
  }
  if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 20) }
  Invoke-RestMethod @params
}

$slug = "e2e-" + ([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())
$restaurantId = $null

try {
  Write-Host "1/9 Login super admin"
  $super = Invoke-Json POST "$BaseUrl/api/auth/login" @{
    email = $SuperEmail
    senha = $SuperPassword
  }

  Write-Host "2/9 Criando restaurante temporario $slug"
  $created = Invoke-Json POST "$BaseUrl/api/super-admin/restaurants" @{
    name = "E2E Restaurante"
    slug = $slug
    plan = "starter"
    template = "pizzaria"
    initial_table_count = 2
    create_default_categories = $true
    create_sample_products = $true
  } $super.token
  $restaurantId = $created.restaurant.id

  Write-Host "3/9 Criando usuario owner"
  Invoke-Json POST "$BaseUrl/api/super-admin/restaurants/$restaurantId/users" @{
    nome = "Owner E2E"
    email = "$slug@teste.local"
    senha = "admin123"
    role = "owner"
  } $super.token | Out-Null

  $owner = Invoke-Json POST "$BaseUrl/api/auth/login" @{
    email = "$slug@teste.local"
    senha = "admin123"
    restaurant_slug = $slug
  }

  Write-Host "4/9 Validando seed de cardapio e mesas"
  $products = Invoke-Json GET "$BaseUrl/api/admin/products" $null $owner.token
  if (($products.produtos | Measure-Object).Count -lt 1) { throw "Seed sem produtos" }
  $qrs = Invoke-Json GET "$BaseUrl/api/super-admin/restaurants/$restaurantId/qrcodes" $null $super.token
  $mesa = $qrs.mesas[0]
  if (-not $mesa.public_token) { throw "Mesa sem token publico" }

  Write-Host "5/9 Abrindo sessao publica e enviando pedido"
  $table = Invoke-Json GET "$BaseUrl/api/public/restaurants/$slug/tables/$($mesa.public_token)"
  $session = Invoke-Json POST "$BaseUrl/api/public/restaurants/$slug/tables/$($mesa.public_token)/sessions"
  $product = $products.produtos[0]
  $order = Invoke-Json POST "$BaseUrl/api/public/restaurants/$slug/orders" @{
    restaurant_id = $restaurantId
    mesa_id = $table.mesa.id
    sessao_mesa_id = $session.sessao.id
    subtotal = [double]$product.preco
    total = [double]$product.preco
    observacao_geral = "pedido e2e"
    itens = @(@{
      produto_id = $product.id
      nome_produto = $product.nome
      preco_unitario = [double]$product.preco
      quantidade = 1
      subtotal = [double]$product.preco
      observacao = $null
      ingredientes = @()
    })
  }
  $pedidoId = $order.id
  if (-not $pedidoId) { $pedidoId = $order.pedido_id }
  if (-not $pedidoId -and $order.pedido) { $pedidoId = $order.pedido.id }
  if (-not $pedidoId -and $order.pedido) { $pedidoId = $order.pedido.pedido_id }
  if (-not $pedidoId) { throw "API nao retornou id do pedido" }

  Write-Host "6/9 Conferindo fila e avancando status"
  $queue = Invoke-Json GET "$BaseUrl/api/kitchen/queue" $null $owner.token
  if (-not ($queue.pedidos | Where-Object { $_.id -eq $pedidoId })) { throw "Pedido nao apareceu na fila" }
  foreach ($status in @("confirmado", "em_preparo", "pronto", "entregue")) {
    Invoke-Json PATCH "$BaseUrl/api/kitchen/orders/$pedidoId/status" @{ status = $status } $owner.token | Out-Null
  }

  Write-Host "7/9 Validando conta e fechamento"
  $bill = Invoke-Json GET "$BaseUrl/api/public/restaurants/$slug/sessions/$($session.sessao.id)/bill"
  if ([double]$bill.total_consumido -le 0) { throw "Conta zerada apos pedido" }
  Invoke-Json POST "$BaseUrl/api/admin/tables/$($table.mesa.id)/close" @{
    forma_pagamento = "pix"
  } $owner.token | Out-Null

  Write-Host "8/9 Validando dashboard"
  $today = (Get-Date).ToString("yyyy-MM-dd")
  $dash = Invoke-Json GET "$BaseUrl/api/admin/dashboard?data_inicio=$today&data_fim=$today" $null $owner.token
  if ([double]$dash.total_bruto -le 0) { throw "Dashboard financeiro nao somou o pedido" }

  Write-Host "9/9 E2E OK"
}
finally {
  if ($restaurantId) {
    try {
      if (-not $super) {
        $super = Invoke-Json POST "$BaseUrl/api/auth/login" @{
          email = $SuperEmail
          senha = $SuperPassword
        }
      }
      Invoke-Json DELETE "$BaseUrl/api/super-admin/restaurants/$restaurantId" $null $super.token | Out-Null
      Write-Host "Restaurante temporario removido"
    } catch {
      Write-Warning "Falha ao limpar restaurante temporario: $($_.Exception.Message)"
    }
  }
}
