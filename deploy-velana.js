// Deploy deco's zunid-style stack on Velana Testnet (chain 484148) ONLY:
//   step "tokens" — DecoToken (ERC20, 1M DECO) + DecoNFT (ERC721), mint DNFT #1,
//                   set on-chain metadata (same name/badge as the other chains,
//                   footer text adapted to Velana).
//   step "names"  — DecoNameService + DecoNameToken, register deco/muse/
//                   0xspotonchain -> burner, mint 3 soulbound name NFTs,
//                   verify resolve() + tokenURI + soulbound reverts.
//   step "amm"    — SimpleAMM (DECO / native VELA), seed 10,000 DECO +
//                   0.001 VELA, test buy (0.0001 VELA) + sell-back, verify.
// Usage: node deploy-velana.js [--step tokens|names|amm|all]
//   No --step = all three, in order. Each step writes its own results file
//   and RESUMES from it: already-done sub-steps are verified on-chain and
//   skipped, so a re-run after a failure never redeploys.
// Results: results-velana.json, name-service-results-velana.json,
//   amm-results-velana.json (+ ../sniper/amm-addresses-velana.json).
//   The shared 3-chain result files are NEVER touched by this script.
//
// Velana specifics (verified 2026-11-16): Besu/QBFT, gas ~7 wei, NO
// eth_getLogs (no log filters anywhere — eth_call reads only). Txns are
// sent as legacy type-0 with an explicit gas price, the pattern proven by
// the land-claim script (claim-velana-land.js).
//
// SECURITY: the burner private key is decrypted in-memory only from the VM
// keystore and is NEVER printed, logged, or written anywhere.
// TESTNET ONLY — the guard refuses any chain ID other than 484148.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');

const DIR = __dirname;
const KEYSTORE_PATH = path.join(process.env.HOME, 'workspace/multichain-wallet/keystore.enc.json');
const VM_KEY_PATH = path.join(process.env.HOME, '.config/multichain-wallet/vm-key');
const EXPECTED_ADDRESS = '0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31';
const RESULTS_TOKENS = path.join(DIR, 'results-velana.json');
const RESULTS_NAMES = path.join(DIR, 'name-service-results-velana.json');
const RESULTS_AMM = path.join(DIR, 'amm-results-velana.json');
const AMM_ADDR_VELANA = path.join(process.env.HOME, 'workspace/sniper/amm-addresses-velana.json');
const REVERT_TEST_RECIPIENT = '0x000000000000000000000000000000000000dEaD';
const FALLBACK_GAS_PRICE = 7n; // wei — Velana's gas price (verified live)

const VELANA = {
  label: 'Velana Testnet', chainId: 484148,
  rpc: 'https://velanachain.com/rpc',
  explorer: 'https://velanachain.com/explorer',
  gasSymbol: 'VELA',
};
const NAMES = [
  { tokenId: 1, name: 'deco' },
  { tokenId: 2, name: 'muse' },
  { tokenId: 3, name: '0xspotonchain' },
];
const SEED_DECO = ethers.parseUnits('10000', 18);
const SEED_BASE = ethers.parseEther('0.001'); // 0.001 test VELA
const TEST_BUY = ethers.parseEther('0.0001'); // 0.0001 test VELA

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

// --- DNFT metadata: same name + gold DC badge as the other chains; the
// footer/description name Velana (the 3-chain text would be wrong here). ---
const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">' +
  '<rect width="512" height="512" fill="#0a0a0f"/>' +
  '<circle cx="256" cy="205" r="115" fill="none" stroke="#f5c518" stroke-width="6"/>' +
  '<text x="256" y="222" font-family="monospace" font-size="72" font-weight="bold" fill="#f5c518" text-anchor="middle">DECO</text>' +
  '<text x="256" y="335" font-family="monospace" font-size="30" fill="#ffffff" text-anchor="middle">NFT #1</text>' +
  '<text x="256" y="385" font-family="monospace" font-size="16" fill="#999999" text-anchor="middle">DYOR - DON&#39;T TRUST, VERIFY</text>' +
  '<text x="256" y="470" font-family="monospace" font-size="14" fill="#555555" text-anchor="middle">VELANA TESTNET</text></svg>';

