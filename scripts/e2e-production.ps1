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
  $params = @{ Method = $Method; Uri = $Uri; Headers = $headers; ContentType = "application/json" }
  if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 30) }
  Invoke-RestMethod @params
}

function Expect-Blocked($Name, $ExpectedStatus, [scriptblock]$Call) {
  try {
    & $Call | Out-Null
    throw "$Name permitiu acesso indevido"
  } catch {
    $status = $null
    try { $status = [int]$_.Exception.Response.StatusCode } catch {}
    if ($status -ne $ExpectedStatus) { throw "$Name retornou $status; esperado $ExpectedStatus" }
  }
}

function Expect-Conta-Bloqueada($Name, $ExpectedStatus, [scriptblock]$Call) {
  try {
    & $Call | Out-Null
    throw "$Name permitiu pedir conta antes da entrega"
  } catch {
    $status = $null
    try { $status = [int]$_.Exception.Response.StatusCode } catch {}
    if ($status -ne $ExpectedStatus) { throw "$Name retornou $status; esperado $ExpectedStatus" }
  }
}

$slug = "e2e-" + ([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())
$restaurantId = $null
$emails = @{}

try {
  Write-Host "1/11 Login super admin"
  $super = Invoke-Json POST "$BaseUrl/api/auth/login" @{ email = $SuperEmail; senha = $SuperPassword }
  $version = (Invoke-WebRequest -Method Post -Uri "$BaseUrl/api/auth/login" -ContentType "application/json" -Body (@{email=$SuperEmail;senha=$SuperPassword} | ConvertTo-Json) -UseBasicParsing).Headers["X-App-Version"]
  Write-Host "Backend version: $version"

  Write-Host "2/11 Criando restaurante temporario Pro: $slug"
  $created = Invoke-Json POST "$BaseUrl/api/super-admin/restaurants" @{
    name = "E2E Restaurante"
    slug = $slug
    plan = "pro"
    template = "restaurante"
    initial_table_count = 2
    create_default_categories = $true
    create_sample_products = $true
  } $super.token
  $restaurantId = $created.restaurant.id

  Write-Host "3/11 Criando usuarios por perfil"
  foreach ($role in @("owner", "cashier", "waiter", "kitchen", "tv")) {
    $emails[$role] = "$role-$slug@teste.local"
    Invoke-Json POST "$BaseUrl/api/super-admin/restaurants/$restaurantId/users" @{
      nome = "$role E2E"
      email = $emails[$role]
      senha = "admin123"
      role = $role
    } $super.token | Out-Null
  }

  Write-Host "4/11 Validando logins e seguranca"
  $owner = Invoke-Json POST "$BaseUrl/api/auth/login" @{ email = $emails.owner; senha = "admin123"; restaurant_slug = $slug }
  $cashier = Invoke-Json POST "$BaseUrl/api/auth/login" @{ email = $emails.cashier; senha = "admin123"; restaurant_slug = $slug }
  $kitchen = Invoke-Json POST "$BaseUrl/api/auth/login" @{ email = $emails.kitchen; senha = "admin123"; restaurant_slug = $slug }
  $tv = Invoke-Json POST "$BaseUrl/api/auth/login" @{ email = $emails.tv; senha = "admin123"; restaurant_slug = $slug }
  Expect-Blocked "admin sem token" 401 { Invoke-Json GET "$BaseUrl/api/admin/tables" }
  Expect-Blocked "waiter em restaurante errado" 403 { Invoke-Json POST "$BaseUrl/api/auth/login" @{ email = $emails.waiter; senha = "admin123"; restaurant_slug = "slug-inexistente" } }

  Write-Host "5/11 Validando seed"
  $products = Invoke-Json GET "$BaseUrl/api/admin/products" $null $owner.token
  if (($products.produtos | Measure-Object).Count -lt 1) { throw "Seed sem produtos" }
  $qrs = Invoke-Json GET "$BaseUrl/api/super-admin/restaurants/$restaurantId/qrcodes" $null $super.token
  $mesa = $qrs.mesas[0]
  if (-not $mesa.public_token) { throw "Mesa sem token publico" }

  Write-Host "6/11 Abrindo sessao e enviando pedido"
  $table = Invoke-Json GET "$BaseUrl/api/public/restaurants/$slug/tables/$($mesa.public_token)"
  $session = Invoke-Json POST "$BaseUrl/api/public/restaurants/$slug/tables/$($mesa.public_token)/sessions"
  $product = $products.produtos[0]
  $order = Invoke-Json POST "$BaseUrl/api/public/restaurants/$slug/orders" @{
    mesa_id = $table.mesa.id
    sessao_mesa_id = $session.sessao.id
    subtotal = 0.01
    total = 0.01
    observacao_geral = "pedido e2e"
    itens = @(@{ produto_id = $product.id; quantidade = 1; observacao = "teste"; ingredientes = @() })
  }
  $pedidoId = $order.pedido.id
  if (-not $pedidoId) { throw "API nao retornou id do pedido" }
  if ([double]$order.pedido.total -ne [double]$product.preco) { throw "Backend nao recalculou preco real do produto" }
  Expect-Conta-Bloqueada "conta com pedido pendente" 409 {
    Invoke-Json POST "$BaseUrl/api/public/restaurants/$slug/tables/$($mesa.public_token)/call" @{ tipo = "conta" }
  }

  Write-Host "7/11 Conferindo fila e avancando cozinha"
  $queue = Invoke-Json GET "$BaseUrl/api/kitchen/queue" $null $kitchen.token
  if (-not ($queue.pedidos | Where-Object { $_.id -eq $pedidoId })) { throw "Pedido nao apareceu na fila" }
  foreach ($status in @("confirmado", "em_preparo", "pronto")) {
    Invoke-Json PATCH "$BaseUrl/api/kitchen/orders/$pedidoId/status" @{ status = $status } $kitchen.token | Out-Null
    Expect-Conta-Bloqueada "conta com pedido $status" 409 {
      Invoke-Json POST "$BaseUrl/api/public/restaurants/$slug/tables/$($mesa.public_token)/call" @{ tipo = "conta" }
    }
  }

  Write-Host "8/11 TV dando baixa"
  Invoke-Json PATCH "$BaseUrl/api/kitchen/orders/$pedidoId/status" @{ status = "entregue" } $tv.token | Out-Null
  Invoke-Json POST "$BaseUrl/api/public/restaurants/$slug/tables/$($mesa.public_token)/call" @{ tipo = "conta" } | Out-Null

  Write-Host "9/11 Conta e fechamento"
  $bill = Invoke-Json GET "$BaseUrl/api/public/restaurants/$slug/sessions/$($session.sessao.id)/bill"
  if ([double]$bill.total_consumido -le 0) { throw "Conta zerada apos pedido" }
  Invoke-Json POST "$BaseUrl/api/admin/tables/$($table.mesa.id)/close" @{
    forma_pagamento = "pix"
    resumo_pagamento = @{ pix = [double]$bill.total_com_taxa }
  } $cashier.token | Out-Null

  Write-Host "10/11 Diagnostico, operacao e export"
  $diag = Invoke-Json GET "$BaseUrl/api/super-admin/diagnostics" $null $super.token
  if (($diag.checks | Where-Object { $_.status -eq "WARN" -and $_.check_name -in @("memberships", "qr_code_token") } | Measure-Object).Count) { throw "Diagnostico critico com WARN" }
  $ops = Invoke-Json GET "$BaseUrl/api/super-admin/operations" $null $super.token
  if (-not $ops.version) { throw "Operacao sem versao" }
  $export = Invoke-Json GET "$BaseUrl/api/super-admin/restaurants/$restaurantId/export" $null $super.token
  if (($export.products | Measure-Object).Count -lt 1) { throw "Export sem produtos" }

  Write-Host "11/11 E2E OK"
  [pscustomobject]@{
    ok = $true
    slug = $slug
    backend_version = $version
    order_id = $pedidoId
    total = $bill.total_com_taxa
  } | ConvertTo-Json
}
finally {
  if ($restaurantId) {
    try {
      if (-not $super) { $super = Invoke-Json POST "$BaseUrl/api/auth/login" @{ email = $SuperEmail; senha = $SuperPassword } }
      Invoke-Json DELETE "$BaseUrl/api/super-admin/restaurants/$restaurantId" $null $super.token | Out-Null
      Write-Host "Restaurante temporario removido"
    } catch {
      Write-Warning "Falha ao limpar restaurante temporario: $($_.Exception.Message)"
    }
  }
}
