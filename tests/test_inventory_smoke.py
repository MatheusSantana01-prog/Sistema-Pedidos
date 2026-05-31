from copy import deepcopy

from fastapi import HTTPException
import pytest

import main


class Resp:
    def __init__(self, data=None, count=None):
        self.data = data
        self.count = count


class FakeQuery:
    def __init__(self, db, table):
        self.db = db
        self.table = table
        self.filters = []
        self.in_filters = []
        self._limit = None
        self._payload = None
        self._op = "select"

    def select(self, *_args, **_kwargs):
        if self._op == "select":
            self._op = "select"
        return self

    def eq(self, field, value):
        self.filters.append((field, value))
        return self

    def in_(self, field, values):
        self.in_filters.append((field, set(values)))
        return self

    def limit(self, value):
        self._limit = value
        return self

    def order(self, *_args, **_kwargs):
        return self

    def insert(self, payload):
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload):
        self._op = "update"
        self._payload = payload
        return self

    def delete(self):
        self._op = "delete"
        return self

    def single(self):
        return self

    def _matches(self, row):
        for field, value in self.filters:
            if str(row.get(field)) != str(value):
                return False
        for field, values in self.in_filters:
            if str(row.get(field)) not in {str(v) for v in values}:
                return False
        return True

    def _rows(self):
        rows = [row for row in self.db.tables.setdefault(self.table, []) if self._matches(row)]
        return rows[: self._limit] if self._limit else rows

    def execute(self):
        table = self.db.tables.setdefault(self.table, [])
        if self._op == "insert":
            payloads = self._payload if isinstance(self._payload, list) else [self._payload]
            created = []
            for payload in payloads:
                row = deepcopy(payload)
                row.setdefault("id", self.db.next_id(self.table))
                table.append(row)
                created.append(row)
            return Resp(created if isinstance(self._payload, list) else created)

        if self._op == "update":
            changed = []
            for row in table:
                if self._matches(row):
                    row.update(deepcopy(self._payload))
                    changed.append(row)
            return Resp(changed)

        if self._op == "delete":
            keep = []
            deleted = []
            for row in table:
                if self._matches(row):
                    deleted.append(row)
                else:
                    keep.append(row)
            self.db.tables[self.table] = keep
            return Resp(deleted)

        return Resp(deepcopy(self._rows()))


class FakeSupabase:
    def __init__(self, tables):
        self.tables = tables
        self.counters = {}

    def table(self, name):
        return FakeQuery(self, name)

    def next_id(self, table):
        self.counters[table] = self.counters.get(table, 0) + 1
        return f"{table}-{self.counters[table]}"


def make_inventory_db():
    return FakeSupabase({
        "suppliers": [{
            "id": "00000000-0000-0000-0000-0000000000a1",
            "restaurant_id": "rest-a",
            "name": "Fornecedor QA",
            "is_active": True,
        }],
        "inventory_items": [
            {
                "id": "00000000-0000-0000-0000-0000000000b1",
                "restaurant_id": "rest-a",
                "name": "Farinha QA",
                "unit": "kg",
                "current_quantity": 0,
                "minimum_quantity": 2,
                "unit_cost": 4,
                "is_active": True,
            },
            {
                "id": "00000000-0000-0000-0000-0000000000b2",
                "restaurant_id": "rest-b",
                "name": "Queijo B",
                "unit": "kg",
                "current_quantity": 50,
                "minimum_quantity": 5,
                "unit_cost": 30,
                "is_active": True,
            },
        ],
        "inventory_movements": [],
        "produtos": [{
            "id": "00000000-0000-0000-0000-0000000000c1",
            "restaurant_id": "rest-a",
            "nome": "Pizza QA",
            "preco": 40,
        }],
        "product_recipes": [{
            "id": "00000000-0000-0000-0000-0000000000d1",
            "restaurant_id": "rest-a",
            "product_id": "00000000-0000-0000-0000-0000000000c1",
            "yield_quantity": 1,
            "is_active": True,
        }],
        "product_recipe_items": [{
            "id": "00000000-0000-0000-0000-0000000000e1",
            "restaurant_id": "rest-a",
            "recipe_id": "00000000-0000-0000-0000-0000000000d1",
            "product_id": "00000000-0000-0000-0000-0000000000c1",
            "inventory_item_id": "00000000-0000-0000-0000-0000000000b1",
            "quantity": 0.5,
            "waste_percent": 0,
        }],
        "pedidos": [{
            "id": "00000000-0000-0000-0000-0000000000f1",
            "restaurant_id": "rest-a",
            "status": "entregue",
        }],
        "pedido_itens": [{
            "id": "00000000-0000-0000-0000-000000000101",
            "pedido_id": "00000000-0000-0000-0000-0000000000f1",
            "produto_id": "00000000-0000-0000-0000-0000000000c1",
            "quantidade": 2,
            "nome_produto": "Pizza QA",
        }],
    })


