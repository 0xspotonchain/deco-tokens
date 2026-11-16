// Velana points tasks 4 + 7 — BUILD (+30) and FURNISHING BONUS (up to +40).
// Builds a Kiosk (item 1, 1x1) at tier 4 (Luxury) on plot #0 in a single
// LandMarket.build tx, completing both tasks at once.
// CORRECTED PRICES (read live from the contract 2026-11-16 — the brief's
// "Kiosk 10 tVELA" and "+3/+8/+15/+25 furnishing" figures were wrong):
// Kiosk base 0.5 VELA; tier cost per block [0, 0.05, 0.15, 0.35, 0.75];
// Luxury Kiosk total = 0.5 + 0.75 = 1.25 VELA. No faucet wait needed.
// Velana testnet only (chain 484148), legacy type-0 txs.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { loadBurnerWallet } = require(path.join(__dirname, '..', 'sniper', 'keystore'));

const RPC = 'https://velanachain.com/rpc';
const CHAIN_ID = 484148;
const BURNER = '0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31';
const LAND = '0x5FEb379932C5ebb5ccC9fbfcf49413Fb38E24261';
const WORLD = '0x681Fd6bDd52584c513d0bBf306E8AC21a6aa92f3';
const PLOT = 0;
const ITEM_KIOSK = 1;
const TIER_LUXURY = 4;
const ROT = 0;
const EXPLORER = 'https://velanachain.com/explorer/#/tx/';

async function main() {
  const landAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'velana-js', 'land-abi.json'), 'utf8'));
  const worldAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'velana-js', 'world-abi.json'), 'utf8'));
  const req = new ethers.FetchRequest(RPC);
  req.timeout = 60000;
  const provider = new ethers.JsonRpcProvider(req, CHAIN_ID, { staticNetwork: true });
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== CHAIN_ID) throw new Error(`Wrong chain: ${net.chainId}`);
  const wallet = loadBurnerWallet(provider);
  const market = new ethers.Contract(LAND, landAbi, wallet);
  const marketRead = new ethers.Contract(LAND, landAbi, provider);
  const world = new ethers.Contract(WORLD, worldAbi, provider);

  const owner = await world.ownerOf(PLOT);
  console.log(`plot ${PLOT} owner: ${owner}`);
  if (owner.toLowerCase() !== BURNER.toLowerCase()) throw new Error('Plot #0 is not owned outright by the burner (it may be in market escrow) — build needs outright ownership or escrow control.');
  const existing = await marketRead.builds(PLOT);
  if (Number(existing.item) !== 0 || existing.by !== ethers.ZeroAddress) {
    throw new Error(`Plot #0 already has a build (item ${existing.item}, tier ${existing.tier}, by ${existing.by}) — refusing to build over it.`);
  }
  const quote = await marketRead.quote(ITEM_KIOSK, TIER_LUXURY);
  console.log(`quote: Kiosk tier 4 (Luxury) = ${ethers.formatEther(quote)} VELA`);
  const bal = await provider.getBalance(BURNER);
  console.log(`burner balance: ${ethers.formatEther(bal)} VELA`);
  if (bal < quote + ethers.parseEther('0.5')) throw new Error('Insufficient balance (quote + 0.5 VELA reserve).');

  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? 7n;
  const tx = await market.build(PLOT, ITEM_KIOSK, TIER_LUXURY, ROT, { value: quote, type: 0, gasPrice });
  console.log(`build tx ${tx.hash} ...`);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`Build reverted (${tx.hash})`);
  console.log(`confirmed in block ${receipt.blockNumber} (gas ${receipt.gasUsed})`);

  const iface = new ethers.Interface(landAbi);
  let built = null;
  for (const log of receipt.logs) {
    try { const p = iface.parseLog(log); if (p && p.name === 'Built') built = p.args; } catch {}
  }
  if (!built) throw new Error('No Built event in receipt — investigate before continuing.');
  console.log(`Built event: anchor ${built.anchor}, by ${built.by}, item ${built.item}, tier ${built.tier}, paid ${ethers.formatEther(built.paid)} VELA`);
  const after = await marketRead.builds(PLOT);
  console.log(`builds(0) now: item ${after.item}, tier ${after.tier}, rot ${after.rot}, by ${after.by}`);
  if (Number(after.item) !== ITEM_KIOSK || Number(after.tier) !== TIER_LUXURY || after.by.toLowerCase() !== BURNER.toLowerCase()) {
    throw new Error('On-chain build record does not match the expected Luxury Kiosk by the burner!');
  }

  const out = {
    task: 'build+tier', points: 70, plot: PLOT, item: ITEM_KIOSK, itemName: 'Kiosk',
    tier: TIER_LUXURY, tierName: 'Luxury', cost: quote.toString(), tx: tx.hash,
    block: receipt.blockNumber, explorer: EXPLORER + tx.hash, at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(__dirname, 'velana-build-kiosk.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`BUILD DONE: Luxury Kiosk on plot #0 for ${ethers.formatEther(quote)} VELA, tx ${EXPLORER}${tx.hash}`);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
