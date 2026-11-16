# Velana Testnet build — deco's zunid-style stack, 4th chain

Built Mon 2026-11-16 ~15:02–15:05 WIB from the burner
`0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31` (chain 484148, EVM/Besu).
Same stack as Arc / Robinhood / LitVM: DECO + DNFT, DecoNameService +
soulbound name NFTs, SimpleAMM pool, volume sniper. Script:
`deploy-velana.js` (Velana-only guard, legacy type-0 txs at 7 wei, resumable
per step; results in `results-velana.json`,
`name-service-results-velana.json`, `amm-results-velana.json`).
The shared 3-chain result files were NOT touched.

**Addresses differ from the other chains** — the burner nonce was already 1
on Velana (land claim tx). Two CREATE coincidences worth knowing:
- Velana DECO `0xDf8A…` is the SAME address as DNFT on the other 3 chains
  (both deployed at burner nonce 1 on their chains — different contract,
  different chain).
- Velana name NFT `0xC72A…` is the SAME address as the Robinhood SimpleAMM
  (both at burner nonce 6 on their chains).

Explorer (hash-routed): https://velanachain.com/explorer/#/tx/<hash>
and https://velanachain.com/explorer/#/address/<addr>.

## Contracts

| Contract | Address |
|---|---|
| DECO (ERC20, 1M) | `0xDf8A3BaAFffc5de3938bff1158584E841531BcbF` |
| DNFT (ERC721, #1 to burner) | `0xFb71a0C41f1D5D737acb5761eF110B1E0695fC64` |
| DecoNameService (registry) | `0xa9928a4D673dFb5a0922e9d76fC731c4D06Ad7c4` |
| DecoNameToken (soulbound) | `0xC72A740883E93E899C02036f96841869A5BdbbDC` |
| SimpleAMM (DECO / native VELA) | `0xa81056EF621c952B5Fc033D7db159a0Da4ED5163` |

## Deploy txs (all confirmed first attempt, blocks 4440–4456)

| Step | Tx | Gas |
|---|---|---|
| DECO deploy | `0x157909cdb3089a76697a30839321703ab46e07a00b013b31afdfa013875982f8` | 634,817 |
| DNFT deploy | `0x20d66d4321fee38c08c3619e2424f6867f8d49469c3f3a9834b26ef5b18f7d35` | 1,276,697 |
| Mint DNFT #1 | `0x2ae952e5b7f48c43f535dfd6a7bbf86f4c4912dbfaf7168452676baa5ca7fa09` (blk 4442) | 74,097 |
| setTokenURI(1) | `0xc1a81309649c807d835619ca964d506ea2f631744af105b27628778d4045c136` (blk 4443) | 1,364,343 |
| Registry deploy | `0x41fb4d6a3e63791ddcec71e3b230e0c11e6e093dce7cfa0c05ba264cf6bb819f` | 302,647 |
| Name NFT deploy | `0xd35e676b2aedc532cdfd376fc8a2cd0c610e2753f9198215d16ad2003ee90019` | 1,788,032 |
| Register `deco` | `0x97f39048474dadec3868c81b763cf46e15e2bddb386162c7fd8ec0168f955ed8` (blk 4446) | 48,956 |
| Register `muse` | `0x6e7fcb8f8d4985a3b7765c39ca19ffcf0c7eb6da1a4254ac64c905c79b2f1b5b` (blk 4447) | 48,956 |
| Register `0xspotonchain` | `0x460bde90fa316ff90045379b7f3380c064700a70b873151907e993a832f433f4` (blk 4448) | 49,064 |
| Mint name #1 `deco` | `0x2c57af1a25d86f663344c212aaa0d27d31a93d7e9838fb67c23ae81500dc5575` (blk 4449) | 117,358 |
| Mint name #2 `muse` | `0x6cfcc8c00c21e3565cb43dcb461850cead2d38c2b213856ae28fe00c934861d8` (blk 4450) | 100,258 |
| Mint name #3 `0xspotonchain` | `0x22a9efd8758bb701010757670eac314383c3c7cd0b422b49bede4c438b4b6e6d` (blk 4451) | 100,366 |
| AMM deploy | `0xc517130369eb72a5d7703f20c173189ca7c0f76aee1c1f3250e4e4cac6b820a1` | 740,510 |
| Approve DECO | `0xe14dd12bd34e98e563914640bc234629abc31cf72b70cd1b7ad313b8a17d692f` (blk 4453) | 46,414 |
| Seed 10,000 DECO + 0.001 VELA | `0xaa3dade13eb87b2fa5a26a8aff11108d37cac0a35f5b9c39db264c0ea27a152f` (blk 4454) | 108,990 |
| Test buy (0.0001 VELA) | `0x326f0a85c1214078def83358da698e4da254ac671d88cf22055b320f53952687` (blk 4455) | 53,027 |
| Test sell-back | `0xe68884bd157e5be1e784b14f8b69592a0f517d21bfa5c2bf91767409a14b5dd8` (blk 4456) | 65,696 |

Total build gas: 6,920,228 gas × 7 wei = **0.000000000048441596 VELA**
(negligible — gas is effectively free on Velana).

## Verification (all on-chain)

- DECO: name/symbol/decimals/totalSupply = 1,000,000; deployer holds 1M.
- DNFT: name/symbol OK; `ownerOf(1)` = burner; `tokenURI(1)` = 1,829-char
  data URI, verified exact. NOTE: the Velana metadata differs slightly from
  the 3-chain version — same name ("Deco NFT #1") and gold DC badge, but the
  footer says "VELANA TESTNET" and the description names Velana (the 3-chain
  text would have been wrong here).
- Names: `resolve("deco")` / `resolve("muse")` / `resolve("0xspotonchain")`
  all = burner. tokenURI(1–3) decode to "Deco Name #N — <name>" with the
  name in the SVG artwork (2,189 / 2,189 / 2,241 chars).
- Soulbound proven (eth_call, no gas): `transferFrom`, `approve`,
  `setApprovalForAll` all revert with the soulbound custom errors.
- AMM: `deco()` = Velana DECO, `quote()` = address(0) [native VELA].
  Seeded 10,000 DECO + 0.001 VELA, reserves verified. Test buy received
  exactly 906.610893880149131581 DECO (quote matched exactly); sell-back
  restored 10,000 DECO, pool kept the 0.000000544933154048 VELA fee.
  **No remove-liquidity function** — the seed liquidity is locked in the
  pool, like zunid's pools and the other 3 chains.

## Volume sniper

`volume.js` extended for Velana (self-test passes, incl. 8 new Velana
checks; the 3 original chains are untouched — same CHAINS objects, same
DECO address, plain tx overrides):
- `config.js`: 484148 added to `ALLOWED_CHAIN_IDS` only. Velana is NOT in
  `CHAINS` (sniper.js/dryrun.js assume every entry has a v2/v4 dex config).
- `volume.js`: own `VELANA_CHAIN` entry (chain 484148, Velana RPC/explorer);
  `VOLUME.velana` (native VELA base, 0.0001 VELA rounds, per-chain DECO
  address, legacy type-0 txs at 7 wei, 2s/round pacing for the 240 req/min
  RPC limit); per-chain `deco` in all VOLUME entries; `--amm-file` option
  (Velana uses `sniper/amm-addresses-velana.json` — the shared
  `amm-addresses.json` was NOT touched).

### Proof run — 5/5, 0 failed (2026-11-16 ~15:04–15:05 WIB)

- Bought 0.0005 VELA, sold 0.00049727493220578 VELA, fees
  0.00000272506779422 VELA (same fee figure as the Robinhood/LitVM proofs —
  same pool math).
- DECO bought = sold = 4526.327469520650076425 (exact reconcile).
- Gas: 0.000000000004249056 VELA (11 txs: 1 approval + 5 buy + 5 sell).
- Cleanup: no leftover DECO, baseline 990,000 intact.
- Log: `sniper/volume-logs/2026-11-16-velana.jsonl` (11 lines, all
  confirmed). Summary: `2026-11-16-velana-summary-150434.json`.
- First tx (approve): `0xd30507b733026b58fe471b2aa382545d3959ed944ba1164fe9d6e362a719f16d`;
  last tx (sell round 5): `0x83ad0840dd32308d9306cfe21a34c506deccaec08e660fe92ede091f7f19bdec`.
- Round pace: ~12–13s/round (Velana confirmations are slower than LitVM).

### Before-state (pre-proof, for the balance check)

- Burner: 990,000 DECO / 8.4989994550173739 VELA.
- Pool: 10,000 DECO / 0.001000544933154048 VELA.

### First run — 1,000 rounds

**Part 1: rounds 1–181 (2026-11-16 ~15:05–16:18 WIB).** Launched 15:05 WIB
(pid 5706), log `sniper/volume-logs/2026-11-16-first-run-velana.log`.
The VM RESTARTED at ~16:18 WIB (uptime reset to 0), killing the run after
round 180 logged — but round 181's buy AND sell both landed on-chain first.
The sell (tx `0x1765376aad30219b3a7e95b95e4b22edca0666c74c76c003e0445bffa47ae1c0`,
block 4894, nonce 390, status 1) was found by scanning blocks 4893–4896
with raw `eth_getBlockByNumber` (ethers' `getBlock(b, true)` returns only
hashes on this Besu node — it uses `blockTimestamp`, not `timestamp`).
Its log line was reconstructed and appended to the jsonl: sold
829.800113292433979157 DECO for 0.000099450476526395 VELA; the AMM-math
reconstruction cross-checked against live pool reserves with diff 0 wei.
Burner DECO back to exactly 990,000; pool at 10,000 DECO /
0.001102343695418412 VELA. No funds lost, no round left half-done.
Part 1: 181/181 rounds, 0 failed, 362 txs.

**Part 2: rounds 182–1000 (819 rounds, RESUMED).** Launched as a second
`volume.js` invocation (`--rounds 819`, same jsonl, log
`sniper/volume-logs/2026-11-16-first-run-velana-resume.log`) after
verifying the on-chain state above. Combined totals (part 1 + part 2) =
the 1,000-round first run.

**Second VM restart ~18:23 WIB.** The VM rebooted AGAIN (uptime 0), killing
part 2 during round 490: the log's last line was "round 490 sell: attempt 1
failed (read ECONNRESET) — retrying in 1s". On-chain check showed nonce
1370 = exactly the 979 logged txs, so the sell was NEVER sent (unlike part
1, where the sell had landed). Burner held 990,676.784615827358772609 DECO
— 676.784615827358772609 above the 990,000 baseline, exactly round 490's
buy amount. Recovery: new script `sniper/sell-leftover-velana.js` sold
only the leftover back to the pool — tx
`0xfcc8afaeb42760421022120139abf32971c14e35569ae92ddf454e32672b4d20`
(block 5911, gas 62,459), received 0.000099441332737111 VELA (quote matched
exactly), burner DECO back to exactly 990,000, sell appended to the jsonl
as round 490's sell leg. Part 2: **490/490 rounds, 0 failed, 980 txs**
(979 logged by the run + 1 manual sell-back).

**Part 3: remaining 329 rounds (1000 − 181 − 490).** Launched ~18:26 WIB
as a third `volume.js` invocation (`--rounds 329`, same jsonl, log
`sniper/volume-logs/2026-11-16-first-run-velana-resume2.log`). Baseline
verified 990,000 DECO at launch. Round numbers restart per invocation
(each invocation logs rounds 1..N) — totals are counted by jsonl lines,
not round numbers.

**Part 3 DIED at round 33 (~18:35 WIB) — RPC 502 + ethers bug, NOT a VM
restart** (uptime 29 min at check). The Velana RPC returned `502 Bad
Gateway` during round 33's sell wait, and ethers v6's `waitForTransaction`
runs an unguarded `await getBlockNumber()` inside a `new Promise(async …)`
executor — the 502 became an unhandled rejection that killed node (stack
shows only ethers frames, no volume.js frames — the error never reached
runRound's try/catch). The sell HAD landed first: tx
`0xc234469eadb27ccdd366f27dccd60458cd8fae444efc3c0bf14da5ac17c18de5`
(block 5977, nonce 1436, status 1, gas 62,459). Balances reconciled exactly
(burner 990,000 DECO, pool 10,000 DECO / 0.001392445453719979 VELA, sum
exactly 1,000,000) — no sell-back needed. Sell log line reconstructed
from AMM math (sold 668.415906674062199888 DECO for
0.000099440832670067 VELA) and appended to the jsonl, cross-checked
against live pool reserves with diff **0 wei**. Part 3: **33/33 rounds,
0 failed, 66 txs.**
**Watcher failure (same incident):** the wait loop (PID 4934) was fooled
by its own command line — `pgrep -f "volume.js …"` matched the watcher's
own bash -c string, so it sat in its 4h loop and never noticed the run
died. Killed via process.kill (session proc_75c75495d951); verified gone.
**Fixes applied (shared code — helps all chains):** (1) `volume.js`:
replaced all 4 `sent.wait()` calls (approve/buy/sell/cleanup) with a new
`waitForReceipt()` helper that polls `getTransactionReceipt` through the
existing `retryAsync` (502s now stay on the normal await path, where
runRound's catch turns them into a failed round instead of a dead
process); 180s timeout. (2) `provider.js`: `providerFor()` now attaches
a `provider.on('error')` listener (defense-in-depth — ethers emits
'error' for some internal failures, and with no listener EventEmitter
throws). Self-test PASSES (all original + Velana checks).

**Part 4: remaining 296 rounds (1000 − 704).** Launched ~18:54 WIB
(`--rounds 296`, same jsonl, log
`sniper/volume-logs/2026-11-16-first-run-velana-resume3.log`, node PID
14527, recorded in `sniper/volume-logs/velana-part4.pid`). Verified
before launch: jsonl 1,419 lines = 709 buys / 709 sells / 1 approve
(704 first-run rounds + 5 proof rounds — perfectly balanced). First 4
rounds done in ~40s (~10s/round — the manual receipt polling is faster
than ethers' block-based wait). Watcher: exec session proc_2496ca5341b9,
**PID-based** (`kill -0`, no pgrep pattern to self-match) + stall
detection (jsonl unchanged for 10 min → reports STALLED), 4h deadline.
ETA ~19:45 WIB at ~10s/round.

**Points sweep prep (done while part 3 runs; tasks run AFTER it finishes).**
Points at 18:27 WIB: 85, rank #1, 4/10 done (faucet, plot, site, store).
ABIs downloaded to `tokens/velana-js/`: launch-abi.json (factory/locker/
token), land-abi.json (LandMarket, 42 fns), market-abi.json (VelanaMarket),
world-abi.json, plus launch.js, launch-core.js, land-ui.js, chain.js,
pay-testnet.js, points.js. Scripts written (all syntax-checked, Velana-only
guards, type-0 txs): `velana-launch-dm.js` (DM, 100T, 100% to burner via
sole recipient at 10000 bps, team 0%), `velana-buy-land.js` (cheapest
listing, cap 2.5 VELA), `velana-build-kiosk.js` (Luxury Kiosk on plot #0),
`velana-list-sale.js`, `velana-list-rent.js`, `velana-velpay.js`
(self-payment 0.1 tVELA), `velana-points-check.js`.
KEY CORRECTIONS to the brief: (1) Kiosk costs **0.5 VELA base**, Luxury
tier total **1.25 VELA** — NOT 10 tVELA; furnishing tiers per block are
[0, 0.05, 0.15, 0.35, 0.75] VELA, so build + max furnishing (+70 pts) is
affordable NOW at ~8.5 VELA — no faucet wait needed. (2) Build is via
**LandMarket.build(anchor, item, tier, rot)**, not the VelanaMarket shop.
(3) Factory supply is whole tokens (form passes BigInt raw, max 10^15;
VDEMO totalSupply is 10^24, so the factory scales ×10^18 — verified again
after launch). (4) Open listings at 18:30 WIB: sale 3 plot 2722 @ 1.5 VELA
(cheapest, has a tier-2 Kiosk), sale 1 plot 2720 @ 2.0 VELA. (5) The chain
reset ~Nov 14 19:14 UTC (genesis block ts) — VDEMO's launch time predates
this chain instance, so its launch tx is not findable on-chain.

<!-- FIRST-RUN-RESULTS -->
## 1,000-round first run — COMPLETE 2026-11-16 ~19:44 WIB

**1,000/1,000 rounds, 0 failed, 2,000 txs, all confirmed.** Four parts
(two VM restarts + one RPC-502 crash in between): part 1 = 181, part 2 =
490, part 3 = 33, part 4 = 296. Log: `sniper/volume-logs/2026-11-16-velana.jsonl`
(2,011 lines = 11 proof + 2,000 first-run; 1,000 buys / 1,000 sells).

**Combined totals (from the jsonl):** bought 0.1 VELA, sold
0.099444696503971269 VELA, fees 0.000555303496028731 VELA. DECO bought =
sold = 733,074.499728691067468197 (diff **0.0**). Gas total
0.000000000808393936 VELA. First tx (part 1 round 1 buy):
`0xe9ab414ad7ed8f7f73b2275fe29650d7bf29986630618b95a7b9f8aaa0243405`;
last tx (part 4 round 296 sell):
`0xb5375c0a37a26ebf538c701de4ab73cf2b23afc06bee9080478510473959c3bb`.
Part 4 summary: `sniper/volume-logs/2026-11-16-velana-summary-185443.json`
(296/296, 0 failed; bought 0.0296, sold 0.02943387195674298, fees
0.00016612804325702, gas 0.000000000239284976 VELA; 11:54:43–12:44:06 UTC).
Parts 1–3 wrote no summaries (killed before finishing) — their totals
come from the jsonl.

**Balance check (before → after the first run):** burner DECO 990,000 →
990,000 (unchanged — every round buys then sells back). Burner VELA
8.4989994550173739 (pre-proof) → 8.498441425640907957 (after the run;
−0.000558029376465943 = round fees 0.000555303496028731 + proof fees +
gas). Pool 10,000 DECO / 0.001000544933154048 VELA (post-seed) →
10,000 DECO / 0.001558573496976999 VELA (fees accrue to the pool).
Burner + pool = exactly 1,000,000 DECO throughout. Final nonce 2029
(block 6612).

## Points sweep — DONE 2026-11-16 ~19:50 WIB (250 pts, rank #1)

From 85 pts (4/10) to **250 pts, rank #1 of 23** (#2 has 35 pts).
Tasks done: faucet, plot, buy_land, build, tier (Luxury, +40), site,
store, velpay, launch. Remaining: sell_land +30 and rent_out +30 —
both listed, both need a counterparty (another player must buy/rent).
Max solo total: 250/310.

| Task | Pts | Result |
|---|---|---|
| Token launch | +40 | DM "Deco Muse" `0xcA5987dACb20D79a420A844181A07cc94A94Ef36`, 100T supply, 100% to burner (team 0%, sole recipient 10000 bps). Fee 0.1 VELA. Tx `0x825567bad73d1d5bea6a70b174c2f7d63347046293b5df617e27cb22ea51e642` (block 6614). totalSupply 10^32 confirms the factory scales supply ×10^18. |
| Buy land | +30 | Plot 2722 (sale 3) @ 1.5 VELA from 0x5f04… (fee 0.0375 paid by seller). Tx `0x2edc37723020099de2f0b4b74b559f5a4038a7d64cf93cb5206cef15de58e4b7` (block 6616). Plot has a tier-2 Kiosk from the previous owner. |
| Vel Pay | +25 | Request `vp_HcYJUQ47UUZf` ("DECO test payment"), 0.1 tVELA, burner as merchant AND payer. Vel Pay contract `0x2b1a07E1260200F54dd0A205E61e94dD8CE71b95`. Create tx `0x0a31b374c0d4e6d7feff729bc2fdb1070a6fe7168f99d7595a9aa9a444fd8180` (block 6617); pay tx `0x026dd69e7f42f612eedd5cc33821089ffb0dee3a03604d5b959735a1e0d57f31` (block 6618). Server status: paid. Net cost ~0 + gas (0.1 came back). |
| Build | +30 | Luxury Kiosk (item 1, tier 4) on plot #0, 1.25 VELA. Tx `0x085f4ca5e992c58c2ecb0a03fc8ab68587828d3d58141b01ddc2d73f049e09a3` (block 6619). Built event + builds(0) verified. |
| Furnishing | +40 | Same tx — built directly at tier 4 (Luxury), the max. No separate upgrade needed. |
| Sell land | +30 pending | Plot 2722 listed @ 1.0 VELA (sale 4). Deposit: prepare `0x06193c392a48ee66323d241d92e187637058acefe56032ab219d7605274b0d0d`, escrow transfer `0xb3a2c763eeda1d9ac05524318d225e7bfaba3be68c8492712cc4d4693d5c36a0`; list tx `0x3f4adc5d5a9da092f7fa99bf8021343fb664cafd484abe3fb0be049a809a9665` (block 6622). Completes when someone buys it. |
| Rent out | +30 pending | Plot #0 (Luxury Kiosk) listed @ 0.05 VELA/day, 1–7 days — cheapest rental on the market (others 0.1 and 0.3/day). Deposit: prepare `0xe6669665461a5b1e3a9dfc155eabc173cd02b863ee34ebdf0804d7043a96048f`, escrow transfer `0x05db918fdd3228303fa3d1e3096382cad98be913add01dcea3586091270543f1`; listRent tx `0xfccf91400b67c5311a6528a8a8552759204ca6aa1bbb5cc9ed60fcdd66141c9b` (block 6625). Completes when someone rents it. |

**Final balances (block 6629):** burner 5.648441425626902252 VELA /
990,000 DECO / 100,000,000,000,000 DM. Pool 10,000 DECO /
0.001558573496976999 VELA. Both plots in LandMarket escrow with the
burner as depositor (plot #0 + its Luxury Kiosk; plot 2722 + its tier-2
Kiosk). Sweep spend: 2.85 VELA (0.1 launch + 1.5 buy + 1.25 build) +
~0.000000000014 VELA gas; Vel Pay netted to ~0.
Result files: `tokens/velana-dm-launch.json`, `velana-buy-land.json`,
`velana-velpay.json`, `velana-build-kiosk.json`, `velana-list-sale.json`,
`velana-list-rent.json`. Scripts: `tokens/velana-launch-dm.js`,
`velana-buy-land.js`, `velana-velpay.js`, `velana-build-kiosk.js`,
`velana-list-sale.js`, `velana-list-rent.js`, `velana-points-check.js`.
Points check: `node velana-points-check.js` (250 pts, rank #1, verified
2026-11-16T12:49:34Z).

**Note for later:** if plot 2722 sells, the 1.0 VELA (minus 2.5% fee)
lands in `pending(burner)` on LandMarket — claim with `claimPending()`.
If plot #0 gets rented, rent accrues the same way. Either event flips
the remaining points tasks; re-check points after.
