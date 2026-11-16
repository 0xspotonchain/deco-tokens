# deco testnet tokens

ERC20 "Deco Token" (DECO) + ERC721 "Deco NFT" (DNFT), deployed from the burner
wallet on Arc Testnet, Robinhood Chain Testnet, and LitVM LiteForge testnet.
See `deployments.md` for addresses, tx hashes, and explorer links.

## Layout

- `contracts/DecoToken.sol` — fixed 1,000,000 supply, minted to deployer.
- `contracts/DecoNFT.sol` — public `mint(address)`, owner `setTokenURI`.
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
