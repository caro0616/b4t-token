"""Conciliación de saldos y costos de B4T (casos A17, M06 y M07).

Lee la matriz de pruebas de una red, consulta la blockchain por RPC público y:

1. Completa en la matriz las columnas Fecha y hora, Estado, Gas usado y Costo (POL)
   de cada fila que tenga hash.
2. Consulta totalSupply y balanceOf de cada cuenta y escribe conciliacion.csv.
3. Opcional (--eventos): reconstruye los saldos a partir de los eventos Transfer
   desde el bloque de despliegue y los compara con balanceOf.
4. Escribe reporte_conciliacion.md con las tablas listas para el informe.

Solo usa información pública (direcciones y hashes). No necesita claves ni API keys.

Uso:
    python scripts/conciliacion.py --red amoy
    python scripts/conciliacion.py --red mainnet --eventos
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DECIMALES = 18
UNIDAD = 10**DECIMALES
TOPIC_TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
SEL_TOTAL_SUPPLY = "0x18160ddd"
SEL_BALANCE_OF = "0x70a08231"

REDES = {
    "amoy": {
        "chain_id": 80002,
        "rpc": "https://polygon-amoy-bor-rpc.publicnode.com",
        "explorador": "https://amoy.polygonscan.com",
        "carpeta": RAIZ / "evidencias" / "amoy",
        "matriz": "matriz_amoy.csv",
    },
    "mainnet": {
        "chain_id": 137,
        "rpc": "https://polygon-bor-rpc.publicnode.com",
        "explorador": "https://polygonscan.com",
        "carpeta": RAIZ / "evidencias" / "mainnet",
        "matriz": "matriz_mainnet.csv",
    },
}


# ---------------------------------------------------------------- RPC ---------

class RPC:
    def __init__(self, url: str):
        self.url = url
        self._id = 0

    def llamar(self, metodo: str, params: list):
        self._id += 1
        cuerpo = json.dumps({"jsonrpc": "2.0", "id": self._id, "method": metodo, "params": params}).encode()
        req = urllib.request.Request(
            self.url, data=cuerpo,
            headers={"Content-Type": "application/json", "User-Agent": "b4t-conciliacion/1.0"},
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            resp = json.loads(r.read())
        if "error" in resp:
            raise RuntimeError(f"{metodo}: {resp['error']}")
        return resp["result"]

    def eth_call(self, a: str, data: str) -> int:
        return int(self.llamar("eth_call", [{"to": a, "data": data}, "latest"]), 16)


def pad(direccion: str) -> str:
    return direccion.lower().replace("0x", "").rjust(64, "0")


def a_b4t(unidades: int) -> str:
    """Convierte unidades mínimas a B4T sin perder precisión (sin floats)."""
    valor = Decimal(unidades) / Decimal(UNIDAD)
    texto = format(valor.normalize(), "f")
    return texto


def a_pol(wei: int) -> str:
    return format((Decimal(wei) / Decimal(10**18)).quantize(Decimal("0.000000001")), "f")


# ---------------------------------------------------------- matriz ------------

def completar_matriz(rpc: RPC, ruta: Path) -> list[dict]:
    with ruta.open(newline="", encoding="utf-8-sig") as f:
        lector = csv.DictReader(f)
        campos = lector.fieldnames or []
        filas = list(lector)

    bloques: dict[str, int] = {}
    for fila in filas:
        h = (fila.get("Hash") or "").strip()
        if not h.startswith("0x"):
            continue
        rec = rpc.llamar("eth_getTransactionReceipt", [h])
        if rec is None:
            fila["Estado"] = "No encontrada"
            continue
        gas = int(rec["gasUsed"], 16)
        precio = int(rec.get("effectiveGasPrice") or "0x0", 16)
        fila["Estado"] = "Exitosa" if rec["status"] == "0x1" else "Revertida"
        fila["Gas usado"] = str(gas)
        fila["Costo (POL)"] = a_pol(gas * precio)
        fila["_costo_wei"] = gas * precio
        fila["_desde"] = rec["from"]
        if not (fila.get("Fecha y hora") or "").strip():
            num = rec["blockNumber"]
            if num not in bloques:
                bloques[num] = int(rpc.llamar("eth_getBlockByNumber", [num, False])["timestamp"], 16)
            fila["Fecha y hora"] = datetime.fromtimestamp(bloques[num], timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    with ruta.open("w", newline="", encoding="utf-8") as f:
        escritor = csv.DictWriter(f, fieldnames=campos, extrasaction="ignore", lineterminator="\r\n")
        escritor.writeheader()
        escritor.writerows(filas)
    return filas


# ------------------------------------------------------- conciliación ---------

def saldos_por_eventos(rpc: RPC, contrato: str, desde: int, paso: int = 2000) -> tuple[dict[str, int], int]:
    hasta = int(rpc.llamar("eth_blockNumber", []), 16)
    saldos: dict[str, int] = {}
    n = 0
    b = desde
    while b <= hasta:
        fin = min(b + paso - 1, hasta)
        logs = rpc.llamar("eth_getLogs", [{
            "address": contrato, "topics": [TOPIC_TRANSFER],
            "fromBlock": hex(b), "toBlock": hex(fin),
        }])
        for log in logs:
            origen = "0x" + log["topics"][1][-40:]
            destino = "0x" + log["topics"][2][-40:]
            monto = int(log["data"], 16)
            saldos[origen] = saldos.get(origen, 0) - monto
            saldos[destino] = saldos.get(destino, 0) + monto
            n += 1
        b = fin + 1
    saldos.pop("0x" + "0" * 40, None)  # la dirección cero solo emite
    return saldos, n


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--red", choices=REDES, required=True)
    p.add_argument("--config", default=str(RAIZ / "scripts" / "config.json"))
    p.add_argument("--rpc", help="URL RPC alternativa")
    p.add_argument("--eventos", action="store_true", help="reconstruir saldos con eventos Transfer")
    args = p.parse_args()

    red = REDES[args.red]
    cfg = json.loads(Path(args.config).read_text(encoding="utf-8"))
    cfg_red = cfg["redes"][args.red]
    contrato = cfg_red["contrato"]
    if not contrato or "PENDIENTE" in contrato.upper():
        print(f"Falta la dirección del contrato en {args.config} (redes.{args.red}.contrato).")
        return 1

    rpc = RPC(args.rpc or cfg_red.get("rpc") or red["rpc"])
    chain = int(rpc.llamar("eth_chainId", []), 16)
    if chain != red["chain_id"]:
        print(f"El RPC responde chain ID {chain}, se esperaba {red['chain_id']}. Se detiene.")
        return 1

    cuentas = [("Billetera del proyecto" if args.red == "mainnet" else "Billetera de pruebas",
                cfg_red["billetera_despliegue"])]
    cuentas += [(c["nombre"], c["direccion"]) for c in cfg["integrantes"]]

    # 1. Matriz
    filas = completar_matriz(rpc, red["carpeta"] / red["matriz"])
    con_hash = [f for f in filas if "_costo_wei" in f]
    exitosas = [f for f in con_hash if f["Estado"] == "Exitosa"]
    revertidas = [f for f in con_hash if f["Estado"] == "Revertida"]
    gas_total = sum(int(f["Gas usado"]) for f in con_hash)
    costo_total = sum(f["_costo_wei"] for f in con_hash)

    # 2. Saldos
    total = rpc.eth_call(contrato, SEL_TOTAL_SUPPLY)
    saldos = [(n, d, rpc.eth_call(contrato, SEL_BALANCE_OF + pad(d))) for n, d in cuentas]
    suma = sum(s for _, _, s in saldos)
    cuadra = suma == total

    with (red["carpeta"] / "conciliacion.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\r\n")
        w.writerow(["Cuenta", "Direccion publica", "Saldo final (B4T)", "Saldo final (unidades)"])
        for n, d, s in saldos:
            w.writerow([n, d, a_b4t(s), s])
        w.writerow(["Suma de saldos", "", a_b4t(suma), suma])
        w.writerow(["totalSupply()", contrato, a_b4t(total), total])
        w.writerow(["Cuadra", "", "SI" if cuadra else "NO", total - suma])

    # 3. Eventos (opcional)
    eventos_txt = ""
    if args.eventos:
        desde = int(cfg_red.get("bloque_despliegue") or 0)
        por_eventos, n_eventos = saldos_por_eventos(rpc, contrato, desde)
        difs = [(n, d) for n, d, s in saldos if por_eventos.get(d.lower(), 0) != s]
        externos = [d for d in por_eventos if d not in {c[1].lower() for c in cuentas} and por_eventos[d] != 0]
        eventos_txt = (
            f"\n## Reconstrucción con eventos Transfer\n\n"
            f"- Eventos Transfer leídos desde el bloque {desde}: {n_eventos}\n"
            f"- Cuentas cuyo saldo por eventos difiere de balanceOf: {len(difs)}"
            + (" (" + ", ".join(n for n, _ in difs) + ")" if difs else "") + "\n"
            f"- Direcciones fuera del equipo con saldo: {len(externos)}"
            + (" (" + ", ".join(externos[:10]) + ("…" if len(externos) > 10 else "") + ")" if externos else "") + "\n"
        )

    # 4. Reporte
    presupuesto = cfg_red.get("presupuesto_pol")
    lineas = [
        f"# Conciliación B4T – {args.red} (chain ID {chain})",
        "",
        f"Generado: {datetime.now(timezone.utc):%Y-%m-%d %H:%M UTC} · Contrato: "
        f"[{contrato}]({red['explorador']}/token/{contrato})",
        "",
        "## Saldos",
        "",
        "| Cuenta | Dirección | Saldo (B4T) |",
        "| --- | --- | ---: |",
        *[f"| {n} | `{d}` | {a_b4t(s)} |" for n, d, s in saldos],
        f"| **Suma** | | **{a_b4t(suma)}** |",
        f"| **totalSupply()** | | **{a_b4t(total)}** |",
        "",
        f"Resultado: {'la suma de saldos coincide con totalSupply' if cuadra else 'NO cuadra, diferencia de ' + str(total - suma) + ' unidades'}.",
        "",
        "## Transacciones y costos",
        "",
        f"- Filas con hash: {len(con_hash)} · exitosas: {len(exitosas)} · revertidas: {len(revertidas)}",
        f"- Gas total: {gas_total:,}".replace(",", " "),
        f"- Costo total: {a_pol(costo_total)} POL",
    ]
    if presupuesto not in (None, "", 0):
        dentro = Decimal(a_pol(costo_total)) <= Decimal(str(presupuesto))
        lineas.append(f"- Presupuesto aprobado: {presupuesto} POL → {'dentro' if dentro else 'EXCEDIDO'}")
    if args.red == "mainnet":
        lineas.append(f"- Meta de la propuesta: ≥ 18 transacciones confirmadas → "
                      f"{'cumple' if len(exitosas) >= 18 else 'faltan ' + str(18 - len(exitosas))}")
    lineas += ["", "| ID | Función | Estado | Gas | Costo (POL) | Hash |", "| --- | --- | --- | ---: | ---: | --- |"]
    lineas += [f"| {f['ID']} | {f['Funcion']} | {f['Estado']} | {f['Gas usado']} | {f['Costo (POL)']} | "
               f"[{f['Hash'][:10]}…]({red['explorador']}/tx/{f['Hash']}) |" for f in con_hash]
    reporte = "\n".join(lineas) + "\n" + eventos_txt
    (red["carpeta"] / "reporte_conciliacion.md").write_text(reporte, encoding="utf-8")
    print(reporte)
    return 0 if cuadra else 2


if __name__ == "__main__":
    sys.exit(main())
