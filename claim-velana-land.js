// Claim ONE VELA World land plot for the burner wallet, directly on-chain.
// Velana Testnet only (chain 484148). No browser wallet, no seed/key on any
// website. Key decrypted in memory from the VM keystore; never printed/logged.
const fs = require('fs');
const { ethers } = require('ethers');
const { loadBurnerWallet } = require('../sniper/keystore.js');

const RPC = 'https://velanachain.com/rpc';
const CHAIN_ID = 484148;
const WORLD = '0x681Fd6bDd52584c513d0bBf306E8AC21a6aa92f3';
const PLOT_ID = 0; // lowest-numbered available plot (verified unclaimed, non-showcase)
const ABI = JSON.parse(fs.readFileSync('/tmp/velana-world-abi.json', 'utf8'));

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== CHAIN_ID) throw new Error(`Wrong chain: ${net.chainId}`);
  const world = new ethers.Contract(WORLD, ABI, provider);
  const wallet = loadBurnerWallet(provider);
  const burner = wallet.address;

  // ---- preflight (all read-only) ----
  const [balBefore, nonce, ownedBefore, totalBefore, ownerBefore, price1, show] = await Promise.all([
    provider.getBalance(burner),
    provider.getTransactionCount(burner),
    world.owned(burner),
    world.totalClaimed(),
    world.ownerOf(PLOT_ID),
    world.price(1),
    world.isShowcase(PLOT_ID),
  ]);
  console.log('burner:', burner);
  console.log('balance before:', ethers.formatEther(balBefore), 'VELA | nonce:', nonce, '| owned:', ownedBefore.toString());
  console.log('totalClaimed before:', totalBefore.toString(), '| price(1):', ethers.formatEther(price1), 'VELA');
  console.log('plot', PLOT_ID, 'owner before:', ownerBefore, '| showcase:', show);
  if (ownerBefore !== ethers.ZeroAddress) throw new Error('Plot already claimed — aborting.');
  if (show) throw new Error('Plot is showcase — aborting.');
  if (balBefore < price1) throw new Error('Not enough VELA — aborting.');

  // static call proves the claim would succeed before we spend anything
  await world.claim.staticCall([PLOT_ID], { from: burner, value: price1 });
  console.log('staticCall claim: OK');

  // ---- send (type 0 legacy, like the site's own test wallet) ----
  const w = world.connect(wallet);
  const fee = await provider.getFeeData();
  const gasPrice = fee.gasPrice ?? ethers.parseUnits('0.000000007', 'gwei');
  const gasEst = await w.claim.estimateGas([PLOT_ID], { value: price1 });
  const gasLimit = (gasEst * 150n) / 100n;
  console.log('gas estimate:', gasEst.toString(), '| gasLimit:', gasLimit.toString(), '| gasPrice:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');
  const tx = await w.claim([PLOT_ID], { value: price1, type: 0, gasPrice, gasLimit });
  console.log('tx sent:', tx.hash);
  const rc = await tx.wait(1, 120000);
  if (!rc || rc.status !== 1) throw new Error('Transaction failed on-chain. hash: ' + tx.hash);
  console.log('confirmed in block:', rc.blockNumber, '| gas used:', rc.gasUsed.toString());

  // ---- verify on-chain ----
  const [ownerAfter, ownedAfter, totalAfter, balAfter, p] = await Promise.all([
    world.ownerOf(PLOT_ID),
    world.owned(burner),
    world.totalClaimed(),
    provider.getBalance(burner),
    world.plot(PLOT_ID),
  ]);
  console.log('plot', PLOT_ID, 'owner after:', ownerAfter);
  console.log('owned after:', ownedAfter.toString(), '| totalClaimed after:', totalAfter.toString());
  console.log('balance after:', ethers.formatEther(balAfter), 'VELA');
  console.log('plot locked:', p.locked, '| kind:', p.kind.toString(), '| name:', JSON.stringify(p.name));
  if (ownerAfter.toLowerCase() !== burner.toLowerCase()) throw new Error('VERIFICATION FAILED: plot owner is not the burner.');
  console.log('CLAIM VERIFIED. tx:', tx.hash);
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
