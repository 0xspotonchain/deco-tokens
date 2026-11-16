# deco testnet tokens

ERC20 "Deco Token" (DECO) + ERC721 "Deco NFT" (DNFT), deployed from the burner
wallet on Arc Testnet, Robinhood Chain Testnet, LitVM LiteForge testnet, and
Velana Testnet. Same addresses on the first three chains; Velana differs
(the burner nonce had already advanced). See `deployments.md` for addresses,
tx hashes, and explorer links; `velana-build.md` for the Velana record.

## DECO MUSE (DM)

ERC20 "DECO MUSE" (DM) — mintable + burnable, 100T initial supply — deployed
from the Circle agent wallet on Arc Testnet (deployed with the Circle CLI,
`circle contract deploy`).

- Contract: `0x104a92386b4a7ddbfb35214b72ddbb8ed0134438` (Arc Testnet, chain 5042002)
- Deploy tx: `0x5170d66177252adb9e835546d28b534c0bd780f3af10473614d67f22edfd17f7`
- Owner: the Circle wallet `0xc7d81269debced5e62069a4d42950965853aa300`
- `contracts/DecoMuseToken.sol` — OpenZeppelin ERC20 + ERC20Burnable + Ownable.
  The owner is passed as an explicit constructor argument because the Circle
  agent wallet is a smart-contract account: deploys run through a factory via
  a bundler, so `msg.sender` in the constructor is the factory, not the wallet.
- Logo: `dm-logo.svg` / `dm-logo-256.png` / `dm-logo-512.png`

## SimpleAMM pools

Own constant-product DEX pools (`contracts/SimpleAMM.sol`, x·y=k, 0.3% fee),
one per chain, seeded 10,000 DECO + base each. No remove-liquidity function —
the liquidity stays locked in the pool.

| Chain | Pool | Pair |
|---|---|---|
| Arc Testnet | `0x3137C615F3f3B1e7C8F75390F8ccb128f4D11A3A` | DECO / USDC |
| Robinhood Chain Testnet | `0xC72A740883E93E899C02036f96841869A5BdbbDC` | DECO / ETH |
| LitVM LiteForge Testnet | `0x3137C615F3f3B1e7C8F75390F8ccb128f4D11A3A` | DECO / zkLTC |
| Velana Testnet | `0xa81056EF621c952B5Fc033D7db159a0Da4ED5163` | DECO / VELA |
| Arc Testnet (Circle) | `0x53661d12527e02019d991d2f24bf4b6661a96ba7` | DM / USDC |

Deploy with `deploy-amm.js`; results in `amm-results.json` (3 chains) and
`amm-results-velana.json`. The volume sniper (deco-sniper repo) trades
against these pools. The Circle DM/USDC pool was deployed from the Circle
agent wallet with the Circle CLI — see `circle-stack-2026-11-16.md` and
`amm-results-circle.json`.

## DecoNameService

Own ENS-style name registry (`DecoNameService`) + soulbound name NFTs
(`DecoNameToken`). Names `deco` (#1), `muse` (#2), `0xspotonchain` (#3) all
resolve to the burner wallet; `circle` (#4, Arc only) resolves to the Circle
agent wallet. 13 soulbound NFTs: 9 on Arc / Robinhood / LitVM, 3 on Velana,
+ #4 on Arc for Circle. Transfers and approvals always revert (proven
on-chain). Full record in `name-service.md`.

## Circle wallet stack (Arc)

The burner stack, mirrored onto the Circle agent wallet
(`0xc7d81269debced5e62069a4d42950965853aa300`) on Arc Testnet — same build,
but the Circle wallet is a smart-contract account, so every write goes
through the Circle CLI (`circle contract deploy` / `circle wallet execute`)
via the bundler. Full record in `circle-stack-2026-11-16.md`.

- **DM/USDC SimpleAMM pool** `0x53661d12527e02019d991d2f24bf4b6661a96ba7`,
  seeded 10,000 DM + 10 USDC. SimpleAMM has no owner and no `msg.sender`
  dependency in the constructor, so the SCA factory gotcha doesn't apply.
  Volume: 100/100 buy/sell rounds via `volume-circle.js` in the deco-sniper
  repo — 201 txs on-chain (one round double-sold when the CLI reported a
  sell as failed after it had landed; both sells verified via Swap events).
  Net: +0.038073 USDC, DM delta −98.36 (from 99.9T holdings).
- **DNFT #2** — minted by the Circle wallet itself (`DecoNFT.mint` is
  public; the Circle SCA implements `onERC721Received`, probed on-chain
  first). Metadata set by the burner (DNFT owner), `nft-metadata-2.json`.
- **Name "circle"** → Circle wallet, + soulbound name NFT #4. The registry
  is burner-owned, so Circle can't self-register (simulated first: reverts
  `OwnableUnauthorizedAccount`); the burner registered the name and minted
  #4 to Circle.

Scripts: `circle-recon.js` (read-only recon), `circle-name-batch.js`
(burner-signed register + mint + metadata), `circle-verify-nfts.js`
(read-only soulbound + tokenURI checks). Results: `amm-results-circle.json`,
`circle-name-results.json`.

## Velana Testnet (4th chain)

The full stack on Velana (chain 484148): DECO
`0xDf8A3BaAFffc5de3938bff1158584E841531BcbF`, DNFT
`0xFb71a0C41f1D5D737acb5761eF110B1E0695fC64`, name registry
`0xa9928a4D673dFb5a0922e9d76fC731c4D06Ad7c4`, soulbound name NFT
`0xC72A740883E93E899C02036f96841869A5BdbbDC`, SimpleAMM pool
`0xa81056EF621c952B5Fc033D7db159a0Da4ED5163`. Full record in
`velana-build.md` — including the 1,000-round volume run (2,000 txs,
0 failed, gas ~0 at 7 wei).

Velana Testnet Points: **250 points, rank #1 of 23** (9/10 tasks; #2 has
35). The sweep launched a second DM token ("Deco Muse",
`0xcA5987dACb20D79a420A844181A07cc94A94Ef36`, 100T supply, 100% to the
burner) via the Velana token launcher, bought land plot 2722, paid a Vel
Pay request, and built a Luxury Kiosk (tier 4, max) on plot #0. Sell-land
and rent-out points (+30 each) need counterparties — plot 2722 is listed
for sale at 1.0 VELA, plot #0 for rent at 0.05 VELA/day. Points are not
tokens — no monetary value, no reward promised.

Sweep scripts + results: `velana-launch-dm.js`, `velana-buy-land.js`,
`velana-velpay.js`, `velana-build-kiosk.js`, `velana-list-sale.js`,
`velana-list-rent.js`, `velana-points-check.js`, and the matching
`velana-*.json` result files.

## Layout

- `contracts/DecoToken.sol` — fixed 1,000,000 supply, minted to deployer.
- `contracts/DecoNFT.sol` — public `mint(address)`, owner `setTokenURI`.
- `contracts/DecoMuseToken.sol` — DECO MUSE (DM), mintable + burnable, owner-only mint.
- `compile.js` — compiles with solc-js (OpenZeppelin v5.6.1, solc 0.8.38).
- `deploy.js` — deploys both contracts + mints NFT #1 per chain. Hard
  testnet-only guard (chain IDs 5042002, 46630, 4441 only). Key decrypted
  in-memory from the VM keystore, never printed or logged.
- `deploy-velana.js` — deploys DECO + DNFT + name service + SimpleAMM on
  Velana (own script; the burner nonce had already advanced past the
  other chains). `velana-build.md` — full Velana record.
- `velana-*.js` / `velana-*.json` — Testnet Points sweep scripts + results
  (token launch, land buy/sell/rent, Vel Pay, kiosk build, points check).
- `build/` — ABIs + bytecode. `deploy-results.json` — raw deploy output.

## Re-run

```sh
node compile.js
node deploy.js                  # three chains (arc | robinhood | litvm)
node deploy.js --chain=arc      # one chain
node deploy-velana.js           # Velana (4th chain, own script)
```

A re-deploy creates NEW contract addresses (the burner nonce has advanced).

## Credits

Name service, soulbound name NFTs and SimpleAMM pools are modeled on our friend [0xzunid](https://github.com/0xzunid)'s approach ([0xzunid.muse](https://0xzunid.github.io/0xzunid.muse.ai/)) — credit where it's due.

## Built with

Built with [Muse](https://muse.ai) — deco's AI agent.