const METADATA = {
  name: 'Deco NFT #1',
  description:
    "Deco's first testnet NFT — minted by the burner wallet on Velana Testnet. DYOR, don't trust — verify, not your keys, not your coins.",
  image: 'data:image/svg+xml;base64,' + Buffer.from(SVG, 'utf8').toString('base64'),
  attributes: [
    { trait_type: 'Token', value: '#1' },
    { trait_type: 'Collection', value: 'Deco NFT' },
    { trait_type: 'Network', value: 'Testnet' },
    { trait_type: 'Minter', value: 'Burner wallet' },
  ],
};
const TOKEN_URI = 'data:application/json;base64,' + Buffer.from(JSON.stringify(METADATA), 'utf8').toString('base64');

// --- keystore (same pattern as deploy.js / keystore.js) ---
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
  return JSON.parse(fs.readFileSync(path.join(DIR, 'build', name + '.json'), 'utf8'));
}

function readJsonIfExists(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

function explorerTx(hash) { return `${VELANA.explorer}/#/tx/${hash}`; }
function explorerAddr(addr) { return `${VELANA.explorer}/#/address/${addr}`; }

// --- Velana provider + tx helpers (legacy type-0, explicit gas price) ---
function velanaProvider() {
  const req = new ethers.FetchRequest(VELANA.rpc);
  req.setHeader('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36');
  req.timeout = 30000;
  return new ethers.JsonRpcProvider(req, VELANA.chainId, { staticNetwork: true });
}

let cachedGasPrice = null;
async function gasPriceOf(provider) {
  if (cachedGasPrice === null) {
    const fee = await provider.getFeeData();
    cachedGasPrice = fee.gasPrice ?? FALLBACK_GAS_PRICE;
    console.log(`  gas price: ${cachedGasPrice} wei (${ethers.formatUnits(cachedGasPrice, 'gwei')} gwei)`);
  }
  return cachedGasPrice;
}

// Legacy type-0 overrides; gas limit is auto-estimated by ethers.
async function txOpts(provider, extra = {}) {
  return { type: 0, gasPrice: await gasPriceOf(provider), ...extra };
}

async function deployWithRetry(factory, args, label, provider, maxAttempts = 2) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const opts = await txOpts(provider);
      const contract = await factory.deploy(...args, opts);
      const tx = contract.deploymentTransaction();
      console.log(`  ${label}: deploy tx ${tx.hash} (attempt ${attempt})`);
      await contract.waitForDeployment();
      const addr = await contract.getAddress();
      const receipt = await tx.wait();
      if (receipt.status !== 1) throw new Error(`${label}: deploy tx reverted (${tx.hash})`);
      return { contract, address: addr, txHash: tx.hash, receipt };
    } catch (e) {
      lastErr = e;
      console.error(`  ${label}: attempt ${attempt} failed: ${e.message}`);
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw lastErr;
}

async function sendAndConfirm(label, sendFn) {
  const tx = await sendFn();
  console.log(`  ${label}: tx ${tx.hash} ...`);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`${label}: transaction reverted (${tx.hash})`);
  console.log(`  ${label}: confirmed in block ${receipt.blockNumber} (gas used: ${receipt.gasUsed})`);
  return { txHash: tx.hash, receipt };
}

async function connectAndGuard(pk) {
  const provider = velanaProvider();
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== VELANA.chainId) {
    throw new Error(`Chain ID mismatch: RPC reports ${network.chainId}, expected ${VELANA.chainId} — aborting (testnet guard).`);
  }
  const wallet = new ethers.Wallet(pk, provider);
  const balance = await provider.getBalance(wallet.address);
  const nonce = await provider.getTransactionCount(wallet.address);
  console.log(`  chainId guard OK (${network.chainId}); burner balance: ${ethers.formatEther(balance)} VELA; nonce: ${nonce}`);
  return { provider, wallet, startBalance: balance };
}

