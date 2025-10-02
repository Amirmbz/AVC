const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting deployment to Abstract blockchain...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(balance)); // Fixed: removed .utils

  // Contract parameters
  const NAME = "Abstract NFT Collection";
  const SYMBOL = "ANC";
  const HIDDEN_METADATA_URI = "ipfs://QmYourHiddenMetadataHash/hidden.json";
  const CONTRACT_METADATA_URI = "ipfs://QmYourContractMetadataHash/contract.json";
  const MERKLE_ROOT = "0x0000000000000000000000000000000000000000000000000000000000000000"; // Replace with actual merkle root

  // Deploy the contract
  const AbstractNFTCollection = await ethers.getContractFactory("AbstractNFTCollection");
  const contract = await AbstractNFTCollection.deploy(
    NAME,
    SYMBOL,
    HIDDEN_METADATA_URI,
    CONTRACT_METADATA_URI,
    MERKLE_ROOT
  );

  await contract.waitForDeployment(); // Fixed: replaced .deployed()

  const contractAddress = await contract.getAddress(); // Fixed: get address in v6
  const deployTransaction = contract.deploymentTransaction(); // Fixed: get deployment transaction

  console.log("Contract deployed to:", contractAddress);
  console.log("Transaction hash:", deployTransaction?.hash);

  // Save deployment info
  const deploymentInfo = {
    contractAddress: contractAddress,
    contractName: NAME,
    contractSymbol: SYMBOL,
    network: hre.network.name,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    transactionHash: deployTransaction?.hash,
  };

  const deploymentPath = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(deploymentPath, `${hre.network.name}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("Deployment info saved to:", path.join(deploymentPath, `${hre.network.name}.json`));

  // Wait for a few block confirmations before verification
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    if (deployTransaction) {
      await deployTransaction.wait(5);
    }

    // Verify the contract
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [
          NAME,
          SYMBOL,
          HIDDEN_METADATA_URI,
          CONTRACT_METADATA_URI,
          MERKLE_ROOT,
        ],
      });
      console.log("Contract verified successfully");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }

  console.log("Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });