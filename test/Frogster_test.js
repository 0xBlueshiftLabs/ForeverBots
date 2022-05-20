// truffle test --compile-none


var chai = require("./setupchai.js");
const BN = web3.utils.BN;
const expect = chai.expect;
const truffleAssert = require('truffle-assertions');
const { latestTime } = require('./utils');
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const Frogster = artifacts.require("./ForeverBots");

var exampleHashes = ["0x7465737400000000000000000000000000000000000000000000000000000000", "0x7463737400000000000000000000000000000000000000000000000000000000"];


let addresses = [
	"0x627306090abaB3A6e1400e9345bC60c78a8BEf57", 
	"0xf17f52151EbEF6C7334FAD080c5704D77216b732",
	"0xC5fdf4076b8F3A5357c5E395ab970B5B54098Fef",
	"0x821aEa9a577a9b44299B9c15c88cf3087F3b5544",
];





// pass array of strings, returns merkletree object
const generateTreeFromHexLeafs = (leafs) => {
	tree = new MerkleTree(leafs, keccak256, {
		hashLeaves: true,
		sortPairs: true,
	});
	return tree;
};

// pass merkletree object and string leaf, returns array of strings
const getProofFromHexLeaf = (tree, leaf) => {
	const hash = keccak256(leaf);
	const proof = tree.getHexProof(hash);
	return proof;
};

let exampleMerkleTree = generateTreeFromHexLeafs(addresses);
const rootHash = exampleMerkleTree.getHexRoot();

// gets merkle proof for accounts[0]
let proof = getProofFromHexLeaf(exampleMerkleTree, addresses[0]);




