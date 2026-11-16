// Velana points task 1 — TOKEN LAUNCH (+40).
// Launches "Deco Muse" (DM), 100T supply, 100% to the burner, via the
// VelanaTokenFactory. Team share 0% (allowed: 0-50%); the factory requires
// team + recipients to total exactly 10000 bps, so the burner is the sole
// recipient at 10000 bps. Supply is passed as whole tokens (10^14) — the
// factory scales by 10^decimals (evidence: the VDEMO demo token shows
// totalSupply 10^24 while the form caps supply input at 10^15, so the
// factory must scale; verified again on-chain after launch).
// Velana testnet only (chain 484148), legacy type-0 txs.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { loadBurnerWallet } = require(path.join(__dirname, '..', 'sniper', 'keystore'));

const RPC = 'https://velanachain.com/rpc';
const CHAIN_ID = 484148;
const BURNER = '0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31';
const FACTORY = '0x73dCdB0A0f493daCF44dd5b553beB36B9118e1fF';
const ZERO = '0x0000000000000000000000000000000000000000';
const EXPLORER = 'https://velanachain.com/explorer/#/tx/';

const PARAMS = {
  name: 'Deco Muse',
  symbol: 'DM',
  supply: 100000000000000n, // 100T whole tokens; factory mints supply * 10^18
  logoURI: '', // no DM logo hosted yet — leave blank rather than the wrong logo
  website: 'https://0xspotonchain.github.io/deco/',
  description: 'DECO MUSE — deco.muse testnet token on Velana. DYOR, don\'t trust — verify.',
  teamBps: 0,
  teamBeneficiary: ZERO,
  cliffDays: 0,
  vestDays: 0,
  recipients: [BURNER],
  recipientBps: [10000],
};

async function main() {
  const abi = JSON.parse(fs.readFileSync(path.join(__dirname, 'velana-js', 'launch-abi.json'), 'utf8'));
  const req = new ethers.FetchRequest(RPC);
  req.timeout = 60000;
  const provider = new ethers.JsonRpcProvider(req, CHAIN_ID, { staticNetwork: true });
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== CHAIN_ID) throw new Error(`Wrong chain: ${net.chainId}`);
  const wallet = loadBurnerWallet(provider);
  const factory = new ethers.Contract(FACTORY, abi.factory, wallet);
  const factoryRead = new ethers.Contract(FACTORY, abi.factory, provider);

  // Guard: never launch DM twice.
  const mine = await factoryRead.launchesBy(BURNER);
  for (const i of mine) {
    const l = await factoryRead.getLaunch(i);
    const t = new ethers.Contract(l.token, abi.token, provider);
    if ((await t.symbol()) === 'DM') throw new Error(`DM already launched by burner: ${l.token} (index ${i}) — refusing to launch twice.`);
  }

  const fee = await factoryRead.launchFee();
  const bal = await provider.getBalance(BURNER);
  console.log(`launchFee: ${ethers.formatEther(fee)} VELA | burner balance: ${ethers.formatEther(bal)} VELA`);
  if (bal < fee + ethers.parseEther('0.5')) throw new Error('Insufficient balance (fee + 0.5 VELA reserve).');
  const countBefore = await factoryRead.count();
  console.log(`launches before: ${countBefore}`);

  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? 7n;
  const tx = await factory.launch(PARAMS, { value: fee, type: 0, gasPrice });
  console.log(`launch tx ${tx.hash} ...`);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`Launch reverted (${tx.hash})`);
  console.log(`confirmed in block ${receipt.blockNumber} (gas ${receipt.gasUsed})`);

  const iface = new ethers.Interface(abi.factory);
  let launched = null;
  for (const log of receipt.logs) {
    try { const p = iface.parseLog(log); if (p && p.name === 'Launched') launched = p.args; } catch {}
  }
  if (!launched) throw new Error('No Launched event in receipt — investigate before continuing.');
  console.log(`Launched event: index ${launched.index}, token ${launched.token}, creator ${launched.creator}, supply(param) ${launched.supply}, feePaid ${ethers.formatEther(launched.feePaid)} VELA`);

  // Verify on-chain.
  const token = new ethers.Contract(launched.token, abi.token, provider);
  const [name, symbol, decimals, totalSupply, burnerBal] = await Promise.all([
    token.name(), token.symbol(), token.decimals(), token.totalSupply(), token.balanceOf(BURNER),
  ]);
  const expected = PARAMS.supply * 10n ** BigInt(decimals);
  console.log(`token: ${name} (${symbol}), decimals ${decimals}, totalSupply ${totalSupply}`);
  console.log(`burner balance: ${burnerBal} (${ethers.formatEther(burnerBal)} DM)`);
  if (totalSupply !== expected) console.log(`WARNING: totalSupply ${totalSupply} != expected ${expected} (supply x 10^decimals) — factory did NOT scale; token displays ${ethers.formatEther(totalSupply)} DM.`);
  else console.log('totalSupply matches 100T whole tokens (factory scaled x10^18) ✓');
  if (burnerBal !== totalSupply) console.log(`WARNING: burner holds ${burnerBal}, not the full supply ${totalSupply}.`);

  const out = {
    task: 'launch', points: 40, token: launched.token, index: Number(launched.index),
    name, symbol, decimals: Number(decimals), totalSupply: totalSupply.toString(),
    burnerBalance: burnerBal.toString(), feePaid: launched.feePaid.toString(),
    tx: tx.hash, block: receipt.blockNumber, explorer: EXPLORER + tx.hash,
    at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(__dirname, 'velana-dm-launch.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`LAUNCH DONE: DM at ${launched.token}, tx ${EXPLORER}${tx.hash}`);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