// ---------------------------------------------------------------- tokens
async function stepTokens(pk) {
  console.log(`\n=== Velana: DECO + DNFT + metadata ===`);
  const { provider, wallet, startBalance } = await connectAndGuard(pk);
  const existing = readJsonIfExists(RESULTS_TOKENS) || {};
  const results = {
    chain: 'velana', label: VELANA.label, chainId: VELANA.chainId,
    explorer: VELANA.explorer, ...existing,
  };
  const tokenArtifact = loadArtifact('DecoToken');
  const nftArtifact = loadArtifact('DecoNFT');

  // ERC20
  if (results.erc20?.address) {
    const code = await provider.getCode(results.erc20.address);
    if (code === '0x') throw new Error(`Recorded DECO address ${results.erc20.address} has no code — refusing to reuse.`);
    console.log(`  DECO already deployed at ${results.erc20.address} (resuming)`);
  } else {
    const factory = new ethers.ContractFactory(tokenArtifact.abi, tokenArtifact.bytecode, wallet);
    const dep = await deployWithRetry(factory, [], 'DecoToken ERC20', provider);
    console.log(`  DecoToken deployed at ${dep.address} (gas used: ${dep.receipt.gasUsed})`);
    if ((await provider.getCode(dep.address)) === '0x') throw new Error('DecoToken: no code at deployed address');
    results.erc20 = { address: dep.address, txHash: dep.txHash, gasUsed: dep.receipt.gasUsed.toString(), explorerTx: explorerTx(dep.txHash) };
    writeJson(RESULTS_TOKENS, results);
  }
  const tokenRead = new ethers.Contract(results.erc20.address, tokenArtifact.abi, provider);
  const [tName, tSymbol, tSupply, tDecimals] = await Promise.all([
    tokenRead.name(), tokenRead.symbol(), tokenRead.totalSupply(), tokenRead.decimals(),
  ]);
  const deployerBal = await tokenRead.balanceOf(wallet.address);
  console.log(`  verified: name=${tName} symbol=${tSymbol} decimals=${tDecimals} totalSupply=${ethers.formatUnits(tSupply, tDecimals)} deployerBalance=${ethers.formatUnits(deployerBal, tDecimals)}`);
  if (tName !== 'Deco Token' || tSymbol !== 'DECO' || tSupply !== 1000000n * 10n ** 18n) {
    throw new Error('DecoToken verification mismatch');
  }

  // ERC721
  if (results.erc721?.address) {
    const code = await provider.getCode(results.erc721.address);
    if (code === '0x') throw new Error(`Recorded DNFT address ${results.erc721.address} has no code — refusing to reuse.`);
    console.log(`  DNFT already deployed at ${results.erc721.address} (resuming)`);
  } else {
    const factory = new ethers.ContractFactory(nftArtifact.abi, nftArtifact.bytecode, wallet);
    const dep = await deployWithRetry(factory, [], 'DecoNFT ERC721', provider);
    console.log(`  DecoNFT deployed at ${dep.address} (gas used: ${dep.receipt.gasUsed})`);
    if ((await provider.getCode(dep.address)) === '0x') throw new Error('DecoNFT: no code at deployed address');
    results.erc721 = { address: dep.address, txHash: dep.txHash, gasUsed: dep.receipt.gasUsed.toString(), explorerTx: explorerTx(dep.txHash) };
    writeJson(RESULTS_TOKENS, results);
  }
  const nftRead = new ethers.Contract(results.erc721.address, nftArtifact.abi, provider);
  const nftWrite = new ethers.Contract(results.erc721.address, nftArtifact.abi, wallet);
  const [nName, nSymbol] = await Promise.all([nftRead.name(), nftRead.symbol()]);
  console.log(`  verified: name=${nName} symbol=${nSymbol}`);
  if (nName !== 'Deco NFT' || nSymbol !== 'DNFT') throw new Error('DecoNFT verification mismatch');

  // Mint #1 (skip if the burner already owns it)
  let minted = false;
  try {
    const owner1 = await nftRead.ownerOf(1);
    if (owner1.toLowerCase() === wallet.address.toLowerCase()) {
      console.log('  DNFT #1 already owned by the burner (resuming)');
      if (!results.mint) results.mint = { tokenId: 1, txHash: '(already minted before this run)', gasUsed: '0' };
      minted = true;
    }
  } catch (e) {
    if (!/nonexistent token/i.test(e.message) && !/ERC721NonexistentToken/i.test(e.message)) throw e;
    // token #1 does not exist yet — mint below
  }
  if (!minted) {
    const m = await sendAndConfirm('mint DNFT #1', async () =>
      nftWrite.mint(wallet.address, await txOpts(provider)));
    const owner1 = await nftRead.ownerOf(1);
    if (owner1.toLowerCase() !== wallet.address.toLowerCase()) throw new Error('Mint verification mismatch');
    console.log(`  minted token #1 to burner; ownerOf(1)=burner`);
    results.mint = { tokenId: 1, txHash: m.txHash, gasUsed: m.receipt.gasUsed.toString(), explorerTx: explorerTx(m.txHash) };
    writeJson(RESULTS_TOKENS, results);
  }

  // Metadata (skip if tokenURI already matches)
  const currentUri = await nftRead.tokenURI(1);
  if (currentUri === TOKEN_URI) {
    console.log(`  tokenURI(1) already set (${TOKEN_URI.length} chars, matches) — skipping`);
    if (!results.metadata) results.metadata = { txHash: '(already set before this run)', gasUsed: '0', tokenUriLength: TOKEN_URI.length };
  } else {
    const owner = await nftRead.owner();
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) throw new Error('Burner is not the DNFT owner — cannot setTokenURI.');
    const s = await sendAndConfirm('setTokenURI(1)', async () =>
      nftWrite.setTokenURI(1, TOKEN_URI, await txOpts(provider)));
    const after = await nftRead.tokenURI(1);
    if (after !== TOKEN_URI) throw new Error('tokenURI verification mismatch after set');
    console.log(`  verified: tokenURI(1) now ${TOKEN_URI.length} chars, matches expected metadata`);
    results.metadata = { txHash: s.txHash, gasUsed: s.receipt.gasUsed.toString(), explorerTx: explorerTx(s.txHash), tokenUriLength: TOKEN_URI.length };
    writeJson(RESULTS_TOKENS, results);
  }

  const endBalance = await provider.getBalance(wallet.address);
  results.gasSpentNative = ethers.formatEther(startBalance - endBalance);
  results.updatedAt = new Date().toISOString();
  writeJson(RESULTS_TOKENS, results);
  console.log(`  tokens step done. Gas spent this step: ${results.gasSpentNative} VELA`);
  console.log(`  DECO: ${results.erc20.address} | DNFT: ${results.erc721.address}`);
  return results;
}

