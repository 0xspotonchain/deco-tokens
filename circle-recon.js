// Recon for the Circle-wallet stack mirror on Arc Testnet. READ-ONLY.
// Usage: node circle-recon.js
// Checks: Circle balances (native USDC 18-dec, USDC view 6-dec, DM, EURC view),
// gas price, whether the Circle SCA implements onERC721Received (decides the
// NFT paths), name-service owner + "circle" availability, DNFT next token id.
const { ethers } = require('ethers');

const RPC = 'https://rpc.testnet.arc.io';
const CIRCLE = '0xc7d81269debced5e62069a4d42950965853aa300';
const BURNER = '0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31';
const DM = '0x104a92386b4a7ddbfb35214b72ddbb8ed0134438';
const USDC_VIEW = '0x3600000000000000000000000000000000000000'; // 6 dec
const DNFT = '0xDf8A3BaAFffc5de3938bff1158584E841531BcbF';
const REGISTRY = '0x9d1217DD428440ef49C59CCa2085aF6bd7A7a5b6';
const NAME_TOKEN = '0x553c4212254DA568FdDc5Cc312318bB6c0fBB0E4';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function allowance(address,address) view returns (uint256)',
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const net = await provider.getNetwork();
  console.log('chainId:', net.chainId.toString(), net.chainId === 5042002n ? '(Arc Testnet OK)' : 'MISMATCH — ABORT');
  if (net.chainId !== 5042002n) process.exit(1);

  const fee = await provider.getFeeData();
  const gp = fee.gasPrice ?? fee.maxFeePerGas;
  console.log('gas price:', gp ? `${ethers.formatUnits(gp, 'gwei')} gwei` : 'n/a');

  // --- Circle balances ---
  const nativeBal = await provider.getBalance(CIRCLE);
  console.log('\nCircle native USDC (18 dec):', ethers.formatUnits(nativeBal, 18));
  const usdcView = new ethers.Contract(USDC_VIEW, ERC20_ABI, provider);
  console.log('USDC view decimals:', await usdcView.decimals(), '| symbol:', await usdcView.symbol());
  const viewBal = await usdcView.balanceOf(CIRCLE);
  console.log('Circle USDC view (6 dec):', ethers.formatUnits(viewBal, 6));
  const dm = new ethers.Contract(DM, ERC20_ABI, provider);
  console.log('Circle DM (18 dec):', ethers.formatUnits(await dm.balanceOf(CIRCLE), 18));
  console.log('Circle DM allowance to burner pool (sanity):', ethers.formatUnits(await dm.allowance(CIRCLE, '0x3137C615F3f3B1e7C8F75390F8ccb128f4D11A3A'), 18));

  // --- ERC721 receiver probe: does the Circle SCA implement onERC721Received? ---
  // onERC721Received(address,address,uint256,bytes) selector 0x150b7a02.
  // A compliant receiver returns 0x150b7a02. Anything else (revert/empty/other)
  // means _safeMint to this account will revert.
  const iface = new ethers.Interface(['function onERC721Received(address,address,uint256,bytes) returns (bytes4)']);
  const data = iface.encodeFunctionData('onERC721Received', [BURNER, BURNER, 1, '0x']);
  try {
    const ret = await provider.call({ to: CIRCLE, data });
    console.log('\nonERC721Received probe returned:', ret);
    console.log('implements ERC721Receiver:', ret.toLowerCase().startsWith('0x150b7a02') ? 'YES' : 'NO (return is not the magic value)');
  } catch (e) {
    console.log('\nonERC721Received probe REVERTED:', e.message.slice(0, 200));
    console.log('implements ERC721Receiver: NO (call reverts)');
  }
  const code = await provider.getCode(CIRCLE);
  console.log('Circle wallet code size:', code === '0x' ? '0 (not deployed?)' : `${(code.length - 2) / 2} bytes`);

  // --- Name service state ---
  const reg = new ethers.Contract(REGISTRY, [
    'function owner() view returns (address)',
    'function resolve(string) view returns (address)',
  ], provider);
  console.log('\nRegistry owner:', await reg.owner(), '(burner:', BURNER, ')');
  console.log('resolve("circle"):', await reg.resolve('circle'), '(zero = available)');
  console.log('resolve("deco"):', await reg.resolve('deco'));
  const nt = new ethers.Contract(NAME_TOKEN, [
    'function owner() view returns (address)',
    'function tokenIdForName(string) view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
  ], provider);
  console.log('NameToken owner:', await nt.owner());
  console.log('tokenIdForName("circle"):', (await nt.tokenIdForName('circle')).toString(), '(0 = not minted)');
  console.log('Circle DNAME balance:', (await nt.balanceOf(CIRCLE)).toString());

  // --- DNFT state ---
  const dnft = new ethers.Contract(DNFT, [
    'function owner() view returns (address)',
    'function nextTokenId() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
  ], provider);
  console.log('\nDNFT owner:', await dnft.owner());
  console.log('DNFT nextTokenId:', (await dnft.nextTokenId()).toString());
  console.log('Circle DNFT balance:', (await dnft.balanceOf(CIRCLE)).toString());
  console.log('Burner DNFT balance:', (await dnft.balanceOf(BURNER)).toString());
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
