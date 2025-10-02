import '../App.css';

import React, { useState, useEffect, useRef, createContext, useContext } from 'react';

import { ethers } from 'ethers';

import MintingInterface from './MintingInterface';



const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');

const Web3Context = createContext(null);



export const Web3Provider = ({ children }) => {

  const [account, setAccount] = useState(null);

  const [provider, setProvider] = useState(null);

  const [signer, setSigner] = useState(null);

  const [chainId, setChainId] = useState(null);

  const [isConnecting, setIsConnecting] = useState(false);

  const [balance, setBalance] = useState('0');



  const ABSTRACT_CHAIN_ID = 11124;

  const ABSTRACT_NET = {

    chainId: '0x2B74',

    chainName: 'Abstract Testnet',

    nativeCurrency: {

      name: 'ETH',

      symbol: 'ETH',

      decimals: 18,

    },

    rpcUrls: ['https://api.testnet.abs.xyz/'],

    blockExplorerUrls: ['https://sepolia.abscan.org'],

  };



  const formatAddress = (value) => {

    if (!value) return '';

    return `${value.substring(0, 6)}...${value.substring(value.length - 4)}`;

  };



  const disconnect = () => {

    setAccount(null);

    setProvider(null);

    setSigner(null);

    setChainId(null);

    setBalance('0');

  };



  const handleAccountsChanged = (accounts) => {

    if (!accounts || accounts.length === 0) {

      disconnect();

    } else {

      setAccount(accounts[0]);

    }

  };



  const handleChainChanged = (nextChainId) => {

    const numericId = typeof nextChainId === 'string' ? parseInt(nextChainId, 16) : nextChainId;

    setChainId(numericId);

    window.location.reload();

  };



  const updateBalance = async () => {

    if (!provider || !account) return;

    try {

      const nextBalance = await provider.getBalance(account);

      setBalance(ethers.utils.formatEther(nextBalance));

    } catch (error) {

      console.error('Error updating balance:', error);

    }

  };



  const setupEventListeners = () => {

    if (typeof window === 'undefined' || !window.ethereum) return () => {};

    const { ethereum } = window;

    ethereum.on('accountsChanged', handleAccountsChanged);

    ethereum.on('chainChanged', handleChainChanged);

    return () => {

      if (!ethereum.removeListener) return;

      ethereum.removeListener('accountsChanged', handleAccountsChanged);

      ethereum.removeListener('chainChanged', handleChainChanged);

    };

  };



  const checkConnection = async () => {

    if (typeof window === 'undefined' || !window.ethereum) return;

    try {

      const nextProvider = new ethers.providers.Web3Provider(window.ethereum);

      const accounts = await nextProvider.listAccounts();

      if (accounts.length > 0) {

        setAccount(accounts[0]);

        setProvider(nextProvider);

        setSigner(nextProvider.getSigner());

        const network = await nextProvider.getNetwork();

        setChainId(network.chainId);

      }

    } catch (error) {

      console.error('Error checking connection:', error);

    }

  };



  const switchToAbstract = async () => {

    if (typeof window === 'undefined' || !window.ethereum) {

      alert('Please install MetaMask or another Web3 wallet');

      return;

    }



    try {

      await window.ethereum.request({

        method: 'wallet_switchEthereumChain',

        params: [{ chainId: ABSTRACT_NET.chainId }],

      });

    } catch (switchError) {

      const errorCode =

        switchError?.code ?? switchError?.data?.originalError?.code;



      if (errorCode === 4902) {

        try {

          await window.ethereum.request({

            method: 'wallet_addEthereumChain',

            params: [ABSTRACT_NET],

          });



          await window.ethereum.request({

            method: 'wallet_switchEthereumChain',

            params: [{ chainId: ABSTRACT_NET.chainId }],

          });

        } catch (addError) {

          console.error('Error adding Abstract network:', addError);

          alert('Failed to add the Abstract network');

          return;

        }

      } else if (errorCode === 4001) {

        console.warn('User rejected the network switch request');

        return;

      } else {

        console.error('Error switching to Abstract network:', switchError);

        alert('Failed to switch to the Abstract network');

        return;

      }

    }



    try {

      const refreshedProvider = new ethers.providers.Web3Provider(window.ethereum);

      const refreshedSigner = refreshedProvider.getSigner();

      const address = await refreshedSigner.getAddress();

      const [network, balanceWei] = await Promise.all([

        refreshedProvider.getNetwork(),

        refreshedProvider.getBalance(address),

      ]);

      setProvider(refreshedProvider);

      setSigner(refreshedSigner);

      setAccount(address);

      setChainId(network.chainId);

      setBalance(ethers.utils.formatEther(balanceWei));

    } catch (refreshError) {

      console.error('Error refreshing connection after network switch:', refreshError);

    }

  };



  const connectWallet = async () => {

    if (typeof window === 'undefined' || !window.ethereum) {

      alert('Please install MetaMask or another Web3 wallet');

      return;

    }



    setIsConnecting(true);



    try {

      await window.ethereum.request({ method: 'eth_requestAccounts' });

      const nextProvider = new ethers.providers.Web3Provider(window.ethereum);

      const accounts = await nextProvider.listAccounts();

      const network = await nextProvider.getNetwork();



      if (accounts.length > 0) {

        setAccount(accounts[0]);

        setProvider(nextProvider);

        setSigner(nextProvider.getSigner());

        setChainId(network.chainId);

      }



      if (network.chainId !== ABSTRACT_CHAIN_ID) {

        await switchToAbstract();

      }

    } catch (error) {

      console.error('Error connecting wallet:', error);

      alert('Failed to connect wallet');

    } finally {

      setIsConnecting(false);

    }

  };



  useEffect(() => {

    checkConnection();

    const teardown = setupEventListeners();

    return () => {

      if (typeof teardown === 'function') {

        teardown();

      }

    };

  }, []);



  useEffect(() => {

    if (account && provider) {

      updateBalance();

    }

  }, [account, provider]);



  const value = {

    account,

    provider,

    signer,

    chainId,

    balance,

    isConnecting,

    isConnected: Boolean(account),

    isCorrectNetwork: chainId === ABSTRACT_CHAIN_ID,

    connectWallet,

    disconnect,

    switchToAbstract,

    formatAddress,

    updateBalance,

  };



  return (

    <Web3Context.Provider value={value}>

      {children}

    </Web3Context.Provider>

  );

};



