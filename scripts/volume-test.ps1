param(
  [int]$Orders = 25,
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

$slug = "volume-" + ([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())
$restaurantId = $null

try {
  $super = Invoke-Json POST "$BaseUrl/api/auth/login" @{ email = $SuperEmail; senha = $SuperPassword }
  $created = Invoke-Json POST "$BaseUrl/api/super-admin/restaurants" @{
    name = "Volume Test"
    slug = $slug
    plan = "pro"
    template = "restaurante"
    initial_table_count = 4
    create_default_categories = $true
    create_sample_products = $true
  } $super.token
  $restaurantId = $created.restaurant.id
  Invoke-Json POST "$BaseUrl/api/super-admin/restaurants/$restaurantId/users" @{
    nome = "Kitchen Volume"
    email = "kitchen-$slug@teste.local"
    senha = "admin123"
    role = "kitchen"
  } $super.token | Out-Null
  $kitchen = Invoke-Json POST "$BaseUrl/api/auth/login" @{
    email = "kitchen-$slug@teste.local"
    senha = "admin123"
    restaurant_slug = $slug
  }

  $qrs = Invoke-Json GET "$BaseUrl/api/super-admin/restaurants/$restaurantId/qrcodes" $null $super.token
  $products = Invoke-Json GET "$BaseUrl/api/public/restaurants/$slug/menu"
  $product = $products.cardapio[0].produtos[0]
  $createdOrders = @()
  $started = Get-Date

  for ($i = 0; $i -lt $Orders; $i++) {
    $mesa = $qrs.mesas[$i % $qrs.mesas.Count]
    $table = Invoke-Json GET "$BaseUrl/api/public/restaurants/$slug/tables/$($mesa.public_token)"
    $session = Invoke-Json POST "$BaseUrl/api/public/restaurants/$slug/tables/$($mesa.public_token)/sessions"
    $order = Invoke-Json POST "$BaseUrl/api/public/restaurants/$slug/orders" @{
      mesa_id = $table.mesa.id
      sessao_mesa_id = $session.sessao.id
      itens = @(@{ produto_id = $product.id; quantidade = 1; ingredientes = @() })
    }
    $createdOrders += $order.pedido.id
  }

  $queue = Invoke-Json GET "$BaseUrl/api/kitchen/queue" $null $kitchen.token
  $found = @($queue.pedidos | Where-Object { $createdOrders -contains $_.id })
  if ($found.Count -ne $Orders) { throw "Fila retornou $($found.Count) de $Orders pedidos criados" }

  $elapsed = [math]::Round(((Get-Date) - $started).TotalSeconds, 2)
  [pscustomobject]@{
    ok = $true
    slug = $slug
    orders = $Orders
    queue_found = $found.Count
    elapsed_seconds = $elapsed
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
