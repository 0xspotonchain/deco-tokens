// Velana Testnet Points status check (read-only).
// Fetches https://velanachain.com/points/points.json and prints the burner's
// points, rank and completed tasks. Run after each sweep task (the indexer
// rebuilds the JSON every ~2 min, so wait a few minutes after a tx).
const BURNER = '0xf1d949ed9b0b62508203ab0b91bf01e73309ad31';

async function main() {
  const r = await fetch('https://velanachain.com/points/points.json', { cache: 'no-store' });
  if (!r.ok) throw new Error(`points.json HTTP ${r.status}`);
  const d = await r.json();
  const a = d.addresses[BURNER];
  console.log(`points.json generated ${d.generatedAt} | indexedTo block ${d.indexedTo} | ${d.participants} participants | complete=${d.complete}`);
  if (!a) { console.log('burner not ranked yet'); return; }
  console.log(`burner: ${a.p} points | rank ${a.r ? '#' + a.r : '—'} | tasks: ${a.t.join(', ') || '(none)'}${a.tier !== undefined ? ` | tier ${a.tier} (${(d.tierNames || [])[a.tier] || '?'})` : ''}`);
  const me = d.leaderboard.find((x) => x.address.toLowerCase() === BURNER);
  if (me) console.log(`leaderboard row: rank #${me.rank}, ${me.points} pts`);
  const next = d.leaderboard.find((x) => x.rank === (a.r || 0) + 1);
  if (next) console.log(`next below: #${next.rank} ${next.address} ${next.points} pts`);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