export const useWeb3 = () => {

  const context = useContext(Web3Context);

  if (!context) {

    throw new Error('useWeb3 must be used within a Web3Provider');

  }

  return context;

};



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

    formatAddress,

  } = useWeb3();



  return (

    <div className="wallet-card">

      <h2>Wallet</h2>

      {!isConnected ? (

        <button onClick={connectWallet} disabled={isConnecting} className="button-primary">

          {isConnecting ? 'Connecting...' : 'Connect Wallet'}

        </button>

      ) : (

        <div className="wallet-card-body">

          <p className="helper-text">Address</p>

          <p className="mono">{formatAddress(account)}</p>

          <p className="helper-text">Balance: {parseFloat(balance || '0').toFixed(4)} ETH</p>

          {!isCorrectNetwork && (

            <button className="button-warning" onClick={switchToAbstract}>

              Switch to Abstract

            </button>

          )}

          <button className="button-plain" onClick={disconnect}>Disconnect</button>

        </div>

      )}

    </div>

  );

};



const WalletButton = () => {

  const { isConnected, connectWallet, disconnect, formatAddress, account } = useWeb3();



  if (!isConnected) {

    return (

      <button onClick={connectWallet} className="nav-wallet-button">

        Connect Wallet

      </button>

    );

  }



  return (

    <div className="nav-wallet-connected">

      <span className="badge badge-success mono">{formatAddress(account)}</span>

      <button className="button-plain" onClick={disconnect}>Sign out</button>

    </div>

  );

};



const resourcePath = (relative) => `${process.env.PUBLIC_URL}${relative}`;



