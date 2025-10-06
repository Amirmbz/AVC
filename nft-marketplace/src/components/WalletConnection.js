import "../App.css";

import React, {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
} from "react";

import { ethers } from "ethers";

import MintingInterface from "./MintingInterface";
import {
  ArrowDown,
  ArrowRight,
  Cross,
  Discord,
  DiscordBlack,
  Exp,
  ExpBlack,
  Hamburger,
  Instagram,
  Logo,
  Twitter,
  TwitterBlack,
  DiscordDisabled,
  ExpDisabled,
} from "../assets/svg";

// import waveImage from "../assets/image/2.jpg";
import waveVideo from "../assets/video/waveVideo.mp4";
import heroAnimation from "../assets/video/heroAnimation.mp4";

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(
  /\/$/,
  ""
);

const Web3Context = createContext(null);

const MINT_INFO_DISABLED = true;

const ABSTRACT_CHAIN_ID = parseInt(
  process.env.REACT_APP_ABSTRACT_CHAIN_ID || "0",
  10
);
const ABSTRACT_CHAIN_ID_HEX =
  process.env.REACT_APP_ABSTRACT_CHAIN_ID_HEX || "0x0";
const ABSTRACT_NETWORK = {
  chainId: ABSTRACT_CHAIN_ID_HEX,
  chainName: process.env.REACT_APP_ABSTRACT_CHAIN_NAME || "Abstract",
  nativeCurrency: {
    name: process.env.REACT_APP_ABSTRACT_NATIVE_NAME || "ETH",
    symbol: process.env.REACT_APP_ABSTRACT_NATIVE_SYMBOL || "ETH",
    decimals: Number(process.env.REACT_APP_ABSTRACT_NATIVE_DECIMALS || 18),
  },
  rpcUrls: [process.env.REACT_APP_ABSTRACT_RPC_URL || ""].filter(Boolean),
  blockExplorerUrls: [process.env.REACT_APP_ABSTRACT_EXPLORER_URL || ""].filter(
    Boolean
  ),
};

