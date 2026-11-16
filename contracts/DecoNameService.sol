// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Deco Name Service
/// @notice Minimal ENS-style registry for deco's testnet stack.
///         The owner (the burner wallet) maps names to addresses; anyone can
///         resolve them. Names are stored case-sensitively as given — the
///         deploy script always registers lowercase names.
///         Testnet only. No fees, no expiry, no subdomains — keep it minimal.
contract DecoNameService is Ownable {
    error EmptyName();

    mapping(string => address) private _records;

    event NameRegistered(string name, address target);

    constructor() Ownable(msg.sender) {}

    /// @notice Register (or re-register / update) `name` -> `target`.
    ///         Owner only. A zero target unregisters the name.
    function register(string calldata name, address target) external onlyOwner {
        if (bytes(name).length == 0) revert EmptyName();
        _records[name] = target;
        emit NameRegistered(name, target);
    }

    /// @notice Resolve `name` to its target address (zero address if unset).
    function resolve(string calldata name) external view returns (address) {
        return _records[name];
    }
}