// ---------------------------------------------------------------- names
function decodeAndCheckTokenUri(uri, expectedTokenId, expectedName) {
  const prefix = 'data:application/json;base64,';
  if (!uri.startsWith(prefix)) throw new Error(`tokenURI(${expectedTokenId}) is not a base64 JSON data URI`);
  const meta = JSON.parse(Buffer.from(uri.slice(prefix.length), 'base64').toString('utf8'));
  const expectedMetaName = `Deco Name #${expectedTokenId} — ${expectedName}`;
  if (meta.name !== expectedMetaName) {
    throw new Error(`tokenURI(${expectedTokenId}) name mismatch: got "${meta.name}", expected "${expectedMetaName}"`);
  }
  const nameTrait = (meta.attributes || []).find((a) => a.trait_type === 'Name');
  if (!nameTrait || nameTrait.value !== expectedName) {
    throw new Error(`tokenURI(${expectedTokenId}) attributes missing Name=${expectedName}`);
  }
  const imgPrefix = 'data:image/svg+xml;base64,';
  if (!meta.image || !meta.image.startsWith(imgPrefix)) {
    throw new Error(`tokenURI(${expectedTokenId}) image is not a base64 SVG data URI`);
  }
  const svg = Buffer.from(meta.image.slice(imgPrefix.length), 'base64').toString('utf8');
  if (!svg.includes(expectedName)) {
    throw new Error(`tokenURI(${expectedTokenId}) SVG artwork does not contain the name "${expectedName}"`);
  }
  return { name: meta.name, description: meta.description, svgContainsName: true, uriLength: uri.length };
}

// Prove the soulbound lock with eth_call (staticCall) only — no gas spent.
async function proveSoulbound(nftWrite, tokenId) {
  const checks = [
    { method: 'transferFrom', args: [EXPECTED_ADDRESS, REVERT_TEST_RECIPIENT, tokenId] },
    { method: 'approve', args: [REVERT_TEST_RECIPIENT, tokenId] },
    { method: 'setApprovalForAll', args: [REVERT_TEST_RECIPIENT, true] },
  ];
  const results = [];
  for (const c of checks) {
    let reverted = false;
    let reason = '';
    try {
      await nftWrite[c.method].staticCall(...c.args);
      reason = 'CALL SUCCEEDED — soulbound lock NOT enforced!';
    } catch (e) {
      reverted = true;
      reason = (e.reason || e.shortMessage || e.message || 'reverted').split('\n')[0];
    }
    console.log(`  soulbound check ${c.method}: ${reverted ? 'REVERTED as expected' : '!!! DID NOT REVERT'} (${reason})`);
    results.push({ method: c.method, reverted, reason, mentionsSoulbound: /soulbound/i.test(reason) });
    if (!reverted) throw new Error(`Soulbound lock FAILED: ${c.method} did not revert on token #${tokenId}`);
  }
  return results;
}

