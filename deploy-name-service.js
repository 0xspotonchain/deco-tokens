// Deploy DecoNameService (registry) + DecoNameToken (soulbound name NFTs)
// to Arc / Robinhood / LitVM testnets, register deco's 3 names, mint the 3
// soulbound name tokens, and verify everything on-chain.
// Usage: node deploy-name-service.js [--chain arc|robinhood|litvm] [--dry-run]
//   No --chain = all three chains, sequentially.
//   --dry-run = connect, check chain ID + balance, show the deployment plan
//     with predicted contract addresses, and exit WITHOUT signing or sending
//     anything (the keystore is not even decrypted in dry-run mode).
//   Without --dry-run it deploys for real (testnet gas only).
//
// SECURITY: the burner private key is decrypted in-memory only from the VM
// keystore and is NEVER printed, logged, or written anywhere.
//
// Names (same on every chain): 1=deco, 2=muse, 3=0xspotonchain — all resolve
// to the burner EVM address. Token IDs match the name list order.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');

const DIR = __dirname;
const KEYSTORE_PATH = path.join(process.env.HOME, 'workspace/multichain-wallet/keystore.enc.json');
const VM_KEY_PATH = path.join(process.env.HOME, '.config/multichain-wallet/vm-key');
const EXPECTED_ADDRESS = '0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31';
const RESULTS_PATH = path.join(DIR, 'name-service-results.json');
const MD_PATH = path.join(DIR, 'name-service.md');
// Dummy recipient used ONLY for the eth_call (staticCall) soulbound revert
// test — no real transaction is ever sent to it.
const REVERT_TEST_RECIPIENT = '0x000000000000000000000000000000000000dEaD';

const NAMES = [
  { tokenId: 1, name: 'deco' },
  { tokenId: 2, name: 'muse' },
  { tokenId: 3, name: '0xspotonchain' },
];

// Testnet-only guard: these are the ONLY chain IDs this script will ever use.
const CHAINS = {
  arc: {
    label: 'Arc Testnet', chainId: 5042002,
    rpc: 'https://rpc.testnet.arc.io',
    explorer: 'https://explorer.testnet.arc.io',
    gasSymbol: 'USDC',
  },
  robinhood: {
    label: 'Robinhood Chain Testnet', chainId: 46630,
    rpc: 'https://rpc.testnet.chain.robinhood.com/rpc',
    explorer: 'https://explorer.testnet.chain.robinhood.com',
    gasSymbol: 'test ETH',
  },
  litvm: {
    label: 'LitVM LiteForge Testnet', chainId: 4441,
    rpc: 'https://rpc.testnet.liteforge.zeeve.net/',
    explorer: 'https://explorer.testnet.liteforge.zeeve.net',
    gasSymbol: 'zkLTC',
  },
};
const ALLOWED_CHAIN_IDS = new Set(Object.values(CHAINS).map((c) => c.chainId));

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
  // Verify the key matches the expected burner address before using it.
  const wallet = new ethers.Wallet(pk);
  if (wallet.address.toLowerCase() !== EXPECTED_ADDRESS.toLowerCase()) {
    throw new Error('Keystore EVM key does not match expected burner address — aborting.');
  }
  return pk;
}

function loadArtifact(name) {
  return JSON.parse(fs.readFileSync(path.join(DIR, 'build', name + '.json'), 'utf8'));
}

function checkArtifact(artifact, expectedFns) {
  for (const fn of expectedFns) {
    if (!artifact.abi.some((e) => e.type === 'function' && e.name === fn)) {
      throw new Error(`${artifact.contractName}: ABI missing function ${fn}`);
    }
  }
  if (!artifact.bytecode || artifact.bytecode.length < 100) {
    throw new Error(`${artifact.contractName}: empty bytecode`);
  }
}

async function deployWithRetry(factory, label, maxAttempts = 2) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const contract = await factory.deploy();
      console.log(`  ${label}: deploy tx ${contract.deploymentTransaction().hash} (attempt ${attempt})`);
      await contract.waitForDeployment();
      const addr = await contract.getAddress();
      const txReceipt = await contract.deploymentTransaction().wait();
      return { contract, address: addr, txHash: contract.deploymentTransaction().hash, receipt: txReceipt };
    } catch (e) {
      lastErr = e;
      console.error(`  ${label}: attempt ${attempt} failed: ${e.message}`);
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw lastErr;
}

// Decode a tokenURI data: URI and check it carries the right name.
// Returns { name, description, svgContainsName, attributes }.
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
// Each call is made FROM the burner (the token owner), so without the lock
// it would succeed; a revert therefore proves the lock, not a permissions
// failure. Returns { method, reverted, reason } per call.
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

