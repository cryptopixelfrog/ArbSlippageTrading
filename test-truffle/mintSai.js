//https://medium.com/ethereum-grid/forking-ethereum-mainnet-mint-your-own-dai-d8b62a82b3f7
//https://github.com/ryanio/truffle-mint-dai/blob/master/test/sai.js

require('dotenv').config();
const erc20ABI = require('../test-cli/abi/erc20');
const ForceSend = artifacts.require('ForceSend');
// saiAddress must be unlocked using --unlock 0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359
const saiAddress = '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359';
const saiContract = new web3.eth.Contract(erc20ABI, saiAddress);
const userAddress = process.env.TRADERWALLETADDR;

const getSaiBalance = async account => {
  return saiContract.methods.balanceOf(account).call();
};

contract('Truffle Mint SAI', async accounts => {
  it('should send ether to the SAI contract', async () => {
    // Send 1 eth to saiAddress to have gas to mint.
    // Uses ForceSend contract, otherwise just sending
    // a normal tx will revert.
    const forceSend = await ForceSend.new();
    await forceSend.go(saiAddress, { value: web3.utils.toWei('2', 'ether') });
    var ethBalance = web3.eth.getBalance(saiAddress).then(function(ethBalance){
      console.log('balance', ethBalance);
    });
  });

  it('should mint SAI for our first 5 generated accounts', async () => {
    // Get 100 SAI for first 5 accounts
    // saiAddress is passed to ganache-cli with flag `--unlock`
    // so we can use the `mint` method.
    await saiContract.methods
        .mint(accounts[0], web3.utils.toWei('200', 'ether'))
        .send({ from: saiAddress });
    const saiBalance = await getSaiBalance(accounts[0]);
    console.log('saiBalance: ', saiBalance);
  });

  it('Mint SAI for me', async () => {
    await saiContract.methods
        .mint(userAddress, web3.utils.toWei('200', 'ether'))
        .send({ from: saiAddress });
    const usersaiBalance = await saiContract.methods.balanceOf(userAddress).call();
    console.log('usersaiBalance: ', usersaiBalance);
  });

  it('FlashLoanReceiver Smart Contract', async () => {
    await saiContract.methods
        .mint(process.env.FLASHLOANRECEIVERCONTRACT, web3.utils.toWei('200', 'ether'))
        .send({ from: saiAddress });
    const flashsaiBalance = await saiContract.methods.balanceOf(process.env.FLASHLOANRECEIVERCONTRACT).call();
    console.log('FlashLoanReceiver SC SAI balance: ', flashsaiBalance);
  });

});
