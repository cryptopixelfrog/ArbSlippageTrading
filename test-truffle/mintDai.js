// https://medium.com/ethereum-grid/forking-ethereum-mainnet-mint-your-own-dai-d8b62a82b3f7
// https://github.com/ryanio/truffle-mint-dai/blob/master/test/dai.js
require('dotenv').config();
const daiABI = require('../test-cli/abi/dai');
// userAddress must be unlocked using --unlock 0x6b175474e89094c44da98b954eedeac495271d0f
const userAddress = process.env.TRADERWALLETADDR;
const daiAddress = '0x6b175474e89094c44da98b954eedeac495271d0f';
const daiContract = new web3.eth.Contract(daiABI, daiAddress);
const ForceSend = artifacts.require('ForceSend');


contract('Prepare Assets', async accounts => {
  it('Send ETH from account[0] to my wallet', async () => {
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: userAddress,
      value: web3.utils.toWei('10', 'ether')
    });
    var ethBalance = web3.eth.getBalance(userAddress).then(function(ethBalance){
      console.log('ETH balance in wallet: ', ethBalance);
    });
  });

  it('Send ETH to FlashLoanReceiver Smart Contract', async () => {
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: process.env.FLASHLOANRECEIVERCONTRACT,
      value: web3.utils.toWei('1', 'ether')
    });
    var ethBalance = web3.eth.getBalance(process.env.FLASHLOANRECEIVERCONTRACT).then(function(ethBalance){
      console.log('ETH balance in FlashLoanReceiver Smart Contract: ', ethBalance);
    });
  });

  it('Send ETH to the DAI mint contract', async () => {
    // Send 1 eth to daiAddress to have gas to mint.
    // Uses ForceSend contract, otherwise just sending
    // a normal tx will revert.
    const forceSend = await ForceSend.new();
    await forceSend.go(daiAddress, { value: web3.utils.toWei('2', 'ether') });
    var ethBalanceOnDaiAddr = web3.eth.getBalance(daiAddress).then(function(ethBalanceOnDaiAddr){
      console.log('ETH balance in DAI contract: ', ethBalanceOnDaiAddr);
    });
  });

  it('Mint DAI for accounts[0]', async () => {
    // daiAddress is passed to ganache-cli with flag `--unlock`
    // so we can use the `transfer` method
    await daiContract.methods
        .transfer(accounts[0], web3.utils.toWei('200', 'ether'))
        .send({ from: daiAddress, gasLimit: 800000 });
    const daiBalance = await daiContract.methods.balanceOf(accounts[0]).call();
    console.log('DAI balance in accounts[0]: ', daiBalance);
  });

  it('Mint DAI for my wallet', async () => {
    await daiContract.methods
        .transfer(userAddress, web3.utils.toWei('200', 'ether'))
        .send({ from: daiAddress, gasLimit: 800000 });
    const userdaiBalance = await daiContract.methods.balanceOf(userAddress).call();
    console.log('DAI balance in my wallet: ', userdaiBalance);
  });

  it('Mint DAI for FlashLoanReceiver Smart Contract', async () => {
    await daiContract.methods
        .transfer(process.env.FLASHLOANRECEIVERCONTRACT, web3.utils.toWei('200', 'ether'))
        .send({ from: daiAddress, gasLimit: 800000 });
    const flashdaiBalance = await daiContract.methods.balanceOf(process.env.FLASHLOANRECEIVERCONTRACT).call();
    console.log('DAI balance in FlashLoanReceiver SC: ', flashdaiBalance);
  });

});