export const Web3Provider = ({ children }) => {
  const [account, setAccount] = useState(null);

  const [provider, setProvider] = useState(null);

  const [signer, setSigner] = useState(null);

  const [chainId, setChainId] = useState(null);

  const [isConnecting, setIsConnecting] = useState(false);

  const [balance, setBalance] = useState("0");
  const formatAddress = (value) => {
    if (!value) return "";
    return `${value.substring(0, 6)}...${value.substring(value.length - 4)}`;
  };

  const disconnect = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setBalance("0");
  };

  const handleAccountsChanged = (accounts) => {
    if (!accounts || accounts.length === 0) {
      disconnect();
    } else {
      setAccount(accounts[0]);
    }
  };

  const handleChainChanged = (nextChainId) => {
    const numericId =
      typeof nextChainId === "string" ? parseInt(nextChainId, 16) : nextChainId;

    setChainId(numericId);

    window.location.reload();
  };

  const updateBalance = async () => {
    if (!provider || !account) return;

    try {
      const nextBalance = await provider.getBalance(account);

      setBalance(ethers.utils.formatEther(nextBalance));
    } catch (error) {
      console.error("Error updating balance:", error);
    }
  };

  const setupEventListeners = () => {
    if (typeof window === "undefined" || !window.ethereum) return () => {};

    const { ethereum } = window;

    ethereum.on("accountsChanged", handleAccountsChanged);

    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (!ethereum.removeListener) return;

      ethereum.removeListener("accountsChanged", handleAccountsChanged);

      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  };

  const checkConnection = async () => {
    if (typeof window === "undefined" || !window.ethereum) return;

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
      console.error("Error checking connection:", error);
    }
  };

  const switchToAbstract = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Please install MetaMask or another Web3 wallet");

      return;
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",

        params: [{ chainId: ABSTRACT_NETWORK.chainId }],
      });
    } catch (switchError) {
      const errorCode =
        switchError?.code ?? switchError?.data?.originalError?.code;

      if (errorCode === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",

            params: [ABSTRACT_NETWORK],
          });

          await window.ethereum.request({
            method: "wallet_switchEthereumChain",

            params: [{ chainId: ABSTRACT_NETWORK.chainId }],
          });
        } catch (addError) {
          console.error("Error adding Abstract network:", addError);

          alert("Failed to add the Abstract network");

          return;
        }
      } else if (errorCode === 4001) {
        console.warn("User rejected the network switch request");

        return;
      } else {
        console.error("Error switching to Abstract network:", switchError);

        alert("Failed to switch to the Abstract network");

        return;
      }
    }

    try {
      const refreshedProvider = new ethers.providers.Web3Provider(
        window.ethereum
      );

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
      console.error(
        "Error refreshing connection after network switch:",
        refreshError
      );
    }
  };

  const connectWallet = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Please install MetaMask or another Web3 wallet");

      return;
    }

    setIsConnecting(true);

    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });

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
      console.error("Error connecting wallet:", error);

      alert("Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    checkConnection();

    const teardown = setupEventListeners();

    return () => {
      if (typeof teardown === "function") {
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

    switchToAbstract,

    formatAddress,

    updateBalance,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);

  if (!context) {
    throw new Error("useWeb3 must be used within a Web3Provider");
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

    switchToAbstract,

    formatAddress,
  } = useWeb3();

  return (
    <div className="wallet-card">
      <h2>Wallet</h2>

      {!isConnected ? (
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="button-primary"
        >
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </button>
      ) : (
        <div className="wallet-card-body">
          <p className="helper-text">Address</p>

          <p className="mono">{formatAddress(account)}</p>

          <p className="helper-text">
            Balance: {parseFloat(balance || "0").toFixed(4)} ETH
          </p>

          {!isCorrectNetwork && (
            <button className="button-warning" onClick={switchToAbstract}>
              Switch to Abstract
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const WalletButton = () => {
  const { isConnected, connectWallet, formatAddress, account } = useWeb3();

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
    </div>
  );
};

const resourcePath = (relative) => `${process.env.PUBLIC_URL}${relative}`;

const HomePage = () => {
  const { isConnected, account } = useWeb3();

  const [activeFaq, setActiveFaq] = useState(null);

  const [walletInput, setWalletInput] = useState("");

  const [storedWallets, setStoredWallets] = useState(() => {
    if (typeof window === "undefined") return [];

    try {
      const saved = window.localStorage.getItem("avc-wl-addresses");

      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Failed to read stored wallets:", error);

      return [];
    }
  });

  const [canUseClipboard, setCanUseClipboard] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [submitMessage, setSubmitMessage] = useState(null);

  const [submitError, setSubmitError] = useState(null);

  const heroBackground = {
    video: resourcePath("/assets/landing/reply-assets/4.mp4"),

    fallback: resourcePath("/assets/landing/reply-assets/1.png"),
  };

  const heroCards = [
    {
      icon: Twitter.default,

      title: "X/Twitter",

      background: "#FFE4FC",

      accent: "rgba(239, 68, 228, 0.2)",

      href: "https://x.com",

      color: "#FF82F2",
    },

    {
      icon: Discord.default,

      title: "Coming Soon",

      caption: "Coming soon",

      background: "#CAFFE6",

      accent: "rgba(16, 185, 129, 0.2)",

      color: "#0ECF74",
    },

    {
      icon: Exp.default,

      title: "Coming Soon",

      caption: "Coming soon",

      background: "#FFE378",

      accent: "rgba(251, 146, 60, 0.2)",

      color: "#FF7E00",
    },

    {
      icon: Instagram.default,

      title: "Coming Soon",

      caption: "Coming soon",

      background: "#BDDDF6",

      accent: "rgba(59, 130, 246, 0.2)",

      color: "#4476F1",
    },
  ];

  // const heroStripImages = [
  //   "/assets/landing/hero/001.png",

  //   "/assets/landing/hero/0015.png",

  //   "/assets/landing/hero/002.png",

  //   "/assets/landing/hero/007.png",

  //   "/assets/landing/hero/008.png",

  //   "/assets/landing/hero/011.png",

  //   "/assets/landing/hero/014.png",

  //   "/assets/landing/hero/Elisa.png",

  //   "/assets/landing/hero/Fat.png",

  //   "/assets/landing/hero/Flower.jpg",

  //   "/assets/landing/hero/Robot.png",

  //   "/assets/landing/hero/TMA.png",

  //   "/assets/landing/hero/Wale.png",

  //   "/assets/landing/hero/X-Ray.png",
  // ].map(resourcePath);

  const faqItems = [
    {
      question: "What is AVC?",

      answer:
        "AVC (Abstract Vibes Cabal) is a 4,444-piece, art-forward NFT collection launching on Abstract.<br /> It’s designed for degens, collectors, and creators who value aesthetic, culture, and connection, with a deep focus on <strong>Creator Capital Markets</strong>. <br />Each character is built with storytelling and streamability in mind. From profile picture to 3D-ready avatar, we’re building tools to let holders bring their NFTs to life in the emerging CCM era,  through content, Vtubing, and digital identity.",
    },

    {
      question: "Are you a derivative of GVC?",

      answer:
        "No, AVC is not a derivative of GVC. <br /><br /> We are deeply inspired by what GVC created on Ethereum, and many of us are active GVC holders. But AVC is its own identity, built <strong>natively for Abstract</strong>.<br />We wanted to create something original that fit the culture, UX, and speed of Abstract while still rewarding a community we’re proud to be part of.<br />That’s why GVC holders are <strong>automatically whitelisted</strong>, and will continue to be rewarded throughout the AVC journey.",
    },

    {
      question: "What makes you different?",

      answer: `
      AVC is built with <strong>Creator Capital Markets (CCM)</strong> iin mind from day one.<br />
      While most collections stop at PFPs, we’re designing for <strong>streamable, expressive digital identity</strong>.<br />
      That means:
      <ul>
      <li>3D models of characters</li>
      <li>Vtuber-style rigging and animation-ready assets</li>
      <li>Storyline and lore potential baked into the art</li>
      <li>A roadmap that supports creators, not just collectors</li>
      </ul>
      We’re not building a brand we’re building a culture engine for Abstract and beyond.<br /><br />
      <strong>Who is the team?</strong><br />
      We’re anonymous by choice, united by culture. Artists, designers, motion directors, degen traders, all with past experience launching, growing, and supporting NFT projects. GVC holders. Abstract believers.
      <br /><br />
      <strong>What’s the vision?</strong><br />
      AVC is a digital collectible project focused on quality art and authentic vibes. We aim to shape the visual culture of Abstract by combining on-chain energy with premium design and curated community drops.      <br /><br />
      <strong>Why Abstract?</strong><br />
      Because it’s new, fast, and growing, but still missing the iconic culture mint. We’re building AVC to fill that gap: clean UX, great design, no ETH gas, and full community alignment.
      <br /><br />
      <strong>When is the mint?</strong><br />
      Early October (exact date TBD). GVC holders are already whitelisted.Follow the X to stay updated. 
      `,
    },
  ];

  useEffect(() => {
    if (!isConnected || !account) {
      setWalletInput("");

      return;
    }

    try {
      setWalletInput(ethers.utils.getAddress(account));
    } catch (error) {
      setWalletInput(account);
    }
  }, [isConnected, account]);

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    if (navigator.clipboard?.readText) {
      setCanUseClipboard(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(
        "avc-wl-addresses",
        JSON.stringify(storedWallets)
      );
    } catch (error) {
      console.error("Failed to persist wallets:", error);
    }
  }, [storedWallets]);

  const submitAddressToServer = async (address) => {
    const endpoint = API_BASE_URL
      ? `${API_BASE_URL}/api/wallet-submissions`
      : "/api/wallet-submissions";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          source: "landing-join-footer",
          submittedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        let errorMessage =
          "Unable to submit wallet address right now. Please try again shortly.";

        try {
          if (contentType.includes("application/json")) {
            const data = await response.json();
            if (data && typeof data.error === "string") {
              errorMessage = data.error;
            }
          } else {
            const text = await response.text();
            if (text && !text.trim().startsWith("<")) {
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
      console.error("Failed to sync wallet address with server:", error);
      throw error;
    }
  };

  const handlePasteClick = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.readText)
      return;

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
      console.error("Failed to paste wallet:", error);
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

      setSubmitMessage("Wallet submitted successfully.");

      if (isConnected && account) {
        try {
          setWalletInput(ethers.utils.getAddress(account));
        } catch (error) {
          setWalletInput(account);
        }
      } else {
        setWalletInput("");
      }
    } catch (error) {
      const rawMessage = error?.message || "";

      const friendlyMessage =
        !rawMessage || rawMessage.trim().startsWith("<")
          ? "Unable to submit wallet address right now. Please try again shortly."
          : rawMessage;

      setSubmitError(friendlyMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // <div className="page-shell">
    <div>
      <section
        className="landing-hero"
        id="top"
        // style={{ backgroundImage: `url(${heroBackground.fallback})` }}
      >
        <video
          className="hero-video"
          src={heroAnimation}
          controls={false}
          autoPlay
          loop
          muted
          playsInline
        />
        <div className="hero-copy">
          <h1 className="hero-title">
            The vibes are better.<br></br> Abstract Vibes Cabal is here
          </h1>

          <p className="hero-subtitle">
            An art-forward, vibe-first NFT collection built natively for
            Abstract and built for the rise of Creator Capital Markets.<br></br>{" "}
            Designed by artists, traders, and Web3 degens who loved GVC, but
            wanted more Vibes on Abstract.{" "}
          </p>
        </div>
      </section>

      <section className="hero-cta-row">
        {heroCards.map((card) => {
          const CardTag = card.href ? "a" : "div";

          const cardProps = card.href
            ? { href: card.href, target: "_blank", rel: "noreferrer noopener" }
            : {};

          return (
            <CardTag
              key={card.title}
              className="hero-card"
              style={{
                background: card.background,
              }}
              {...cardProps}
            >
              {/* <span className="hero-card-icon">{card.icon}</span> */}
              <img
                className={`hero-card-icon ${
                  card.title === "Discord" ? "hero-card-icon-discord" : ""
                }`}
                src={card.icon}
              />

              <div className="hero-card-body mt-5">
                <span className="hero-card-title" style={{ color: card.color }}>
                  {card.title}
                </span>
              </div>
            </CardTag>
          );
        })}
      </section>

      <section
        className="who-behind"
        // style={{ backgroundImage: `url(${resourcePath('/assets/landing/reply-assets/2.jpg')})` }}

        id="who-section"
      >
        <div className="who-image who-image-wave">
          <video
            src={waveVideo}
            autoPlay
            loop
            muted
            playsInline
            controls={false}
          />
        </div>
        <div className="who-copy-container">
          <div className="who-copy">
            {/* <span className="section-tag">Who is behind AVC?</span> */}

            <h2 className="section-title">
              {/* A collective of artists, designers, and vibesmiths. */}
              Who is behind AVC?
            </h2>

            <div className="section-description-container">
              <p className="section-description">
                We’re a collective of artists, designers, traders, and long-time
                Web3 builders. Most of us are GVC holders. Some of us are whales
                of other NFTs. All of us believe Abstract is ready for its first
                true culture mint.
              </p>

              <p className="section-description">
                We’re not a brand. We’re not a studio. We’re a crew of people
                who love art and vibes, and know how to build things that
                matter.
                <br /> This is AVC. Built for Abstract.{" "}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <ImageSlider />
        {/* <div className="gallery-grid">
          {heroStripImages.map((src, index) => (
            <img key={`${src}-${index}`} src={src} alt="AVC roster" />
          ))}
        </div>
        <div className="gallery-grid">
          {heroStripImages.reverse().map((src, index) => (
            <img key={`${src}-${index}`} src={src} alt="AVC roster" />
          ))}
        </div> */}
      </section>

      <section className="who-are-we" id="who-are-we">
        <div className="who-text-container">
          <div className="who-text">
            <h2 className="section-title">Who Are We?</h2>
            <p className="section-description seprate-who-text-title">
              We’re a collective of designers, artists, motion creators, and
              traders who’ve spent years in Web3, launching, collecting, and
              vibing with the best of what the space has to offer.
            </p>
            <p className="section-description">
              Most of us hold GVC. Some of us are whales. All of us are obsessed
              with art, culture, and building real communities.{" "}
            </p>
            <p className="section-description seprate-who-text">
              We’ve been watching Abstract grow, fast UX, new metas, high
              energy. But it’s been missing that project, the one
            </p>
            <p className="section-description">
              that defines the culture. That’s what AVC is built to be.{" "}
              <strong>This is not just another mint.</strong> We’re building AVC
              to thrive in the next phase of NFTs:{" "}
            </p>{" "}
            <p className="section-description">
              <strong>Creator Capital Markets</strong>, a world where holders
              are not just collectors, they are streamers, performers, and
              co-creators.{" "}
            </p>
            {/* <p className="section-description" style={{ marginTop: "16px" }}>
              That is why AVC is not just art. Every character is being built
              with 3D modeling in mind, so you can eventually bring your PFP to
              life like a vtuber, use it in live streams, or flex it in virtual
              scenes.
            </p>
            <p className="section-description" style={{ marginTop: "16px" }}>
              No IP traps. No broken promises. Just expressive, usable identity.
              We are not a brand. We are a cabal of creators, artists, and
              vibes.
            </p> */}
          </div>
        </div>
        <div className="who-figure">
          <img
            src={resourcePath("/assets/landing/reply-assets/3.png")}
            alt="Chill AVC character"
          />
        </div>
      </section>

      <section>
        <div className="video-frame">
          <video className="video-feed" autoPlay muted loop playsInline>
            <source
              src={resourcePath("/assets/landing/reply-assets/4.mp4")}
              type="video/mp4"
            />
          </video>
        </div>
      </section>

      <section className="minting-interface">
        <div className="video-copy">
          <p className="section-description">
            That is why AVC is not just art. Every character is being built with
            3D modeling in mind, so you can eventually bring your PFP to life
            like a vtuber, use it in live streams, or flex it in virtual scenes.
          </p>

          <p className="section-description">
            No IP traps. No broken promises. Just expressive, usable identity.
            We are not a brand. We are a cabal of creators, artists, and vibes.
          </p>
        </div>
      </section>

      <section
        className="faq-section"
        style={{ backgroundColor: "#F7B0EE" }}
        id="faq-section"
      >
        <div className="faq-container" style={{ padding: "0px" }}>
          <div className="faq-card">
            <h2 className="section-title">FAQs</h2>

            <div className="faq-list">
              {faqItems.map((item, index) => {
                const isOpen = activeFaq === index;

                return (
                  <div
                    key={item.question}
                    className={`faq-item ${isOpen ? "open" : ""}`}
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                  >
                    <div className="faq-question">
                      <span>{item.question}</span>

                      <span className="arrow-opener">
                        {isOpen ? (
                          <img src={ArrowDown.default} />
                        ) : (
                          <img src={ArrowRight.default} />
                        )}
                      </span>
                    </div>

                    {isOpen && (
                      <div
                        className="faq-answer"
                        dangerouslySetInnerHTML={{ __html: item.answer }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <img
          className="faq-image"
          src={resourcePath("/assets/landing/reply-assets/5.png")}
          alt="AVC FAQ"
        />
      </section>

      <section className="join-footer">
        <img
          className="footer-image"
          src={resourcePath("/assets/landing/reply-assets/6.png")}
          alt="AVC FAQ"
        />
        <div className="join-copy-container">
          <div className="join-copy">
            <h2 className="section-title">
              Enter your wallet to be raffled into a WL giveaway, for better
              vibes.{" "}
            </h2>

            <form onSubmit={handleWalletSubmit}>
              <input
                type="text"
                placeholder="Enter your EVM wallet address "
                value={walletInput}
                onChange={(event) => setWalletInput(event.target.value)}
                autoComplete="off"
              />

              <div className="button-container">
                <button
                  type="button"
                  className="paste-button"
                  onClick={handlePasteClick}
                  disabled={!canUseClipboard}
                >
                  Paste
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !walletInput.trim()}
                >
                  {isSubmitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>

            {submitMessage && (
              <p className="form-feedback success">{submitMessage}</p>
            )}

            {submitError && (
              <p className="form-feedback error">{submitError}</p>
            )}
            <div className="footer-pill" style={{ width: "100%" }}>
              <a
                href="https://x.com/ABSVibesCabal"
                target="_blank"
                rel="noreferrer noopener"
                className="nav-pill-icon"
              >
                <img src={TwitterBlack.default} />
              </a>
              <a
                aria-disabled={true}
                target="_blank"
                rel="noreferrer noopener"
                className="nav-pill-icon"
              >
                <img src={DiscordDisabled.default} />
              </a>{" "}
              <a
                aria-disabled={true}
                target="_blank"
                rel="noreferrer noopener"
              >
                Mint Info
              </a>{" "}
            </div>
            <p className="copy-right">
              AVC © 2025 | Created with good vibes 💚
            </p>
          </div>
        </div>
      </section>

      {/* {isConnected && (
        <div className="section-spacer">
          <WalletStatus />
        </div>
      )} */}
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
    <div className={`mobile-menu ${isOpen ? "open" : ""}`}>
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
        <button
          type="button"
          onClick={() => handleNavigate("home", "who-are-we")}
        >
          Who We Are
        </button>

        <button
          type="button"
          onClick={() => handleNavigate("home", "faq-section")}
        >
          FAQs
        </button>

        <button
          type="button"
          onClick={() => handleNavigate("status", "status-section")}
          disabled={MINT_INFO_DISABLED}
        >
          Mint Info
        </button>
      </div>

      <div className="mobile-menu-buttons">
        <WalletButton />

        <button
          type="button"
          className="button-secondary"
          onClick={() => handleNavigate("status", "status-section")}
          disabled={MINT_INFO_DISABLED}
        >
          View Status
        </button>
      </div>
    </div>
  );
};

const App = () => {
  const [currentPage, setCurrentPage] = useState("home");

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  const handleNavigate = (page, anchorId) => {
    setCurrentPage(page);

    setIsMenuOpen(false);

    const targetId =
      anchorId || (page === "status" ? "status-section" : undefined);

    if (targetId) {
      setTimeout(() => {
        const element = document.getElementById(targetId);

        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  };

  return (
    <Web3Provider>
      <div className="app-shell">
        <nav className="navbar page-shell">
          <div className="nav-pill">
            <button type="button" onClick={() => handleNavigate("home")}>
              <img src={Logo.default} />
            </button>
            <button
              className="navbar-links"
              type="button"
              onClick={() => handleNavigate("home", "who-are-we")}
            >
              Who We Are
            </button>
            <button
              className="navbar-links"
              type="button"
              onClick={() => handleNavigate("home", "faq-section")}
            >
              FAQs
            </button>
            {/* <span className="nav-pill-divider" /> */}
            <a
              href="https://x.com/ABSVibesCabal"
              target="_blank"
              rel="noreferrer noopener"
              className="nav-pill-icon navbar-links"
            >
              <img src={TwitterBlack.default} />
            </a>
            <a
              aria-disabled={true}
              target="_blank"
              rel="noreferrer noopener"
              className="nav-pill-icon navbar-links"
            >
              <img src={DiscordDisabled.default} />
            </a>{" "}
            <a
              aria-disabled={true}
              target="_blank"
              rel="noreferrer noopener"
              className="nav-pill-icon navbar-links"
            >
              <img src={ExpDisabled.default} />
            </a>
          </div>

          <div className="nav-actions">
            <button
              type="button"
              className="mint-info-desktop navbar-links"
              onClick={() => handleNavigate("status", "status-section")}
              disabled={MINT_INFO_DISABLED}
            >
              Mint Info
            </button>
            {isMenuOpen ? (
              <img className="mobile-menu-toggle" src={Cross.default} />
            ) : (
              <img
                className="mobile-menu-toggle"
                src={Hamburger.default}
                onClick={() => setIsMenuOpen(true)}
              />
            )}
            <div className="nav-desktop-wallet navbar-links">
              <WalletButton />
            </div>
          </div>
        </nav>

        <div
          className="mobile-menu"
          style={{
            opacity: !isMenuOpen ? 0 : 1,
            zIndex: !isMenuOpen ? -1 : 40,
          }}
        >
          <div className="logo-container">
            <button type="button" onClick={() => handleNavigate("home")}>
              <img src={Logo.default} />
            </button>
            <img
              className="mobile-menu-toggle"
              src={Cross.default}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            />
          </div>
          <a onClick={() => handleNavigate("home", "who-are-we")}>Who We Are</a>{" "}
          <a onClick={() => handleNavigate("home", "faq-section")}>FAQs</a>{" "}
          <a
            onClick={
              MINT_INFO_DISABLED
                ? undefined
                : () => handleNavigate("status", "status-section")
            }
            aria-disabled={MINT_INFO_DISABLED}
          >
            Mint Info
          </a>
          <div className="mobile-wallet">
            <WalletButton />
          </div>
          <div className="mobile-socials-container">
            <a
              href="https://x.com/ABSVibesCabal"
              target="_blank"
              rel="noreferrer noopener"
              className="nav-pill-icon"
            >
              <img src={TwitterBlack.default} />
            </a>
            <a
              
              target="_blank"
              rel="noreferrer noopener"
              className="nav-pill-icon"
              aria-disabled={true}
            >
              <img src={DiscordDisabled.default} />
            </a>{" "}
            <a
              aria-disabled={true}
              target="_blank"
              rel="noreferrer noopener"
              className="nav-pill-icon"
              style={{ width: 30 }}
            >
              <img src={ExpDisabled.default} />
            </a>
          </div>
        </div>
        {/* <MobileMenu
          isOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
          handleNavigate={handleNavigate}
        /> */}

        <main className="main-area">
          {currentPage === "home" && <HomePage />}

          {currentPage === "status" && <MintStatusPage />}
        </main>
      </div>
    </Web3Provider>
  );
};

const WalletStatus = () => {
  const { account, chainId, isConnected, isCorrectNetwork, formatAddress } =
    useWeb3();

  const [copied, setCopied] = useState(false);

  const [canCopy, setCanCopy] = useState(false);

  const copyTimeoutRef = useRef(null);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
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
      console.error("Failed to copy address:", error);
    }
  };

  return (
    <div className="card stack-sm">
      <h3>Wallet Status</h3>

      <div className="card-inline">
        <span className="helper-text">Connection</span>

        <span
          className={`badge ${isConnected ? "badge-success" : "badge-danger"}`}
        >
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <div className="card-inline">
        <span className="helper-text">Network</span>

        <span
          className={`badge ${
            isCorrectNetwork ? "badge-success" : "badge-warning"
          }`}
        >
          {chainId} {isCorrectNetwork ? "" : `(switch to ${ABSTRACT_CHAIN_ID})`}
        </span>
      </div>

      <div className="card-inline wallet-address">
        <span className="helper-text">Address</span>

        <div className="wallet-address-actions">
          <span className="mono wallet-address-value" title={account}>
            {formatAddress(account)}
          </span>

          <button
            type="button"
            className="wallet-copy-button"
            onClick={handleCopy}
            disabled={!canCopy}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;

const ImageSlider = () => {
  const [heroStripImagesUp, setHeroStripImagesUp] = useState([
    // Your image URLs here
    "/assets/landing/imageSlider/up/1.jpeg",
    "/assets/landing/imageSlider/up/2.jpeg",
    "/assets/landing/imageSlider/up/3.jpeg",
    "/assets/landing/imageSlider/up/4.jpeg",
    "/assets/landing/imageSlider/up/5.jpeg",
    "/assets/landing/imageSlider/up/6.jpeg",
    "/assets/landing/imageSlider/up/7.jpeg",
    "/assets/landing/imageSlider/up/8.jpeg",
    "/assets/landing/imageSlider/up/9.jpeg",
    "/assets/landing/imageSlider/up/10.jpeg",
    "/assets/landing/imageSlider/up/11.jpeg",
    "/assets/landing/imageSlider/up/12.jpeg",

    // ... add all your images
  ]);
  const [heroStripImagesDown, setHeroStripImagesDown] = useState([
    // Your image URLs here
    "/assets/landing/imageSlider/down/1.jpeg",
    "/assets/landing/imageSlider/down/2.jpeg",
    "/assets/landing/imageSlider/down/3.jpeg",
    "/assets/landing/imageSlider/down/4.jpeg",
    "/assets/landing/imageSlider/down/5.jpeg",
    "/assets/landing/imageSlider/down/6.jpeg",
    "/assets/landing/imageSlider/down/7.jpeg",
    "/assets/landing/imageSlider/down/8.jpeg",
    "/assets/landing/imageSlider/down/9.jpeg",
    "/assets/landing/imageSlider/down/10.jpeg",
    "/assets/landing/imageSlider/down/11.jpeg",
    "/assets/landing/imageSlider/down/12.jpeg",
  ]);

  const sliderRef1 = useRef(null);
  const sliderRef2 = useRef(null);
  const animationRef1 = useRef(null);
  const animationRef2 = useRef(null);

  useEffect(() => {
    const startSliders = () => {
      // Stop any existing animations
      if (animationRef1.current) {
        cancelAnimationFrame(animationRef1.current);
      }
      if (animationRef2.current) {
        cancelAnimationFrame(animationRef2.current);
      }

      const slider1 = sliderRef1.current;
      const slider2 = sliderRef2.current;

      if (!slider1 || !slider2) return;

      // Reset positions
      slider1.style.transform = "translateX(0)";
      slider2.style.transform = "translateX(0)";

      let position1 = 0;
      let position2 = 0;
      const speed = 0.5; // Adjust speed as needed

      const animate = () => {
        position1 -= speed;
        position2 += speed; // Reverse direction for second slider

        const sliderWidth1 = slider1.scrollWidth / 2;
        const sliderWidth2 = slider2.scrollWidth / 2;

        // Reset position when entire set has moved through
        if (Math.abs(position1) >= sliderWidth1) {
          position1 = 0;
        }
        if (Math.abs(position2) >= sliderWidth2) {
          position2 = 0;
        }

        slider1.style.transform = `translateX(${position1}px)`;
        slider2.style.transform = `translateX(${position2}px)`;

        animationRef1.current = requestAnimationFrame(animate);
      };

      animationRef1.current = requestAnimationFrame(animate);
    };

    startSliders();

    // Cleanup on unmount
    return () => {
      if (animationRef1.current) {
        cancelAnimationFrame(animationRef1.current);
      }
      if (animationRef2.current) {
        cancelAnimationFrame(animationRef2.current);
      }
    };
  }, [heroStripImagesUp, heroStripImagesDown]);

  const reversedDuplicatedImages = [...heroStripImagesDown]
    .reverse()
    .concat([...heroStripImagesDown].reverse());

  return (
    <section>
      <h3 className="gallery-heading">
        Every piece is handcrafted. No trait farming. Just vibes.
      </h3>

      {/* First Slider */}
      <div className="slider-container">
        <div ref={sliderRef1} className="slider-track">
          {[...heroStripImagesUp, ...heroStripImagesUp].map((src, index) => (
            <img
              key={`slider1-${index}`}
              src={src}
              alt="AVC roster"
              loading="lazy"
              className="slider-image"
            />
          ))}
        </div>
      </div>

      {/* Second Slider (reversed) */}
      <div className="slider-container">
        <div ref={sliderRef2} className="slider-track slider-animate-right">
          {reversedDuplicatedImages.map((src, index) => (
            <img
              key={`slider2-${index}`}
              src={src}
              alt="AVC roster"
              loading="lazy"
              className="slider-image"
            />
          ))}
        </div>
      </div>
    </section>
  );
};
