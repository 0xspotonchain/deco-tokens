# Token deployments — deco's burner wallet

Deployed Mon 2026-11-16 ~04:12 WIB from burner `0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31`.
Testnet only. All 6 deployments + 3 mints succeeded on the first attempt.
Velana (4th chain) deployed later the same day, ~15:00 WIB.

**Same addresses on Arc, Robinhood and LitVM** — expected: CREATE addresses
derive from deployer address + nonce, and the burner had the same nonce
sequence (0, 1, 2) on each chain. **Velana differs** — the burner nonce was
already 1 there (the VELA World land claim), so both contracts landed at
different addresses.

- **DecoToken (ERC20)** — `0x5f1dF574015C9D044b4C9Ef658cD55aFcC13D783`
  (Arc / Robinhood / LitVM); Velana: `0xDf8A3BaAFffc5de3938bff1158584E841531BcbF`
  "Deco Token", DECO, 18 decimals, 1,000,000 fixed supply, all minted to the burner.
- **DecoNFT (ERC721)** — `0xDf8A3BaAFffc5de3938bff1158584E841531BcbF`
  (Arc / Robinhood / LitVM); Velana: `0xFb71a0C41f1D5D737acb5761eF110B1E0695fC64`
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

## Velana Testnet (chain 484148) — gas: test VELA

Deployed with `deploy-velana.js` (same contracts, same mint + metadata steps).
Raw output in `results-velana.json`.

