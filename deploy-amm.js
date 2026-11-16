// Deploy + seed + verify SimpleAMM pools for the DECO volume-sniper stack.
// One pool per chain: Arc (USDC view quote), Robinhood (native ETH), LitVM (native zkLTC).
//
// Usage:
//   node deploy-amm.js [--chain arc|robinhood|litvm] [--dry-run] [--seed-only]
//   No --chain = all three chains, sequentially.
//   --dry-run  = validate config, check balances, estimate deploy gas, print
//                the plan, exit 0. Sends NOTHING and never touches the keystore.
//   --seed-only = skip deploy; seed the pool at the address in
//                ../sniper/amm-addresses.json (recovery path).
//
// SECURITY: the burner private key is decrypted in-memory only from the VM
// keystore and is NEVER printed, logged, or written anywhere. Live mode only.
// TESTNET ONLY — the chainId guard refuses any chain outside the allowlist.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');

const DIR = __dirname;
const KEYSTORE_PATH = path.join(process.env.HOME, 'workspace/multichain-wallet/keystore.enc.json');
const VM_KEY_PATH = path.join(process.env.HOME, '.config/multichain-wallet/vm-key');
const RESULTS_PATH = path.join(DIR, 'amm-results.json');
const AMM_ADDR_PATH = path.join(process.env.HOME, 'workspace/sniper/amm-addresses.json');
const EXPECTED_ADDRESS = '0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31';
const DECO = '0x5f1dF574015C9D044b4C9Ef658cD55aFcC13D783';
const ZERO = ethers.ZeroAddress;

// Seed + test-swap sizes. Price impact of the test buy (computed exactly in
// dry-run): Arc ~1.3%, Robinhood/LitVM ~9.3% — the 0.0001 buy is 10% of the
// 0.001 seed reserve on the native chains, so it exceeds the ~5% guideline.
// That is acceptable for a volume sniper (the buy is immediately sold back
// and the impact is transient), but if a <=5% impact is wanted, raise the
// native seed base to 0.0025 (impact ~4.1%) or halve the buy to 0.00005.
const SEED_DECO = ethers.parseUnits('10000', 18); // 10,000 DECO per chain

const CHAINS = {
  arc: {
    label: 'Arc Testnet', chainId: 5042002,
    rpc: 'https://rpc.testnet.arc.io',
    explorer: 'https://explorer.testnet.arc.io',
    gasSymbol: 'USDC (native, 18 dec)',
    quote: '0x3600000000000000000000000000000000000000', // USDC ERC-20 view, 6 dec
    quoteDecimals: 6,
    quoteSymbol: 'USDC',
    nativeBase: false,
    seedBase: ethers.parseUnits('10', 6), // 10 USDC
    testBuyBase: ethers.parseUnits('0.1', 6), // 0.1 USDC
  },
  robinhood: {
    label: 'Robinhood Chain Testnet', chainId: 46630,
    rpc: 'https://rpc.testnet.chain.robinhood.com/rpc',
    explorer: 'https://explorer.testnet.chain.robinhood.com',
    gasSymbol: 'test ETH',
    quote: ZERO, // native ETH base
    quoteDecimals: 18,
    quoteSymbol: 'ETH',
    nativeBase: true,
    seedBase: ethers.parseEther('0.001'), // 0.001 ETH
    testBuyBase: ethers.parseEther('0.0001'), // 0.0001 ETH
  },
  litvm: {
    label: 'LitVM LiteForge Testnet', chainId: 4441,
    rpc: 'https://rpc.testnet.liteforge.zeeve.net/',
    explorer: 'https://explorer.testnet.liteforge.zeeve.net',
    gasSymbol: 'zkLTC',
    quote: ZERO, // native zkLTC base
    quoteDecimals: 18,
    quoteSymbol: 'zkLTC',
    nativeBase: true,
    seedBase: ethers.parseEther('0.001'), // 0.001 zkLTC
    testBuyBase: ethers.parseEther('0.0001'), // 0.0001 zkLTC
  },
};
const ALLOWED_CHAIN_IDS = new Set(Object.values(CHAINS).map((c) => c.chainId));

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

// --- keystore (live mode only; dry-run never calls this) ---
function decryptAesGcm(enc, keyBuf) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, Buffer.from(enc.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(enc.data, 'base64')), decipher.final()]);
}

