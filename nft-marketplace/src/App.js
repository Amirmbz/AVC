import './App.css';
import React, { useState, useEffect, createContext, useContext } from 'react';
import { ethers } from 'ethers';
import MintingInterface from './MintingInterface';


// Import MintingInterface (you'll create this as a separate component)
// import MintingInterface from './MintingInterface';

// Create Web3 Context
const Web3Context = createContext();

// Web3 Provider Component
export const Web3Provider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [balance, setBalance] = useState('0');

  // Abstract Network Configuration
  const ABSTRACT_TESTNET = {
    chainId: '0x2B6C', // 11124 in hex
    chainName: 'Abstract Testnet',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://api.testnet.abs.xyz'],
    blockExplorerUrls: ['https://explorer.testnet.abs.xyz'],
  };

  // Check if wallet is connected on component mount
  useEffect(() => {
    checkConnection();
    setupEventListeners();
  }, []);

  // Update balance when account changes
  useEffect(() => {
    if (account && provider) {
      updateBalance();
    }
  }, [account, provider]);

  const checkConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const accounts = await provider.listAccounts();
        
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setProvider(provider);
          setSigner(provider.getSigner());
          
          const network = await provider.getNetwork();
          setChainId(network.chainId);
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    }
  };

  const setupEventListeners = () => {
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      disconnect();
    } else {
      setAccount(accounts[0]);
    }
  };

  const handleChainChanged = (chainId) => {
    setChainId(parseInt(chainId, 16));
    window.location.reload(); // Recommended by MetaMask
  };

  const updateBalance = async () => {
    try {
      const balance = await provider.getBalance(account);
      setBalance(ethers.utils.formatEther(balance));
    } catch (error) {
      console.error('Error updating balance:', error);
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask or another Web3 wallet');
      return;
    }

    setIsConnecting(true);

    try {
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.listAccounts();
      const network = await provider.getNetwork();

      setAccount(accounts[0]);
      setProvider(provider);
      setSigner(provider.getSigner());
      setChainId(network.chainId);

      // Switch to Abstract network if not already connected
      if (network.chainId !== 11124) {
        await switchToAbstract();
      }

    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const switchToAbstract = async () => {
    try {
      // Try to switch to Abstract network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ABSTRACT_TESTNET.chainId }],
      });
    } catch (switchError) {
      // If network doesn't exist, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [ABSTRACT_TESTNET],
          });
        } catch (addError) {
          console.error('Error adding Abstract network:', addError);
          alert('Failed to add Abstract network');
        }
      } else {
        console.error('Error switching to Abstract network:', switchError);
      }
    }
  };

  const disconnect = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setBalance('0');
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const isCorrectNetwork = () => {
    return chainId === 11124; // Abstract testnet
  };

  const value = {
    account,
    provider,
    signer,
    chainId,
    balance,
    isConnecting,
    isConnected: !!account,
    isCorrectNetwork: isCorrectNetwork(),
    connectWallet,
    disconnect,
    switchToAbstract,
    formatAddress,
    updateBalance
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
};

// Custom hook to use Web3 context
export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};

// Wallet Connection Component
const WalletConnection = () => {
  const {
    account,
    balance,
    isConnecting,
    isConnected,
    isCorrectNetwork,
    connectWallet,
    disconnect,
    switchToAbstract,
    formatAddress
  } = useWeb3();

  return (
    <div className="bg-white shadow-lg rounded-lg p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Wallet Connection</h2>
      
      {!isConnected ? (
        <div className="text-center">
          <p className="text-gray-600 mb-4">Connect your wallet to start using the NFT marketplace</p>
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 w-full"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      ) : (
        <div>
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Connected Account</p>
            <p className="font-mono text-lg">{formatAddress(account)}</p>
            <p className="text-sm text-gray-600 mt-2">
              Balance: {parseFloat(balance).toFixed(4)} ETH
            </p>
          </div>

          {!isCorrectNetwork && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm mb-2">
                ⚠️ Please switch to Abstract Testnet
              </p>
              <button
                onClick={switchToAbstract}
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-4 rounded text-sm"
              >
                Switch Network
              </button>
            </div>
          )}

          <button
            onClick={disconnect}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 w-full"
          >
            Disconnect Wallet
          </button>
        </div>
      )}
    </div>
  );
};

