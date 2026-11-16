// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @title Deco Name Token (DNAME)
/// @notice Soulbound ERC-721: one token per name registered in the
///         DecoNameService. Non-transferable by design — minting is the only
///         way a token moves, and it can never leave its holder.
///         Metadata is fully on-chain (base64 JSON + inline SVG badge) in
///         the gold-DC badge style of the Deco NFT. No hosting, no accounts.
///         Testnet only. Owner (the burner wallet) mints.
contract DecoNameToken is ERC721, Ownable {
    using Strings for uint256;

    error SoulboundTransferBlocked(uint256 tokenId);
    error SoulboundApprovalsDisabled();
    error TokenAlreadyExists(uint256 tokenId);
    error NameAlreadyMinted(string name);
    error EmptyName();

    mapping(uint256 => string) private _tokenNames;
    mapping(string => uint256) private _nameToTokenId;

    constructor() ERC721("Deco Name", "DNAME") Ownable(msg.sender) {}

    /// @notice Mint token `tokenId` for `name` to `to`. Owner only.
    ///         One token per name: re-minting an existing tokenId or an
    ///         already-minted name reverts.
    function mint(address to, uint256 tokenId, string calldata name) external onlyOwner {
        if (bytes(name).length == 0) revert EmptyName();
        if (_ownerOf(tokenId) != address(0)) revert TokenAlreadyExists(tokenId);
        if (_nameToTokenId[name] != 0) revert NameAlreadyMinted(name);
        _tokenNames[tokenId] = name;
        _nameToTokenId[name] = tokenId;
        _safeMint(to, tokenId);
    }

    /// @notice The name recorded for `tokenId`.
    function tokenName(uint256 tokenId) external view returns (string memory) {
        _requireOwned(tokenId);
        return _tokenNames[tokenId];
    }

    /// @notice The token ID minted for `name` (0 if the name was never minted).
    function tokenIdForName(string calldata name) external view returns (uint256) {
        return _nameToTokenId[name];
    }

    /// @notice Fully on-chain metadata: data: URI, base64 JSON, inline SVG.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory name = _tokenNames[tokenId];
        string memory svg = string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
                '<rect width="512" height="512" fill="#0a0a0f"/>',
                '<circle cx="256" cy="185" r="105" fill="none" stroke="#f5c518" stroke-width="6"/>',
                '<text x="256" y="205" font-family="monospace" font-size="64" font-weight="bold" fill="#f5c518" text-anchor="middle">DC</text>',
                '<text x="256" y="330" font-family="monospace" font-size="30" font-weight="bold" fill="#ffffff" text-anchor="middle">',
                name,
                '</text>',
                '<text x="256" y="370" font-family="monospace" font-size="16" fill="#999999" text-anchor="middle">DECO NAME #',
                tokenId.toString(),
                '</text>',
                '<text x="256" y="420" font-family="monospace" font-size="14" fill="#f5c518" text-anchor="middle">SOULBOUND - NON-TRANSFERABLE</text>',
                '<text x="256" y="470" font-family="monospace" font-size="14" fill="#555555" text-anchor="middle">ARC - ROBINHOOD - LITVM TESTNETS</text></svg>'
            )
        );
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name":"Deco Name #',
                        tokenId.toString(),
                        " \u2014 ",
                        name,
                        '","description":"Soulbound name token for the DecoNameService on testnets. The name \\"',
                        name,
                        '\\" resolves to its holder via the DecoNameService registry. Non-transferable \\u2014 bound to its holder. DYOR, don\\u0027t trust \\u2014 verify.","image":"data:image/svg+xml;base64,',
                        Base64.encode(bytes(svg)),
                        '","attributes":[{"trait_type":"Name","value":"',
                        name,
                        '"},{"trait_type":"Token ID","value":"',
                        tokenId.toString(),
                        '"},{"trait_type":"Type","value":"Soulbound"},{"trait_type":"Network","value":"Testnet"}]}'
                    )
                )
            )
        );
        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    /// @notice Soulbound lock: any update where the token already has an
    ///         owner is a transfer (or burn) and reverts. Minting — the only
    ///         update with from == address(0) — is allowed.
    ///         This single override blocks transferFrom, safeTransferFrom
    ///         and any burn, since they all funnel through _update.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (_ownerOf(tokenId) != address(0)) {
            revert SoulboundTransferBlocked(tokenId);
        }
        return super._update(to, tokenId, auth);
    }

    /// @notice Approvals are meaningless on a soulbound token — always revert.
    function approve(address, uint256) public override {
        revert SoulboundApprovalsDisabled();
    }

    /// @notice Approvals are meaningless on a soulbound token — always revert.
    function setApprovalForAll(address, bool) public override {
        revert SoulboundApprovalsDisabled();
    }
}