async function stepNames(pk) {
  console.log(`\n=== Velana: DecoNameService + soulbound name NFTs ===`);
  const { provider, wallet, startBalance } = await connectAndGuard(pk);
  const existing = readJsonIfExists(RESULTS_NAMES) || {};
  const results = {
    chain: 'velana', label: VELANA.label, chainId: VELANA.chainId,
    explorer: VELANA.explorer, ...existing,
  };
  results.names = results.names || {};
  results.tokens = results.tokens || [];
  const registryArtifact = loadArtifact('DecoNameService');
  const nftArtifact = loadArtifact('DecoNameToken');
  let totalGas = 0n;

  if (results.registry?.address) {
    const code = await provider.getCode(results.registry.address);
    if (code === '0x') throw new Error(`Recorded registry ${results.registry.address} has no code — refusing to reuse.`);
    console.log(`  DecoNameService already deployed at ${results.registry.address} (resuming)`);
  } else {
    const factory = new ethers.ContractFactory(registryArtifact.abi, registryArtifact.bytecode, wallet);
    const dep = await deployWithRetry(factory, [], 'DecoNameService', provider);
    console.log(`  DecoNameService deployed at ${dep.address} (gas used: ${dep.receipt.gasUsed})`);
    results.registry = { address: dep.address, txHash: dep.txHash, gasUsed: dep.receipt.gasUsed.toString(), explorerTx: explorerTx(dep.txHash) };
    totalGas += dep.receipt.gasUsed;
    writeJson(RESULTS_NAMES, results);
  }

  if (results.nft?.address) {
    const code = await provider.getCode(results.nft.address);
    if (code === '0x') throw new Error(`Recorded name NFT ${results.nft.address} has no code — refusing to reuse.`);
    console.log(`  DecoNameToken already deployed at ${results.nft.address} (resuming)`);
  } else {
    const factory = new ethers.ContractFactory(nftArtifact.abi, nftArtifact.bytecode, wallet);
    const dep = await deployWithRetry(factory, [], 'DecoNameToken', provider);
    console.log(`  DecoNameToken deployed at ${dep.address} (gas used: ${dep.receipt.gasUsed})`);
    results.nft = { address: dep.address, txHash: dep.txHash, gasUsed: dep.receipt.gasUsed.toString(), explorerTx: explorerTx(dep.txHash) };
    totalGas += dep.receipt.gasUsed;
    writeJson(RESULTS_NAMES, results);
  }

  const registryRead = new ethers.Contract(results.registry.address, registryArtifact.abi, provider);
  const registryWrite = new ethers.Contract(results.registry.address, registryArtifact.abi, wallet);
  const nftRead = new ethers.Contract(results.nft.address, nftArtifact.abi, provider);
  const nftWrite = new ethers.Contract(results.nft.address, nftArtifact.abi, wallet);

  const [regOwner, nftOwner, nftName, nftSymbol] = await Promise.all([
    registryRead.owner(), nftRead.owner(), nftRead.name(), nftRead.symbol(),
  ]);
  if (regOwner.toLowerCase() !== wallet.address.toLowerCase()) throw new Error('DecoNameService owner is not the burner');
  if (nftOwner.toLowerCase() !== wallet.address.toLowerCase()) throw new Error('DecoNameToken owner is not the burner');
  if (nftName !== 'Deco Name' || nftSymbol !== 'DNAME') throw new Error(`DecoNameToken name/symbol mismatch: ${nftName}/${nftSymbol}`);
  console.log(`  verified: both contracts owned by burner; NFT name=${nftName} symbol=${nftSymbol}`);

  for (const n of NAMES) {
    const already = await registryRead.resolve(n.name);
    if (already.toLowerCase() === EXPECTED_ADDRESS.toLowerCase()) {
      console.log(`  "${n.name}" already resolves to the burner (resuming)`);
      if (!results.names[n.name]) {
        results.names[n.name] = { tokenId: n.tokenId, target: EXPECTED_ADDRESS, txHash: '(registered before this run)', gasUsed: '0' };
      }
      continue;
    }
    const tx = await sendAndConfirm(`register "${n.name}"`, async () =>
      registryWrite.register(n.name, EXPECTED_ADDRESS, await txOpts(provider)));
    totalGas += tx.receipt.gasUsed;
    results.names[n.name] = { tokenId: n.tokenId, target: EXPECTED_ADDRESS, txHash: tx.txHash, gasUsed: tx.receipt.gasUsed.toString(), explorerTx: explorerTx(tx.txHash) };
    writeJson(RESULTS_NAMES, results);
  }

  for (const n of NAMES) {
    let owned = false;
    try {
      const owner = await nftRead.ownerOf(n.tokenId);
      owned = owner.toLowerCase() === wallet.address.toLowerCase();
    } catch (e) {
      if (!/nonexistent token/i.test(e.message) && !/ERC721NonexistentToken/i.test(e.message)) throw e;
    }
    if (owned) {
      console.log(`  DecoNameToken #${n.tokenId} ("${n.name}") already owned by the burner (resuming)`);
      if (!results.tokens.find((t) => t.tokenId === n.tokenId)) {
        results.tokens.push({ tokenId: n.tokenId, name: n.name, txHash: '(minted before this run)', gasUsed: '0' });
      }
      continue;
    }
    const tx = await sendAndConfirm(`mint DecoNameToken #${n.tokenId} ("${n.name}")`, async () =>
      nftWrite.mint(EXPECTED_ADDRESS, n.tokenId, n.name, await txOpts(provider)));
    const owner = await nftRead.ownerOf(n.tokenId);
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) throw new Error(`ownerOf(${n.tokenId}) is not the burner after mint`);
    totalGas += tx.receipt.gasUsed;
    results.tokens.push({ tokenId: n.tokenId, name: n.name, txHash: tx.txHash, gasUsed: tx.receipt.gasUsed.toString(), explorerTx: explorerTx(tx.txHash) });
    writeJson(RESULTS_NAMES, results);
  }

  // Verification (always runs, even on resume)
  results.verification = { resolve: {}, tokenUris: {}, soulbound: [] };
  for (const n of NAMES) {
    const resolved = await registryRead.resolve(n.name);
    if (resolved.toLowerCase() !== EXPECTED_ADDRESS.toLowerCase()) {
      throw new Error(`resolve("${n.name}") returned ${resolved}, expected burner`);
    }
    console.log(`  verified: resolve("${n.name}") = burner`);
    results.verification.resolve[n.name] = resolved;
  }
  for (const n of NAMES) {
    const uri = await nftRead.tokenURI(n.tokenId);
    const checked = decodeAndCheckTokenUri(uri, n.tokenId, n.name);
    console.log(`  verified: tokenURI(${n.tokenId}) = "${checked.name}" (${checked.uriLength} chars, SVG contains "${n.name}")`);
    results.verification.tokenUris[n.tokenId] = checked;
  }
  results.verification.soulbound = await proveSoulbound(nftWrite, 1);

  const endBalance = await provider.getBalance(wallet.address);
  results.totalGasUsed = (BigInt(results.totalGasUsed || '0') + totalGas).toString();
  results.gasSpentNative = ethers.formatEther(startBalance - endBalance);
  results.updatedAt = new Date().toISOString();
  writeJson(RESULTS_NAMES, results);
  console.log(`  names step done. Gas spent this step: ${results.gasSpentNative} VELA`);
  console.log(`  Registry: ${results.registry.address} | Name NFT: ${results.nft.address}`);
  return results;
}