function loadEvmPrivateKey() {
  const vmKeyHex = fs.readFileSync(VM_KEY_PATH, 'utf8').trim();
  const keyBuf = Buffer.from(vmKeyHex, 'hex');
  const ks = JSON.parse(fs.readFileSync(KEYSTORE_PATH, 'utf8'));
  const payload = JSON.parse(decryptAesGcm(ks, keyBuf).toString('utf8'));
  const pk = payload.keys.evm.privateKey;
  const wallet = new ethers.Wallet(pk);
  if (wallet.address.toLowerCase() !== EXPECTED_ADDRESS.toLowerCase()) {
    throw new Error('Keystore EVM key does not match expected burner address — aborting.');
  }
  return pk;
}

function loadArtifact(name) {
  const a = JSON.parse(fs.readFileSync(path.join(DIR, 'build', name + '.json'), 'utf8'));
  if (!a.bytecode || a.bytecode === '0x') throw new Error(`${name}: artifact has empty bytecode`);
  const fns = new Set(a.abi.filter((x) => x.type === 'function').map((x) => x.name));
  for (const need of ['buy', 'sell', 'addLiquidity', 'getReserves', 'getAmountOut']) {
    if (!fns.has(need)) throw new Error(`${name}: ABI missing required function ${need}`);
  }
  return a;
}

// Exact price impact of a buy of `amountIn` against reserves (fee included),
// returned as basis points of the spot price lost (10000 = 100%).
function priceImpactBps(amountIn, reserveIn) {
  // effective/spot = 997 * reserveIn / (1000 * reserveIn + 997 * amountIn)
  const num = 997n * reserveIn;
  const den = 1000n * reserveIn + 997n * amountIn;
  return Number((10000n * (den - num)) / den); // integer bps, rounds down
}

function readJsonIfExists(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}

function mergeResults(chainKey, entry) {
  const all = readJsonIfExists(RESULTS_PATH);
  all[chainKey] = entry; // update only this chain's entry, never clobber others
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(all, null, 2) + '\n');
}

function mergeAmmAddress(chainKey, address) {
  const all = readJsonIfExists(AMM_ADDR_PATH);
  all[chainKey] = address;
  fs.writeFileSync(AMM_ADDR_PATH, JSON.stringify(all, null, 2) + '\n');
}

async function deployWithRetry(factory, args, label, maxAttempts = 2) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const contract = await factory.deploy(...args);
      const tx = contract.deploymentTransaction();
      console.log(`  ${label}: deploy tx ${tx.hash} (attempt ${attempt})`);
      await contract.waitForDeployment();
      const addr = await contract.getAddress();
      const receipt = await tx.wait();
      return { contract, address: addr, txHash: tx.hash, receipt };
    } catch (e) {
      lastErr = e;
      console.error(`  ${label}: attempt ${attempt} failed: ${e.message}`);
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw lastErr;
}

async function sendAndLog(label, txPromise) {
  const tx = await txPromise;
  console.log(`  ${label}: tx ${tx.hash} ...`);
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error(`${label}: transaction reverted (${tx.hash})`);
  console.log(`  ${label}: confirmed, gas used ${receipt.gasUsed}`);
  return { txHash: tx.hash, receipt };
}

