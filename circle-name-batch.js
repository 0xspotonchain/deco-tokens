// Burner-signed batch for the Circle-wallet stack mirror on Arc Testnet:
//  1. Simulate the Circle wallet calling registry.register() — expect the
//     onlyOwner revert (the registry owner is the burner, so Circle cannot
//     self-register; this captures the exact revert reason for the record).
//  2. Burner registers name "circle" -> Circle wallet address.
//  3. Burner mints soulbound name token #4 ("circle") to the Circle wallet.
//  4. Burner sets the on-chain metadata URI for DNFT #2 (held by Circle).
// Usage: node circle-name-batch.js
// SECURITY: the burner private key is decrypted in-memory only from the VM
// keystore and is NEVER printed, logged, or written anywhere.
// TESTNET ONLY — chainId guard 5042002.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');

const DIR = __dirname;
const KEYSTORE_PATH = path.join(process.env.HOME, 'workspace/multichain-wallet/keystore.enc.json');
const VM_KEY_PATH = path.join(process.env.HOME, '.config/multichain-wallet/vm-key');
const RPC = 'https://rpc.testnet.arc.io';
const CHAIN_ID = 5042002;
const EXPLORER = 'https://explorer.testnet.arc.io';
const BURNER = '0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31';
const CIRCLE = '0xc7d81269debced5e62069a4d42950965853aa300';
const REGISTRY = '0x9d1217DD428440ef49C59CCa2085aF6bd7A7a5b6';
const NAME_TOKEN = '0x553c4212254DA568FdDc5Cc312318bB6c0fBB0E4';
const DNFT = '0xDf8A3BaAFffc5de3938bff1158584E841531BcbF';
const NAME = 'circle';
const TOKEN_ID = 4;

const REGISTRY_ABI = [
  'function owner() view returns (address)',
  'function register(string,address)',
  'function resolve(string) view returns (address)',
];
const NAME_TOKEN_ABI = [
  'function owner() view returns (address)',
  'function mint(address,uint256,string)',
  'function tokenIdForName(string) view returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  'function balanceOf(address) view returns (uint256)',
  'function tokenName(uint256) view returns (string)',
];
const DNFT_ABI = [
  'function owner() view returns (address)',
  'function setTokenURI(uint256,string)',
  'function tokenURI(uint256) view returns (string)',
  'function ownerOf(uint256) view returns (address)',
];

// --- DNFT #2 metadata (same gold-DC badge style as #1, Circle-themed) ---
const SVG2 =
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">' +
  '<rect width="512" height="512" fill="#0a0a0f"/>' +
  '<circle cx="256" cy="205" r="115" fill="none" stroke="#f5c518" stroke-width="6"/>' +
  '<text x="256" y="222" font-family="monospace" font-size="72" font-weight="bold" fill="#f5c518" text-anchor="middle">DECO</text>' +
  '<text x="256" y="335" font-family="monospace" font-size="30" fill="#ffffff" text-anchor="middle">NFT #2</text>' +
  '<text x="256" y="385" font-family="monospace" font-size="16" fill="#999999" text-anchor="middle">DYOR - DON&#39;T TRUST, VERIFY</text>' +
  '<text x="256" y="470" font-family="monospace" font-size="14" fill="#555555" text-anchor="middle">ARC TESTNET - CIRCLE WALLET</text></svg>';

const METADATA2 = {
  name: 'Deco NFT #2',
  description:
    "Deco's second testnet NFT — minted by the Circle agent wallet on Arc Testnet. DYOR, don't trust — verify, not your keys, not your coins.",
  image: 'data:image/svg+xml;base64,' + Buffer.from(SVG2, 'utf8').toString('base64'),
  attributes: [
    { trait_type: 'Token', value: '#2' },
    { trait_type: 'Collection', value: 'Deco NFT' },
    { trait_type: 'Network', value: 'Testnet' },
    { trait_type: 'Minter', value: 'Circle agent wallet' },
  ],
};
const TOKEN_URI_2 = 'data:application/json;base64,' + Buffer.from(JSON.stringify(METADATA2), 'utf8').toString('base64');

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
  if (wallet.address.toLowerCase() !== BURNER.toLowerCase()) {
    throw new Error('Keystore EVM key does not match expected burner address — aborting.');
  }
  return pk;
}

