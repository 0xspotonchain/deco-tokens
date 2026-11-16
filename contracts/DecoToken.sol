// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Deco Token (DECO)
/// @notice Fixed-supply ERC20 for deco's burner wallet on testnets.
///         1,000,000 DECO minted to the deployer at construction. No mint/burn after.
contract DecoToken is ERC20, Ownable {
    constructor() ERC20("Deco Token", "DECO") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }
}
