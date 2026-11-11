// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts@5.6.1/token/ERC20/ERC20.sol";

/// @title Block4 Token (B4T)
/// @notice Token ERC-20 de uso exclusivamente académico (Blockchain, Universidad EAFIT).
///         No tiene valor económico, no se vende y no representa ningún derecho.
/// @dev Suministro fijo de 1 000 000 B4T (18 decimales) emitido una sola vez en el
///      constructor a la cuenta que despliega. No hay funciones administrativas:
///      sin mint posterior, burn, pausa, owner, comisiones ni proxy.
contract B4T is ERC20 {
    /// @notice Suministro total en unidades enteras de token (antes de aplicar decimales).
    uint256 public constant INITIAL_SUPPLY = 1_000_000;

    /// @notice El constructor no recibe parámetros. Emite
    ///         1 000 000 * 10^18 unidades mínimas a msg.sender.
    constructor() ERC20("Block4 Token", "B4T") {
        _mint(msg.sender, INITIAL_SUPPLY * 10 ** decimals());
    }
}
