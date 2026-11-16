// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title DECO MUSE (DM)
/// @notice Mintable + burnable ERC-20 for deco's Circle agent wallet on
///         Arc Testnet. The owner is passed as an explicit constructor
///         argument because the Circle agent wallet is a smart-contract
///         account: deploys run through a factory via a bundler, so
///         msg.sender inside the constructor is the factory, not the
///         wallet. Minting is owner-only; anyone can burn their own
///         tokens (ERC20Burnable). Testnet only. 18 decimals. No cap,
///         no pause, no fees, no proxy.
contract DecoMuseToken is ERC20, ERC20Burnable, Ownable {
    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner,
        uint256 initialSupply
    ) ERC20(name_, symbol_) Ownable(initialOwner) {
        _mint(initialOwner, initialSupply);
    }

    /// @notice Mint `amount` tokens to `to`. Owner only.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
