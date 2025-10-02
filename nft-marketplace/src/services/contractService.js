import { ethers } from 'ethers';
import mintingConfig from '../config/mintingConfig.json';

const { contract } = mintingConfig;
const CONTRACT_ADDRESS = contract?.address ?? ethers.constants.AddressZero;

const CONTRACT_ABI = [
  'function publicMint(uint256 quantity) external payable',
  'function whitelistMint(uint256 quantity, bytes32[] calldata merkleProof) external payable',
  'function freeMint(uint256 quantity, bytes32[] calldata merkleProof) external',
  'function saleState() external view returns (uint8)',
  'function publicPrice() external view returns (uint256)',
  'function whitelistPrice() external view returns (uint256)',
  'function remainingSupply() external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function MAX_SUPPLY() external view returns (uint256)',
  'function freeMintRemaining() external view returns (uint256)',
  'function getWalletMintStats(address account) external view returns (uint256 whitelistMinted, uint256 publicMinted, uint256 freeMinted, uint256 freeMintAllowance, bool holdsPartnerToken)',
  'function walletOfOwner(address owner) external view returns (uint256[] memory)'
];

const SALE_STATES = ['CLOSED', 'WHITELIST', 'PUBLIC'];

export class ContractService {
  constructor(provider, signer) {
    this.provider = provider;
    this.signer = signer;
    this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    this.readOnlyContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  }

  static getConfig() {
    return mintingConfig;
  }

  async getTotalSupply() {
    return this.readOnlyContract.totalSupply();
  }

  async getMaxSupply() {
    return this.readOnlyContract.MAX_SUPPLY();
  }

  async getRemainingSupply() {
    return this.readOnlyContract.remainingSupply();
  }

  async getFreeMintRemaining() {
    return this.readOnlyContract.freeMintRemaining();
  }

  async getPublicPrice() {
    return this.readOnlyContract.publicPrice();
  }

  async getWhitelistPrice() {
    return this.readOnlyContract.whitelistPrice();
  }

  async getSaleState() {
    const stateIndex = await this.readOnlyContract.saleState();
    return SALE_STATES[stateIndex];
  }

  async getWalletMintStats(address) {
    const stats = await this.readOnlyContract.getWalletMintStats(address);
    return {
      whitelistMinted: stats.whitelistMinted,
      publicMinted: stats.publicMinted,
      freeMinted: stats.freeMinted,
      freeMintAllowance: stats.freeMintAllowance,
      holdsPartnerToken: stats.holdsPartnerToken
    };
  }

  async getWalletTokens(address) {
    return this.readOnlyContract.walletOfOwner(address);
  }

  async publicMint(quantity, options = {}) {
    const price = await this.getPublicPrice();
    const totalCost = price.mul(quantity);
    return this.contract.publicMint(quantity, {
      value: totalCost,
      ...options
    });
  }

  async whitelistMint(quantity, merkleProof, options = {}) {
    const price = await this.getWhitelistPrice();
    const totalCost = price.mul(quantity);
    return this.contract.whitelistMint(quantity, merkleProof, {
      value: totalCost,
      ...options
    });
  }

  async freeMint(quantity, merkleProof) {
    return this.contract.freeMint(quantity, merkleProof);
  }

  formatEther(wei) {
    return ethers.utils.formatEther(wei);
  }

  parseEther(ether) {
    return ethers.utils.parseEther(ether);
  }

  async estimateGas(functionName, ...args) {
    return this.contract.estimateGas[functionName](...args);
  }
}

export default ContractService;