async function sendAndLog(label, txPromise) {
  const tx = await txPromise;
  console.log(`  ${label}: tx ${tx.hash} ...`);
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error(`${label}: transaction reverted (${tx.hash})`);
  console.log(`  ${label}: confirmed in block ${receipt.blockNumber} (gas used: ${receipt.gasUsed})`);
  return { txHash: tx.hash, receipt };
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== CHAIN_ID) throw new Error(`Chain guard: RPC reports ${net.chainId}, expected ${CHAIN_ID}`);
  const results = { chain: 'arc', chainId: CHAIN_ID, timestamp: new Date().toISOString() };

  // 1. Simulate Circle calling register() — expect the onlyOwner revert.
  const regRead = new ethers.Contract(REGISTRY, REGISTRY_ABI, provider);
  console.log('1. Simulating Circle -> registry.register("circle", Circle) ...');
  try {
    await regRead.register.staticCall(NAME, CIRCLE, { from: CIRCLE });
    console.log('  UNEXPECTED: simulation did NOT revert — Circle could self-register?');
    results.circleRegisterSimulation = { reverted: false };
  } catch (e) {
    const msg = e.message || '';
    const reason = msg.includes('OwnableUnauthorizedAccount') ? 'OwnableUnauthorizedAccount' : msg.slice(0, 200);
    console.log(`  reverted as expected: ${reason}`);
    results.circleRegisterSimulation = { reverted: true, reason, fullError: msg.slice(0, 400) };
  }

  // Preconditions.
  const regOwner = await regRead.owner();
  if (regOwner.toLowerCase() !== BURNER.toLowerCase()) throw new Error(`Registry owner is ${regOwner}, not the burner — cannot register.`);
  const ntRead = new ethers.Contract(NAME_TOKEN, NAME_TOKEN_ABI, provider);
  const ntOwner = await ntRead.owner();
  if (ntOwner.toLowerCase() !== BURNER.toLowerCase()) throw new Error(`NameToken owner is ${ntOwner}, not the burner — cannot mint.`);
  if ((await regRead.resolve(NAME)) !== ethers.ZeroAddress) throw new Error(`Name "${NAME}" is already registered.`);
  if ((await ntRead.tokenIdForName(NAME)) !== 0n) throw new Error(`Name "${NAME}" is already minted.`);
  const dnftRead = new ethers.Contract(DNFT, DNFT_ABI, provider);
  if ((await dnftRead.ownerOf(2)).toLowerCase() !== CIRCLE.toLowerCase()) throw new Error('DNFT #2 is not held by the Circle wallet — aborting.');
  if ((await dnftRead.owner()).toLowerCase() !== BURNER.toLowerCase()) throw new Error('Burner is not the DNFT owner — cannot setTokenURI.');
  console.log('  preconditions OK: registry + name token owned by burner, "circle" free, DNFT #2 held by Circle.');

  const pk = loadEvmPrivateKey();
  const wallet = new ethers.Wallet(pk, provider);
  console.log(`  burner: ${wallet.address} (key verified against keystore)`);

  // 2. Register "circle" -> Circle.
  const reg = new ethers.Contract(REGISTRY, REGISTRY_ABI, wallet);
  const r = await sendAndLog('register("circle" -> Circle)', reg.register(NAME, CIRCLE));
  results.registerTx = r.txHash; results.registerGas = r.receipt.gasUsed.toString();

  // 3. Mint soulbound name token #4 ("circle") to Circle.
  const nt = new ethers.Contract(NAME_TOKEN, NAME_TOKEN_ABI, wallet);
  const m = await sendAndLog('mint DNAME #4 ("circle") to Circle', nt.mint(CIRCLE, TOKEN_ID, NAME));
  results.mintTx = m.txHash; results.mintGas = m.receipt.gasUsed.toString();

  // 4. Set DNFT #2 metadata URI.
  const dnft = new ethers.Contract(DNFT, DNFT_ABI, wallet);
  const s = await sendAndLog('setTokenURI(DNFT #2)', dnft.setTokenURI(2, TOKEN_URI_2));
  results.setTokenUriTx = s.txHash; results.setTokenUriGas = s.receipt.gasUsed.toString();

  // Verify everything.
  const resolved = await regRead.resolve(NAME);
  const tid = await ntRead.tokenIdForName(NAME);
  const owner4 = await ntRead.ownerOf(TOKEN_ID);
  const name4 = await ntRead.tokenName(TOKEN_ID);
  const circleDname = await ntRead.balanceOf(CIRCLE);
  const uri2 = await dnftRead.tokenURI(2);
  console.log('\nVerification:');
  console.log(`  resolve("circle") = ${resolved} (expect ${CIRCLE})`);
  console.log(`  tokenIdForName("circle") = ${tid} (expect 4)`);
  console.log(`  ownerOf(DNAME #4) = ${owner4} (expect Circle)`);
  console.log(`  tokenName(#4) = "${name4}" (expect "circle")`);
  console.log(`  Circle DNAME balance = ${circleDname} (expect 1)`);
  console.log(`  DNFT tokenURI(2) length = ${uri2.length} (expect ${TOKEN_URI_2.length}, match: ${uri2 === TOKEN_URI_2})`);
  if (resolved.toLowerCase() !== CIRCLE.toLowerCase()) throw new Error('resolve() verification failed');
  if (tid !== 4n) throw new Error('tokenIdForName verification failed');
  if (owner4.toLowerCase() !== CIRCLE.toLowerCase()) throw new Error('ownerOf(#4) verification failed');
  if (name4 !== NAME) throw new Error('tokenName verification failed');
  if (circleDname !== 1n) throw new Error('Circle DNAME balance verification failed');
  if (uri2 !== TOKEN_URI_2) throw new Error('DNFT tokenURI verification failed');
  results.verification = {
    resolveCircle: resolved, tokenIdForName: tid.toString(), ownerOf4: owner4,
    tokenName4: name4, circleDnameBalance: circleDname.toString(), tokenUri2Length: uri2.length,
  };
  results.explorer = {
    registerTx: `${EXPLORER}/tx/${r.txHash}`,
    mintTx: `${EXPLORER}/tx/${m.txHash}`,
    setTokenUriTx: `${EXPLORER}/tx/${s.txHash}`,
  };

  fs.writeFileSync(path.join(DIR, 'circle-name-results.json'), JSON.stringify(results, null, 2) + '\n');
  fs.writeFileSync(path.join(DIR, 'nft-metadata-2.json'), JSON.stringify(METADATA2, null, 2) + '\n');
  console.log('\nAll verified. Results written to circle-name-results.json; metadata saved to nft-metadata-2.json');
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
