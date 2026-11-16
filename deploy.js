// Deploy DecoToken (ERC20) + DecoNFT (ERC721) to Arc / Robinhood / LitVM testnets
// and mint 1 NFT to the burner on each chain.
// Usage: node deploy.js [--chain arc|robinhood|litvm] [--skip-mint]
//   No args = all three chains. Deploys for real (testnet gas only).
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

async function deployWithRetry(factory, label, maxAttempts = 2) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const contract = await factory.deploy();
      console.log(`  ${label}: deploy tx ${contract.deploymentTransaction().hash} (attempt ${attempt})`);
      const receipt = await contract.waitForDeployment();
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

async function deployChain(key, cfg, pk, skipMint) {
  console.log(`\n=== ${cfg.label} (chain ${cfg.chainId}) ===`);
  const provider = new ethers.JsonRpcProvider(cfg.rpc);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== cfg.chainId || !ALLOWED_CHAIN_IDS.has(Number(network.chainId))) {
    throw new Error(`Chain ID mismatch: RPC reports ${network.chainId}, expected ${cfg.chainId} — aborting (testnet guard).`);
  }
  const wallet = new ethers.Wallet(pk, provider);
  const balance = await provider.getBalance(wallet.address);
  const feeData = await provider.getFeeData();
  console.log(`  burner balance: ${ethers.formatEther(balance)} ${cfg.gasSymbol}`);
  console.log(`  gas price: ${feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') + ' gwei' : 'n/a (EIP-1559 maxFee ' + (feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') + ' gwei' : 'n/a') + ')'}`);

  const tokenArtifact = loadArtifact('DecoToken');
  const nftArtifact = loadArtifact('DecoNFT');
  const results = { chain: key, label: cfg.label, chainId: cfg.chainId, explorer: cfg.explorer };

  // ERC20
  const tokenFactory = new ethers.ContractFactory(tokenArtifact.abi, tokenArtifact.bytecode, wallet);
  const token = await deployWithRetry(tokenFactory, 'DecoToken ERC20');
  console.log(`  DecoToken deployed at ${token.address} (gas used: ${token.receipt.gasUsed})`);
  const code = await provider.getCode(token.address);
  if (code === '0x') throw new Error('DecoToken: no code at deployed address');
  const tokenRead = new ethers.Contract(token.address, tokenArtifact.abi, provider);
  const [tName, tSymbol, tSupply, tDecimals] = await Promise.all([
    tokenRead.name(), tokenRead.symbol(), tokenRead.totalSupply(), tokenRead.decimals(),
  ]);
  const deployerBal = await tokenRead.balanceOf(wallet.address);
  console.log(`  verified: name=${tName} symbol=${tSymbol} decimals=${tDecimals} totalSupply=${ethers.formatUnits(tSupply, tDecimals)} deployerBalance=${ethers.formatUnits(deployerBal, tDecimals)}`);
  if (tName !== 'Deco Token' || tSymbol !== 'DECO' || tSupply !== 1000000n * 10n ** 18n) {
    throw new Error('DecoToken verification mismatch');
  }
  results.erc20 = { address: token.address, txHash: token.txHash, gasUsed: token.receipt.gasUsed.toString() };

  // ERC721
  const nftFactory = new ethers.ContractFactory(nftArtifact.abi, nftArtifact.bytecode, wallet);
  const nft = await deployWithRetry(nftFactory, 'DecoNFT ERC721');
  console.log(`  DecoNFT deployed at ${nft.address} (gas used: ${nft.receipt.gasUsed})`);
  const nftCode = await provider.getCode(nft.address);
  if (nftCode === '0x') throw new Error('DecoNFT: no code at deployed address');
  const nftRead = new ethers.Contract(nft.address, nftArtifact.abi, provider);
  const [nName, nSymbol] = await Promise.all([nftRead.name(), nftRead.symbol()]);
  console.log(`  verified: name=${nName} symbol=${nSymbol}`);
  if (nName !== 'Deco NFT' || nSymbol !== 'DNFT') throw new Error('DecoNFT verification mismatch');
  results.erc721 = { address: nft.address, txHash: nft.txHash, gasUsed: nft.receipt.gasUsed.toString() };

  // Proof-of-mint: 1 NFT to the burner
  if (!skipMint) {
    const nftWrite = new ethers.Contract(nft.address, nftArtifact.abi, wallet);
    const mintTx = await nftWrite.mint(wallet.address);
    console.log(`  mint tx ${mintTx.hash} ...`);
    const mintReceipt = await mintTx.wait();
    const nftBal = await nftRead.balanceOf(wallet.address);
    const owner1 = await nftRead.ownerOf(1);
    console.log(`  minted token #1 to burner (gas used: ${mintReceipt.gasUsed}); burner NFT balance=${nftBal}; ownerOf(1)=${owner1}`);
    if (owner1.toLowerCase() !== wallet.address.toLowerCase()) throw new Error('Mint verification mismatch');
    results.mint = { tokenId: 1, txHash: mintTx.hash, gasUsed: mintReceipt.gasUsed.toString() };
  }

  const endBalance = await provider.getBalance(wallet.address);
  results.gasSpentNative = ethers.formatEther(balance - endBalance);
  console.log(`  gas spent this chain: ${results.gasSpentNative} ${cfg.gasSymbol}`);
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const chainArg = (args.find((a) => a.startsWith('--chain=')) || '').split('=')[1];
  const skipMint = args.includes('--skip-mint');
  const selected = chainArg ? [chainArg] : Object.keys(CHAINS);
  for (const k of selected) {
    if (!CHAINS[k]) { console.error(`Unknown chain: ${k}`); process.exit(2); }
  }
  const pk = loadEvmPrivateKey();
  console.log(`Burner wallet: ${EXPECTED_ADDRESS} (key verified against keystore)`);

  const allResults = {};
  let failures = 0;
  for (const k of selected) {
    try {
      allResults[k] = await deployChain(k, CHAINS[k], pk, skipMint);
    } catch (e) {
      failures++;
      console.error(`FAILED ${CHAINS[k].label}: ${e.message}`);
      allResults[k] = { error: e.message };
    }
  }
  fs.writeFileSync(path.join(DIR, 'deploy-results.json'), JSON.stringify(allResults, null, 2) + '\n');
  console.log('\nResults written to deploy-results.json');
  if (failures) { console.error(`${failures} chain(s) failed.`); process.exit(1); }
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
