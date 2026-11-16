// Verify the Circle wallet's NFTs on Arc Testnet. READ-ONLY (eth_call sims).
// - DNAME #4 ("circle"): soulbound — transferFrom/approve/setApprovalForAll
//   simulated FROM the Circle wallet must revert with the soulbound errors.
// - DNAME #4 tokenURI decodes to "Deco Name #4 — circle".
// - DNFT #2: owner + metadata name check.
// Usage: node circle-verify-nfts.js
const { ethers } = require('ethers');

const RPC = 'https://rpc.testnet.arc.io';
const CIRCLE = '0xc7d81269debced5e62069a4d42950965853aa300';
const BURNER = '0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31';
const NAME_TOKEN = '0x553c4212254DA568FdDc5Cc312318bB6c0fBB0E4';
const DNFT = '0xDf8A3BaAFffc5de3938bff1158584E841531BcbF';

const NT_ABI = [
  'function ownerOf(uint256) view returns (address)',
  'function balanceOf(address) view returns (uint256)',
  'function tokenURI(uint256) view returns (string)',
  'function transferFrom(address,address,uint256)',
  'function approve(address,uint256)',
  'function setApprovalForAll(address,bool)',
  'error SoulboundTransferBlocked(uint256 tokenId)',
  'error SoulboundApprovalsDisabled()',
];

async function expectRevert(label, fn, expectedSelector) {
  try {
    await fn();
    console.log(`  ${label}: DID NOT REVERT — UNEXPECTED`);
    return { method: label, reverted: false };
  } catch (e) {
    const msg = e.message || '';
    const data = (e.info && e.info.error && e.info.error.data) || e.data || '';
    const hit = msg.includes(expectedSelector) || String(data).startsWith(expectedSelector);
    // Decode the selector from the revert data if present.
    let selector = '';
    const m = msg.match(/data="(0x[0-9a-fA-F]{8})/) || String(data).match(/^(0x[0-9a-fA-F]{8})/);
    if (m) selector = m[1];
    console.log(`  ${label}: reverted ${hit || selector ? `(selector ${selector || 'n/a'}, expect ${expectedSelector})` : ''} — ${msg.slice(0, 120)}`);
    return { method: label, reverted: true, selector, expectedSelector, match: selector.toLowerCase() === expectedSelector.toLowerCase() };
  }
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const nt = new ethers.Contract(NAME_TOKEN, NT_ABI, provider);
  const selTransfer = ethers.id('SoulboundTransferBlocked(uint256)').slice(0, 10);
  const selApprove = ethers.id('SoulboundApprovalsDisabled()').slice(0, 10);
  console.log('SoulboundTransferBlocked selector:', selTransfer);
  console.log('SoulboundApprovalsDisabled selector:', selApprove);

  console.log('\nDNAME #4 state:');
  console.log('  ownerOf(4):', await nt.ownerOf(4));
  console.log('  Circle DNAME balance:', (await nt.balanceOf(CIRCLE)).toString());
  const uri = await nt.tokenURI(4);
  const json = JSON.parse(Buffer.from(uri.replace('data:application/json;base64,', ''), 'base64').toString('utf8'));
  console.log('  tokenURI name:', JSON.stringify(json.name), '| svg contains "circle":', Buffer.from(json.image.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf8').includes('circle'));

  console.log('\nSoulbound simulations (from Circle, eth_call — nothing sent):');
  const results = [];
  results.push(await expectRevert('transferFrom', () => nt.transferFrom.staticCall(CIRCLE, BURNER, 4, { from: CIRCLE }), selTransfer));
  results.push(await expectRevert('approve', () => nt.approve.staticCall(BURNER, 4, { from: CIRCLE }), selApprove));
  results.push(await expectRevert('setApprovalForAll', () => nt.setApprovalForAll.staticCall(BURNER, true, { from: CIRCLE }), selApprove));

  const dnft = new ethers.Contract(DNFT, [
    'function ownerOf(uint256) view returns (address)',
    'function tokenURI(uint256) view returns (string)',
  ], provider);
  console.log('\nDNFT #2 state:');
  console.log('  ownerOf(2):', await dnft.ownerOf(2));
  const uri2 = await dnft.tokenURI(2);
  const json2 = JSON.parse(Buffer.from(uri2.replace('data:application/json;base64,', ''), 'base64').toString('utf8'));
  console.log('  tokenURI name:', JSON.stringify(json2.name), '| minter attr:', JSON.stringify(json2.attributes.find((a) => a.trait_type === 'Minter')));

  const allOk = results.every((r) => r.reverted && r.match);
  console.log('\nSoulbound checks all match expected errors:', allOk);
  if (!allOk) process.exit(1);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