// --- dry-run: read-only validation + plan, no signing, no keystore ---
async function dryRunChain(key, cfg) {
  console.log(`\n=== DRY RUN: ${cfg.label} (chain ${cfg.chainId}) ===`);
  const artifact = loadArtifact('SimpleAMM');
  console.log(`  artifact OK: SimpleAMM bytecode ${(artifact.bytecode.length - 2) / 2} bytes, ABI has buy/sell/addLiquidity/getReserves/getAmountOut`);

  const provider = new ethers.JsonRpcProvider(cfg.rpc);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== cfg.chainId || !ALLOWED_CHAIN_IDS.has(Number(network.chainId))) {
    throw new Error(`Chain ID mismatch: RPC reports ${network.chainId}, expected ${cfg.chainId} — aborting (testnet guard).`);
  }
  console.log(`  chainId guard OK: RPC reports ${network.chainId}`);

  const nativeBal = await provider.getBalance(EXPECTED_ADDRESS);
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas;
  console.log(`  burner native balance: ${ethers.formatEther(nativeBal)} ${cfg.gasSymbol}`);
  console.log(`  gas price: ${gasPrice ? ethers.formatUnits(gasPrice, 'gwei') + ' gwei' : 'n/a'}`);

  const deco = new ethers.Contract(DECO, ERC20_ABI, provider);
  const decoBal = await deco.balanceOf(EXPECTED_ADDRESS);
  console.log(`  burner DECO balance: ${ethers.formatUnits(decoBal, 18)} (need ${ethers.formatUnits(SEED_DECO, 18)} to seed)`);
  if (decoBal < SEED_DECO) throw new Error('Insufficient DECO balance to seed');

  if (!cfg.nativeBase) {
    const quote = new ethers.Contract(cfg.quote, ERC20_ABI, provider);
    const qCode = await provider.getCode(cfg.quote);
    if (qCode === '0x') throw new Error(`Quote token ${cfg.quote} has no code on-chain`);
    const qBal = await quote.balanceOf(EXPECTED_ADDRESS);
    const qDec = await quote.decimals();
    console.log(`  burner ${cfg.quoteSymbol} (view) balance: ${ethers.formatUnits(qBal, qDec)} (need ${ethers.formatUnits(cfg.seedBase + cfg.testBuyBase, cfg.quoteDecimals)} for seed + test buy)`);
    if (Number(qDec) !== cfg.quoteDecimals) throw new Error(`Quote decimals mismatch: on-chain ${qDec}, config ${cfg.quoteDecimals}`);
    if (qBal < cfg.seedBase + cfg.testBuyBase) throw new Error(`Insufficient ${cfg.quoteSymbol} balance to seed + test buy`);
  } else {
    const needNative = cfg.seedBase + cfg.testBuyBase;
    console.log(`  native needed for seed + test buy: ${ethers.formatEther(needNative)} ${cfg.quoteSymbol} (excl. gas)`);
    if (nativeBal < needNative) throw new Error(`Insufficient native balance to seed + test buy`);
  }

  // Deploy gas estimate (read-only simulation, from the burner address).
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, provider);
  const deployTx = await factory.getDeployTransaction(DECO, cfg.quote);
  deployTx.from = EXPECTED_ADDRESS;
  const estGas = await provider.estimateGas(deployTx);
  console.log(`  estimated deploy gas: ${estGas}`);
  if (gasPrice) {
    // Rough total: deploy + 2 approvals + seed + buy + sell (~150k each).
    const roughTotal = estGas + 750000n;
    const roughCost = roughTotal * gasPrice;
    console.log(`  rough total gas cost (deploy + 5 txs @ ~150k): ~${ethers.formatEther(roughCost)} ${cfg.gasSymbol} (${Number((roughCost * 10000n) / nativeBal) / 100}% of balance)`);
    if (roughCost > nativeBal / 2n) console.log('  WARNING: rough cost exceeds 50% of native balance — check gas price before live run');
  }

  const impactBps = priceImpactBps(cfg.testBuyBase, cfg.seedBase);
  console.log(`  seed: ${ethers.formatUnits(SEED_DECO, 18)} DECO + ${ethers.formatUnits(cfg.seedBase, cfg.quoteDecimals)} ${cfg.quoteSymbol}`);
  console.log(`  test buy: ${ethers.formatUnits(cfg.testBuyBase, cfg.quoteDecimals)} ${cfg.quoteSymbol} = ${Number((cfg.testBuyBase * 10000n) / cfg.seedBase) / 100}% of base reserve -> price impact ~${impactBps / 100}%`);
  if (impactBps > 500) console.log('  NOTE: test-buy price impact exceeds the ~5% guideline (see comment at top of this file) — transient for a volume sniper, but consider a bigger seed base.');
  console.log(`  plan: deploy SimpleAMM(DECO, ${cfg.nativeBase ? 'address(0) [native]' : cfg.quote}) -> approve DECO ${ethers.formatUnits(SEED_DECO, 18)}${cfg.nativeBase ? '' : ` + ${cfg.quoteSymbol} ${ethers.formatUnits(cfg.seedBase + cfg.testBuyBase, cfg.quoteDecimals)}`} -> addLiquidity -> verify reserves -> test buy -> test sell-back -> write results`);
  console.log('  DRY RUN OK — nothing sent, keystore untouched.');
}

