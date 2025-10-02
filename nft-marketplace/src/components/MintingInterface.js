import React, { useState, useEffect, useMemo } from 'react';
import { useWeb3 } from './WalletConnection';
import ContractService from '../services/contractService';

const MintingInterface = ({ showControls = true }) => {
  const { account, provider, signer, isConnected, isCorrectNetwork } = useWeb3();
  const [contractService, setContractService] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [mintQuantity, setMintQuantity] = useState(1);

  const [totalSupply, setTotalSupply] = useState(0);
  const [remainingSupply, setRemainingSupply] = useState(0);
  const [maxSupply, setMaxSupply] = useState(0);
  const [publicPrice, setPublicPrice] = useState('0');
  const [whitelistPrice, setWhitelistPrice] = useState('0');
  const [saleState, setSaleState] = useState('CLOSED');
  const [freeMintRemaining, setFreeMintRemaining] = useState(0);
  const [walletStats, setWalletStats] = useState(null);
  const [userTokens, setUserTokens] = useState([]);

  const [mintingStatus, setMintingStatus] = useState('');
  const [txHash, setTxHash] = useState('');

  const mintingConfig = useMemo(() => ContractService.getConfig(), []);

  useEffect(() => {
    if (provider && signer && isConnected) {
      const service = new ContractService(provider, signer);
      setContractService(service);
    } else {
      setContractService(null);
      setUserTokens([]);
      setTotalSupply(0);
      setRemainingSupply(0);
      setMaxSupply(0);
      setPublicPrice('0');
      setWhitelistPrice('0');
      setSaleState('CLOSED');
      setFreeMintRemaining(0);
      setWalletStats(null);
      setMintingStatus('');
      setTxHash('');
    }
  }, [provider, signer, isConnected]);

  useEffect(() => {
    if (contractService) {
      loadContractData(contractService);
    }
  }, [contractService, account]);

  const loadContractData = async (service) => {
    const activeService = service ?? contractService;
    if (!activeService) return;

    try {
      setIsBusy(true);

      const [
        totalSup,
        remainingSup,
        maxSup,
        pubPrice,
        wlPrice,
        state,
        freeRemaining,
        walletInfo,
        tokens
      ] = await Promise.all([
        activeService.getTotalSupply(),
        activeService.getRemainingSupply(),
        activeService.getMaxSupply(),
        activeService.getPublicPrice(),
        activeService.getWhitelistPrice(),
        activeService.getSaleState(),
        activeService.getFreeMintRemaining(),
        account ? activeService.getWalletMintStats(account) : null,
        account ? activeService.getWalletTokens(account) : []
      ]);

      setTotalSupply(totalSup.toNumber());
      setRemainingSupply(remainingSup.toNumber());
      setMaxSupply(maxSup.toNumber());
      setPublicPrice(activeService.formatEther(pubPrice));
      setWhitelistPrice(activeService.formatEther(wlPrice));
      setSaleState(state);
      setFreeMintRemaining(freeRemaining.toNumber());
      setWalletStats(walletInfo);
      setUserTokens(tokens.map((token) => token.toNumber()));
    } catch (error) {
      console.error('Error loading contract data:', error);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRefresh = () => {
    if (contractService) {
      loadContractData(contractService);
    }
  };

  const updateQuantity = (value) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      setMintQuantity(1);
      return;
    }

    const bounded = Math.min(10, Math.max(1, Math.floor(numeric)));
    setMintQuantity(bounded);
  };

  const getConfigEntry = (listKey) => {
    const list = mintingConfig?.lists?.[listKey] ?? [];
    if (!account) return null;
    return list.find((item) => item.address.toLowerCase() === account.toLowerCase());
  };

  const whitelistEntry = getConfigEntry('whitelist');
  const freeMintEntry = getConfigEntry('freeMint');

  const handleTransactionFeedback = (tx) => {
    setMintingStatus('Transaction submitted. Waiting for confirmation...');
    setTxHash(tx.hash);
  };

  const waitForReceipt = async (txPromise) => {
    try {
      const receipt = await txPromise;
      if (receipt && receipt.wait) {
        await receipt.wait();
      }
    } catch (error) {
      throw error;
    }
  };

  const handlePublicMint = async () => {
    if (!contractService || !isConnected || !isCorrectNetwork) {
      alert('Please connect your wallet on the Abstract testnet to mint.');
      return;
    }

    if (saleState !== 'PUBLIC') {
      alert('Public mint is not active right now.');
      return;
    }

    try {
      setMintingStatus('Preparing mint transaction...');
      setIsBusy(true);

      const gasEstimate = await contractService.estimateGas('publicMint', mintQuantity);
      const tx = await contractService.publicMint(mintQuantity, {
        gasLimit: gasEstimate.mul(110).div(100)
      });

      handleTransactionFeedback(tx);
      await tx.wait();

      setMintingStatus('Mint confirmed. Your NFT reveal will follow shortly.');
      await loadContractData(contractService);
      resetStatusLater();
    } catch (error) {
      handleMintError(error);
    } finally {
      setIsBusy(false);
    }
  };

  const handleWhitelistMint = async () => {
    if (!contractService || !isConnected || !isCorrectNetwork) {
      alert('Please connect your wallet on the Abstract testnet to mint.');
      return;
    }

    if (saleState !== 'WHITELIST') {
      alert('Whitelist mint is not active right now.');
      return;
    }

    if (!whitelistEntry || !Array.isArray(whitelistEntry.merkleProof) || whitelistEntry.merkleProof.length === 0) {
      alert('Merkle proof missing. Update config/mintingConfig.json for this wallet.');
      return;
    }

    try {
      setMintingStatus('Preparing whitelist mint...');
      setIsBusy(true);

      const gasEstimate = await contractService.estimateGas('whitelistMint', mintQuantity, whitelistEntry.merkleProof);
      const tx = await contractService.whitelistMint(mintQuantity, whitelistEntry.merkleProof, {
        gasLimit: gasEstimate.mul(110).div(100)
      });

      handleTransactionFeedback(tx);
      await tx.wait();

      setMintingStatus('Whitelist mint confirmed.');
      await loadContractData(contractService);
      resetStatusLater();
    } catch (error) {
      handleMintError(error);
    } finally {
      setIsBusy(false);
    }
  };

  const handleFreeMint = async () => {
    if (!contractService || !isConnected || !isCorrectNetwork) {
      alert('Please connect your wallet on the Abstract testnet to mint.');
      return;
    }

    if (!freeMintEntry || !Array.isArray(freeMintEntry.merkleProof) || freeMintEntry.merkleProof.length === 0) {
      alert('Free mint proof missing. Update config/mintingConfig.json for this wallet.');
      return;
    }

    if (!walletStats || walletStats.freeMintAllowance === 0) {
      alert('You have no free mint allowance left.');
      return;
    }

    try {
      setMintingStatus('Submitting free mint...');
      setIsBusy(true);

      const quantity = Math.min(mintQuantity, walletStats.freeMintAllowance);
      const gasEstimate = await contractService.estimateGas('freeMint', quantity, freeMintEntry.merkleProof);
      const tx = await contractService.freeMint(quantity, freeMintEntry.merkleProof, {
        gasLimit: gasEstimate.mul(110).div(100)
      });

      handleTransactionFeedback(tx);
      await tx.wait();

      setMintingStatus('Free mint confirmed.');
      await loadContractData(contractService);
      resetStatusLater();
    } catch (error) {
      handleMintError(error);
    } finally {
      setIsBusy(false);
    }
  };

  const handleMintError = (error) => {
    console.error('Minting error:', error);
    const message = error?.reason || error?.message || 'Minting failed';
    setMintingStatus(`Error: ${message}`);
  };

  const resetStatusLater = () => {
    setTimeout(() => {
      setMintingStatus('');
      setTxHash('');
    }, 5000);
  };

  const calculateTotalCost = () => {
    if (saleState === 'WHITELIST') {
      return (parseFloat(whitelistPrice || '0') * mintQuantity).toFixed(4);
    }
    return (parseFloat(publicPrice || '0') * mintQuantity).toFixed(4);
  };

  const progressPercentage = maxSupply > 0 ? (totalSupply / maxSupply) * 100 : 0;
  const saleBadgeClass =
    saleState === 'PUBLIC'
      ? 'badge-success'
      : saleState === 'WHITELIST'
      ? 'badge-warning'
      : 'badge-muted';
  const isErrorStatus = mintingStatus.startsWith('Error');

  const eligibleForWhitelist = Boolean(whitelistEntry);
  const eligibleForFreeMint = Boolean(freeMintEntry && walletStats && walletStats.freeMintAllowance > 0);

  if (!isConnected) {
    return (
      <div className="stack">
        <div className="card stack-sm">
          <h2 className="section-heading">Mint Abstract NFTs</h2>
          <p className="helper-text">
            Connect your wallet from the Overview tab to request NFTs from the prepared collection.
          </p>
        </div>
      </div>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <div className="stack">
        <div className="card stack-sm">
          <h2 className="section-heading">Mint Abstract NFTs</h2>
          <p className="helper-text">
            Switch your wallet to the Abstract Testnet (chain 11124) before minting.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card stack-sm">
        <div className="card-inline">
          <h2 className="section-heading">Mint Abstract NFTs</h2>
          <button onClick={handleRefresh} disabled={isBusy} className="button-secondary">
            {isBusy ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <p className="helper-text">
          Mint requests draw randomly from our finished artwork set. The exact NFT you receive is revealed after the transaction confirms.
        </p>
      </div>

      <div className="card stack-sm">
        <div className="card-inline">
          <span className="helper-text">Sale phase</span>
          <span className={`badge ${saleBadgeClass}`}>{saleState}</span>
        </div>
        <div className="card-inline">
          <span className="helper-text">Total minted</span>
          <strong>{totalSupply}</strong>
          <span className="helper-text">of {maxSupply || '-'}</span>
        </div>
        <div className="card-inline">
          <span className="helper-text">Remaining supply</span>
          <strong>{remainingSupply}</strong>
        </div>
        <div className="card-inline">
          <span className="helper-text">Public price</span>
          <strong>{publicPrice} ETH</strong>
        </div>
        <div className="card-inline">
          <span className="helper-text">Whitelist price</span>
          <strong>{whitelistPrice} ETH</strong>
        </div>
        <div className="card-inline">
          <span className="helper-text">Free mint remaining</span>
          <strong>{freeMintRemaining}</strong>
        </div>
        {walletStats && (
          <>
            <div className="card-inline">
              <span className="helper-text">Minted (whitelist/public/free)</span>
              <strong>
                {walletStats.whitelistMinted} / {walletStats.publicMinted} / {walletStats.freeMinted}
              </strong>
            </div>
            <div className="card-inline">
              <span className="helper-text">Free mint allowance</span>
              <strong>{walletStats.freeMintAllowance}</strong>
            </div>
            <div className="card-inline">
              <span className="helper-text">Partner collection holder</span>
              <span className={`badge ${walletStats.holdsPartnerToken ? 'badge-success' : 'badge-muted'}`}>
                {walletStats.holdsPartnerToken ? 'Yes' : 'No'}
              </span>
            </div>
          </>
        )}
        <div className="stack-sm">
          <span className="helper-text">Collection progress</span>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPercentage}%` }} />
          </div>
          <span className="helper-text">{progressPercentage.toFixed(1)}% minted</span>
        </div>
      </div>

      <div className="card stack-sm">
        <h3>Eligibility</h3>
        <div className="card-inline">
          <span className="helper-text">Whitelist</span>
          <span className={`badge ${eligibleForWhitelist ? 'badge-success' : 'badge-muted'}`}>
            {eligibleForWhitelist ? 'Eligible' : 'Not listed'}
          </span>
        </div>
        <div className="card-inline">
          <span className="helper-text">Free mint</span>
          <span className={`badge ${eligibleForFreeMint ? 'badge-success' : 'badge-muted'}`}>
            {eligibleForFreeMint ? 'Eligible' : 'Not listed'}
          </span>
        </div>
      </div>

      {showControls ? (
        saleState !== 'CLOSED' ? (
          <div className="card stack-sm">
            <label htmlFor="mint-quantity" className="helper-text">
              Quantity (max 10 per transaction)
            </label>
            <div className="row">
              <button onClick={() => updateQuantity(mintQuantity - 1)} disabled={isBusy} className="button-secondary">
                -
              </button>
              <input
                id="mint-quantity"
                type="number"
                min="1"
                max="10"
                value={mintQuantity}
                onChange={(event) => updateQuantity(event.target.value)}
              />
              <button onClick={() => updateQuantity(mintQuantity + 1)} disabled={isBusy} className="button-secondary">
                +
              </button>
            </div>

            <div className="card-inline">
              <span className="helper-text">Estimated total</span>
              <strong>{saleState === 'WHITELIST' ? whitelistPrice : publicPrice} ETH each</strong>
              <strong>{calculateTotalCost()} ETH total</strong>
            </div>

            <div className="row">
              {eligibleForFreeMint && (
                <button
                  onClick={handleFreeMint}
                  disabled={isBusy || walletStats?.freeMintAllowance === 0}
                  className="button-warning"
                >
                  {isBusy ? 'Processing...' : 'Free Mint'}
                </button>
              )}

              {saleState === 'WHITELIST' && eligibleForWhitelist ? (
                <button onClick={handleWhitelistMint} disabled={isBusy} className="button-primary">
                  {isBusy ? 'Processing...' : 'Whitelist Mint'}
                </button>
              ) : (
                <button onClick={handlePublicMint} disabled={isBusy || saleState === 'CLOSED'} className="button-primary">
                  {isBusy ? 'Processing...' : 'Public Mint'}
                </button>
              )}
            </div>

            {mintingStatus && (
              <div className={`card-muted ${isErrorStatus ? 'status-error' : 'status-success'}`}>
                <p>{mintingStatus}</p>
                {txHash && (
                  <p className="helper-text">
                    <a href={`https://explorer.testnet.abs.xyz/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
                      View transaction
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="card-muted">
            <p className="helper-text">Minting is paused. Check back soon.</p>
          </div>
        )
      ) : (
        <div className="card-muted">
          <p className="helper-text">
            Minting controls live on the Mint tab. This summary will expand with more analytics closer to launch.
          </p>
        </div>
      )}

      {userTokens.length > 0 && (
        <div className="card stack-sm">
          <h3>Your confirmed mints</h3>
          <div className="row">
            {userTokens.map((tokenId) => (
              <span key={tokenId} className="badge badge-muted">#{tokenId}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MintingInterface;