def test_inventory_smoke_sale_and_cancel_reversal(monkeypatch):
    fake = make_inventory_db()
    monkeypatch.setattr(main, "sb", fake)
    user = {"sub": "user-owner", "nome": "Owner QA", "role": "owner", "restaurant_id": "rest-a"}

    entrada = main.registrar_inventory_movement("rest-a", {
        "inventory_item_id": "00000000-0000-0000-0000-0000000000b1",
        "movement_type": "entrada",
        "quantity": 10,
        "unit_cost": 4,
        "supplier_id": "00000000-0000-0000-0000-0000000000a1",
        "reason": "Entrada smoke QA",
    }, user)
    assert entrada["balance_after"] == 10

    baixa = main.baixar_estoque_pedido_entregue("rest-a", "00000000-0000-0000-0000-0000000000f1", user)
    assert len(baixa["movements"]) == 1
    assert baixa["movements"][0]["movement_type"] == "venda"
    assert baixa["movements"][0]["quantity_delta"] == -1
    assert fake.tables["inventory_items"][0]["current_quantity"] == 9

    baixa_duplicada = main.baixar_estoque_pedido_entregue("rest-a", "00000000-0000-0000-0000-0000000000f1", user)
    assert baixa_duplicada["movements"] == []
    assert fake.tables["inventory_items"][0]["current_quantity"] == 9

    estorno = main.estornar_estoque_pedido("rest-a", "00000000-0000-0000-0000-0000000000f1", user)
    assert len(estorno["movements"]) == 1
    assert estorno["movements"][0]["movement_type"] == "estorno"
    assert estorno["movements"][0]["quantity_delta"] == 1
    assert fake.tables["inventory_items"][0]["current_quantity"] == 10

    estorno_duplicado = main.estornar_estoque_pedido("rest-a", "00000000-0000-0000-0000-0000000000f1", user)
    assert estorno_duplicado["movements"] == []
    assert fake.tables["inventory_items"][0]["current_quantity"] == 10


def test_inventory_smoke_multi_tenant_isolation(monkeypatch):
    fake = make_inventory_db()
    monkeypatch.setattr(main, "sb", fake)

    item_a = main.buscar_inventory_item("rest-a", "00000000-0000-0000-0000-0000000000b1")
    assert item_a["name"] == "Farinha QA"

    with pytest.raises(HTTPException) as exc:
        main.buscar_inventory_item("rest-b", "00000000-0000-0000-0000-0000000000b1")
    assert exc.value.status_code == 404


@pytest.mark.parametrize("role", ["owner", "manager"])
def test_inventory_permission_allows_owner_and_manager(role):
    checker = main.authorize(["manager", "owner"])

    result = checker({"role": role, "restaurant_id": "rest-a"})

    assert result["role"] == role


@pytest.mark.parametrize("role", ["cashier", "waiter", "kitchen", "tv"])
def test_inventory_permission_blocks_operational_roles(role):
    checker = main.authorize(["manager", "owner"])

    with pytest.raises(HTTPException) as exc:
        checker({"role": role, "restaurant_id": "rest-a"})

    assert exc.value.status_code == 403
