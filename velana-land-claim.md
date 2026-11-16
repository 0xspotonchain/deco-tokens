# VELA World land claim — burner wallet

Claimed directly on-chain from the VM (signed tx via RPC). No browser wallet
was connected and no key/seed touched any website — the standing rule.

## The claim

- **Plot:** ID **0** (row 0, col 0 — the lowest-numbered available plot)
- **Chain:** Velana Testnet, 484148 — RPC https://velanachain.com/rpc
- **Contract:** VelanaWorld `0x681Fd6bDd52584c513d0bBf306E8AC21a6aa92f3` (v2)
- **Function:** `claim(uint256[])` with `[0]`, value 1.5 VELA
- **Tx:** `0x04882a2a395a0a4c4c459d3cbd08729436b0c530582bacbb201e17d47ba1caea`
- **Explorer:** https://velanachain.com/explorer/#/tx/0x04882a2a395a0a4c4c459d3cbd08729436b0c530582bacbb201e17d47ba1caea
- **Block:** 4347 · **Gas used:** 147,208 at 0.000000007 gwei (type-0 legacy tx, like the site's own test wallet)
- **Claimed:** 2026-11-16 ~14:15 WIB, on deco's "You do it for me"

## Price (verified on-chain before sending)

- `price(1)` = **1.5 test VELA** = 1.0 VELA locked in the plot + 0.5 VELA land fee
  (`LOCK()` = 1.0, `landFee()` = 0.5 — matches the site's `chain.js` constants).
- Gas was ~0.000000000001 VELA (negligible).

## Balances

- Burner VELA before: **10.0** → after: **8.499999999998969544**
  (1.5 VELA claim cost + ~1e-12 VELA gas)
- Plots owned by burner: 0 → **1**
- `totalClaimed()`: 37 → **38**
- Plot 0 is **locked** (`plot.locked = true`), kind 0, no name set yet.

## Verification (all read back on-chain after confirmation)

- `ownerOf(0)` = burner `0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31` ✓
- `owned(burner)` = 1 ✓
- `totalClaimed()` = 38 ✓
- A static call of `claim([0])` with 1.5 VELA was run before sending and
  succeeded, proving the claim would work before any funds moved.

## How the claim function was found

- The Velana explorer has no contract-source API (404 on both Blockscout-style
  endpoints), so the ABI came from the site's own JS: `world.js` imports
  `chain.js`, which loads `./world-abi.json?v=2` and exposes
  `claim(ids)` with `value = ids.length * (LOCK + FEE)`.
- Grid: `SIZE()` = 64, `PLOTS()` = 4096 (IDs 0–4095). Showcase district is
  `SHOW_MIN 28 – SHOW_MAX 36` (centre of the grid); `isShowcase(0)` = false.
- Claimed IDs at the time: 37 plots, all in the 1800–3500 range; plot 0 was
  the lowest available.

## Notes

- The 1 VELA "lock" is held by the plot, not spent — `release(id)` exists in
  the contract (returns the lock, presumably; untested, do not call without
  checking). The 0.5 VELA fee is gone.
- Plot has no name/data yet — `setPlot(id, kind, name, link, data)` can set
  them later from the burner (or from the site with a connected wallet).
- Script: `claim-velana-land.js` in this folder. ABI snapshot: `/tmp/velana-world-abi.json`
  (also live at https://velanachain.com/world/world-abi.json).
- Faucet tx that funded this (10 VELA): `0x2f0483a6e69ca2af1439ca84839c04601856c5694f0ae45659333058ce089bd8`.
