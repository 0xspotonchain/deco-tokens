// Compile DecoToken + DecoNFT with solc-js. Writes ABIs + bytecode to build/.
// Usage: node compile.js
const fs = require('fs');
const path = require('path');
const solc = require('solc');

const DIR = __dirname;
const CONTRACTS_DIR = path.join(DIR, 'contracts');
const BUILD_DIR = path.join(DIR, 'build');

function findImports(importPath) {
  // Resolve @openzeppelin/... from local node_modules; relative imports from contracts/.
  try {
    let full;
    if (importPath.startsWith('@')) {
      full = path.join(DIR, 'node_modules', importPath);
    } else {
      full = path.join(CONTRACTS_DIR, importPath);
    }
    return { contents: fs.readFileSync(full, 'utf8') };
  } catch (e) {
    return { error: 'Import not found: ' + importPath };
  }
}

function main() {
  const sources = {};
  for (const file of fs.readdirSync(CONTRACTS_DIR)) {
    if (file.endsWith('.sol')) {
      sources[file] = { content: fs.readFileSync(path.join(CONTRACTS_DIR, file), 'utf8') };
    }
  }
  const input = {
    language: 'Solidity',
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const errors = (output.errors || []).filter((e) => e.severity === 'error');
  if (errors.length) {
    for (const e of errors) console.error(e.formattedMessage);
    process.exit(1);
  }
  for (const w of (output.errors || []).filter((e) => e.severity === 'warning')) {
    console.error('warning: ' + w.formattedMessage);
  }
  fs.mkdirSync(BUILD_DIR, { recursive: true });
  for (const [source, contracts] of Object.entries(output.contracts)) {
    for (const [name, c] of Object.entries(contracts)) {
      const artifact = {
        contractName: name,
        sourceName: source,
        abi: c.abi,
        bytecode: '0x' + c.evm.bytecode.object,
        deployedBytecode: '0x' + c.evm.deployedBytecode.object,
      };
      fs.writeFileSync(path.join(BUILD_DIR, name + '.json'), JSON.stringify(artifact, null, 2) + '\n');
      console.log(`compiled ${name} (${source}) — bytecode ${c.evm.bytecode.object.length / 2} bytes`);
    }
  }
  console.log('solc version:', solc.version());
}

main();
