require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();


module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    abstract_testnet: {
      url: process.env.ABSTRACT_TESTNET_RPC || "https://api.testnet.abstract.network/",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11124, // Abstract testnet chain ID (replace with actual)
    },
    abstract_mainnet: {
      url: process.env.ABSTRACT_MAINNET_RPC || "https://api.abstract.network/",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11123, // Abstract mainnet chain ID (replace with actual)
    },
  },
  etherscan: {
    apiKey: {
      abstract_testnet: process.env.ABSTRACT_API_KEY || "",
      abstract_mainnet: process.env.ABSTRACT_API_KEY || "",
    },
    customChains: [
      {
        network: "abstract_testnet",
        chainId: 11124,
        urls: {
          apiURL: "https://api-testnet.abstract.network/api",
          browserURL: "https://explorer-testnet.abstract.network/",
        },
      },
      {
        network: "abstract_mainnet",
        chainId: 11123,
        urls: {
          apiURL: "https://api.abstract.network/api",
          browserURL: "https://explorer.abstract.network/",
        },
      },
    ],
  },
};