| Item | Address / tx | Gas used |
|---|---|---|
| ERC20 deploy | tx [0x157909cdb3089a76697a30839321703ab46e07a00b013b31afdfa013875982f8](https://velanachain.com/explorer/#/tx/0x157909cdb3089a76697a30839321703ab46e07a00b013b31afdfa013875982f8) | 634,817 |
| ERC721 deploy | tx [0x20d66d4321fee38c08c3619e2424f6867f8d49469c3f3a9834b26ef5b18f7d35](https://velanachain.com/explorer/#/tx/0x20d66d4321fee38c08c3619e2424f6867f8d49469c3f3a9834b26ef5b18f7d35) | 1,276,697 |
| Mint NFT #1 | tx [0x2ae952e5b7f48c43f535dfd6a7bbf86f4c4912dbfaf7168452676baa5ca7fa09](https://velanachain.com/explorer/#/tx/0x2ae952e5b7f48c43f535dfd6a7bbf86f4c4912dbfaf7168452676baa5ca7fa09) | 74,097 |

- ERC20: https://velanachain.com/explorer/#/address/0xDf8A3BaAFffc5de3938bff1158584E841531BcbF
- ERC721: https://velanachain.com/explorer/#/address/0xFb71a0C41f1D5D737acb5761eF110B1E0695fC64
- Total gas spent: **0.000000000023449678 test VELA** (Velana gas price is ~7 wei)

## NFT metadata (set 2026-11-16 ~04:16 WIB, `node set-metadata.js`; Velana ~15:01 WIB)

Token #1 now has a fully on-chain metadata URI on all four chains — a
`data:application/json;base64` URI containing name "Deco NFT #1",
description, and an inline base64 SVG badge image. No hosting, no accounts.
Metadata source saved in `nft-metadata.json`; tx results in `metadata-results.json`.

| Chain | setTokenURI tx | Gas used |
|---|---|---|
| Arc Testnet | [0x1cd1f0ea9289eacafe312c6df42bea624915f15272527fc86846695cc18f0a26](https://explorer.testnet.arc.io/tx/0x1cd1f0ea9289eacafe312c6df42bea624915f15272527fc86846695cc18f0a26) | 1,409,797 |
| Robinhood Chain Testnet | [0x3d8aeacf115ea14dc8ac63f1b1601c3fc1d9ae3cb5c8ca50a74ad671b0001259](https://explorer.testnet.chain.robinhood.com/tx/0x3d8aeacf115ea14dc8ac63f1b1601c3fc1d9ae3cb5c8ca50a74ad671b0001259) | 1,409,797 |
| LitVM LiteForge Testnet | [0x24598904e225945f10f3ede04f18c98e4393fa1a7f11b4ee636cac921ffbc9ac](https://explorer.testnet.liteforge.zeeve.net/tx/0x24598904e225945f10f3ede04f18c98e4393fa1a7f11b4ee636cac921ffbc9ac) | 1,412,235 |
| Velana Testnet | [0xc1a81309649c807d835619ca964d506ea2f631744af105b27628778d4045c136](https://velanachain.com/explorer/#/tx/0xc1a81309649c807d835619ca964d506ea2f631744af105b27628778d4045c136) | 1,364,343 |

Verified after each tx: `tokenURI(1)` reads back the exact metadata URI.

## SimpleAMM pools (own DEX pools, seeded 10,000 DECO + base each)

`contracts/SimpleAMM.sol` — minimal constant-product AMM (x·y=k, 0.3% fee),
no remove-liquidity function (liquidity stays locked). Deployed with
`deploy-amm.js`; raw results in `amm-results.json` (3 chains) and
`amm-results-velana.json`. The volume sniper trades against these pools
(see the deco-sniper repo).

| Chain | Pool | Pair | Seed |
|---|---|---|---|
| Arc Testnet | `0x3137C615F3f3B1e7C8F75390F8ccb128f4D11A3A` | DECO / USDC | 10,000 DECO + 10 USDC |
| Robinhood Chain Testnet | `0xC72A740883E93E899C02036f96841869A5BdbbDC` | DECO / ETH | 10,000 DECO + 0.001 ETH |
| LitVM LiteForge Testnet | `0x3137C615F3f3B1e7C8F75390F8ccb128f4D11A3A` | DECO / zkLTC | 10,000 DECO + 0.001 zkLTC |
| Velana Testnet | `0xa81056EF621c952B5Fc033D7db159a0Da4ED5163` | DECO / VELA | 10,000 DECO + 0.001 VELA |

## DecoNameService (name registry + soulbound name NFTs)

Own ENS-style registry (`DecoNameService`) + soulbound name NFTs
(`DecoNameToken`). Names `deco` (#1), `muse` (#2), `0xspotonchain` (#3) all
resolve to the burner. Full record in `name-service.md`; raw results in
`name-service-results.json` (3 chains) and `name-service-results-velana.json`.

| Chain | Registry | Name NFT | Name NFTs |
|---|---|---|---|
| Arc / Robinhood / LitVM | `0x9d1217DD428440ef49C59CCa2085aF6bd7A7a5b6` | `0x553c4212254DA568FdDc5Cc312318bB6c0fBB0E4` | 9 (3 per chain) |
| Velana | `0xa9928a4D673dFb5a0922e9d76fC731c4D06Ad7c4` | `0xC72A740883E93E899C02036f96841869A5BdbbDC` | 3 |

Soulbound proven on all 4 chains: `transferFrom`, `approve` and
`setApprovalForAll` all revert with the soulbound custom errors.

## Verification performed

For every deployment: contract code exists at the address, and `name()` /
`symbol()` / `totalSupply()` (ERC20) read back correctly on-chain. ERC20
deployer balance = 1,000,000 DECO on each chain. For every mint: burner NFT
balance = 1 and `ownerOf(1)` = burner address. Pool reserves and name
resolutions re-verified on-chain 2026-11-16 ~18:49 GMT+7.

## Notes

- Sepolia / Base Sepolia / Arbitrum Sepolia / OP Sepolia were NOT attempted —
  the burner holds 0 gas ETH on those chains.
- `deploy.js` has a hard testnet-only guard: it refuses any chain ID other
  than 5042002, 46630, 4441. Re-run per chain with `node deploy.js --chain=arc`
  (etc.) — note a re-deploy would create NEW contract addresses (nonce advanced).
  Velana uses `deploy-velana.js` (chain 484148, same guard style).
- The burner private key is decrypted in-memory only from the VM keystore and
  is never printed, logged, or written anywhere.
