# Block4 Token (B4T)

Token ERC-20 de uso educativo desplegado en Polygon PoS. Proyecto final del curso de Blockchain, Universidad EAFIT.

> **Uso exclusivamente académico.** B4T no tiene valor económico, no se vende, no se lista en mercados y no representa ningún derecho. Se usa solo entre los integrantes del equipo para demostrar el ciclo de vida de un token ERC-20.

## Equipo

| Integrante | Rol |
| --- | --- |
| David Alberto Cuadros Mariño | _por definir_ |
| Maximiliano Bustamante Garcia | _por definir_ |
| Valeria Francis Hornung Urrego | _por definir_ |
| Leidy Carolina Obando Figueroa | _por definir_ |

Supervisor académico: Sergio Steven Ramirez Rico.

## Especificación

| Elemento | Valor |
| --- | --- |
| Nombre | Block4 Token |
| Símbolo | B4T |
| Estándar | ERC-20 (OpenZeppelin Contracts 5.x) |
| Suministro | 1 000 000 B4T, emitidos una sola vez al desplegar |
| Decimales | 18 |
| Funciones administrativas | Ninguna (sin mint posterior, burn, pausas, comisiones ni proxy) |

## Despliegues

| Red | Chain ID | Dirección del contrato | Explorador | Commit / tag |
| --- | --- | --- | --- | --- |
| Polygon Amoy (pruebas) | 80002 | _pendiente_ | _pendiente_ | `v1.0-amoy` |
| Polygon PoS (mainnet) | 137 | _pendiente_ | _pendiente_ | `v1.0-mainnet` |

Compilador: _versión pendiente_ · Optimización: _pendiente_

## Estructura del repositorio

```
contracts/            Código fuente del contrato (B4T.sol)
docs/propuesta/       Propuesta aprobada (PDF)
docs/whitepaper/      Whitepaper académico (PDF)
evidencias/amoy/      Matriz de pruebas A01–A18 y capturas
evidencias/mainnet/   Matriz M01–M07, conciliación de saldos y capturas
revision/             Lista de verificación de la revisión por pares y del despliegue
```

## Reglas del repositorio

- Nunca se suben frases semilla, claves privadas, API keys ni archivos `.env`. Si algo se sube por error, se avisa al equipo de inmediato y se reemplaza la billetera o la clave afectada.
- Las capturas se revisan antes de subirlas: no deben mostrar frases semilla, saldos de otros activos ni datos personales.
- Los cambios al contrato entran por pull request y necesitan la aprobación de al menos dos integrantes distintos del autor.
- El commit exacto desplegado en cada red se marca con un tag.

## Referencias

- [EIP-20: Token Standard](https://eips.ethereum.org/EIPS/eip-20)
- [OpenZeppelin Contracts – ERC20](https://docs.openzeppelin.com/contracts/5.x/erc20)
- [Polygon PoS – documentación para desarrolladores](https://docs.polygon.technology/pos/get-started/building-on-polygon)
- [Remix IDE](https://remix-ide.readthedocs.io/en/latest/)