async function deployChain(key, cfg, pk, dryRun) {
  console.log(`\n=== ${cfg.label} (chain ${cfg.chainId})${dryRun ? ' [DRY RUN — nothing will be sent]' : ''} ===`);
  const provider = new ethers.JsonRpcProvider(cfg.rpc);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== cfg.chainId || !ALLOWED_CHAIN_IDS.has(Number(network.chainId))) {
    throw new Error(`Chain ID mismatch: RPC reports ${network.chainId}, expected ${cfg.chainId} — aborting (testnet guard).`);
  }
  const balance = await provider.getBalance(EXPECTED_ADDRESS);
  const feeData = await provider.getFeeData();
  console.log(`  burner balance: ${ethers.formatEther(balance)} ${cfg.gasSymbol}`);
  console.log(`  gas price: ${feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') + ' gwei' : 'n/a (EIP-1559)'}`);

  const registryArtifact = loadArtifact('DecoNameService');
  const nftArtifact = loadArtifact('DecoNameToken');
  checkArtifact(registryArtifact, ['register', 'resolve']);
  checkArtifact(nftArtifact, ['mint', 'tokenURI', 'tokenName', 'approve', 'setApprovalForAll']);
  console.log(`  artifacts OK: DecoNameService ${(registryArtifact.bytecode.length - 2) / 2} bytes, DecoNameToken ${(nftArtifact.bytecode.length - 2) / 2} bytes`);

  const results = { chain: key, label: cfg.label, chainId: cfg.chainId, explorer: cfg.explorer, dryRun: !!dryRun };

  if (dryRun) {
    // Predict the CREATE addresses from the burner's current nonce — no
    // signing, no sending. Deploy order: registry first, then NFT.
    const nonce = await provider.getTransactionCount(EXPECTED_ADDRESS);
    const predictedRegistry = ethers.getCreateAddress({ from: EXPECTED_ADDRESS, nonce });
    const predictedNft = ethers.getCreateAddress({ from: EXPECTED_ADDRESS, nonce: nonce + 1 });
    console.log(`  burner nonce: ${nonce}`);
    console.log(`  WOULD deploy DecoNameService -> predicted ${predictedRegistry} (nonce ${nonce})`);
    console.log(`  WOULD deploy DecoNameToken   -> predicted ${predictedNft} (nonce ${nonce + 1})`);
    for (const n of NAMES) {
      console.log(`  WOULD register "${n.name}" -> ${EXPECTED_ADDRESS}`);
    }
    for (const n of NAMES) {
      console.log(`  WOULD mint DecoNameToken #${n.tokenId} ("${n.name}") to ${EXPECTED_ADDRESS}`);
    }
    console.log('  WOULD verify: resolve() x3, tokenURI decode x3, soulbound staticCall revert x3 (no gas)');
    console.log('  DRY RUN complete — no transactions sent, no files written.');
    results.predicted = { registry: predictedRegistry, nft: predictedNft, nonce };
    return results;
  }

  const wallet = new ethers.Wallet(pk, provider);
  let totalGas = 0n;

  // 1. Deploy DecoNameService
  const registryFactory = new ethers.ContractFactory(registryArtifact.abi, registryArtifact.bytecode, wallet);
  const registry = await deployWithRetry(registryFactory, 'DecoNameService');
  console.log(`  DecoNameService deployed at ${registry.address} (gas used: ${registry.receipt.gasUsed})`);
  if ((await provider.getCode(registry.address)) === '0x') throw new Error('DecoNameService: no code at deployed address');
  totalGas += registry.receipt.gasUsed;
  results.registry = { address: registry.address, txHash: registry.txHash, gasUsed: registry.receipt.gasUsed.toString() };

  // 2. Deploy DecoNameToken
  const nftFactory = new ethers.ContractFactory(nftArtifact.abi, nftArtifact.bytecode, wallet);
  const nft = await deployWithRetry(nftFactory, 'DecoNameToken');
  console.log(`  DecoNameToken deployed at ${nft.address} (gas used: ${nft.receipt.gasUsed})`);
  if ((await provider.getCode(nft.address)) === '0x') throw new Error('DecoNameToken: no code at deployed address');
  totalGas += nft.receipt.gasUsed;
  results.nft = { address: nft.address, txHash: nft.txHash, gasUsed: nft.receipt.gasUsed.toString() };

  const registryRead = new ethers.Contract(registry.address, registryArtifact.abi, provider);
  const registryWrite = new ethers.Contract(registry.address, registryArtifact.abi, wallet);
  const nftRead = new ethers.Contract(nft.address, nftArtifact.abi, provider);
  const nftWrite = new ethers.Contract(nft.address, nftArtifact.abi, wallet);

  // Sanity: burner owns both contracts, NFT name/symbol as expected.
  const [regOwner, nftOwner, nftName, nftSymbol] = await Promise.all([
    registryRead.owner(), nftRead.owner(), nftRead.name(), nftRead.symbol(),
  ]);
  if (regOwner.toLowerCase() !== wallet.address.toLowerCase()) throw new Error('DecoNameService owner is not the burner');
  if (nftOwner.toLowerCase() !== wallet.address.toLowerCase()) throw new Error('DecoNameToken owner is not the burner');
  if (nftName !== 'Deco Name' || nftSymbol !== 'DNAME') throw new Error(`DecoNameToken name/symbol mismatch: ${nftName}/${nftSymbol}`);
  console.log(`  verified: both contracts owned by burner; NFT name=${nftName} symbol=${nftSymbol}`);

  // 3. Register the 3 names -> burner
  results.names = {};
  for (const n of NAMES) {
    const tx = await registryWrite.register(n.name, EXPECTED_ADDRESS);
    console.log(`  register "${n.name}" tx ${tx.hash} ...`);
    const receipt = await tx.wait();
    console.log(`    confirmed in block ${receipt.blockNumber} (gas used: ${receipt.gasUsed})`);
    totalGas += receipt.gasUsed;
    results.names[n.name] = { tokenId: n.tokenId, target: EXPECTED_ADDRESS, txHash: tx.hash, gasUsed: receipt.gasUsed.toString() };
  }

  // 4. Mint the 3 soulbound name tokens to the burner
  results.tokens = [];
  for (const n of NAMES) {
    const tx = await nftWrite.mint(EXPECTED_ADDRESS, n.tokenId, n.name);
    console.log(`  mint DecoNameToken #${n.tokenId} ("${n.name}") tx ${tx.hash} ...`);
    const receipt = await tx.wait();
    const owner = await nftRead.ownerOf(n.tokenId);
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) throw new Error(`ownerOf(${n.tokenId}) is not the burner after mint`);
    console.log(`    confirmed in block ${receipt.blockNumber} (gas used: ${receipt.gasUsed}); ownerOf(${n.tokenId})=burner`);
    totalGas += receipt.gasUsed;
    results.tokens.push({ tokenId: n.tokenId, name: n.name, txHash: tx.hash, gasUsed: receipt.gasUsed.toString() });
  }

  // 5. Verify: resolve() for all 3 names
  results.verification = { resolve: {}, tokenUris: {}, soulbound: [] };
  for (const n of NAMES) {
    const resolved = await registryRead.resolve(n.name);
    if (resolved.toLowerCase() !== EXPECTED_ADDRESS.toLowerCase()) {
      throw new Error(`resolve("${n.name}") returned ${resolved}, expected burner`);
    }
    console.log(`  verified: resolve("${n.name}") = burner`);
    results.verification.resolve[n.name] = resolved;
  }

  // 6. Verify: tokenURI decodes to JSON with the right name + SVG artwork
  for (const n of NAMES) {
    const uri = await nftRead.tokenURI(n.tokenId);
    const checked = decodeAndCheckTokenUri(uri, n.tokenId, n.name);
    console.log(`  verified: tokenURI(${n.tokenId}) = "${checked.name}" (${checked.uriLength} chars, SVG contains "${n.name}")`);
    results.verification.tokenUris[n.tokenId] = checked;
  }

  // 7. Verify: soulbound lock reverts (eth_call only — no gas spent)
  results.verification.soulbound = await proveSoulbound(nftWrite, 1);

  const endBalance = await provider.getBalance(wallet.address);
  results.totalGasUsed = totalGas.toString();
  results.gasSpentNative = ethers.formatEther(balance - endBalance);
  console.log(`  total gas used this chain: ${totalGas} (${results.gasSpentNative} ${cfg.gasSymbol})`);
  results.updatedAt = new Date().toISOString();
  return results;
}