// --- live run: deploy (unless --seed-only), seed, test swap, verify, record ---
async function liveChain(key, cfg, pk, seedOnly) {
  console.log(`\n=== ${cfg.label} (chain ${cfg.chainId}) ===`);
  const artifact = loadArtifact('SimpleAMM');
  const provider = new ethers.JsonRpcProvider(cfg.rpc);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== cfg.chainId || !ALLOWED_CHAIN_IDS.has(Number(network.chainId))) {
    throw new Error(`Chain ID mismatch: RPC reports ${network.chainId}, expected ${cfg.chainId} — aborting (testnet guard).`);
  }
  const wallet = new ethers.Wallet(pk, provider);
  const startBal = await provider.getBalance(wallet.address);
  console.log(`  burner balance: ${ethers.formatEther(startBal)} ${cfg.gasSymbol}`);
  const gasUsed = {};
  const results = { chain: key, label: cfg.label, chainId: cfg.chainId, explorer: cfg.explorer, timestamp: new Date().toISOString() };

  const deco = new ethers.Contract(DECO, ERC20_ABI, wallet);
  const decoBal = await deco.balanceOf(wallet.address);
  if (decoBal < SEED_DECO) throw new Error(`Insufficient DECO: have ${ethers.formatUnits(decoBal, 18)}, need ${ethers.formatUnits(SEED_DECO, 18)}`);

  let ammAddress;
  if (seedOnly) {
    const addrs = readJsonIfExists(AMM_ADDR_PATH);
    ammAddress = addrs[key];
    if (!ammAddress) throw new Error(`--seed-only: no ${key} address in ${AMM_ADDR_PATH}`);
    const code = await provider.getCode(ammAddress);
    if (code === '0x') throw new Error(`--seed-only: no code at ${ammAddress}`);
    console.log(`  --seed-only: using existing AMM at ${ammAddress}`);
    results.seedOnly = true;
  } else {
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const dep = await deployWithRetry(factory, [DECO, cfg.quote], 'SimpleAMM');
    ammAddress = dep.address;
    console.log(`  SimpleAMM deployed at ${ammAddress} (gas used: ${dep.receipt.gasUsed})`);
    const code = await provider.getCode(ammAddress);
    if (code === '0x') throw new Error('No code at deployed AMM address');
    gasUsed.deploy = dep.receipt.gasUsed.toString();
    results.deployTx = dep.txHash;
  }
  results.amm = ammAddress;
  const amm = new ethers.Contract(ammAddress, artifact.abi, wallet);
  const ammRead = new ethers.Contract(ammAddress, artifact.abi, provider);

  // Sanity: the pool's tokens must be the ones we expect.
  const [onChainDeco, onChainQuote] = await Promise.all([ammRead.deco(), ammRead.quote()]);
  if (onChainDeco.toLowerCase() !== DECO.toLowerCase() || onChainQuote.toLowerCase() !== cfg.quote.toLowerCase()) {
    throw new Error(`AMM token mismatch: deco=${onChainDeco} quote=${onChainQuote}`);
  }
  console.log(`  verified: deco=${onChainDeco} quote=${cfg.nativeBase ? 'address(0) [native]' : onChainQuote}`);

  // Approvals. One approval per token, sized to cover seed + test swap, to
  // save txs (gas is precious on Robinhood):
  //   DECO: seed 10,000 + quoted test-buy output (+ 10 margin) for the
  //     sell-back. A fixed 100 buffer is NOT enough: on native chains the
  //     test buy returns ~906 DECO (Robinhood 2026-11-16: sell-back reverted
  //     with ERC20InsufficientAllowance). Quote it live instead.
  //   Arc USDC view: seed 10 + 0.1 test buy
  const quotedBuyOut = await ammRead.getAmountOut(cfg.testBuyBase, cfg.seedBase, SEED_DECO);
  const decoApproveAmt = SEED_DECO + quotedBuyOut + ethers.parseUnits('10', 18);
  const a1 = await sendAndLog('approve DECO', deco.approve(ammAddress, decoApproveAmt));
  gasUsed.approveDeco = a1.receipt.gasUsed.toString();
  results.approveDecoTx = a1.txHash;
  if (!cfg.nativeBase) {
    const quote = new ethers.Contract(cfg.quote, ERC20_ABI, wallet);
    const a2 = await sendAndLog(`approve ${cfg.quoteSymbol}`, quote.approve(ammAddress, cfg.seedBase + cfg.testBuyBase));
    gasUsed.approveQuote = a2.receipt.gasUsed.toString();
    results.approveQuoteTx = a2.txHash;
  }

  // Seed. Read reserves first so --seed-only recovery verifies the delta.
  const [rDecoBefore, rBaseBefore] = await ammRead.getReserves();
  const seedOpts = cfg.nativeBase ? { value: cfg.seedBase } : {};
  const s = await sendAndLog('addLiquidity (seed)', amm.addLiquidity(SEED_DECO, cfg.seedBase, seedOpts));
  gasUsed.addLiquidity = s.receipt.gasUsed.toString();
  results.seedTx = s.txHash;
  const [rDecoAfter, rBaseAfter] = await ammRead.getReserves();
  if (rDecoAfter !== rDecoBefore + SEED_DECO || rBaseAfter !== rBaseBefore + cfg.seedBase) {
    throw new Error(`Reserve mismatch after seed: expected +${SEED_DECO}/+${cfg.seedBase}, got +${rDecoAfter - rDecoBefore}/+${rBaseAfter - rBaseBefore}`);
  }
  results.reservesAfterSeed = { deco: rDecoAfter.toString(), base: rBaseAfter.toString() };
  console.log(`  reserves verified: ${ethers.formatUnits(rDecoAfter, 18)} DECO / ${ethers.formatUnits(rBaseAfter, cfg.quoteDecimals)} ${cfg.quoteSymbol}`);

  // Test swap: buy, then sell the received DECO straight back.
  const quotedOut = await ammRead.getAmountOut(cfg.testBuyBase, rBaseAfter, rDecoAfter);
  const minOut = (quotedOut * 95n) / 100n; // 5% slippage tolerance
  const decoBeforeBuy = await deco.balanceOf(wallet.address);
  const buyOpts = cfg.nativeBase ? { value: cfg.testBuyBase } : {};
  const b = await sendAndLog('test buy', amm.buy(cfg.testBuyBase, minOut, buyOpts));
  gasUsed.testBuy = b.receipt.gasUsed.toString();
  results.testBuyTx = b.txHash;
  const decoReceived = (await deco.balanceOf(wallet.address)) - decoBeforeBuy;
  console.log(`  test buy received ${ethers.formatUnits(decoReceived, 18)} DECO (quoted ${ethers.formatUnits(quotedOut, 18)})`);
  if (decoReceived < minOut) throw new Error('Test buy received less than minDecoOut');

  const [rDecoMid, rBaseMid] = await ammRead.getReserves();
  const quotedBack = await ammRead.getAmountOut(decoReceived, rDecoMid, rBaseMid);
  const minBack = (quotedBack * 95n) / 100n;
  const sl = await sendAndLog('test sell-back', amm.sell(decoReceived, minBack));
  gasUsed.testSell = sl.receipt.gasUsed.toString();
  results.testSellTx = sl.txHash;
  const [rDecoEnd, rBaseEnd] = await ammRead.getReserves();
  console.log(`  test sell-back done; reserves now ${ethers.formatUnits(rDecoEnd, 18)} DECO / ${ethers.formatUnits(rBaseEnd, cfg.quoteDecimals)} ${cfg.quoteSymbol}`);
  results.reservesAfterTestSwap = { deco: rDecoEnd.toString(), base: rBaseEnd.toString() };

  const endBal = await provider.getBalance(wallet.address);
  results.gasUsed = gasUsed;
  results.gasSpentNative = ethers.formatEther(startBal - endBal);
  console.log(`  gas spent this chain: ${results.gasSpentNative} ${cfg.gasSymbol}`);

  mergeResults(key, results);
  mergeAmmAddress(key, ammAddress);
  console.log(`  results merged into amm-results.json; address merged into sniper/amm-addresses.json`);
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const chainArg = (args.find((a) => a.startsWith('--chain=')) || '').split('=')[1];
  const dryRun = args.includes('--dry-run');
  const seedOnly = args.includes('--seed-only');
  const selected = chainArg ? [chainArg] : Object.keys(CHAINS);
  for (const k of selected) {
    if (!CHAINS[k]) { console.error(`Unknown chain: ${k}`); process.exit(2); }
  }
  if (dryRun && seedOnly) { console.error('--dry-run and --seed-only are mutually exclusive'); process.exit(2); }

  let pk = null;
  if (!dryRun) {
    pk = loadEvmPrivateKey();
    console.log(`Burner wallet: ${EXPECTED_ADDRESS} (key verified against keystore)`);
  }

  let failures = 0;
  for (const k of selected) {
    try {
      if (dryRun) await dryRunChain(k, CHAINS[k]);
      else await liveChain(k, CHAINS[k], pk, seedOnly);
    } catch (e) {
      failures++;
      console.error(`FAILED ${CHAINS[k].label}: ${e.message}`);
    }
  }
  if (failures) { console.error(`${failures} chain(s) failed.`); process.exit(1); }
  console.log(dryRun ? '\nDry run complete — nothing was sent.' : '\nAll done.');
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
