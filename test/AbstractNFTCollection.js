const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AbstractNFTCollection", function () {
  it("Should deploy and return correct name and symbol", async function () {
    const AbstractNFT = await ethers.getContractFactory("AbstractNFTCollection");
    const nft = await AbstractNFT.deploy(
      "Test NFT",
      "TNFT",
      "ipfs://hidden/",
      "ipfs://contract/",
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
    await nft.deployed();

    expect(await nft.name()).to.equal("Test NFT");
    expect(await nft.symbol()).to.equal("TNFT");
  });
});