// Main App Component
const App = () => {
  const [currentPage, setCurrentPage] = useState('home');

  return (
    <Web3Provider>
      <div className="min-h-screen bg-gray-100">
        {/* Navigation */}
        <nav className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center h-16">
              <h1 className="text-2xl font-bold text-gray-800">NFT Marketplace</h1>
              <div className="flex space-x-4">
                <button
                  onClick={() => setCurrentPage('home')}
                  className={`px-4 py-2 rounded ${currentPage === 'home' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  Home
                </button>
                <button
                  onClick={() => setCurrentPage('mint')}
                  className={`px-4 py-2 rounded ${currentPage === 'mint' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  Mint
                </button>
                <button
                  onClick={() => setCurrentPage('marketplace')}
                  className={`px-4 py-2 rounded ${currentPage === 'marketplace' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  Marketplace
                </button>
              </div>
              <WalletButton />
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          {currentPage === 'home' && <HomePage />}
          {currentPage === 'mint' && <MintingInterface />}
          {currentPage === 'marketplace' && <MarketplacePage />}
        </main>
      </div>
    </Web3Provider>
  );
};

// Wallet Button Component (for navbar)
const WalletButton = () => {
  const { account, isConnected, connectWallet, disconnect, formatAddress } = useWeb3();

  if (!isConnected) {
    return (
      <button
        onClick={connectWallet}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="relative group">
      <button className="bg-green-100 text-green-800 font-semibold py-2 px-4 rounded-lg">
        {formatAddress(account)}
      </button>
      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
        <div className="py-2">
          <button
            onClick={disconnect}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
};

// Home Page Component
const HomePage = () => {
  const { isConnected } = useWeb3();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-gray-800 mb-4">
          Welcome to NFT Marketplace
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Mint, buy, and sell unique NFTs on the Abstract network
        </p>
        {!isConnected && <WalletConnection />}
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-8 mb-12">
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl">🎨</span>
          </div>
          <h3 className="text-xl font-semibold mb-2">Create NFTs</h3>
          <p className="text-gray-600">
            Mint your own unique NFTs with our easy-to-use minting interface
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl">🛒</span>
          </div>
          <h3 className="text-xl font-semibold mb-2">Buy & Sell</h3>
          <p className="text-gray-600">
            Trade NFTs in our secure marketplace with low fees
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl">⚡</span>
          </div>
          <h3 className="text-xl font-semibold mb-2">Fast & Cheap</h3>
          <p className="text-gray-600">
            Built on Abstract for lightning-fast transactions and low gas fees
          </p>
        </div>
      </div>

      {isConnected && <WalletStatus />}
    </div>
  );
};

// Marketplace Page Component (placeholder for now)
const MarketplacePage = () => {
  const { isConnected } = useWeb3();

  if (!isConnected) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Marketplace</h2>
        <p className="text-gray-600 mb-6">Connect your wallet to browse the marketplace</p>
        <WalletConnection />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 mb-8">NFT Marketplace</h2>
      
      {/* Placeholder for marketplace content */}
      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
              <span className="text-gray-400">NFT #{i + 1}</span>
            </div>
            <div className="p-4">
              <h3 className="font-semibold mb-2">Sample NFT #{i + 1}</h3>
              <p className="text-gray-600 text-sm mb-2">Owner: 0x1234...5678</p>
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg">0.05 ETH</span>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
                  Buy Now
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 

// Wallet Status Component (for debugging/info)
const WalletStatus = () => {
  const { account, chainId, isConnected, isCorrectNetwork } = useWeb3();

  if (!isConnected) return null;

  return (
    <div className="mt-8 max-w-md mx-auto bg-white shadow-lg rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Wallet Status</h3>
      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium">Status:</span>{' '}
          <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div>
          <span className="font-medium">Network:</span>{' '}
          <span className={isCorrectNetwork ? 'text-green-600' : 'text-yellow-600'}>
            {chainId} {isCorrectNetwork ? '(Abstract Testnet)' : '(Wrong Network)'}
          </span>
        </div>
        <div>
          <span className="font-medium">Address:</span>{' '}
          <span className="font-mono">{account}</span>
        </div>
      </div>
    </div>
  );
};

export default App;
