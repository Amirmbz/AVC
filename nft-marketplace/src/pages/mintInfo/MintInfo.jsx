import "../../App.css";
import "./MintInfo.css";

import React, { useState, useEffect, createContext, Fragment } from "react";

import { ethers } from "ethers";

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
  TwitterWhite,
  DiscordWhite,
  ExpWhite,
  LogoWhite,
  LockRed,
  LockerWhiteOpen,
} from "../../assets/svg";

import {
  useWeb3,
  WalletButton,
  Web3Provider,
} from "../../components/WalletConnection";
import {
  IoIosArrowDown,
  IoMdArrowDropleft,
  IoMdArrowDropright,
} from "react-icons/io";

import mintGif from "../../assets/video/mint.gif";
import { startCountdown } from "../../utils/functions";

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(
  /\/$/,
  ""
);

const Web3Context = createContext(null);

const MINT_INFO_DISABLED = true;

const MAX_COUNTER = 10;
const PHASE_1 = true;
const PHASE_1_DUE = "2025/10/22";
const PHASE_1_PRICE = 0.02;
const PHASE_2 = true;
const PHASE_2_DUE = "2025/10/29";
const PHASE_2_PRICE = 0.04;

const resourcePath = (relative) => `${process.env.PUBLIC_URL}${relative}`;

function MintInfo() {
  const { isConnected, connectWallet, isConnecting, formatAddress, account } =
    useWeb3();

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

  const [currentPage, setCurrentPage] = useState("home");

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [counter, setCounter] = useState(1);

  const [remainigPhase1, setRemainigPhase1] = useState("");
  const [remainigPhase2, setRemainigPhase2] = useState("");

  const tags = [
    {
      id: 0,
      text: "ABSTRACT",
    },
    {
      id: 1,
      text: "ERC-721",
    },
  ];

  const faqItems = [
    {
      question: "Are the NFTs on ETH?",

      answer:
        "No, you can pay with ETH on Ethereum or Abstract. NFTs<br /> are minted to your Abstract wallet.",
    },

    {
      question: "How will I know I got the NFT?",

      answer:
        "Once the transaction is confirmed, the NFT will be minted<br/> automatically within a few minutes.",
    },

    {
      question: "How many can I mint?",

      answer: `
          WL: Up to 2<br />Public: Mint as many you like at .02 each (if available)
          `,
    },
    {
      question: "Can I mint from mobile?",

      answer: `
          Yes, using a mobile wallet that supports WalletConnect.
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

  useEffect(() => {
    let timer1 = startCountdown(PHASE_1_DUE, (time) => {
      setRemainigPhase1(
        `${time.days}D ${time.hours}h ${time.minutes}m ${time.seconds}s`
      );
    });
    let timer2 = startCountdown(PHASE_2_DUE, (time) => {
      setRemainigPhase2(
        `${time.days}D ${time.hours}h ${time.minutes}m ${time.seconds}s`
      );
    });
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div>
      <div className="mint-info-section">
        <nav className="navbar page-shell">
          <div className="nav-pill">
            <button type="button" onClick={() => handleNavigate("home")}>
              <img src={LogoWhite.default} />
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
            <a
              href="https://x.com/ABSVibesCabal"
              target="_blank"
              rel="noreferrer noopener"
              className="nav-pill-icon navbar-links"
            >
              <img src={TwitterWhite.default} />
            </a>
            <a
              aria-disabled={true}
              target="_blank"
              rel="noreferrer noopener"
              className="nav-pill-icon navbar-links"
            >
              <img src={DiscordWhite.default} />
            </a>{" "}
            <a
              aria-disabled={true}
              target="_blank"
              rel="noreferrer noopener"
              className="nav-pill-icon navbar-links"
            >
              <img src={ExpWhite.default} />
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

        <div className="mint-info-background">
          <img
            src={resourcePath("/assets/landing/hero/Mint-Background.png")}
            alt=""
          />
        </div>
        <div className="mint-info">
          <img src={mintGif} alt="" />
          <div className="mint-text">
            <h3>Abstract Vibes Cabal Mint:</h3>
            <div className="tags">
              {tags.map((item) => (
                <div key={item.id}>{item.text}</div>
              ))}
            </div>
            <div className="divider" style={{ marginTop: 33 }} />
            <div className="info-table">
              <thead>
                <th>SUPPLY</th>
                <th>PHASES</th>
                <th>Currency</th>
              </thead>
              <tbody>
                <tr>
                  <td>4444</td>
                  <td>2</td>
                  <td>ETH (Mainnet) or ETH (Abstract) </td>
                </tr>
              </tbody>
            </div>
            <div className="progress">
              <div className="info">
                <span>Minted</span>
                <span>1%(44/4444)</span>
              </div>
              <div className="bar">
                <div className="progressed" style={{ width: "5%" }} />
              </div>
            </div>
            <div className="steps">
              {/* {phases.map((item) => (
                <Fragment key={item.id}> */}
              <div className="accordion">
                <div className="title">
                  <span>
                    Phase 1 - Vibelist -{" "}
                    {PHASE_1 ? `Ending in ${remainigPhase1}` : "Ended"}
                  </span>
                  <div className="actions">
                    <img
                      src={PHASE_1 ? LockerWhiteOpen.default : LockRed.default}
                      alt=""
                    />
                    <IoIosArrowDown
                      color="#fff"
                      fontSize={20}
                      width={20}
                      height={20}
                    />
                  </div>
                </div>
                <div className="description">
                  Connect your wallet to check If you are on the Vibeslist
                  <br />
                  pay {PHASE_1_PRICE} Eth to claim your mint. you can mint, up
                  to 2 NFTs
                </div>
              </div>
              <div className="divider" />
              <div className="accordion">
                <div className="title">
                  <span>
                    Phase 2 - Public sale -{" "}
                    {PHASE_2 ? `Ending in ${remainigPhase2}` : "Ended"}
                  </span>
                  <div className="actions">
                    <img
                      src={PHASE_2 ? LockerWhiteOpen.default : LockRed.default}
                      alt=""
                    />
                    <IoIosArrowDown
                      color="#fff"
                      fontSize={20}
                      width={20}
                      height={20}
                    />
                  </div>
                </div>
                <div className="description">
                  Starting in 72 hours
                  <br />
                  First come first served
                  <br />
                  Open until supply is fully sold
                  <br />
                  Mint as many you like at {PHASE_2_PRICE} each
                </div>
              </div>
              {/* </Fragment>
              ))} */}
            </div>
          </div>
        </div>
        <div className="mint-actions">
          {isConnected ? (
            <Fragment>
              <div className="counter">
                <IoMdArrowDropleft
                  fontSize={30}
                  style={{ color: counter <= 1 ? "#D5D5D5" : "" }}
                  onClick={() => {
                    if (counter <= 1) return;
                    setCounter((prev) => prev - 1);
                  }}
                />
                <span>{counter}</span>
                <IoMdArrowDropright
                  fontSize={30}
                  style={{ color: counter >= MAX_COUNTER ? "#D5D5D5" : "" }}
                  onClick={() => {
                    if (counter >= MAX_COUNTER) return;
                    setCounter((prev) => prev + 1);
                  }}
                />
              </div>
              <div className="mint-button-container">
                <button>
                  Mint {counter} for{" "}
                  {(
                    counter * (PHASE_1 ? PHASE_1_PRICE : PHASE_2_PRICE)
                  ).toFixed(2)}{" "}
                  - using <span style={{ color: "#0ECF74" }}>Abstract</span> ETH
                </button>
                <button>
                  Mint {counter} for{" "}
                  {(
                    counter * (PHASE_1 ? PHASE_1_PRICE : PHASE_2_PRICE)
                  ).toFixed(2)}{" "}
                  - using <span style={{ color: "#2CADF7" }}>Mainnet</span> ETH
                </button>
              </div>
            </Fragment>
          ) : (
            <button className="connect" onClick={connectWallet}>
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>
        <div className="mint-description">
          <h3>AVC isn’t just a PFP</h3>
          <p>
            It’s a platform for expression, creativity, and ownership. <br />
            We’ve built this collection with care, high-quality, handcrafted art
            by a team of seasoned Web3 builders, artists, and traders who’ve
            been through cycles and still believe in culture. <br />
            But we’re not stopping at the art. AVC is your access pass to a
            living, evolving universe of content, characters, and creator
            tools.as we are deeply aligned with the rise of Creator Capital
            Markets (CCM), where your PFP isn’t just a flex, it’s a functional,
            monetizable asset in the evolving creator economy like : <br />
            Physical & digital drops - Animated content – V Tuber-ready avatars
            - Creator tools - Community activations
          </p>
        </div>
      </div>
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
                href="/mint-info"
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
    </div>
  );
}

export default MintInfo;
