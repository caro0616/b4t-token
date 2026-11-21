# Resultados de las pruebas en red simulada

> Ejecución en una blockchain local (Hardhat, chain ID 31337, reglas de Ethereum `cancun`) por falta de POL de prueba en Amoy: los faucets exigen saldo en Ethereum mainnet. El contrato, la configuración del compilador y los casos son los mismos de la matriz A01–A18; los costos se calcularon con una propina de 30 gwei, como en Amoy, y están en POL simulado. Los hashes no son consultables en Polygonscan.

Generado: 2026-11-20 10:23:07 (hora de Bogotá)

- Contrato: 0xB81De5f5D082e35E067587901E0b7803aA91C9D3
- Transacción de despliegue: 0x5b8280ff7ed8d44cf16b89df32472f94f3fc1ddfbf6da1c69fa00e98d23b8100
- Compilador: solc v0.8.24+commit.e11b9ed9, optimización 200 runs, EVM cancun
- Filas aprobadas: 33 de 33
- Transacciones del token: 28 · gas total: 1537057 · costo total: 0.046488224769623152 POL

| ID | Firma | Función | Estado | Aprobado | Transacción |
| --- | --- | --- | --- | --- | --- |
| A01 | - | compilación | Consulta | Sí | — |
| A02 | D | deploy | Éxito | Sí | 0x5b8280ff7e |
| A03 | - | name/symbol/decimals | Consulta | Sí | — |
| A04-1 | D | transfer | Éxito | Sí | 0xbb6cde4c0c |
| A04-2 | D | transfer | Éxito | Sí | 0x28cab3c345 |
| A04-3 | D | transfer | Éxito | Sí | 0xe104ea1715 |
| A04-4 | D | transfer | Éxito | Sí | 0x2b12a942c8 |
| A05-1 | I1 | transfer | Éxito | Sí | 0x03de7203c3 |
| A05-2 | I1 | transfer | Éxito | Sí | 0xc8789e83ea |
| A05-3 | I1 | transfer | Éxito | Sí | 0xf26f3c6dea |
| A05-4 | I2 | transfer | Éxito | Sí | 0x16668caf90 |
| A05-5 | I2 | transfer | Éxito | Sí | 0x3292cfb13e |
| A05-6 | I2 | transfer | Éxito | Sí | 0xb2b1595726 |
| A05-7 | I3 | transfer | Éxito | Sí | 0x6152235a66 |
| A05-8 | I3 | transfer | Éxito | Sí | 0x85a1ff539b |
| A05-9 | I3 | transfer | Éxito | Sí | 0xa7d29f8b03 |
| A05-10 | I4 | transfer | Éxito | Sí | 0xb100796bc3 |
| A05-11 | I4 | transfer | Éxito | Sí | 0x703ed34fb2 |
| A05-12 | I4 | transfer | Éxito | Sí | 0xc22f4a099d |
| A06 | I1 | transfer | Éxito | Sí | 0x97c1a97310 |
| A07 | I4 | transfer | Éxito | Sí | 0x4a5d0ce67b |
| A08 | I1 | transfer | Éxito | Sí | 0xfbbcb67d85 |
| A09 | I3 | transfer | Éxito | Sí | 0x36fc7bcc8f |
| A10 | I4 | transfer | Falló (esperado) | Sí | 0xb96ad52234 |
| A11 | I1 | transfer | Falló (esperado) | Sí | 0xd277436eba |
| A12 | I1 | approve | Éxito | Sí | 0x8ea393ef50 |
| A13 | I2 | transferFrom | Éxito | Sí | 0x385eef7514 |
| A14 | I2 | transferFrom | Falló (esperado) | Sí | 0xd677b33f13 |
| A15-1 | I1 | approve | Éxito | Sí | 0x3b54e9b63f |
| A15-2 | I1 | approve | Éxito | Sí | 0x094fbea226 |
| A16 | - | revisión ABI | Consulta | Sí | — |
| A17 | - | conciliación | Consulta | Sí | — |
| A18 | - | verificación | Consulta | Sí | — |

Fondeo de POL desde D hacia I1–I4 (no son casos de prueba): ver `fondeo_pol.csv`.

Detalle completo: `matriz_simulada.csv` · Saldos por etapa: `saldos_simulada.csv`
