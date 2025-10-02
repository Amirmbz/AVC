const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0x029451F71d60271568B7F86928a840aad4EC5433"; // Replace with your deployed contract address
  
  const [owner] = await ethers.getSigners();
  console.log("Setting up contract with account:", owner.address);

  // Get contract instance
  const AbstractNFTCollection = await ethers.getContractFactory("AbstractNFTCollection");
  const contract = AbstractNFTCollection.attach(contractAddress);

  console.log("Contract attached at:", contract.address);

  // Setup contract parameters
  try {
    // Set prices (in wei)
    const publicPrice = ethers.utils.parseEther("0.01"); // 0.01 ETH
    const whitelistPrice = ethers.utils.parseEther("0.008"); // 0.008 ETH
    
    console.log("Setting prices...");
    const priceTx = await contract.setPrices(publicPrice, whitelistPrice);
    await priceTx.wait();
    console.log("Prices set successfully");

    // Set base URI (update when revealed)
    // const baseURI = "ipfs://QmYourRevealedMetadataHash/";
    // console.log("Setting base URI...");
    // const uriTx = await contract.setBaseURI(baseURI);
    // await uriTx.wait();
    // console.log("Base URI set successfully");

    // Update merkle root if needed
    const newMerkleRoot = "0x1234567890abcdef..."; // Replace with actual merkle root
    console.log("Setting merkle root...");
    const merkleRootTx = await contract.setMerkleRoot(newMerkleRoot);
    await merkleRootTx.wait();
    console.log("Merkle root set successfully");

    // Set sale state (0: CLOSED, 1: WHITELIST, 2: PUBLIC)
    console.log("Setting sale state to WHITELIST...");
    const saleStateTx = await contract.setSaleState(1); // Start with whitelist
    await saleStateTx.wait();
    console.log("Sale state set to WHITELIST");

    console.log("Contract setup completed successfully!");

  } catch (error) {
    console.error("Setup failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });