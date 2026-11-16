# Token deployments — deco's burner wallet

Deployed Mon 2026-11-16 ~04:12 WIB from burner `0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31`.
Testnet only. All 6 deployments + 3 mints succeeded on the first attempt.

**Same addresses on all three chains** — expected: CREATE addresses derive from
deployer address + nonce, and the burner had the same nonce sequence (0, 1, 2)
on each chain.

- **DecoToken (ERC20)** — `0x5f1dF574015C9D044b4C9Ef658cD55aFcC13D783`
  "Deco Token", DECO, 18 decimals, 1,000,000 fixed supply, all minted to the burner.
- **DecoNFT (ERC721)** — `0xDf8A3BaAFffc5de3938bff1158584E841531BcbF`
  "Deco NFT", DNFT. Public `mint(address)`; owner `setTokenURI(uint256, string)`.
  Token #1 minted to the burner on each chain.

Contracts: OpenZeppelin Contracts v5.6.1, solc 0.8.38, optimizer runs 200.
Source in `contracts/`, ABIs + bytecode in `build/DecoToken.json` and `build/DecoNFT.json`.

## Arc Testnet (chain 5042002) — gas: native USDC

| Item | Address / tx | Gas used |
|---|---|---|
| ERC20 deploy | tx [0x9571b610b56fdad0438de5a546a4ecf66d1aaff6b89de654a8b89fc3ca4de0d6](https://explorer.testnet.arc.io/tx/0x9571b610b56fdad0438de5a546a4ecf66d1aaff6b89de654a8b89fc3ca4de0d6) | 634,817 |
| ERC721 deploy | tx [0x89cd4ececd54cb91b8b5998069d0dc78f3ca52891a4ef6ee2e09e7643cec4396](https://explorer.testnet.arc.io/tx/0x89cd4ececd54cb91b8b5998069d0dc78f3ca52891a4ef6ee2e09e7643cec4396) | 1,276,697 |
| Mint NFT #1 | tx [0xb23c4dffc85a57c17d64e57b5b9ea52bf23568a24ff97617f3c5f0745090b85e](https://explorer.testnet.arc.io/tx/0xb23c4dffc85a57c17d64e57b5b9ea52bf23568a24ff97617f3c5f0745090b85e) | 74,097 |

- ERC20: https://explorer.testnet.arc.io/address/0x5f1dF574015C9D044b4C9Ef658cD55aFcC13D783
- ERC721: https://explorer.testnet.arc.io/address/0xDf8A3BaAFffc5de3938bff1158584E841531BcbF
- Total gas spent: **0.049640275 USDC** (25 gwei gas price)

## Robinhood Chain Testnet (chain 46630) — gas: test ETH

| Item | Address / tx | Gas used |
|---|---|---|
| ERC20 deploy | tx [0xe78d53958d8f658e0a860de98bfd89fbfaf0034962972c1378f9ce1e4b6f59ea](https://explorer.testnet.chain.robinhood.com/tx/0xe78d53958d8f658e0a860de98bfd89fbfaf0034962972c1378f9ce1e4b6f59ea) | 634,817 |
| ERC721 deploy | tx [0xf287512ad2a0b951578a10041fb51e8fb515d21522b9cf9697e01160afb88599](https://explorer.testnet.chain.robinhood.com/tx/0xf287512ad2a0b951578a10041fb51e8fb515d21522b9cf9697e01160afb88599) | 1,276,697 |
| Mint NFT #1 | tx [0xae7a91cdf38bfb3fc338bec8ad49e1ce2e730f1119b6c9316565b1f5f6979f25](https://explorer.testnet.chain.robinhood.com/tx/0xae7a91cdf38bfb3fc338bec8ad49e1ce2e730f1119b6c9316565b1f5f6979f25) | 74,097 |

- ERC20: https://explorer.testnet.chain.robinhood.com/address/0x5f1dF574015C9D044b4C9Ef658cD55aFcC13D783
- ERC721: https://explorer.testnet.chain.robinhood.com/address/0xDf8A3BaAFffc5de3938bff1158584E841531BcbF
- Total gas spent: **0.00001985611 test ETH** (0.01 gwei gas price)

## LitVM LiteForge Testnet (chain 4441) — gas: zkLTC

| Item | Address / tx | Gas used |
|---|---|---|
| ERC20 deploy | tx [0x4028c462045e66c86f0ea37cae76c59a7b7512f5749b3e42ee6ae7b5a3d9a2ff](https://explorer.testnet.liteforge.zeeve.net/tx/0x4028c462045e66c86f0ea37cae76c59a7b7512f5749b3e42ee6ae7b5a3d9a2ff) | 638,225 |
| ERC721 deploy | tx [0xca3b362ce26c538592b9a3b974a6af0f60b8564139226a71cdbb1d84c362afb3](https://explorer.testnet.liteforge.zeeve.net/tx/0xca3b362ce26c538592b9a3b974a6af0f60b8564139226a71cdbb1d84c362afb3) | 1,282,405 |
| Mint NFT #1 | tx [0xae06517c000e1f30fb540b6e9087222cb9f1bde8157a81732bded481c6722557](https://explorer.testnet.liteforge.zeeve.net/tx/0xae06517c000e1f30fb540b6e9087222cb9f1bde8157a81732bded481c6722557) | 74,333 |

- ERC20: https://explorer.testnet.liteforge.zeeve.net/address/0x5f1dF574015C9D044b4C9Ef658cD55aFcC13D783
- ERC721: https://explorer.testnet.liteforge.zeeve.net/address/0xDf8A3BaAFffc5de3938bff1158584E841531BcbF
- Total gas spent: **0.00001994963 zkLTC** (0.01 gwei gas price)

## NFT metadata (set 2026-11-16 ~04:16 WIB, `node set-metadata.js`)

Token #1 now has a fully on-chain metadata URI on all three chains — a
`data:application/json;base64` URI (1,897 chars) containing name "Deco NFT #1",
description, and an inline base64 SVG badge image. No hosting, no accounts.
Metadata source saved in `nft-metadata.json`; tx results in `metadata-results.json`.

| Chain | setTokenURI tx | Gas used |
|---|---|---|
| Arc Testnet | [0x1cd1f0ea9289eacafe312c6df42bea624915f15272527fc86846695cc18f0a26](https://explorer.testnet.arc.io/tx/0x1cd1f0ea9289eacafe312c6df42bea624915f15272527fc86846695cc18f0a26) | 1,409,797 |
| Robinhood Chain Testnet | [0x3d8aeacf115ea14dc8ac63f1b1601c3fc1d9ae3cb5c8ca50a74ad671b0001259](https://explorer.testnet.chain.robinhood.com/tx/0x3d8aeacf115ea14dc8ac63f1b1601c3fc1d9ae3cb5c8ca50a74ad671b0001259) | 1,409,797 |
| LitVM LiteForge Testnet | [0x24598904e225945f10f3ede04f18c98e4393fa1a7f11b4ee636cac921ffbc9ac](https://explorer.testnet.liteforge.zeeve.net/tx/0x24598904e225945f10f3ede04f18c98e4393fa1a7f11b4ee636cac921ffbc9ac) | 1,412,235 |

Verified after each tx: `tokenURI(1)` reads back the exact metadata URI.

## Verification performed

For every deployment: contract code exists at the address, and `name()` /
`symbol()` / `totalSupply()` (ERC20) read back correctly on-chain. ERC20
deployer balance = 1,000,000 DECO on each chain. For every mint: burner NFT
balance = 1 and `ownerOf(1)` = burner address.

## Notes

- Sepolia / Base Sepolia / Arbitrum Sepolia / OP Sepolia were NOT attempted —
  the burner holds 0 gas ETH on those chains.
- `deploy.js` has a hard testnet-only guard: it refuses any chain ID other
  than 5042002, 46630, 4441. Re-run per chain with `node deploy.js --chain=arc`
  (etc.) — note a re-deploy would create NEW contract addresses (nonce advanced).
- The burner private key is decrypted in-memory only from the VM keystore and
  is never printed, logged, or written anywhere.
