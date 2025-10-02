const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const fs = require('fs');

// Your whitelist addresses
const whitelistAddresses = [
  "0x1234567890123456789012345678901234567890",
  "0x2345678901234567890123456789012345678901",
  "0x3456789012345678901234567890123456789012",
  // Add more addresses...
];

function generateMerkleTree(addresses) {
  // Create leaf nodes from addresses
  const leafNodes = addresses.map(addr => keccak256(addr));
  
  // Create merkle tree
  const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
  
  // Get merkle root
  const rootHash = merkleTree.getRoot();
  
  console.log('Merkle Root:', '0x' + rootHash.toString('hex'));
  
  // Generate proofs for each address
  const whitelist = {};
  addresses.forEach(address => {
    const leaf = keccak256(address);
    const proof = merkleTree.getHexProof(leaf);
    whitelist[address.toLowerCase()] = proof;
  });
  
  // Save whitelist to file
  const whitelistData = {
    merkleRoot: '0x' + rootHash.toString('hex'),
    whitelist: whitelist
  };
  
  fs.writeFileSync('whitelist.json', JSON.stringify(whitelistData, null, 2));
  console.log('Whitelist saved to whitelist.json');
  
  return whitelistData;
}

// Generate the merkle tree and whitelist
generateMerkleTree(whitelistAddresses);

// package.json dependencies
const packageJson = {
  "name": "abstract-nft-platform",
  "version": "1.0.0",
  "description": "NFT minting platform for Abstract blockchain",
  "scripts": {
    "compile": "hardhat compile",
    "deploy:testnet": "hardhat run scripts/deploy.js --network abstract_testnet",
    "deploy:mainnet": "hardhat run scripts/deploy.js --network abstract_mainnet",
    "setup": "hardhat run scripts/setup.js --network abstract_testnet",
    "generate-whitelist": "node scripts/whitelist-generator.js",
    "verify": "hardhat verify --network abstract_testnet",
    "dev": "npm run dev --prefix frontend",
    "build": "npm run build --prefix frontend"
  },
  "devDependencies": {
    "@nomiclabs/hardhat-ethers": "^2.2.3",
    "@nomiclabs/hardhat-etherscan": "^3.1.7",
    "@openzeppelin/contracts": "^4.9.3",
    "dotenv": "^16.3.1",
    "hardhat": "^2.17.1",
    "merkletreejs": "^0.3.10",
    "keccak256": "^1.0.6"
  },
  "dependencies": {
    "ethers": "^6.8.0"
  }
};

console.log("\n=== Package.json content ===");
console.log(JSON.stringify(packageJson, null, 2));