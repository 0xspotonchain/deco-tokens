# Deco Name Service — deployment record

Own ENS-style registry (`DecoNameService`) + soulbound name NFTs (`DecoNameToken`) for deco's testnet stack.
Names resolve to the burner EVM address `0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31`.
Token IDs: 1 = deco, 2 = muse, 3 = 0xspotonchain (same on every chain).
Name NFTs are soulbound: minting only, transfers and approvals always revert.

## Names

| Token ID | Name | Resolves to |
|---:|---|---|
| 1 | `deco` | burner `0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31` |
| 2 | `muse` | burner `0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31` |
| 3 | `0xspotonchain` | burner `0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31` |

## Arc Testnet (chain 5042002)

- Registry (DecoNameService): `0x9d1217DD428440ef49C59CCa2085aF6bd7A7a5b6` — deploy tx [`0x3c356f255ca0b6bd6a9fd3b5fb212c55da354b959200f4ee297d5693279098bf`](https://explorer.testnet.arc.io/tx/0x3c356f255ca0b6bd6a9fd3b5fb212c55da354b959200f4ee297d5693279098bf) (gas 302647)
- Name NFT (DecoNameToken): `0x553c4212254DA568FdDc5Cc312318bB6c0fBB0E4` — deploy tx [`0xf9a835bae74752438d721245f3bc0807c8fe085900af0985ebba1d56a4d6d71c`](https://explorer.testnet.arc.io/tx/0xf9a835bae74752438d721245f3bc0807c8fe085900af0985ebba1d56a4d6d71c) (gas 1788032)

| Name | Register tx | Mint tx (token ID) |
|---|---|---|
| `deco` | [`0xc2da10e562283d42…`](https://explorer.testnet.arc.io/tx/0xc2da10e562283d42434190d98625bcd3fb3f16641ec9f15c1b8d936785f39e59) | [`0x93cc0cee0c276f0d…`](https://explorer.testnet.arc.io/tx/0x93cc0cee0c276f0d635b9c9332abf9f42eddf45edd2aac3e8b7d921e91b775ee) (#1) |
| `muse` | [`0x4681e50ae1942d0a…`](https://explorer.testnet.arc.io/tx/0x4681e50ae1942d0a1443f7d21ac7dc99416697bf2dd59d797b199061f0e6ae60) | [`0xee9699bbaeaf715d…`](https://explorer.testnet.arc.io/tx/0xee9699bbaeaf715d70098d8289bd1c811e5558f1ef21183a84be743bedbe8d3f) (#2) |
| `0xspotonchain` | [`0x5445d7c6ced6cdee…`](https://explorer.testnet.arc.io/tx/0x5445d7c6ced6cdee9923224e674ea093df892e99003479be7c3ddec653e60693) | [`0xf93c124fdb923ed0…`](https://explorer.testnet.arc.io/tx/0xf93c124fdb923ed0b06bb216157bab6cdf56d46f73988b3f7823bac4b95851e5) (#3) |

- Verified: resolve() returns the burner for all 3 names; tokenURI(1–3) decode to JSON with the right names and SVG artwork; soulbound lock proven by eth_call — `transferFrom`, `approve` and `setApprovalForAll` all revert with the soulbound custom errors.
- Total gas: 2555637 (0.063890925 USDC)
- Updated: 2026-11-16T07:13:46.866Z

## Robinhood Chain Testnet (chain 46630)

- Registry (DecoNameService): `0x9d1217DD428440ef49C59CCa2085aF6bd7A7a5b6` — deploy tx [`0x43458e9d1d086bf5c2d1ee2d9122ae5471d8500ba34836f56f0b63d4b4d1cecd`](https://explorer.testnet.chain.robinhood.com/tx/0x43458e9d1d086bf5c2d1ee2d9122ae5471d8500ba34836f56f0b63d4b4d1cecd) (gas 302647)
- Name NFT (DecoNameToken): `0x553c4212254DA568FdDc5Cc312318bB6c0fBB0E4` — deploy tx [`0xa94e549d6a450f3b5b06d39012a98bbd469902503c67239c99a46a92ccb29431`](https://explorer.testnet.chain.robinhood.com/tx/0xa94e549d6a450f3b5b06d39012a98bbd469902503c67239c99a46a92ccb29431) (gas 1788032)

| Name | Register tx | Mint tx (token ID) |
|---|---|---|
| `deco` | [`0x2bca5350ce46550c…`](https://explorer.testnet.chain.robinhood.com/tx/0x2bca5350ce46550c6f240beb6671ac77ebed82d488cd7bfe20da47675dea7a37) | [`0xacf6e66d82cff62a…`](https://explorer.testnet.chain.robinhood.com/tx/0xacf6e66d82cff62a0e0acbee99d74366bda2b142100b07b57cc9158fcd91c057) (#1) |
| `muse` | [`0x79255ff3628ea476…`](https://explorer.testnet.chain.robinhood.com/tx/0x79255ff3628ea476641f0472abecc6193648190559641940930e796f343cccf1) | [`0x9322405c3ae23c79…`](https://explorer.testnet.chain.robinhood.com/tx/0x9322405c3ae23c79263e470899b3cb0e5fb073246c6980cddc29f8f3dc8c90e5) (#2) |
| `0xspotonchain` | [`0x12ddf84be2e0db77…`](https://explorer.testnet.chain.robinhood.com/tx/0x12ddf84be2e0db77fe8bbec7aae420449f83f0b1675864141d8f0759cd305711) | [`0x38c7715d24a6c78f…`](https://explorer.testnet.chain.robinhood.com/tx/0x38c7715d24a6c78f3fe8eae960ce5e680ac2c8a537ebaf7660d3d725ea528a08) (#3) |

- Verified: resolve() returns the burner for all 3 names; tokenURI(1–3) decode to JSON with the right names and SVG artwork; soulbound lock proven by eth_call — `transferFrom`, `approve` and `setApprovalForAll` all revert with the soulbound custom errors.
- Total gas: 2555637 (0.00002555637 test ETH)
- Updated: 2026-11-16T07:15:00Z

## LitVM LiteForge Testnet (chain 4441)

- Registry (DecoNameService): `0x9d1217DD428440ef49C59CCa2085aF6bd7A7a5b6` — deploy tx [`0x69ed4a657238f3955d14132345bb9c7906e8a69a322fc5a5161bb47ba9cbff27`](https://explorer.testnet.liteforge.zeeve.net/tx/0x69ed4a657238f3955d14132345bb9c7906e8a69a322fc5a5161bb47ba9cbff27) (gas 304203)
- Name NFT (DecoNameToken): `0x553c4212254DA568FdDc5Cc312318bB6c0fBB0E4` — deploy tx [`0x5c935c5b557fc3dcf2e75c029edc6086d826b61d2d1aceefa98e4a205479f287`](https://explorer.testnet.liteforge.zeeve.net/tx/0x5c935c5b557fc3dcf2e75c029edc6086d826b61d2d1aceefa98e4a205479f287) (gas 1796185)

| Name | Register tx | Mint tx (token ID) |
|---|---|---|
| `deco` | [`0x3962b368da384b1a…`](https://explorer.testnet.liteforge.zeeve.net/tx/0x3962b368da384b1a60081086713537a3b29be61a7b21d6582d6fb9c36a484f4e) | [`0x5432351edffafc66…`](https://explorer.testnet.liteforge.zeeve.net/tx/0x5432351edffafc662d9d2e97282386ffa922ad309843294049131215f5551a79) (#1) |
| `muse` | [`0x6331b307f86bcad6…`](https://explorer.testnet.liteforge.zeeve.net/tx/0x6331b307f86bcad60b12ec7333c78a9e715bdb6afcd1ba4abb9972ee333a834b) | [`0xc135ef4d6f4e174b…`](https://explorer.testnet.liteforge.zeeve.net/tx/0xc135ef4d6f4e174bee5dd699faa5223d2e85d332198721c1f29344f0df2f786a) (#2) |
| `0xspotonchain` | [`0xb60b17130069913a…`](https://explorer.testnet.liteforge.zeeve.net/tx/0xb60b17130069913a04d16e9b682ea95a3f339b6e77b65afd0d90d1d8e7b41da7) | [`0x7d73ff3c73bba324…`](https://explorer.testnet.liteforge.zeeve.net/tx/0x7d73ff3c73bba324a096581923cb3581e4ce533e960466a37e2dc6bce6420f39) (#3) |

- Verified: resolve() returns the burner for all 3 names; tokenURI(1–3) decode to JSON with the right names and SVG artwork; soulbound lock proven by eth_call — `transferFrom`, `approve` and `setApprovalForAll` all revert with the soulbound custom errors.
- Total gas: 2567781 (0.00002567781 zkLTC)
- Updated: 2026-11-16T07:13:40.664Z

## Velana Testnet (chain 484148)

Deployed with `deploy-velana.js` (same contracts). Addresses differ from the
other three chains — the burner nonce was already 1 on Velana (the VELA World
land claim). Raw results in `name-service-results-velana.json`.

- Registry (DecoNameService): `0xa9928a4D673dFb5a0922e9d76fC731c4D06Ad7c4` — deploy tx [`0x41fb4d6a3e63791ddcec71e3b230e0c11e6e093dce7cfa0c05ba264cf6bb819f`](https://velanachain.com/explorer/#/tx/0x41fb4d6a3e63791ddcec71e3b230e0c11e6e093dce7cfa0c05ba264cf6bb819f) (gas 302647)
- Name NFT (DecoNameToken): `0xC72A740883E93E899C02036f96841869A5BdbbDC` — deploy tx [`0xd35e676b2aedc532cdfd376fc8a2cd0c610e2753f9198215d16ad2003ee90019`](https://velanachain.com/explorer/#/tx/0xd35e676b2aedc532cdfd376fc8a2cd0c610e2753f9198215d16ad2003ee90019) (gas 1788032)

| Name | Register tx | Mint tx (token ID) |
|---|---|---|
| `deco` | [`0x97f39048474dadec…`](https://velanachain.com/explorer/#/tx/0x97f39048474dadec3868c81b763cf46e15e2bddb386162c7fd8ec0168f955ed8) | [`0x2c57af1a25d86f66…`](https://velanachain.com/explorer/#/tx/0x2c57af1a25d86f663344c212aaa0d27d31a93d7e9838fb67c23ae81500dc5575) (#1) |
| `muse` | [`0x6e7fcb8f8d4985a3…`](https://velanachain.com/explorer/#/tx/0x6e7fcb8f8d4985a3b7765c39ca19ffcf0c7eb6da1a4254ac64c905c79b2f1b5b) | [`0x6cfcc8c00c21e356…`](https://velanachain.com/explorer/#/tx/0x6cfcc8c00c21e3565cb43dcb461850cead2d38c2b213856ae28fe00c934861d8) (#2) |
| `0xspotonchain` | [`0x460bde90fa316ff9…`](https://velanachain.com/explorer/#/tx/0x460bde90fa316ff90045379b7f3380c064700a70b873151907e993a832f433f4) | [`0x22a9efd8758bb701…`](https://velanachain.com/explorer/#/tx/0x22a9efd8758bb701010757670eac314383c3c7cd0b422b49bede4c438b4b6e6d) (#3) |

- Verified: resolve() returns the burner for all 3 names; tokenURI(1–3) decode to JSON with the right names and SVG artwork; soulbound lock proven by eth_call — `transferFrom`, `approve` and `setApprovalForAll` all revert with the soulbound custom errors.
- Total gas: 2555637 (0.000000000017889459 test VELA)
- Updated: 2026-11-16T08:02:23.231Z

Note: the Velana name NFT address `0xC72A740883E93E899C02036f96841869A5BdbbDC`
is the same address as the Robinhood SimpleAMM pool — a CREATE + nonce
coincidence across two different chains. Different contracts, different chains.

## Totals

12 soulbound name NFTs: 9 on Arc / Robinhood / LitVM (3 per chain) + 3 on Velana.
