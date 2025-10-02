// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract AbstractNFTCollection is
    ERC721,
    ERC721Enumerable,
    ERC2981,
    Ownable,
    Pausable,
    ReentrancyGuard
{
    using Strings for uint256;

    uint256 public constant MAX_SUPPLY = 4444;
    uint256 public constant MAX_PER_TRANSACTION = 10;
    uint256 public constant MAX_PER_WALLET = 20;
    uint256 public constant FREE_MINT_SUPPLY = 400;
    uint256 public constant MAX_FREE_PER_WALLET = 1;
    uint96 public constant BPS_DENOMINATOR = 10000;

    uint256 public publicPrice = 0.04 ether;
    uint256 public whitelistPrice = 0.02 ether;

    enum SaleState {
        CLOSED,
        WHITELIST,
        PUBLIC
    }

    SaleState public saleState = SaleState.CLOSED;

    bytes32 public whitelistMerkleRoot;
    bytes32 public freeMintMerkleRoot;
    address public partnerCollection;

    string private _baseTokenURI;
    string private _contractMetadataURI;
    string private _hiddenMetadataURI;
    bool public isRevealed;

    mapping(address => uint256) public whitelistMinted;
    mapping(address => uint256) public publicMinted;
    mapping(address => uint256) public freeMinted;
    uint256 public totalMinted;
    uint256 public freeMintRemaining = FREE_MINT_SUPPLY;

    address[4] public payoutRecipients;
    uint96[4] public payoutBasisPoints;

    uint256 private remainingTokenCount = MAX_SUPPLY;
    mapping(uint256 => uint256) private tokenMatrix;

    event Minted(address indexed to, uint256 quantity, uint256 totalCost);
    event FreeMinted(address indexed to, uint256 quantity);
    event SaleStateChanged(SaleState newState);
    event PriceUpdated(uint256 publicPrice, uint256 whitelistPrice);
    event BaseURIUpdated(string newBaseURI);
    event HiddenURIUpdated(string newHiddenURI);
    event ContractURIUpdated(string newContractURI);
    event PayoutConfigUpdated(address[4] recipients, uint96[4] basisPoints);
    event RoyaltyInfoUpdated(address receiver, uint96 feeNumerator);
    event PartnerCollectionUpdated(address collection);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory hiddenMetadataURI_,
        string memory contractMetadataURI_,
        bytes32 whitelistRoot_,
        bytes32 freeMintRoot_,
        address partnerCollection_,
        address royaltyReceiver_,
        uint96 royaltyFeeBps_
    ) ERC721(name_, symbol_) {
        _hiddenMetadataURI = hiddenMetadataURI_;
        _contractMetadataURI = contractMetadataURI_;
        whitelistMerkleRoot = whitelistRoot_;
        freeMintMerkleRoot = freeMintRoot_;
        partnerCollection = partnerCollection_;

        // Default payout configuration sends all funds to the owner until updated
        payoutRecipients[0] = _msgSender();
        payoutBasisPoints[0] = BPS_DENOMINATOR;

        require(royaltyFeeBps_ <= BPS_DENOMINATOR, "Royalty too high");
        address receiver = royaltyReceiver_ != address(0) ? royaltyReceiver_ : _msgSender();
        _setDefaultRoyalty(receiver, royaltyFeeBps_);
    }

    // -----------------
    // Minting functions
    // -----------------

    function whitelistMint(uint256 quantity, bytes32[] calldata merkleProof) external payable whenNotPaused nonReentrant {
        require(saleState == SaleState.WHITELIST, "Whitelist sale inactive");
        _validateMintRequest(quantity, whitelistPrice * quantity);

        bool eligible = _isWhitelisted(_msgSender(), merkleProof) || _holdsPartnerToken(_msgSender());
        require(eligible, "Not whitelisted");

        whitelistMinted[_msgSender()] += quantity;
        _processPayment(msg.value);
        _mintTokens(_msgSender(), quantity);

        emit Minted(_msgSender(), quantity, msg.value);
    }

    function publicMint(uint256 quantity) external payable whenNotPaused nonReentrant {
        require(saleState == SaleState.PUBLIC, "Public sale inactive");
        _validateMintRequest(quantity, publicPrice * quantity);

        publicMinted[_msgSender()] += quantity;
        _processPayment(msg.value);
        _mintTokens(_msgSender(), quantity);

        emit Minted(_msgSender(), quantity, msg.value);
    }

    function freeMint(uint256 quantity, bytes32[] calldata merkleProof) external whenNotPaused nonReentrant {
        require(quantity > 0 && quantity <= MAX_PER_TRANSACTION, "Invalid quantity");
        require(totalMinted + quantity <= MAX_SUPPLY, "Exceeds supply");
        require(freeMintRemaining >= quantity, "Free mint exhausted");
        require(freeMinted[_msgSender()] + quantity <= MAX_FREE_PER_WALLET, "Free mint limit");
        require(_isFreeMintEligible(_msgSender(), merkleProof), "Not eligible for free mint");

        freeMinted[_msgSender()] += quantity;
        freeMintRemaining -= quantity;
        _mintTokens(_msgSender(), quantity);

        emit FreeMinted(_msgSender(), quantity);
    }

    function ownerMint(address to, uint256 quantity) external onlyOwner {
        require(totalMinted + quantity <= MAX_SUPPLY, "Exceeds supply");
        _mintTokens(to, quantity);
    }

    // -----------------
    // Admin operations
    // -----------------

    function setSaleState(SaleState newState) external onlyOwner {
        saleState = newState;
        emit SaleStateChanged(newState);
    }

    function setPrices(uint256 newPublicPrice, uint256 newWhitelistPrice) external onlyOwner {
        publicPrice = newPublicPrice;
        whitelistPrice = newWhitelistPrice;
        emit PriceUpdated(newPublicPrice, newWhitelistPrice);
    }

    function setWhitelistMerkleRoot(bytes32 newRoot) external onlyOwner {
        whitelistMerkleRoot = newRoot;
    }

    function setFreeMintMerkleRoot(bytes32 newRoot) external onlyOwner {
        freeMintMerkleRoot = newRoot;
    }

    function setPartnerCollection(address collection) external onlyOwner {
        partnerCollection = collection;
        emit PartnerCollectionUpdated(collection);
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    function setContractURI(string calldata newContractURI) external onlyOwner {
        _contractMetadataURI = newContractURI;
        emit ContractURIUpdated(newContractURI);
    }

    function setHiddenMetadataURI(string calldata newHiddenURI) external onlyOwner {
        _hiddenMetadataURI = newHiddenURI;
        emit HiddenURIUpdated(newHiddenURI);
    }

    function reveal() external onlyOwner {
        isRevealed = true;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setPayoutConfig(address[4] calldata recipients, uint96[4] calldata basisPoints) external onlyOwner {
        uint256 totalBps;
        for (uint256 i = 0; i < recipients.length; i++) {
            if (basisPoints[i] > 0) {
                require(recipients[i] != address(0), "Recipient missing");
            }
            totalBps += basisPoints[i];
            payoutRecipients[i] = recipients[i];
            payoutBasisPoints[i] = basisPoints[i];
        }
        require(totalBps == BPS_DENOMINATOR, "Invalid split");
        emit PayoutConfigUpdated(recipients, basisPoints);
    }

    function setRoyaltyInfo(address receiver, uint96 feeNumerator) external onlyOwner {
        require(feeNumerator <= BPS_DENOMINATOR, "Royalty too high");
        
        require(receiver != address(0), "Invalid royalty receiver");
        _setDefaultRoyalty(receiver, feeNumerator);
        emit RoyaltyInfoUpdated(receiver, feeNumerator);
    }

    function withdrawStuckEther() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdraw failed");
    }

    // -----------------
    // View helpers
    // -----------------

    struct WalletMintStats {
        uint256 whitelistMinted;
        uint256 publicMinted;
        uint256 freeMinted;
        uint256 freeMintAllowance;
        bool holdsPartnerToken;
    }

    function getWalletMintStats(address account) external view returns (WalletMintStats memory stats) {
        stats.whitelistMinted = whitelistMinted[account];
        stats.publicMinted = publicMinted[account];
        stats.freeMinted = freeMinted[account];
        stats.freeMintAllowance = MAX_FREE_PER_WALLET - freeMinted[account];
        stats.holdsPartnerToken = _holdsPartnerToken(account);
    }

    function remainingSupply() public view returns (uint256) {
        return remainingTokenCount;
    }

    function contractURI() external view returns (string memory) {
        return _contractMetadataURI;
    }

    // -----------------
    // Internal helpers
    // -----------------

    function _validateMintRequest(uint256 quantity, uint256 requiredValue) private {
        require(quantity > 0 && quantity <= MAX_PER_TRANSACTION, "Invalid quantity");
        require(totalMinted + quantity <= MAX_SUPPLY, "Exceeds supply");
        require(msg.value == requiredValue, "Incorrect payment");
        require((whitelistMinted[_msgSender()] + publicMinted[_msgSender()] + freeMinted[_msgSender()] + quantity) <= MAX_PER_WALLET, "Wallet limit");
    }

    function _isWhitelisted(address account, bytes32[] calldata merkleProof) private view returns (bool) {
        if (whitelistMerkleRoot == bytes32(0)) {
            return false;
        }
        bytes32 leaf = keccak256(abi.encodePacked(account));
        return MerkleProof.verify(merkleProof, whitelistMerkleRoot, leaf);
    }

    function _isFreeMintEligible(address account, bytes32[] calldata merkleProof) private view returns (bool) {
        if (freeMintMerkleRoot == bytes32(0)) {
            return false;
        }
        bytes32 leaf = keccak256(abi.encodePacked(account));
        return MerkleProof.verify(merkleProof, freeMintMerkleRoot, leaf);
    }

    function _holdsPartnerToken(address account) private view returns (bool) {
        if (partnerCollection == address(0)) {
            return false;
        }
        return IERC721(partnerCollection).balanceOf(account) > 0;
    }

    function _mintTokens(address to, uint256 quantity) private {
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _drawRandomTokenId(to);
            totalMinted += 1;
            _safeMint(to, tokenId);
        }
    }

    function _drawRandomTokenId(address minter) private returns (uint256) {
        require(remainingTokenCount > 0, "No tokens left");

        uint256 random = uint256(
            keccak256(
                abi.encodePacked(
                    minter,
                    block.timestamp,
                    block.prevrandao,
                    remainingTokenCount,
                    totalMinted
                )
            )
        ) % remainingTokenCount;

        uint256 tokenId = tokenMatrix[random];
        if (tokenId == 0) {
            tokenId = random;
        }

        uint256 lastValue = tokenMatrix[remainingTokenCount - 1];
        if (lastValue == 0) {
            tokenMatrix[random] = remainingTokenCount - 1;
        } else {
            tokenMatrix[random] = lastValue;
        }

        remainingTokenCount -= 1;
        return tokenId + 1; // Token IDs are 1-indexed
    }

    function _processPayment(uint256 amount) private {
        if (amount == 0) {
            return;
        }

        uint256 remainder = amount;
        for (uint256 i = 0; i < payoutRecipients.length; i++) {
            uint256 share = (amount * payoutBasisPoints[i]) / BPS_DENOMINATOR;
            if (i == payoutRecipients.length - 1) {
                share = remainder;
            } else if (share > remainder) {
                share = remainder;
            }

            if (share > 0) {
                address recipient = payoutRecipients[i];
                require(recipient != address(0), "Unset payout recipient");
                (bool success, ) = payable(recipient).call{value: share}("");
                require(success, "Payout failed");
                remainder -= share;
            }
        }
    }

    // -----------------
    // Metadata overrides
    // -----------------

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");

        if (!isRevealed) {
            return _hiddenMetadataURI;
        }

        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId.toString(), ".json")) : "";
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    // -----------------
    // Interface support
    // -----------------

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC2981) {
        super._burn(tokenId);
    }
}


