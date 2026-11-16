// Velana points task 2 — BUY LAND (+30).
// Buys the cheapest currently-listed plot via LandMarket.buy(saleId),
// paying exactly the listed price (the 2.5% fee comes out of the seller's
// proceeds, not the buyer). Refuses if the cheapest listing is over
// 2.5 VELA or the balance can't cover it + a 0.5 VELA reserve.
// Verifies ownership on VelanaWorld + the Sold event naming the burner.
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
const MAX_PRICE = ethers.parseEther('2.5');
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

  const [ids, sales] = await marketRead.openSales();
  if (!ids.length) throw new Error('No plots listed for sale right now.');
  const listed = ids.map((sid, i) => ({ sid: Number(sid), seller: sales[i].seller, price: sales[i].price, plotIds: sales[i].ids.map(Number) }));
  listed.forEach((s) => console.log(`sale ${s.sid}: plots ${s.plotIds.join(',')} @ ${ethers.formatEther(s.price)} VELA (seller ${s.seller})`));
  listed.sort((a, b) => (a.price < b.price ? -1 : a.price > b.price ? 1 : a.sid - b.sid));
  const pick = listed[0];
  console.log(`cheapest: sale ${pick.sid}, plot(s) ${pick.plotIds.join(',')}, ${ethers.formatEther(pick.price)} VELA`);
  if (pick.price > MAX_PRICE) throw new Error(`Cheapest listing ${ethers.formatEther(pick.price)} VELA exceeds the 2.5 VELA cap — refusing.`);
  if (pick.seller.toLowerCase() === BURNER.toLowerCase()) throw new Error('Cheapest listing is our own — refusing to buy from ourselves.');
  const bal = await provider.getBalance(BURNER);
  if (bal < pick.price + ethers.parseEther('0.5')) throw new Error(`Balance ${ethers.formatEther(bal)} VELA too low for ${ethers.formatEther(pick.price)} + 0.5 reserve.`);

  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? 7n;
  const tx = await market.buy(pick.sid, { value: pick.price, type: 0, gasPrice });
  console.log(`buy tx ${tx.hash} ...`);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`Buy reverted (${tx.hash})`);
  console.log(`confirmed in block ${receipt.blockNumber} (gas ${receipt.gasUsed})`);

  const iface = new ethers.Interface(landAbi);
  let sold = null;
  for (const log of receipt.logs) {
    try { const p = iface.parseLog(log); if (p && p.name === 'Sold') sold = p.args; } catch {}
  }
  if (!sold) throw new Error('No Sold event in receipt — investigate before continuing.');
  console.log(`Sold event: saleId ${sold.saleId}, buyer ${sold.buyer}, seller ${sold.seller}, price ${ethers.formatEther(sold.price)} VELA, fee ${ethers.formatEther(sold.fee)} VELA`);
  if (sold.buyer.toLowerCase() !== BURNER.toLowerCase()) throw new Error('Sold event buyer is not the burner!');

  for (const id of pick.plotIds) {
    const owner = await world.ownerOf(id);
    console.log(`plot ${id} owner now: ${owner}`);
    if (owner.toLowerCase() !== BURNER.toLowerCase()) throw new Error(`Plot ${id} not owned by burner after buy!`);
  }

  const out = {
    task: 'buy_land', points: 30, saleId: pick.sid, plotIds: pick.plotIds,
    price: pick.price.toString(), seller: pick.seller, tx: tx.hash,
    block: receipt.blockNumber, explorer: EXPLORER + tx.hash, at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(__dirname, 'velana-buy-land.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`BUY DONE: plot(s) ${pick.plotIds.join(',')} for ${ethers.formatEther(pick.price)} VELA, tx ${EXPLORER}${tx.hash}`);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
