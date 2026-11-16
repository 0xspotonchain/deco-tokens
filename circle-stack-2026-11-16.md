# Circle wallet stack mirror — Arc Testnet, 2026-11-16

The burner wallet's onchain stack, mirrored onto the Circle agent wallet
(`0xc7d81269debced5e62069a4d42950965853aa300`) on Arc Testnet (chain 5042002).
Same build: a SimpleAMM pool, sniper volume rounds, an NFT, and a soulbound
name NFT — but the Circle wallet is a smart-contract account, so every write
goes through the Circle CLI (`circle contract deploy` / `circle wallet
execute`) via the bundler. Testnet only. Nothing here touches mainnet.

## What the Circle wallet holds now

| Piece | Address / token | Receipt |
|---|---|---|
| DM/USDC SimpleAMM pool | `0x53661d12527e02019d991d2f24bf4b6661a96ba7` | [deploy tx](https://explorer.testnet.arc.io/tx/0x7c70cc9edf839f081b652f6778e9aafd6ca088c294286fdc9dfdd2c4f767d297) |
| DNFT #2 (Deco NFT) | `0xDf8A3BaAFffc5de3938bff1158584E841531BcbF` token #2 | [mint tx](https://explorer.testnet.arc.io/tx/0xe733dc3caba08f6be56646abad4c0fb441569c455a7fa4c894df287e15801995) |
| Name "circle" | resolves to the Circle wallet | [register tx](https://explorer.testnet.arc.io/tx/0xaf8b5c4cbcc7fa99d160aba6a6200ce0b2d11d3a238af27c6b24c011fde96145) |
| Soulbound name NFT #4 | `0x553c4212254DA568FdDc5Cc312318bB6c0fBB0E4` token #4 | [mint tx](https://explorer.testnet.arc.io/tx/0x00de331fbc834df65ce34dd409af16964117bd669bfe449d722d3f91e46f1ce4) |

## Recon findings (all verified on-chain before any write)

- **SimpleAMM is SCA-safe.** The constructor takes only the two token
  addresses; there is no owner and no `msg.sender` dependency anywhere, so
  the factory-gotcha (constructor `msg.sender` = factory) does not apply.
  Deployed with `circle contract deploy`, constructor `(DM, USDC view)`.
- **USDC on Arc: native and view are the same asset.** The Circle wallet's
  native balance (18 dec) and its balance on the USDC ERC-20 view contract
  `0x3600000000000000000000000000000000000000` (6 dec) both read exactly
  80.0 before the build — the view mirrors the native balance. Seeding the
  pool from the view draws down the native balance 1:1.
- **The Circle SCA implements `onERC721Received`.** Probed with an eth_call
  before minting anything: it returns the `0x150b7a02` magic value, so
  `_safeMint` to the Circle wallet succeeds. (If it hadn't, both NFT paths
  below would have needed `_mint`-based contracts instead.)
- **The name registry is burner-owned — Circle cannot self-register.**
  `DecoNameService.register()` is `onlyOwner` and the owner is the burner.
  Simulated from the Circle address first (free eth_call): reverts with
  `OwnableUnauthorizedAccount(0xc7d81269debced5e62069a4d42950965853aa300)`
  (selector `0x118cdaa7`). So the burner (owner) registered "circle" and
  minted the soulbound token — the same owner path used for the burner's
  own names. The Circle wallet *receives* the name and the NFT; it just
  can't register itself.
- **Gas was sane:** 20 gwei at recon (the sniper's spike rule skips above
  100 gwei). Deploy estimate ~0.052 USDC, actual 0.0202 USDC.
- **CLI throughput:** one `circle wallet execute` takes ~8s wall time
  (first call 14.4s including session warmup), so a buy+sell round is
  ~18–25s. 100 rounds ≈ 30–40 min. That set the volume target at 100.

## Pool — DM/USDC, seeded 10,000 DM + 10 USDC

The Circle-native pair: DM is the Circle wallet's own token (it holds
99,999,999,999,400 DM), USDC is its gas and asset. Same seed as the burner
pools (10,000 token + 10 base).

| Step | Tx | Fee (USDC) |
|---|---|---|
| Deploy SimpleAMM(DM, USDC view) | [0x7c70cc9e…](https://explorer.testnet.arc.io/tx/0x7c70cc9edf839f081b652f6778e9aafd6ca088c294286fdc9dfdd2c4f767d297) | 0.0202 |
| Approve DM 25,000 | [0x658652d0…](https://explorer.testnet.arc.io/tx/0x658652d07a5d6a2b3e867b2e40f02f71f41af46755e51bab2369ba7df6c8f5d1) | 0.0038 |
| Approve USDC 25 | [0xb65a07e9…](https://explorer.testnet.arc.io/tx/0xb65a07e981ac64d6e67b6bc44bc0d55ed458198a3f2f164f3f565d8ce70e3f0b) | 0.0041 |
| Seed addLiquidity | [0x02abfeac…](https://explorer.testnet.arc.io/tx/0x02abfeac09169b507d2f8abf51fc35922e5014d31420afd75734afb57d3e98ee) | 0.0060 |

Reserves verified on-chain after seed: exactly 10,000 DM / 10 USDC.
Circle USDC after seed: exactly 70.0 — the hard budget (never below 50
USDC) holds with 20 USDC of headroom.

**Gas note:** the CLI-reported network fees (~0.0375 USDC across the 5
setup txs) were NOT deducted from the Circle wallet's balance — native and
view balances moved only by the 10 USDC seed (80.0 → 70.0 exactly). On Arc
testnet the bundler/network fee for agent-wallet userOps is not charged to
the wallet. The volume run therefore costs only pool slippage/fees
(~0.0006 USDC/round), not gas.

## Volume — 100 rounds via `circle wallet execute`

Runner: `~/workspace/sniper/volume-circle.js` (deco-sniper repo). One round
= buy 0.1 USDC of DM, then sell back exactly the DM received. **100/100
rounds complete, 0 failed rounds.** Log:
`~/workspace/sniper/volume-logs/2026-11-16-circle-dm.jsonl` (102 lines:
100 round entries + 1 superseded failure entry + 1 anomaly note);
segment summary `.../2026-11-16-circle-dm-summary-resume.json` (rounds
9–100; the first segment's summary was never written — a VM reboot killed
the process before the end-of-run write, so the jsonl is the record for
rounds 1–8).

| | |
|---|---|
| Rounds | 100/100 (rounds 1–7 ok; round 8 recovered; rounds 9–100 ok) |
| Txs on-chain | **201** (200 logged + 1 unreported round-61 sell — see below) |
| Bought | 10.0 USDC → 9,917.59214056847 DM |
| Sold | 10.038073 USDC (incl. the round-61 extra sell) |
| Net USDC | **+0.038073** (the wallet ended UP — the double-sell sold its own DM) |
| DM delta | **−98.362913570668475149** (round-61 double-sell, from 99.9T holdings) |
| First buy | [0x324ffce2…](https://explorer.testnet.arc.io/tx/0x324ffce25b9fefaa8078fd75e133f5bb635a99fbb346af6a2859a554c85dcf92) (round 1) |
| Last sell | [0x988cb369…](https://explorer.testnet.arc.io/tx/0x988cb369022d1698ee0386d5ae08ac9e3f73297b139024aa919b9eee99b7c982) (round 100, 2026-11-16T16:08:59Z) |
| Reserves start (post test round) | 10,000 DM / 10.000594 USDC |
| Reserves end | **10,098.362913570668475149 DM / 9.962521 USDC** |
| Circle USDC start (post test round) | 69.999406 |
| Circle USDC end | **70.037479** (lowest mid-run ≈ 69.895 — floor 50 never close) |
| Circle DM end | 99,999,999,893,01.637086429331524851 |
| Pace | ~22–35 s/round (CLI bundler latency varies; two rounds took 86 s / 110 s) |
| Swap events (pool, all-time) | 203 = 101 buys + 102 sells (incl. the 2-tx test round) |

**Two incidents, both reconciled to the wei:**

1. **VM reboot mid-round-8 (22:19 GMT+7).** The CLI was killed mid-buy;
   the buy had landed on-chain
   ([0x8a1268e5…](https://explorer.testnet.arc.io/tx/0x8a1268e50ee5c9354b4c35215ae292890fd08591ba8ad0ba00666d577751d613),
   found via the pool's Swap events) but the sell never ran. Reconciled
   exactly on-chain (reserves + balances) and sold back the exact DM
   ([0x473433bf…](https://explorer.testnet.arc.io/tx/0x473433bfcb659276cfad3f67e2f8c576b497407798a05e53b083b8326892f3ec)).
   Run resumed at round 9 (`--start-round 9`).
2. **Round-61 double-sell (22:50 GMT+7).** The first sell executed
   on-chain while the CLI reported failure, and the runner's recovery sold
   the same 98.362913570668475149 DM a second time. Both sells verified via
   Swap events: first
   [0xa97742c5…](https://explorer.testnet.arc.io/tx/0xa97742c574ddf0e854e0b7ef93147215e0265a470083c771719d1c15faf0a821)
   (0.099406 USDC), recovery
   [0x8c6fc059…](https://explorer.testnet.arc.io/tx/0x8c6fc059da00464f630b3ab6f06429693bbe87197e9f40c4275ae186794bff2b)
   (0.097473 USDC). Net effect: DM delta −98.36 (0.000000000098% of the
   wallet's DM), USDC +0.097473 extra, pool +98.36 DM / −0.097473 USDC vs
   the clean path. **Runner fixed after the run:** a failed sell now
   re-reads the DM balance and recovers the tx hash from Swap events
   before any retry; a failed buy that landed anyway is sold back at once
   (`volume-circle.js`, `--start-round` + `findSwapTx` + `sellAmount`).

Gas: the CLI-reported network fees are NOT deducted from the Circle
wallet on Arc testnet (verified again on this run — the USDC balance moved
only by the swap amounts). The only real cost of the 100 rounds was the
AMM slippage, and the double-sell accidentally turned the run net-positive
in USDC.

## NFT — DNFT #2, minted by the Circle wallet itself

`DecoNFT.mint()` is public (anyone can mint the next token ID), so the
Circle wallet minted #2 to itself via `circle wallet execute` — no
burner signature needed for the mint itself:
[mint tx 0xe733dc3c…](https://explorer.testnet.arc.io/tx/0xe733dc3caba08f6be56646abad4c0fb441569c455a7fa4c894df287e15801995).
Verified: `ownerOf(2)` = Circle wallet, Circle DNFT balance = 1.

The metadata URI is owner-only, so the burner (DNFT owner) set it:
[setTokenURI tx 0x7d6fac28…](https://explorer.testnet.arc.io/tx/0x7d6fac281307ca7f8ede127c7c4b2866128e08e5f6e2146cdb3e9f5e333bcace).
Fully on-chain data URI, same gold-DC badge style as #1, with "NFT #2",
"ARC TESTNET - CIRCLE WALLET", and a "Minter: Circle agent wallet"
attribute. Metadata JSON: `nft-metadata-2.json`.

## Name — "circle" → Circle wallet + soulbound DNAME #4

The burner (registry + name-token owner) registered the name and minted
the token; the Circle wallet is the holder:

| Step | Tx | Gas |
|---|---|---|
| register("circle" → Circle) | [0xaf8b5c4c…](https://explorer.testnet.arc.io/tx/0xaf8b5c4cbcc7fa99d160aba6a6200ce0b2d11d3a238af27c6b24c011fde96145) | 48,968 |
| mint DNAME #4 ("circle") → Circle | [0x00de331f…](https://explorer.testnet.arc.io/tx/0x00de331fbc834df65ce34dd409af16964117bd669bfe449d722d3f91e46f1ce4) | 126,071 |

Verified on-chain: `resolve("circle")` = Circle wallet,
`tokenIdForName("circle")` = 4, `ownerOf(4)` = Circle,
`tokenName(4)` = "circle", Circle DNAME balance = 1, tokenURI name =
"Deco Name #4 — circle" with "circle" in the SVG badge.

**Soulbound, proven from the Circle wallet** (eth_call simulations, nothing
sent): `transferFrom` reverts `SoulboundTransferBlocked(4)`,
`approve` and `setApprovalForAll` revert `SoulboundApprovalsDisabled`.
This is the 13th soulbound name NFT in the stack (3 per chain × 4 chains
for the burner + #4 on Arc for Circle).

## Budget — Circle USDC

| | USDC |
|---|---|
| Before build | 80.0 |
| Pool seed | −10.0 |
| Setup tx fees (reported, not deducted) | 0.0 |
| After seed | 70.0 |
| Test round (1 buy/sell) | −0.000594 |
| Volume, 100 rounds (net incl. round-61 double-sell) | +0.038073 |
| After everything | **70.037479** (floor: 50 — never breached; lowest mid-run ≈ 69.895) |

## Files

- `circle-recon.js` — read-only recon (balances, gas, ERC721 receiver probe, name/DNFT state)
- `circle-name-batch.js` — burner-signed register + name-NFT mint + DNFT #2 metadata
- `circle-verify-nfts.js` — read-only soulbound + tokenURI verification
- `amm-results-circle.json` — pool deploy/seed/test-round record
- `circle-name-results.json` — name + DNAME #4 + metadata record
- `nft-metadata-2.json` — DNFT #2 metadata
- `../sniper/volume-circle.js` — Circle volume runner (CLI executes)
- `../sniper/volume-logs/2026-11-16-circle-dm.jsonl` — per-round tx log (102 lines: 100 rounds + 1 superseded failure entry + 1 round-61 anomaly note)
- `../sniper/volume-logs/2026-11-16-circle-dm-summary-resume.json` — segment summary (rounds 9–100; the rounds 1–8 summary was never written — the VM reboot killed the process before the end-of-run write, so the jsonl is the record for those rounds)
- `../sniper/volume-logs/2026-11-16-circle-dm-test.jsonl` + `...-test-summary.json` — 1-round test before the full run
