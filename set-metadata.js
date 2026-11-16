// Set tokenURI for Deco NFT #1 on all three testnets (fully on-chain metadata:
// a data: URI with base64 JSON + inline SVG image — no hosting, no accounts).
// Usage: node set-metadata.js [--chain arc|robinhood|litvm]
//   No args = all three chains. Sends real txs (testnet gas only).
//
// SECURITY: the burner private key is decrypted in-memory only from the VM
// keystore and is NEVER printed, logged, or written anywhere.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');

const DIR = __dirname;
const KEYSTORE_PATH = path.join(process.env.HOME, 'workspace/multichain-wallet/keystore.enc.json');
const VM_KEY_PATH = path.join(process.env.HOME, '.config/multichain-wallet/vm-key');
const EXPECTED_ADDRESS = '0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31';
const DNFT_ADDRESS = '0xDf8A3BaAFffc5de3938bff1158584E841531BcbF';

// Testnet-only guard: these are the ONLY chain IDs this script will ever use.
const CHAINS = {
  arc: { label: 'Arc Testnet', chainId: 5042002, rpc: 'https://rpc.testnet.arc.io', explorer: 'https://explorer.testnet.arc.io', gasSymbol: 'USDC' },
  robinhood: { label: 'Robinhood Chain Testnet', chainId: 46630, rpc: 'https://rpc.testnet.chain.robinhood.com/rpc', explorer: 'https://explorer.testnet.chain.robinhood.com', gasSymbol: 'test ETH' },
  litvm: { label: 'LitVM LiteForge Testnet', chainId: 4441, rpc: 'https://rpc.testnet.liteforge.zeeve.net/', explorer: 'https://explorer.testnet.liteforge.zeeve.net', gasSymbol: 'zkLTC' },
};
const ALLOWED_CHAIN_IDS = new Set(Object.values(CHAINS).map((c) => c.chainId));

// --- Metadata (same on all three chains) ---
const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">' +
  '<rect width="512" height="512" fill="#0a0a0f"/>' +
  '<circle cx="256" cy="205" r="115" fill="none" stroke="#f5c518" stroke-width="6"/>' +
  '<text x="256" y="222" font-family="monospace" font-size="72" font-weight="bold" fill="#f5c518" text-anchor="middle">DECO</text>' +
  '<text x="256" y="335" font-family="monospace" font-size="30" fill="#ffffff" text-anchor="middle">NFT #1</text>' +
  '<text x="256" y="385" font-family="monospace" font-size="16" fill="#999999" text-anchor="middle">DYOR - DON&#39;T TRUST, VERIFY</text>' +
  '<text x="256" y="470" font-family="monospace" font-size="14" fill="#555555" text-anchor="middle">ARC - ROBINHOOD - LITVM TESTNETS</text></svg>';

const METADATA = {
  name: 'Deco NFT #1',
  description:
    "Deco's first testnet NFT — minted by the burner wallet on Arc, Robinhood Chain, and LitVM testnets. DYOR, don't trust — verify, not your keys, not your coins.",
  image: 'data:image/svg+xml;base64,' + Buffer.from(SVG, 'utf8').toString('base64'),
  attributes: [
    { trait_type: 'Token', value: '#1' },
    { trait_type: 'Collection', value: 'Deco NFT' },
    { trait_type: 'Network', value: 'Testnet' },
    { trait_type: 'Minter', value: 'Burner wallet' },
  ],
};

const TOKEN_URI = 'data:application/json;base64,' + Buffer.from(JSON.stringify(METADATA), 'utf8').toString('base64');

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

async function setChain(key, cfg, pk) {
  console.log(`\n=== ${cfg.label} (chain ${cfg.chainId}) ===`);
  const provider = new ethers.JsonRpcProvider(cfg.rpc);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== cfg.chainId || !ALLOWED_CHAIN_IDS.has(Number(network.chainId))) {
    throw new Error(`Chain ID mismatch: RPC reports ${network.chainId}, expected ${cfg.chainId} — aborting (testnet guard).`);
  }
  const wallet = new ethers.Wallet(pk, provider);
  const nftArtifact = loadArtifact('DecoNFT');
  const nft = new ethers.Contract(DNFT_ADDRESS, nftArtifact.abi, wallet);
  const nftRead = new ethers.Contract(DNFT_ADDRESS, nftArtifact.abi, provider);

  const owner = await nftRead.owner();
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`Burner is not the DNFT owner on this chain (owner=${owner}) — cannot setTokenURI.`);
  }
  const before = await nftRead.tokenURI(1);
  console.log(`  tokenURI(1) before: ${before === '' ? '(empty)' : before.slice(0, 80) + '...'}`);

  const tx = await nft.setTokenURI(1, TOKEN_URI);
  console.log(`  setTokenURI tx ${tx.hash} ...`);
  const receipt = await tx.wait();
  console.log(`  confirmed in block ${receipt.blockNumber} (gas used: ${receipt.gasUsed})`);

  const after = await nftRead.tokenURI(1);
  if (after !== TOKEN_URI) throw new Error('tokenURI verification mismatch after set');
  console.log(`  verified: tokenURI(1) now ${TOKEN_URI.length} chars, matches expected metadata`);
  return { chain: key, label: cfg.label, chainId: cfg.chainId, txHash: tx.hash, gasUsed: receipt.gasUsed.toString(), explorerTx: `${cfg.explorer}/tx/${tx.hash}`, tokenUriLength: TOKEN_URI.length };
}

async function main() {
  const args = process.argv.slice(2);
  const chainArg = (args.find((a) => a.startsWith('--chain=')) || '').split('=')[1];
  const selected = chainArg ? [chainArg] : Object.keys(CHAINS);
  for (const k of selected) {
    if (!CHAINS[k]) { console.error(`Unknown chain: ${k}`); process.exit(2); }
  }
  console.log(`Metadata URI length: ${TOKEN_URI.length} chars (fully on-chain data URI, no hosting)`);
  const pk = loadEvmPrivateKey();
  console.log(`Burner wallet: ${EXPECTED_ADDRESS} (key verified against keystore)`);

  const allResults = {};
  let failures = 0;
  for (const k of selected) {
    try {
      allResults[k] = await setChain(k, CHAINS[k], pk);
    } catch (e) {
      failures++;
      console.error(`FAILED ${CHAINS[k].label}: ${e.message}`);
      allResults[k] = { error: e.message };
    }
  }
  fs.writeFileSync(path.join(DIR, 'metadata-results.json'), JSON.stringify(allResults, null, 2) + '\n');
  fs.writeFileSync(path.join(DIR, 'nft-metadata.json'), JSON.stringify(METADATA, null, 2) + '\n');
  console.log('\nResults written to metadata-results.json; metadata saved to nft-metadata.json');
  if (failures) { console.error(`${failures} chain(s) failed.`); process.exit(1); }
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
