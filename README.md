# deco testnet tokens

ERC20 "Deco Token" (DECO) + ERC721 "Deco NFT" (DNFT), deployed from the burner
wallet on Arc Testnet, Robinhood Chain Testnet, and LitVM LiteForge testnet.
See `deployments.md` for addresses, tx hashes, and explorer links.

## DECO MUSE (DM)

ERC20 "DECO MUSE" (DM) — mintable + burnable, 100T initial supply — deployed
from the Circle agent wallet on Arc Testnet (deployed with the Circle CLI,
`circle contract deploy`).

- Contract: `0x104a92386b4a7ddbfb35214b72ddbb8ed0134438` (Arc Testnet, chain 5042002)
- Deploy tx: `0x5170d66177252adb9e835546d28b534c0bd780f3af10473614d67f22edfd17f7`
- Owner: the Circle wallet `0xc7d81269debced5e62069a4d42950965853aa300`
- `contracts/DecoMuseToken.sol` — OpenZeppelin ERC20 + ERC20Burnable + Ownable.
  The owner is passed as an explicit constructor argument because the Circle
  agent wallet is a smart-contract account: deploys run through a factory via
  a bundler, so `msg.sender` in the constructor is the factory, not the wallet.
- Logo: `dm-logo.svg` / `dm-logo-256.png` / `dm-logo-512.png`

## Layout

- `contracts/DecoToken.sol` — fixed 1,000,000 supply, minted to deployer.
- `contracts/DecoNFT.sol` — public `mint(address)`, owner `setTokenURI`.
- `contracts/DecoMuseToken.sol` — DECO MUSE (DM), mintable + burnable, owner-only mint.
- `compile.js` — compiles with solc-js (OpenZeppelin v5.6.1, solc 0.8.38).
- `deploy.js` — deploys both contracts + mints NFT #1 per chain. Hard
  testnet-only guard (chain IDs 5042002, 46630, 4441 only). Key decrypted
  in-memory from the VM keystore, never printed or logged.
- `build/` — ABIs + bytecode. `deploy-results.json` — raw deploy output.

## Re-run

```sh
node compile.js
node deploy.js                  # all three chains
node deploy.js --chain=arc      # one chain (arc | robinhood | litvm)
```

A re-deploy creates NEW contract addresses (the burner nonce has advanced).

## Credits

Name service, soulbound name NFTs and SimpleAMM pools are modeled on our friend [0xzunid](https://github.com/0xzunid)'s approach ([0xzunid.muse](https://0xzunid.github.io/0xzunid.muse.ai/)) — credit where it's due.

## Built with

Built with [Muse](https://muse.ai) — deco's AI agent.
