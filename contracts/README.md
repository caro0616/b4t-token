# Contrato

`B4T.sol` es el contrato ERC-20 del proyecto, escrito por el rol 1 (Contrato) sobre OpenZeppelin Contracts.

## Configuración de compilación

| Parámetro | Valor |
| --- | --- |
| Compilador | Solidity 0.8.24 (pragma fijo `pragma solidity 0.8.24;`) |
| Optimización | Activada, 200 runs |
| EVM | cancun |
| Librería | OpenZeppelin Contracts 5.6.1 (import `@openzeppelin/contracts@5.6.1/token/ERC20/ERC20.sol`) |
| Licencia | MIT |
| Constructor | Sin parámetros. Emite 1 000 000 × 10^18 unidades mínimas (18 decimales) a `msg.sender` en el momento del despliegue |

Estos mismos valores deben usarse en Remix al compilar y en Polygonscan al verificar, tanto en Amoy como en mainnet.

## Funciones públicas del ABI

| Función | Tipo | Descripción |
| --- | --- | --- |
| `name()` | view | Devuelve `"Block4 Token"` |
| `symbol()` | view | Devuelve `"B4T"` |
| `decimals()` | view | Devuelve `18` |
| `totalSupply()` | view | Suministro total: 1 000 000 × 10^18 |
| `INITIAL_SUPPLY()` | view (constante) | Suministro en unidades enteras: `1000000` |
| `balanceOf(address account)` | view | Saldo de una cuenta |
| `allowance(address owner, address spender)` | view | Monto que `spender` puede gastar en nombre de `owner` |
| `transfer(address to, uint256 value)` | nonpayable | Transfiere tokens a `to` |
| `approve(address spender, uint256 value)` | nonpayable | Autoriza a `spender` a gastar `value` |
| `transferFrom(address from, address to, uint256 value)` | nonpayable | Transfiere tokens usando una autorización previa |

Eventos: `Transfer(address,address,uint256)` y `Approval(address,address,uint256)`.

No existen funciones `mint`, `burn`, `pause`, `owner` ni ninguna otra función administrativa (caso A16). El suministro se emite una sola vez en el constructor y no puede cambiar.

> **Nota:** la cuenta que despliega el contrato recibe todo el suministro. En Amoy será la cuenta de pruebas acordada por el equipo; en mainnet, la billetera exclusiva del proyecto.

Cualquier cambio a este archivo entra por pull request con dos aprobaciones de integrantes distintos del autor.
