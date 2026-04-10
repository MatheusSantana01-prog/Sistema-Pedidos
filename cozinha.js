async function carregarPedidos() {
    let resposta = await fetch("http://127.0.0.1:8000/pedidos")
    let pedidos = await resposta.json()

    let div = document.getElementById("pedidos")
    div.innerHTML = ""

    pedidos.forEach(pedido => {
        let classe = ""

      if (pedido.status === "recebido") {
    classe = "recebido"
} else if (pedido.status === "em preparo") {
    classe = "preparo"
} else if (pedido.status === "pronto") {
    classe = "pronto"
}

        div.innerHTML += `
            <div class="card ${classe}">
                <h3>Pedido #${pedido.id}</h3>
                <p><strong>Mesa:</strong> ${pedido.mesa}</p>
                <p><strong>Item:</strong> ${pedido.item}</p>
                <p><strong>Status:</strong> ${pedido.status}</p>
                <button onclick="mudarStatus(${pedido.id})">Avançar status</button>
            </div>
        `
    })
}

async function mudarStatus(id) {
    await fetch(`http://127.0.0.1:8000/pedido/${id}`, {
        method: "PUT"
    })

    carregarPedidos()
}

carregarPedidos()
setInterval(carregarPedidos, 3000)