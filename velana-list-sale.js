// Velana points task 5 — SELL LAND (+30, completes only when it sells).
// Lists a plot for sale on LandMarket at a low price to attract a buyer.
// Flow (mirrors land-ui.js sellFlow): deposit the plot into market escrow
// first — LandMarket.prepare([id]) then VelanaWorld.transfer(id, LAND) —
// then LandMarket.list([id], price). Skips deposit if already escrowed.
// Usage: node velana-list-sale.js --plot=<id> --price=<vela>
// Defaults: plot = the plot bought by velana-buy-land.js (from its result
// file), price = 1.0 VELA.
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
  let plot = Number(arg('plot', ''));
  const priceStr = arg('price', '1.0');
  if (!Number.isInteger(plot)) {
    const bought = JSON.parse(fs.readFileSync(path.join(__dirname, 'velana-buy-land.json'), 'utf8'));
    plot = bought.plotIds[0];
    console.log(`no --plot given, using bought plot ${plot} from velana-buy-land.json`);
  }
  const price = ethers.parseEther(priceStr);
  if (price <= 0n) throw new Error('Price must be above 0.');

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

  // Already listed?
  const [ids, sales] = await marketRead.openSales();
  const mine = ids.map((sid, i) => ({ sid: Number(sid), s: sales[i] })).find((x) => x.s.ids.map(Number).includes(plot));
  if (mine) throw new Error(`Plot ${plot} is already listed (sale ${mine.sid} @ ${ethers.formatEther(mine.s.seller === BURNER ? mine.s.price : mine.s.price)} VELA).`);

  // Deposit into escrow if owned outright.
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

  const tx = await market.list([plot], price, { type: 0, gasPrice });
  console.log(`list tx ${tx.hash} ...`);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`list reverted (${tx.hash})`);
  console.log(`confirmed in block ${receipt.blockNumber} (gas ${receipt.gasUsed})`);

  const iface = new ethers.Interface(landAbi);
  let listed = null;
  for (const log of receipt.logs) {
    try { const p = iface.parseLog(log); if (p && p.name === 'Listed') listed = p.args; } catch {}
  }
  if (!listed) throw new Error('No Listed event in receipt — investigate before continuing.');
  console.log(`Listed event: saleId ${listed.saleId}, seller ${listed.seller}, price ${ethers.formatEther(listed.price)} VELA, ids ${listed.ids.map(Number).join(',')}`);

  const out = {
    task: 'sell_land', points: 30, plot, saleId: Number(listed.saleId), price: price.toString(),
    depositTxs: txs, tx: tx.hash, block: receipt.blockNumber,
    explorer: EXPLORER + tx.hash, at: new Date().toISOString(),
    note: 'Listing live. The +30 completes only when a buyer buys it (Sold event, burner as seller).',
  };
  fs.writeFileSync(path.join(__dirname, 'velana-list-sale.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`LISTED FOR SALE: plot ${plot} @ ${ethers.formatEther(price)} VELA (sale ${listed.saleId}), tx ${EXPLORER}${tx.hash}`);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