const HomePage = () => {

  const { isConnected, account } = useWeb3();

  const [activeFaq, setActiveFaq] = useState(0);

  const [walletInput, setWalletInput] = useState('');

  const [storedWallets, setStoredWallets] = useState(() => {



    if (typeof window === 'undefined') return [];

    try {

      const saved = window.localStorage.getItem('avc-wl-addresses');

      return saved ? JSON.parse(saved) : [];

    } catch (error) {

      console.error('Failed to read stored wallets:', error);

      return [];

    }

  });

  const [canUseClipboard, setCanUseClipboard] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [submitMessage, setSubmitMessage] = useState(null);

  const [submitError, setSubmitError] = useState(null);



  const heroBackground = {

    video: resourcePath('/assets/landing/reply-assets/4.mp4'),

    fallback: resourcePath('/assets/landing/reply-assets/1.png'),

  };



  const heroCards = [

    {

      icon: 'X',

      title: 'X/Twitter',

      caption: '@abstractvibescabal',

      background: 'linear-gradient(135deg, #ffe3ff, #ffd7ff)',

      accent: 'rgba(239, 68, 228, 0.2)',

      href: 'https://x.com',

    },

    {

      icon: 'DC',

      title: 'Discord',

      caption: 'Coming soon',

      background: 'linear-gradient(135deg, #dfffe8, #bff5dd)',

      accent: 'rgba(16, 185, 129, 0.2)',

    },

    {

      icon: 'XP',

      title: 'Experiences',

      caption: 'Coming soon',

      background: 'linear-gradient(135deg, #ffeebe, #ffd67d)',

      accent: 'rgba(251, 146, 60, 0.2)',

    },

    {

      icon: 'IG',

      title: 'Instagram',

      caption: 'Coming soon',

      background: 'linear-gradient(135deg, #e0ecff, #c6d9ff)',

      accent: 'rgba(59, 130, 246, 0.2)',

    },

  ];



  const heroStripImages = [

    '/assets/landing/hero/001.png',

    '/assets/landing/hero/0015.png',

    '/assets/landing/hero/002.png',

    '/assets/landing/hero/007.png',

    '/assets/landing/hero/008.png',

    '/assets/landing/hero/011.png',

    '/assets/landing/hero/014.png',

    '/assets/landing/hero/Elisa.png',

    '/assets/landing/hero/Fat.png',

    '/assets/landing/hero/Flower.jpg',

    '/assets/landing/hero/Robot.png',

    '/assets/landing/hero/TMA.png',

    '/assets/landing/hero/Wale.png',

    '/assets/landing/hero/X-Ray.png',

  ].map(resourcePath);





  const faqItems = [

    {

      question: 'What is AVC?',

      answer:

        'Abstract Vibes Cabal is an artist-led universe built on Abstract. We blend handcrafted 3D characters, music, storytelling, and community-driven experiences into one evolving world.',

    },

    {

      question: 'Are you a derivative of GVC?',

      answer:

        'No derivatives. AVC is original IP. Our avatars, lore, and experiences are created in-house by a crew of designers, writers, musicians, and 3D artists.',

    },

    {

      question: 'What makes you different?',

      answer:

        'Every AVC piece is crafted individually, no trait farming and no mass-generated combos. Holders can expect immersive drops, live activations, and collabs that treat characters like performers, not collectibles.',

    },

  ];





  useEffect(() => {

    if (!isConnected || !account) {

      setWalletInput('');

      return;

    }



    try {

      setWalletInput(ethers.utils.getAddress(account));

    } catch (error) {

      setWalletInput(account);

    }

  }, [isConnected, account]);



  useEffect(() => {

    if (typeof navigator === 'undefined') return;

    if (navigator.clipboard?.readText) {

      setCanUseClipboard(true);

    }

  }, []);



  useEffect(() => {

    if (typeof window === 'undefined') return;

    try {

      window.localStorage.setItem('avc-wl-addresses', JSON.stringify(storedWallets));

    } catch (error) {

      console.error('Failed to persist wallets:', error);

    }

  }, [storedWallets]);



  const submitAddressToServer = async (address) => {
    const endpoint = API_BASE_URL ? `${API_BASE_URL}/api/wallet-submissions` : '/api/wallet-submissions';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          source: 'landing-join-footer',
          submittedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = 'Unable to submit wallet address right now. Please try again shortly.';

        try {
          if (contentType.includes('application/json')) {
            const data = await response.json();
            if (data && typeof data.error === 'string') {
              errorMessage = data.error;
            }
          } else {
            const text = await response.text();
            if (text && !text.trim().startsWith('<')) {
              errorMessage = text.trim();
            }
          }
        } catch (parseError) {
          // ignore parse errors and fall back to default message
        }

        throw new Error(errorMessage);
      }

      return await response.json().catch(() => null);
    } catch (error) {
      console.error('Failed to sync wallet address with server:', error);
      throw error;
    }
  };



  const handlePasteClick = async () => {

    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return;

    try {

      const text = await navigator.clipboard.readText();

      const trimmed = text.trim();

      if (!trimmed) return;

      try {

        setWalletInput(ethers.utils.getAddress(trimmed));

      } catch (error) {

        setWalletInput(trimmed);

      }

    } catch (error) {

      console.error('Failed to paste wallet:', error);

    }

  };



  const handleWalletSubmit = async (event) => {

    event.preventDefault();

    if (isSubmitting) return;



    const value = walletInput.trim();

    if (!value) return;



    setSubmitMessage(null);

    setSubmitError(null);



    let storedValue = value;

    try {

      storedValue = ethers.utils.getAddress(value);

    } catch (error) {

      storedValue = value;

    }



    const normalized = storedValue.toLowerCase();

    setIsSubmitting(true);



    try {

      await submitAddressToServer(storedValue);



      setStoredWallets((prev) => {

        if (prev.some((entry) => entry.toLowerCase() === normalized)) {

          return prev;

        }

        return [...prev, storedValue];

      });



      setSubmitMessage('Wallet submitted successfully.');



      if (isConnected && account) {

        try {

          setWalletInput(ethers.utils.getAddress(account));

        } catch (error) {

          setWalletInput(account);

        }

      } else {

        setWalletInput('');

      }

    } catch (error) {

      const rawMessage = error?.message || '';

      const friendlyMessage = !rawMessage || rawMessage.trim().startsWith('<') ?

        'Unable to submit wallet address right now. Please try again shortly.' : rawMessage;

      setSubmitError(friendlyMessage);

    } finally {

      setIsSubmitting(false);

    }

  };



  return (

    <div className="page-shell">

      <section

        className="landing-hero"

        id="top"

        style={{ backgroundImage: `url(${heroBackground.fallback})` }}

      >

        <div className="hero-copy">

          <span className="hero-eyebrow">The vibes are better.</span>

          <h1 className="hero-title">Abstract Vibes Cabal is here</h1>

          <p className="hero-subtitle">

            An art-forward, vibe-first NFT collection built natively for Abstract and built for the rise of Creator Capital Markets. Designed by artists, traders, and Web3 degens who loved GVC, but wanted more vibes on Abstract.

          </p>

        </div>

      </section>



      <section className="hero-cta-row">

        {heroCards.map((card) => {

          const CardTag = card.href ? 'a' : 'div';

          const cardProps = card.href

            ? { href: card.href, target: '_blank', rel: 'noreferrer noopener' }

            : {};



          return (

            <CardTag

              key={card.title}

              className="hero-card"

              style={{ background: card.background, boxShadow: `0 18px 40px ${card.accent}` }}

              {...cardProps}

            >

              <span className="hero-card-icon">{card.icon}</span>

              <div className="hero-card-body">

                <span className="hero-card-title">{card.title}</span>

                <span className="hero-card-caption">{card.caption}</span>

              </div>

            </CardTag>

          );

        })}

      </section>



      <section className="section-spacer who-behind" 

      style={{ backgroundImage: `url(${resourcePath('/assets/landing/reply-assets/2.jpg')})` }}

      id="who-section">

        <div

          className="who-image who-image-wave"

        ></div>

        <div className="who-copy">

          <span className="section-tag">Who is behind AVC?</span>

          <h2 className="section-title">A collective of artists, designers, and vibesmiths.</h2>

          <p className="section-description">

            We are a collective of artists, designers, traders, and long-time Web3 builders. Most of us are GVC holders. Some of us are whales of other NFTs. All of us believe Abstract is ready for its first true culture mint.

          </p>

          <p className="section-description">

            We are not a brand. We are not a studio. We are a crew of people who love art and vibes, and know how to build things that matter. This is AVC. Built for Abstract.

          </p>

        </div>

      </section>



      <section className="section-spacer gallery-section">

        <h3 className="gallery-heading">Every piece is handcrafted. No trait farming. Just vibes.</h3>

        <div className="gallery-grid">

          {heroStripImages.map((src, index) => (

            <img key={`${src}-${index}`} src={src} alt="AVC roster" />

          ))}

        </div>

      </section>



      <section className="section-spacer who-are-we" id="who-are-we">

        <div className="who-text">

          <h2 className="section-title">Who Are We?</h2>

          <p className="section-description">

            We are a collective of designers, artists, motion creators, and traders who have spent years in Web3, launching, collecting, and vibing with the best of what the space has to offer. Most of us hold GVC. Some of us are whales. All of us are obsessed with art, culture, and building real communities.

          </p>

          <p className="section-description">

            We have been watching Abstract grow, fast UX, new metas, high energy. But it has been missing that project, the one that defines the culture. That is what AVC is built to be. <strong>This is not just another mint.</strong> We are building AVC to thrive in the next phase of NFTs: <strong>Creator Capital Markets</strong>, a world where holders are not just collectors, they are streamers, performers, and co-creators.

          </p>

          <p className="section-description">

            That is why AVC is not just art. Every character is being built with 3D modeling in mind, so you can eventually bring your PFP to life like a vtuber, use it in live streams, or flex it in virtual scenes.

          </p>

          <p className="section-description">

            No IP traps. No broken promises. Just expressive, usable identity. We are not a brand. We are a cabal of creators, artists, and vibes.

          </p>

        </div>

        <div className="who-figure">

          <img src={resourcePath('/assets/landing/reply-assets/3.png')} alt='Chill AVC character' />

        </div>

      </section>



      <section className="section-spacer video-panel">

        <div className="video-frame">

          <video

            className="video-feed"

            autoPlay

            muted

            loop

            playsInline

          >

            <source src={resourcePath('/assets/landing/reply-assets/4.mp4')} type="video/mp4" />

          </video>

        </div>



      </section>



      <section className="section-spacer minting-interface">

                <div className="video-copy">

          <p className="section-description">

            That is why AVC is not just art. Every character is being built with 3D modeling in mind, so you can eventually bring your PFP to life like a vtuber, use it in live streams, or flex it in virtual scenes.

          </p>

          <p className="section-description">

            No IP traps. No broken promises. Just expressive, usable identity. We are not a brand. We are a cabal of creators, artists, and vibes.

          </p>

        </div>

      </section>



      <section className="faq-section section-spacer" 

      style={{ backgroundColor: '#F7B0EE'}}

      id="faq-section">

        <div className="faq-card">

          <span className="section-tag">FAQs</span>

          <h2 className="section-title">Answers for the curious.</h2>

          <div className="faq-list">

            {faqItems.map((item, index) => {

              const isOpen = activeFaq === index;

              return (

                <div

                  key={item.question}

                  className={`faq-item ${isOpen ? 'open' : ''}`}

                  onClick={() => setActiveFaq(isOpen ? null : index)}

                >

                  <div className="faq-question">

                    <span>{item.question}</span>

                    <span>{isOpen ? '-' : '+'}</span>

                  </div>

                  {isOpen && <div className="faq-answer">{item.answer}</div>}

                </div>

              );

            })}

          </div>

        </div>

        <div className="faq-card">

          <img

            src={resourcePath('/assets/landing/reply-assets/5.png')}

            alt="AVC FAQ"

            style={{ width: '100%', borderRadius: '24px', boxShadow: '0 18px 40px rgba(15, 23, 42, 0.12)' }}

          />

        </div>

      </section>



      <section className="join-footer section-spacer">

        <div className="join-visual">

          <img

            src={resourcePath('/assets/landing/reply-assets/6.png')}

            alt="AVC FAQ"

            style={{ width: '100%', borderRadius: '24px', boxShadow: '0 18px 40px rgba(15, 23, 42, 0.12)' }}

          />

        </div>

        <div className="join-copy">

          <h2 className="section-title">Enter your wallet to be rolled into WL giveaways. For better vibes.</h2>

          <form onSubmit={handleWalletSubmit}>

            <input

              type="text"

              placeholder="0xAi...j69B"

              value={walletInput}

              onChange={(event) => setWalletInput(event.target.value)}

              autoComplete="off"

            />

            <button

              type="button"

              className="paste-button"

              onClick={handlePasteClick}

              disabled={!canUseClipboard}

            >

              Paste

            </button>

            <button type="submit" disabled={isSubmitting || !walletInput.trim()}>

              {isSubmitting ? 'Submitting...' : 'Submit'}

            </button>

          </form>

          {submitMessage && <p className="form-feedback success">{submitMessage}</p>}

          {submitError && <p className="form-feedback error">{submitError}</p>}

          <p className="footer-note">We will ping holders with drops, events, and IRL invites. Zero spam, only vibes.</p>

        </div>

      </section>



      {isConnected && (

        <div className="section-spacer">

          <WalletStatus />

        </div>

      )}

    </div>

  );

};



