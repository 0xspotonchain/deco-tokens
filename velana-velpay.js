// Velana points task 3 — VEL PAY PAYMENT (+25).
// Creates a Vel Pay testnet payment request with the burner as merchant,
// then pays it with the burner as payer (0.1 tVELA). Net cost ~zero
// (merchant = payer = burner) plus gas. The Paid event names the burner
// as payer, which is what the points indexer watches.
// Vel Pay is server-mediated (see pay-testnet.js): the server prepares
// calldata, the wallet signs it, the server verifies receipts. No keys
// ever touch the server — the VM keystore signs locally.
// Flow: POST /api/prepare -> send create tx -> POST /api/requests ->
// GET pay page (pay tx embedded in #paybtn data-tx) -> send pay tx ->
// POST /api/requests/<id>/tx -> verify status "paid".
// Velana testnet only (chain 484148), legacy type-0 txs.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { loadBurnerWallet } = require(path.join(__dirname, '..', 'sniper', 'keystore'));

const RPC = 'https://velanachain.com/rpc';
const CHAIN_ID = 484148;
const BURNER = '0xF1d949ed9B0b62508203AB0B91Bf01E73309Ad31';
const PAY_BASE = 'https://velanachain.com/pay';
const AMOUNT = '0.1';
const MEMO = 'DECO test payment';
const EXPIRES_MIN = '60';
const EXPLORER = 'https://velanachain.com/explorer/#/tx/';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function api(method, url, data) {
  const r = await fetch(PAY_BASE + url, {
    method,
    headers: { 'content-type': 'application/json', 'user-agent': UA },
    body: data ? JSON.stringify(data) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Vel Pay API ${method} ${url} -> HTTP ${r.status}: ${json.error || JSON.stringify(json)}`);
  return json;
}

function parsePayTx(html) {
  const m = html.match(/id="paybtn"[^>]*data-tx="([^"]*)"/) || html.match(/data-tx="([^"]*)"[^>]*id="paybtn"/);
  if (!m) throw new Error('No #paybtn data-tx found on the pay page (request may have expired or the page shape changed).');
  const raw = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return JSON.parse(raw);
}

async function main() {
  const req = new ethers.FetchRequest(RPC);
  req.timeout = 60000;
  const provider = new ethers.JsonRpcProvider(req, CHAIN_ID, { staticNetwork: true });
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== CHAIN_ID) throw new Error(`Wrong chain: ${net.chainId}`);
  const wallet = loadBurnerWallet(provider);
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? 7n;

  // 1. Prepare the request.
  const prep = await api('POST', '/api/prepare', { amount: AMOUNT, memo: MEMO, expiresInMinutes: EXPIRES_MIN, merchant: BURNER });
  console.log(`prepared request ${prep.id} (memo: ${prep.memo})`);
  console.log(`create tx: to ${prep.tx.to}, value ${prep.tx.value}, data ${String(prep.tx.data || '').slice(0, 66)}...`);
  const createValue = prep.tx.value ? BigInt(prep.tx.value) : 0n;

  // 2. Send the create tx.
  const createTx = await wallet.sendTransaction({ to: prep.tx.to, data: prep.tx.data, value: createValue, type: 0, gasPrice });
  console.log(`create tx ${createTx.hash} ...`);
  const r1 = await createTx.wait();
  if (!r1 || r1.status !== 1) throw new Error(`Create tx reverted (${createTx.hash})`);
  console.log(`create confirmed in block ${r1.blockNumber} (gas ${r1.gasUsed})`);

  // 3. Register the request with the server.
  const saved = await api('POST', '/api/requests', { id: prep.id, memo: prep.memo, txHash: createTx.hash });
  console.log(`request saved: ${saved.id} (status ${saved.status})`);
  const pageUrl = `${PAY_BASE}/${saved.id}`;

  // 4. Fetch the pay page and extract the prepared pay tx.
  const pageRes = await fetch(pageUrl, { headers: { 'user-agent': UA } });
  if (!pageRes.ok) throw new Error(`Pay page HTTP ${pageRes.status}`);
  const payTx = parsePayTx(await pageRes.text());
  console.log(`pay tx: to ${payTx.to}, value ${payTx.value}`);
  const payValue = payTx.value ? BigInt(payTx.value) : 0n;
  if (payValue !== ethers.parseEther(AMOUNT)) {
    console.log(`WARNING: pay value ${ethers.formatEther(payValue)} != requested ${AMOUNT} — proceeding only if it matches the request amount.`);
    throw new Error('Pay tx value mismatch — refusing to pay the wrong amount.');
  }

  // 5. Pay it (burner pays itself as merchant).
  const pay = await wallet.sendTransaction({ to: payTx.to, data: payTx.data, value: payValue, type: 0, gasPrice });
  console.log(`pay tx ${pay.hash} ...`);
  const r2 = await pay.wait();
  if (!r2 || r2.status !== 1) throw new Error(`Pay tx reverted (${pay.hash})`);
  console.log(`pay confirmed in block ${r2.blockNumber} (gas ${r2.gasUsed})`);

  // 6. Record the payment with the server and verify.
  await api('POST', `/api/requests/${saved.id}/tx`, { txHash: pay.hash });
  await new Promise((res) => setTimeout(res, 3000));
  const final = await api('GET', `/api/requests/${saved.id}`);
  console.log(`request status now: ${final.status}`);
  if (final.status !== 'paid') throw new Error(`Request status is "${final.status}", not "paid" — check ${pageUrl}`);

  const out = {
    task: 'velpay', points: 25, requestId: saved.id, amount: AMOUNT, memo: MEMO,
    merchant: BURNER, payer: BURNER, velPayContract: payTx.to,
    createTx: createTx.hash, payTx: pay.hash, payBlock: r2.blockNumber,
    pageUrl, explorer: EXPLORER + pay.hash, at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(__dirname, 'velana-velpay.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`VEL PAY DONE: paid ${AMOUNT} tVELA to self via request ${saved.id}, pay tx ${EXPLORER}${pay.hash}`);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