contract('ForeverBots', accounts => {

  let frogster;

  beforeEach(async () => {
    frogster = await Frogster.new("preRevealURI");
    await frogster.setRoot(rootHash);
  })

  
  
  it('has default values', async () => {

    expect(await frogster.maxSupply()).to.be.a.bignumber.equal(new BN(5)); // 5000 in actual
    expect(await frogster.cost()).to.be.a.bignumber.equal(new BN(web3.utils.toWei('0.2', 'ether')));
    expect(await frogster.mintsPerWallet()).to.be.a.bignumber.equal(new BN(1));

    expect(await frogster.preSaleStatus()).to.equal(false);
    expect(await frogster.publicSaleStatus()).to.equal(false);

    expect(await frogster.name()).to.equal('ForeverBots');
    expect(await frogster.symbol()).to.equal('BOTS');
    expect(await frogster.baseTokenURI()).to.equal('preRevealURI');

    expect(await frogster.totalSupply()).to.be.a.bignumber.equal(new BN(0));
  })


  it('owner can set mint cost', async () => {

    expect(await frogster.cost()).to.be.a.bignumber.equal(new BN(web3.utils.toWei('0.2', 'ether')));
    await frogster.setCost(web3.utils.toWei('1', 'ether'));
    expect(await frogster.cost()).to.be.a.bignumber.equal(new BN(web3.utils.toWei('1', 'ether')));
    
  })

  it('owner can set root', async () => {

    expect(await frogster.root()).to.equal(rootHash);
    await frogster.setRoot(exampleHashes[0]);
    expect(await frogster.root()).to.equal(exampleHashes[0]);
    
  })


  it('owner can set pre and public sale status', async () => {

    expect(await frogster.preSaleStatus()).to.equal(false);
    expect(await frogster.publicSaleStatus()).to.equal(false);

    await frogster.setPreSaleStatus(true);
    expect(await frogster.preSaleStatus()).to.equal(true);
    expect(await frogster.publicSaleStatus()).to.equal(false);

    await frogster.setPublicSaleStatus(true);
    expect(await frogster.preSaleStatus()).to.equal(true);
    expect(await frogster.publicSaleStatus()).to.equal(true);

  })
  

  it('Whitelisted addresses can mint at pre sale', async () => {
    
    await frogster.setPreSaleStatus(true);

    // tries to mint without being on whitelist
    await truffleAssert.reverts(
      frogster.whitelistMint(1, proof, { from: accounts[7], value: 0.2e18 }),
      "Not on whitelist"
    );
    
    await frogster.whitelistMint(1, proof, { from: accounts[0], value: 0.2e18 });
    expect(await frogster.totalSupply()).to.be.a.bignumber.equal(new BN(1));
  
  })
  

  it('can mint from public sale', async () => {

    expect(await frogster.totalSupply()).to.be.a.bignumber.equal(new BN(0));

    // tries to mint before general sale live
    await truffleAssert.reverts(
      frogster.mint(1, { value: 0.2e18, from: accounts[9] }),
      "Public sale not live"
    );


    await frogster.setPublicSaleStatus(true);

    // wrong amount of ether sent
    await truffleAssert.reverts(
      frogster.mint(1, { value: 0.3e18 }),
      "Incorrect funds supplied"
    );

    await frogster.mint(1, { value: 0.2e18, from: accounts[9] });

    // tries to mint a 2nd
    await truffleAssert.reverts(
      frogster.mint(1, { value: 0.2e18, from: accounts[9] }),
      "Would exceed mints per wallet limit"
    );

    for (i=0; i<4; i++) {
      await frogster.mint(1, { value: 0.2e18, from: accounts[i+3] });
    }
    
    expect(await frogster.totalSupply()).to.be.a.bignumber.equal(new BN(5));

    // tries to mint after max supply reached
    await truffleAssert.reverts(
      frogster.mint(1, { value: 0.2e18, from: accounts[8] }),
      "All tokens have been minted"
    );

    expect(await web3.eth.getBalance(frogster.address)).to.be.a.bignumber.equal(new BN(web3.utils.toWei('1', 'ether')));
  })

  

  it('returns token URI but only for minted tokens', async () => {

    expect(await frogster.totalSupply()).to.be.a.bignumber.equal(new BN(0));

    await frogster.setPublicSaleStatus(true);

    // tries to read tokenURI for token yet to be minted
    await truffleAssert.reverts(
      frogster.tokenURI(1),
      "ERC721Metadata: URI query for nonexistent token"
    );
    
    await frogster.mint(1, { value: 0.2e18, from: accounts[9] });
    expect(await frogster.totalSupply()).to.be.a.bignumber.equal(new BN(1));
    expect(await frogster.tokenURI(1)).to.equal('preRevealURI1.json');

    await frogster.setBaseUri("baseURI");
    expect(await frogster.tokenURI(1)).to.equal('baseURI1.json');

    await frogster.mint(1, { value: 0.2e18, from: accounts[8] });
    expect(await frogster.totalSupply()).to.be.a.bignumber.equal(new BN(2));
    expect(await frogster.tokenURI(2)).to.equal('baseURI2.json');
  })


  it('can set base URI', async () => {

    expect(await frogster.totalSupply()).to.be.a.bignumber.equal(new BN(0));

    await frogster.setPublicSaleStatus(true);
    await frogster.setBaseUri("baseURI");

    await frogster.mint(1, { value: 0.2e18, from: accounts[9] });
    expect(await frogster.totalSupply()).to.be.a.bignumber.equal(new BN(1));
    expect(await frogster.tokenURI(1)).to.equal('baseURI1.json');

    await frogster.setBaseUri('editedBaseURI');
    expect(await frogster.tokenURI(1)).to.equal('editedBaseURI1.json');
  })


  it('owner can airdrop', async () => {

    await frogster.airDrop([accounts[2], accounts[3]]);

    expect(await frogster.balanceOf(accounts[2])).to.be.a.bignumber.equal(new BN(1));
    expect(await frogster.balanceOf(accounts[3])).to.be.a.bignumber.equal(new BN(1));
    expect(await frogster.totalSupply()).to.be.a.bignumber.equal(new BN(2));
  })


  it('can change mints per wallet', async () => {

    expect(await frogster.mintsPerWallet()).to.be.a.bignumber.equal(new BN(1));
    expect(await frogster.totalSupply()).to.be.a.bignumber.equal(new BN(0));
    expect(await frogster.balanceOf(accounts[0])).to.be.a.bignumber.equal(new BN(0));

    await frogster.setPublicSaleStatus(true);

    await frogster.mint(1, { value: 0.2e18 });
    expect(await frogster.totalSupply()).to.be.a.bignumber.equal(new BN(1));
    expect(await frogster.balanceOf(accounts[0])).to.be.a.bignumber.equal(new BN(1));

    // tries to mint a 2nd
    await truffleAssert.reverts(
      frogster.mint(1, { value: 0.2e18 }),
      "Would exceed mints per wallet limit"
    );

    await frogster.setMintsPerWallet(2);
    expect(await frogster.mintsPerWallet()).to.be.a.bignumber.equal(new BN(2));

    await frogster.mint(1, { value: 0.2e18 });

    // tries to mint a 3rd
    await truffleAssert.reverts(
      frogster.mint(1, { value: 0.2e18 }),
      "Would exceed mints per wallet limit"
    );
    
  })

  it('can airdrop tokens before minting goes live', async () => {

    expect(await frogster.totalSupply()).to.be.a.bignumber.equal(new BN(0));
    expect(await frogster.balanceOf(accounts[0])).to.be.a.bignumber.equal(new BN(0));

    await frogster.airDrop([accounts[0], accounts[1]]);

    expect(await frogster.totalSupply()).to.be.a.bignumber.equal(new BN(2));
    expect(await frogster.balanceOf(accounts[0])).to.be.a.bignumber.equal(new BN(1));
    expect(await frogster.balanceOf(accounts[1])).to.be.a.bignumber.equal(new BN(1));

    await frogster.setPublicSaleStatus(true);

    await frogster.mint(1, { value: 0.2e18 });
    expect(await frogster.totalSupply()).to.be.a.bignumber.equal(new BN(3));
    expect(await frogster.balanceOf(accounts[0])).to.be.a.bignumber.equal(new BN(2));

    // tries to mint a 2nd
    await truffleAssert.reverts(
      frogster.mint(1, { value: 0.2e18 }),
      "Would exceed mints per wallet limit"
    );
    
  })


})