const MintStatusPage = () => {

  return (

    <div className="container stack" id="status-section">

      <MintingInterface showControls={false} />

    </div>

  );

};



const MobileMenu = ({ isOpen, setIsMenuOpen, handleNavigate }) => {

  return (

    <div className={`mobile-menu ${isOpen ? 'open' : ''}`}>

      <div className="mobile-menu-header">

        <span>AVC</span>

        <button

          type="button"

          className="nav-toggle"

          onClick={() => setIsMenuOpen(false)}

          aria-label="Close menu"

        >

          <span className="nav-toggle-icon open" />

        </button>

      </div>

      <div className="mobile-menu-links">

        <button type="button" onClick={() => handleNavigate('home', 'who-section')}>Who We Are</button>

        <button type="button" onClick={() => handleNavigate('home', 'faq-section')}>FAQs</button>

        <button type="button" onClick={() => handleNavigate('status', 'status-section')}>Mint Info</button>

      </div>

      <div className="mobile-menu-buttons">

        <WalletButton />

        <button

          type="button"

          className="button-secondary"

          onClick={() => handleNavigate('status', 'status-section')}

        >

          View Status

        </button>

      </div>

    </div>

  );

};



const App = () => {

  const [currentPage, setCurrentPage] = useState('home');

  const [isMenuOpen, setIsMenuOpen] = useState(false);



  useEffect(() => {

    document.body.style.overflow = isMenuOpen ? 'hidden' : '';

    return () => {

      document.body.style.overflow = '';

    };

  }, [isMenuOpen]);



  const handleNavigate = (page, anchorId) => {

    setCurrentPage(page);

    setIsMenuOpen(false);



    const targetId = anchorId || (page === 'status' ? 'status-section' : undefined);

    if (targetId) {

      setTimeout(() => {

        const element = document.getElementById(targetId);

        if (element) {

          element.scrollIntoView({ behavior: 'smooth', block: 'start' });

        }

      }, 100);

    }

  };



  return (

    <Web3Provider>

      <div className="app-shell">

        <nav className="navbar">

          <div className="nav-pill">

            <button type="button" onClick={() => handleNavigate('home', 'who-section')}>Who We Are</button>

            <button type="button" onClick={() => handleNavigate('home', 'faq-section')}>FAQs</button>

            <span className="nav-pill-divider" />

            <a href="https://x.com" target="_blank" rel="noreferrer noopener" className="nav-pill-icon">X</a>

            <a href="https://discord.com" target="_blank" rel="noreferrer noopener" className="nav-pill-icon">DC</a>

          </div>

          <div className="nav-actions">

            <div className="nav-desktop-wallet">

              <WalletButton />

            </div>

          </div>

        </nav>



        <MobileMenu

          isOpen={isMenuOpen}

          setIsMenuOpen={setIsMenuOpen}

          handleNavigate={handleNavigate}

        />



        <main className="main-area">

          {currentPage === 'home' && <HomePage />}

          {currentPage === 'status' && <MintStatusPage />}

        </main>

      </div>

    </Web3Provider>

  );

};



