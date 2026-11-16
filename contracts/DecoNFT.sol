// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Deco NFT (DNFT)
/// @notice Simple ERC721 for deco's burner wallet on testnets.
///         Anyone can mint the next token ID to an address; the owner can set
///         per-token URIs. Token IDs start at 1.
contract DecoNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId = 1;

    constructor() ERC721("Deco NFT", "DNFT") Ownable(msg.sender) {}

    /// @notice Mint the next token ID to `to`.
    function mint(address to) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }

    /// @notice Owner sets the metadata URI for a token.
    function setTokenURI(uint256 tokenId, string calldata uri) external onlyOwner {
        _setTokenURI(tokenId, uri);
    }

    /// @notice Next token ID that will be minted.
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
}
