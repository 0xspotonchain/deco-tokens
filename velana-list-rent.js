// Velana points task 6 — RENT OUT (+30, completes only when rented).
// Lists a plot for rent on LandMarket at a low daily price.
// Flow (mirrors land-ui.js rentFlow): deposit the plot into market escrow
// first — LandMarket.prepare([id]) then VelanaWorld.transfer(id, LAND) —
// then LandMarket.listRent(id, perDay, minDays, maxDays). Skips deposit if
// already escrowed.
// Usage: node velana-list-rent.js --plot=<id> --per-day=<vela> --min=<days> --max=<days>
// Defaults: plot 0, 0.05 VELA/day, min 1, max 7 days.
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
const EXPLORER = 'https://velanachain.com/explorer/#/tx/';

function arg(name, def) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
}

async function main() {
  const landAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'velana-js', 'land-abi.json'), 'utf8'));
  const worldAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'velana-js', 'world-abi.json'), 'utf8'));
  const plot = Number(arg('plot', '0'));
  const perDay = ethers.parseEther(arg('per-day', '0.05'));
  const min = Number(arg('min', '1'));
  const max = Number(arg('max', '7'));
  if (!Number.isInteger(plot) || plot < 0) throw new Error('Bad --plot.');
  if (perDay <= 0n || min < 1 || max < min || max > 365) throw new Error('Bad rent terms (per-day > 0, 1 <= min <= max <= 365).');

  const req = new ethers.FetchRequest(RPC);
  req.timeout = 60000;
  const provider = new ethers.JsonRpcProvider(req, CHAIN_ID, { staticNetwork: true });
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== CHAIN_ID) throw new Error(`Wrong chain: ${net.chainId}`);
  const wallet = loadBurnerWallet(provider);
  const market = new ethers.Contract(LAND, landAbi, wallet);
  const marketRead = new ethers.Contract(LAND, landAbi, provider);
  const world = new ethers.Contract(WORLD, worldAbi, wallet);
  const worldRead = new ethers.Contract(WORLD, worldAbi, provider);

  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? 7n;

  const [rids, rents] = await marketRead.allRentals();
  if (rids.map(Number).includes(plot)) throw new Error(`Plot ${plot} is already listed for rent.`);

  const owner = await worldRead.ownerOf(plot);
  console.log(`plot ${plot} owner: ${owner}`);
  const txs = [];
  if (owner.toLowerCase() === BURNER.toLowerCase()) {
    const prep = await market.prepare([plot], { type: 0, gasPrice });
    console.log(`prepare tx ${prep.hash} ...`);
    const r1 = await prep.wait();
    if (!r1 || r1.status !== 1) throw new Error(`prepare reverted (${prep.hash})`);
    txs.push(prep.hash);
    const tr = await world.transfer(plot, LAND, { type: 0, gasPrice });
    console.log(`escrow transfer tx ${tr.hash} ...`);
    const r2 = await tr.wait();
    if (!r2 || r2.status !== 1) throw new Error(`escrow transfer reverted (${tr.hash})`);
    txs.push(tr.hash);
    const dep = await marketRead.depositor(plot);
    if (dep.toLowerCase() !== BURNER.toLowerCase()) throw new Error('Depositor is not the burner after escrow transfer!');
    console.log('plot deposited in market escrow ✓');
  } else if (owner.toLowerCase() === LAND.toLowerCase()) {
    const dep = await marketRead.depositor(plot);
    if (dep.toLowerCase() !== BURNER.toLowerCase()) throw new Error(`Plot is in escrow but depositor is ${dep}, not the burner.`);
    console.log('plot already in escrow by the burner ✓');
  } else {
    throw new Error(`Plot ${plot} is owned by ${owner} — not the burner.`);
  }

  const tx = await market.listRent(plot, perDay, min, max, { type: 0, gasPrice });
  console.log(`listRent tx ${tx.hash} ...`);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`listRent reverted (${tx.hash})`);
  console.log(`confirmed in block ${receipt.blockNumber} (gas ${receipt.gasUsed})`);

  const iface = new ethers.Interface(landAbi);
  let listed = null;
  for (const log of receipt.logs) {
    try { const p = iface.parseLog(log); if (p && p.name === 'RentListed') listed = p.args; } catch {}
  }
  if (!listed) throw new Error('No RentListed event in receipt — investigate before continuing.');
  console.log(`RentListed event: id ${listed.id}, owner ${listed.owner}, perDay ${ethers.formatEther(listed.perDay)} VELA, ${listed.minDays}-${listed.maxDays} days`);

  const out = {
    task: 'rent_out', points: 30, plot, perDay: perDay.toString(), minDays: min, maxDays: max,
    depositTxs: txs, tx: tx.hash, block: receipt.blockNumber,
    explorer: EXPLORER + tx.hash, at: new Date().toISOString(),
    note: 'Rent listing live. The +30 completes only when someone rents it (Rented event).',
  };
  fs.writeFileSync(path.join(__dirname, 'velana-list-rent.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`LISTED FOR RENT: plot ${plot} @ ${ethers.formatEther(perDay)} VELA/day (${min}-${max} days), tx ${EXPLORER}${tx.hash}`);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