const WalletStatus = () => {

  const { account, chainId, isConnected, isCorrectNetwork, formatAddress } = useWeb3();

  const [copied, setCopied] = useState(false);

  const [canCopy, setCanCopy] = useState(false);

  const copyTimeoutRef = useRef(null);



  useEffect(() => {

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {

      setCanCopy(true);

    }

    return () => {

      if (copyTimeoutRef.current) {

        clearTimeout(copyTimeoutRef.current);

      }

    };

  }, []);



  if (!isConnected) return null;



  const handleCopy = async () => {

    if (!account || !canCopy) return;

    try {

      await navigator.clipboard.writeText(account);

      setCopied(true);

      if (copyTimeoutRef.current) {

        clearTimeout(copyTimeoutRef.current);

      }

      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);

    } catch (error) {

      console.error('Failed to copy address:', error);

    }

  };



  return (

    <div className="card stack-sm">

      <h3>Wallet Status</h3>

      <div className="card-inline">

        <span className="helper-text">Connection</span>

        <span className={`badge ${isConnected ? 'badge-success' : 'badge-danger'}`}>

          {isConnected ? 'Connected' : 'Disconnected'}

        </span>

      </div>

      <div className="card-inline">

        <span className="helper-text">Network</span>

        <span className={`badge ${isCorrectNetwork ? 'badge-success' : 'badge-warning'}`}>

          {chainId} {isCorrectNetwork ? '' : '(switch to 11124)'}

        </span>

      </div>

      <div className="card-inline wallet-address">

        <span className="helper-text">Address</span>

        <div className="wallet-address-actions">

          <span className="mono wallet-address-value" title={account}>{formatAddress(account)}</span>

          <button

            type="button"

            className="wallet-copy-button"

            onClick={handleCopy}

            disabled={!canCopy}

          >

            {copied ? 'Copied' : 'Copy'}

          </button>

        </div>

      </div>

    </div>

  );

};



export default App;