function loadExistingResults() {
  try {
    return JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function renderMarkdown(all) {
  const lines = [];
  lines.push('# Deco Name Service — deployment record');
  lines.push('');
  lines.push('Own ENS-style registry (`DecoNameService`) + soulbound name NFTs (`DecoNameToken`) for deco\'s testnet stack.');
  lines.push('Names resolve to the burner EVM address `0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31`.');
  lines.push('Token IDs: 1 = deco, 2 = muse, 3 = 0xspotonchain (same on every chain).');
  lines.push('Name NFTs are soulbound: minting only, transfers and approvals always revert.');
  lines.push('');
  lines.push('## Names');
  lines.push('');
  lines.push('| Token ID | Name | Resolves to |');
  lines.push('|---:|---|---|');
  for (const n of NAMES) {
    lines.push(`| ${n.tokenId} | \`${n.name}\` | burner \`0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31\` |`);
  }
  lines.push('');
  for (const key of Object.keys(CHAINS)) {
    const r = all[key];
    lines.push(`## ${CHAINS[key].label} (chain ${CHAINS[key].chainId})`);
    lines.push('');
    if (!r) {
      lines.push('_Not deployed yet._');
      lines.push('');
      continue;
    }
    if (r.error) {
      lines.push(`_Deploy failed: ${r.error}_`);
      lines.push('');
      continue;
    }
    if (r.dryRun) {
      lines.push('_Dry run only — not deployed._');
      if (r.predicted) {
        lines.push(`Predicted registry: \`${r.predicted.registry}\`, predicted NFT: \`${r.predicted.nft}\` (nonce ${r.predicted.nonce}).`);
      }
      lines.push('');
      continue;
    }
    lines.push(`- Registry (DecoNameService): \`${r.registry.address}\` — deploy tx [\`${r.registry.txHash}\`](${CHAINS[key].explorer}/tx/${r.registry.txHash}) (gas ${r.registry.gasUsed})`);
    lines.push(`- Name NFT (DecoNameToken): \`${r.nft.address}\` — deploy tx [\`${r.nft.txHash}\`](${CHAINS[key].explorer}/tx/${r.nft.txHash}) (gas ${r.nft.gasUsed})`);
    lines.push('');
    lines.push('| Name | Register tx | Mint tx (token ID) |');
    lines.push('|---|---|---|');
    for (const n of NAMES) {
      const reg = r.names[n.name];
      const tok = (r.tokens || []).find((t) => t.tokenId === n.tokenId);
      lines.push(`| \`${n.name}\` | [\`${reg.txHash.slice(0, 18)}…\`](${CHAINS[key].explorer}/tx/${reg.txHash}) | [\`${tok.txHash.slice(0, 18)}…\`](${CHAINS[key].explorer}/tx/${tok.txHash}) (#${n.tokenId}) |`);
    }
    lines.push('');
    const v = r.verification || {};
    lines.push(`- Verified: resolve() returns the burner for all 3 names; tokenURI(1–3) decode to JSON with the right names and SVG artwork; soulbound lock proven by eth_call — \`transferFrom\`, \`approve\` and \`setApprovalForAll\` all revert${(v.soulbound || []).every((s) => s.mentionsSoulbound) ? ' with the soulbound custom errors' : ''}.`);
    lines.push(`- Total gas: ${r.totalGasUsed} (${r.gasSpentNative} ${CHAINS[key].gasSymbol})`);
    if (r.updatedAt) lines.push(`- Updated: ${r.updatedAt}`);
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const chainArg = (args.find((a) => a.startsWith('--chain=')) || '').split('=')[1];
  const dryRun = args.includes('--dry-run');
  const selected = chainArg ? [chainArg] : Object.keys(CHAINS);
  for (const k of selected) {
    if (!CHAINS[k]) { console.error(`Unknown chain: ${k}`); process.exit(2); }
  }
  // Dry-run never touches the keystore: nothing is signed, so no key is needed.
  const pk = dryRun ? null : loadEvmPrivateKey();
  console.log(`Burner wallet: ${EXPECTED_ADDRESS}${dryRun ? ' (dry-run: keystore NOT decrypted)' : ' (key verified against keystore)'}`);

  const allResults = loadExistingResults();
  let failures = 0;
  for (const k of selected) {
    try {
      const r = await deployChain(k, CHAINS[k], pk, dryRun);
      if (!dryRun) allResults[k] = r; // dry-run writes nothing to the results file
    } catch (e) {
      failures++;
      console.error(`FAILED ${CHAINS[k].label}: ${e.message}`);
      if (!dryRun) allResults[k] = { chain: k, label: CHAINS[k].label, chainId: CHAINS[k].chainId, error: e.message, updatedAt: new Date().toISOString() };
    }
  }
  if (!dryRun) {
    fs.writeFileSync(RESULTS_PATH, JSON.stringify(allResults, null, 2) + '\n');
    fs.writeFileSync(MD_PATH, renderMarkdown(allResults));
    console.log('\nResults written to name-service-results.json and name-service.md');
  }
  if (failures) { console.error(`${failures} chain(s) failed.`); process.exit(1); }
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