// ---------------------------------------------------------------- amm
async function stepAmm(pk) {
  console.log(`\n=== Velana: SimpleAMM (DECO / native VELA) ===`);
  const tokens = readJsonIfExists(RESULTS_TOKENS);
  const DECO = tokens?.erc20?.address;
  if (!DECO) throw new Error('No Velana DECO address in results-velana.json — run --step tokens first.');
  const { provider, wallet, startBalance } = await connectAndGuard(pk);
  const existing = readJsonIfExists(RESULTS_AMM) || {};
  const results = {
    chain: 'velana', label: VELANA.label, chainId: VELANA.chainId,
    explorer: VELANA.explorer, deco: DECO, quote: ethers.ZeroAddress,
    quoteSymbol: 'VELA', nativeBase: true, timestamp: new Date().toISOString(), ...existing,
  };
  const artifact = loadArtifact('SimpleAMM');
  const gasUsed = results.gasUsed || {};

  const deco = new ethers.Contract(DECO, ERC20_ABI, wallet);
  const decoBal = await deco.balanceOf(wallet.address);
  if (decoBal < SEED_DECO) throw new Error(`Insufficient DECO: have ${ethers.formatUnits(decoBal, 18)}, need ${ethers.formatUnits(SEED_DECO, 18)}`);

  let ammAddress = results.amm;
  if (ammAddress) {
    const code = await provider.getCode(ammAddress);
    if (code === '0x') throw new Error(`Recorded AMM ${ammAddress} has no code — refusing to reuse.`);
    console.log(`  SimpleAMM already deployed at ${ammAddress} (resuming)`);
  } else {
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const dep = await deployWithRetry(factory, [DECO, ethers.ZeroAddress], 'SimpleAMM', provider);
    ammAddress = dep.address;
    console.log(`  SimpleAMM deployed at ${ammAddress} (gas used: ${dep.receipt.gasUsed})`);
    gasUsed.deploy = dep.receipt.gasUsed.toString();
    results.deployTx = dep.txHash;
    results.amm = ammAddress;
    writeJson(RESULTS_AMM, results);
  }
  const amm = new ethers.Contract(ammAddress, artifact.abi, wallet);
  const ammRead = new ethers.Contract(ammAddress, artifact.abi, provider);

  const [onChainDeco, onChainQuote] = await Promise.all([ammRead.deco(), ammRead.quote()]);
  if (onChainDeco.toLowerCase() !== DECO.toLowerCase() || onChainQuote !== ethers.ZeroAddress) {
    throw new Error(`AMM token mismatch: deco=${onChainDeco} quote=${onChainQuote}`);
  }
  console.log(`  verified: deco=${onChainDeco} quote=address(0) [native VELA]`);

  // Seed (skip if reserves already hold the seed)
  const [rDeco0, rBase0] = await ammRead.getReserves();
  if (rDeco0 >= SEED_DECO && rBase0 >= SEED_BASE) {
    console.log(`  pool already seeded: ${ethers.formatUnits(rDeco0, 18)} DECO / ${ethers.formatEther(rBase0)} VELA (resuming)`);
    if (!results.reservesAfterSeed) {
      results.reservesAfterSeed = { deco: rDeco0.toString(), base: rBase0.toString() };
    }
  } else {
    // Approval sized from a LIVE getAmountOut quote against the planned
    // seed reserves (+ 10 DECO margin) — the Robinhood bug was a fixed
    // 100-DECO buffer that was too small for the ~906 DECO test-buy output.
    const quotedBuyOut = await ammRead.getAmountOut(TEST_BUY, SEED_BASE, SEED_DECO);
    const decoApproveAmt = SEED_DECO + quotedBuyOut + ethers.parseUnits('10', 18);
    const currentAllow = await deco.allowance(wallet.address, ammAddress);
    if (currentAllow < decoApproveAmt) {
      const a1 = await sendAndConfirm('approve DECO', async () =>
        deco.approve(ammAddress, decoApproveAmt, await txOpts(provider)));
      gasUsed.approveDeco = a1.receipt.gasUsed.toString();
      results.approveDecoTx = a1.txHash;
    } else {
      console.log(`  DECO allowance already ${ethers.formatUnits(currentAllow, 18)} — no new approval needed`);
    }
    const s = await sendAndConfirm('addLiquidity (seed)', async () =>
      amm.addLiquidity(SEED_DECO, SEED_BASE, await txOpts(provider, { value: SEED_BASE })));
    gasUsed.addLiquidity = s.receipt.gasUsed.toString();
    results.seedTx = s.txHash;
    const [rDecoAfter, rBaseAfter] = await ammRead.getReserves();
    if (rDecoAfter !== rDeco0 + SEED_DECO || rBaseAfter !== rBase0 + SEED_BASE) {
      throw new Error(`Reserve mismatch after seed: expected +${SEED_DECO}/+${SEED_BASE}, got +${rDecoAfter - rDeco0}/+${rBaseAfter - rBase0}`);
    }
    results.reservesAfterSeed = { deco: rDecoAfter.toString(), base: rBaseAfter.toString() };
    console.log(`  reserves verified: ${ethers.formatUnits(rDecoAfter, 18)} DECO / ${ethers.formatEther(rBaseAfter)} VELA`);
    writeJson(RESULTS_AMM, results);
  }

  // Test swap: buy, then sell the received DECO straight back.
  if (!results.testSellTx) {
    const [rDecoAfter, rBaseAfter] = await ammRead.getReserves();
    const quotedOut = await ammRead.getAmountOut(TEST_BUY, rBaseAfter, rDecoAfter);
    const minOut = (quotedOut * 95n) / 100n; // 5% slippage tolerance
    const decoBeforeBuy = await deco.balanceOf(wallet.address);
    const b = await sendAndConfirm('test buy', async () =>
      amm.buy(TEST_BUY, minOut, await txOpts(provider, { value: TEST_BUY })));
    gasUsed.testBuy = b.receipt.gasUsed.toString();
    results.testBuyTx = b.txHash;
    const decoReceived = (await deco.balanceOf(wallet.address)) - decoBeforeBuy;
    console.log(`  test buy received ${ethers.formatUnits(decoReceived, 18)} DECO (quoted ${ethers.formatUnits(quotedOut, 18)})`);
    if (decoReceived < minOut) throw new Error('Test buy received less than minDecoOut');
    results.testBuyReceivedDeco = decoReceived.toString();

    const [rDecoMid, rBaseMid] = await ammRead.getReserves();
    const quotedBack = await ammRead.getAmountOut(decoReceived, rDecoMid, rBaseMid);
    const minBack = (quotedBack * 95n) / 100n;
    const sl = await sendAndConfirm('test sell-back', async () =>
      amm.sell(decoReceived, minBack, await txOpts(provider)));
    gasUsed.testSell = sl.receipt.gasUsed.toString();
    results.testSellTx = sl.txHash;
    const [rDecoEnd, rBaseEnd] = await ammRead.getReserves();
    console.log(`  test sell-back done; reserves now ${ethers.formatUnits(rDecoEnd, 18)} DECO / ${ethers.formatEther(rBaseEnd)} VELA`);
    results.reservesAfterTestSwap = { deco: rDecoEnd.toString(), base: rBaseEnd.toString() };
    writeJson(RESULTS_AMM, results);
  } else {
    console.log('  test buy + sell-back already done (resuming)');
  }

  const endBalance = await provider.getBalance(wallet.address);
  results.gasUsed = gasUsed;
  results.gasSpentNative = ethers.formatEther(startBalance - endBalance);
  results.updatedAt = new Date().toISOString();
  writeJson(RESULTS_AMM, results);
  writeJson(AMM_ADDR_VELANA, { velana: ammAddress });
  console.log(`  amm step done. Gas spent this step: ${results.gasSpentNative} VELA`);
  console.log(`  SimpleAMM: ${ammAddress} (also written to sniper/amm-addresses-velana.json)`);
  return results;
}

// ---------------------------------------------------------------- main
async function main() {
  const args = process.argv.slice(2);
  const stepEq = (args.find((a) => a.startsWith('--step=')) || '').split('=')[1];
  const stepIdx = args.indexOf('--step');
  const stepArg = stepEq || (stepIdx !== -1 && args[stepIdx + 1] ? args[stepIdx + 1] : 'all');
  const steps = stepArg === 'all' ? ['tokens', 'names', 'amm'] : [stepArg];
  for (const s of steps) {
    if (!['tokens', 'names', 'amm'].includes(s)) { console.error(`Unknown step: ${s}`); process.exit(2); }
  }
  const pk = loadEvmPrivateKey();
  console.log(`Burner wallet: ${EXPECTED_ADDRESS} (key verified against keystore)`);
  console.log(`Target: ${VELANA.label} (chain ${VELANA.chainId}) — steps: ${steps.join(', ')}`);

  for (const s of steps) {
    if (s === 'tokens') await stepTokens(pk);
    if (s === 'names') await stepNames(pk);
    if (s === 'amm') await stepAmm(pk);
  }
  console.log('\nAll requested steps done.');
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
