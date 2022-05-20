// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

/**
 * @dev Modifier 'onlyOwner' becomes available, where owner is the contract deployer
 */
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev ERC721 token standard
 */
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";


/**
 * @dev Merkle tree
 */
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";


// change contract name
contract ForeverBots is Ownable, ERC721 { 

  
    uint256 public totalSupply;
    uint256 public maxSupply = 5000;

    uint256 public cost = 0.15 ether;
    uint256 public mintsPerWallet = 1;

    bool public preSaleStatus;
    bool public publicSaleStatus;

    string public baseTokenURI;

    bytes32 public root;
    

    constructor( 
        string memory _preRevealURI
    ) ERC721("ForeverBots", "BOTS") { 
        baseTokenURI = _preRevealURI;
    }
    
    
    // --- EVENTS --- //
    
    event TokenMinted(uint256 tokenId, address indexed recipient);


    // --- MAPPINGS --- //

    mapping(address => uint) public hasMinted;
        
    
    // --- PUBLIC --- //
    
    
    /**
     * @dev Mint tokens through public sale
     */
    function mint(uint _amount) external payable returns(bool) {
    
        require(publicSaleStatus, "Public sale not live");
        require(hasMinted[msg.sender] + _amount <= mintsPerWallet, "Would exceed mints per wallet limit");
        require(msg.value == cost * _amount, "Incorrect funds supplied"); // mint cost
        require(totalSupply + _amount <= maxSupply, "All tokens have been minted");
        
        mintAmount(msg.sender, _amount);
        return true;
    }

    /**
     * @dev Mint tokens through pre sale
     */
    function whitelistMint(uint _amount, bytes32[] memory _proof) external payable returns(bool) {

        require(hasMinted[msg.sender] + _amount <= mintsPerWallet, "Would exceed mints per wallet limit");
        require(msg.value == cost * _amount, "Incorrect funds supplied"); // mint cost
        require(totalSupply + _amount <= maxSupply, "All tokens have been minted");
        require(preSaleStatus, "Presale not live");
        require(MerkleProof.verify(_proof, root, keccak256(abi.encodePacked(msg.sender))) == true, "Not on whitelist");

        mintAmount(msg.sender, _amount);
        return true;
    }
    

    // --- INTERNAL --- //
    
    function mintAmount(address _user, uint _amount) internal {
        hasMinted[_user] += _amount;
        for (uint i=0; i<_amount; i++) {
            uint tokenId = totalSupply + (i+1);
            _mint(_user, tokenId);
            emit TokenMinted(tokenId, _user);
        }
        totalSupply += _amount;
    }
    
    
    // --- VIEW --- //
    
    
    /**
     * @dev Returns tokenURI, which, if revealedStatus = true, is comprised of the baseURI concatenated with the tokenId
     */
    function tokenURI(uint256 _tokenId) public view override returns(string memory) {

        require(_exists(_tokenId), "ERC721Metadata: URI query for nonexistent token");

        return string(abi.encodePacked(baseTokenURI, Strings.toString(_tokenId), ".json"));
    }


    /**
     * @dev Returns boolean of whether '_address' has minted
     */
    function hasMintedGetter(address _address) external view returns(uint) {
        return hasMinted[_address];
    }



    // --- ONLY OWNER ---

    
    /**
     * @dev Withdraw all ether from smart contract. Only contract owner can call.
     * @param _to - address ether will be sent to
     */
    function withdrawAllFunds(address payable _to) external onlyOwner {
        require(address(this).balance > 0, "No funds to withdraw");
        _to.transfer(address(this).balance);
    }

    /**
     * @dev Set the baseURI string.
     * @param _newBaseUri - new base URI of metadata (Example:   ipfs://cid/)
     */
    function setBaseUri(string memory _newBaseUri) external onlyOwner {
        baseTokenURI = _newBaseUri;
    }
    
    
    /**
     * @dev Set the cost of minting a token
     * @param _newCost in Wei. Where 1 Wei = 10^-18 ether
     */
    function setCost(uint _newCost) external onlyOwner {
        cost = _newCost;
    }

    /**
     * @dev Set the number of mints per wallet
     */
    function setMintsPerWallet(uint _newMintsPerWallet) external onlyOwner {
        mintsPerWallet = _newMintsPerWallet;
    }
    
    
    /**
     * @dev Set the status of the pre sale.
     */
    function setPreSaleStatus(bool _status) external onlyOwner {
        preSaleStatus = _status;
    }
    
    
    /**
     * @dev Set the status of the public sale.
     */
    function setPublicSaleStatus(bool _status) external onlyOwner {
        publicSaleStatus = _status;
    }


    /**
     * @dev Set the root for Merkle Proof
     */
    function setRoot(bytes32 _newRoot) external onlyOwner {
        root = _newRoot;
    }


    /**
     * @dev Airdrop 1 token to each address in array '_to'
     * @param _to - array of address' that tokens will be sent to
     */
    function airDrop(address[] calldata _to) external onlyOwner {

        require(totalSupply + _to.length <= maxSupply, "Minting this many would exceed the max supply");

        for (uint i=0; i<_to.length; i++) {
            uint tokenId = totalSupply + 1;
            totalSupply++;
            _mint(_to[i], tokenId);
            emit TokenMinted(tokenId, _to[i]);
        }
    }

    
}