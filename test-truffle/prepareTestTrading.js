require('dotenv').config();
const daiABI = require('../test-cli/abi/dai');
// userAddress must be unlocked using --unlock ADDRESS
const userAddress = process.env.TRADERWALLETADDR;
const daiAddress = '0x6b175474e89094c44da98b954eedeac495271d0f';
const daiContract = new web3.eth.Contract(daiABI, daiAddress);
const ForceSend = artifacts.require('ForceSend');


contract('Prepare Assets', async accounts => {
  // For gas
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
  //flashloan fee
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

});
