require('dotenv').config();
const Web3 = require('web3');
const fs = require('fs');
const LendingPoolAddressesProvider = JSON.parse(fs.readFileSync("./build/contracts/ILendingPoolAddressesProvider.json"));
const LendingPool = JSON.parse(fs.readFileSync("./build/contracts/ILendingPool.json"));
const ERC20Token =  JSON.parse(fs.readFileSync("./build/contracts/SafeERC20.json"));
const ArbSlippageTrading =  JSON.parse(fs.readFileSync("./build/contracts/ArbSlippageTrading.json"));
const Util = require("./utils/utils");

const TRADERACCOUNTADDR = process.env.TRADERWALLETADDR;
const LENDINGPOOLADDRESS = '0x24a42fD28C976A61Df5D00D0599C34c4f90748c8';
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.NETENDPOINT));
const receiverContract = process.env.FLASHLOANRECEIVERCONTRACT;
const reserveAddrETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const ArbSlippageTradingInst = new web3.eth.Contract(ArbSlippageTrading.abi, receiverContract);
const UniswapExchangeABI = JSON.parse(fs.readFileSync('build/contracts/UniswapExchange.json'))
const uniSwapDAIExAddress = '0x2a1530C4C41db0B0b2bB646CB5Eb1A67b7158667';
const UniswapContractInst = new web3.eth.Contract(UniswapExchangeABI.abi, uniSwapDAIExAddress);
const KyberExchangeABI = JSON.parse(fs.readFileSync('build/contracts/KyberNetworkProxy.json'))
const kyberExchangeAddress = '0x818E6FECD516Ecc3849DAf6845e3EC868087B755';
const KyberContractInst = new web3.eth.Contract(KyberExchangeABI.abi, kyberExchangeAddress);

const ethAddr = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const daiAddr = '0x6b175474e89094c44da98b954eedeac495271d0f';

const daiABI = require('../test-cli/abi/dai');
const daiContract = new web3.eth.Contract(daiABI, daiAddr);

const srcQty = web3.utils.toHex(1 * 10 ** 18); //how much the 1 eth coast. dont confuse this is not an amount of flashloan.
//The amount requested for this flashloan, this is amount of borrowing.
const loanAmount = 1;



// this works
async function initVariables(){
  // maxTokensSell(min_eth at tokentoethtransferinput) is a min amount of ETH I want to buy at uniswap.
  // To minimize my ETH loss compare with flashloan ETH, this should be at least same amount with flashloan ETH.
  // 0.99 eth - 1 eth flashloan flashloan,
  // 99 eth - 100 eth flashloan(this fails),
  // 98 eth - 100 eth flashloan(this works),
  // 98.9 eth - 100 eth flashloan(this works)
  //let maxTokensSell = web3.utils.toHex(98.90 * 10 ** 18); // hardcoded maxTokensSell
  console.log(loanAmount);
  let maxTokensSell = web3.utils.toHex((loanAmount * 0.98) * 10 ** 18);
  console.log(parseInt(maxTokensSell));

  let block = await web3.eth.getBlock('latest');
  let sellDeadline = block.timestamp + 300; // adding 5 min(300) - unix time,
  let setData = await ArbSlippageTradingInst.methods.setArray(maxTokensSell, sellDeadline).send({
    from: process.env.TRADERWALLETADDR,
    gasLimit: 800000
  });
  console.log(setData);
}


async function testFlashLoanTrading(){

  let receiver_starting_bal = await web3.eth.getBalance(receiverContract);
  let wallet_starting_bal = await web3.eth.getBalance(process.env.TRADERWALLETADDR);

  initVariables();

  /// Retrieve the LendingPool address
  const LendingPoolAddressesProviderInst = new web3.eth.Contract(LendingPoolAddressesProvider.abi, LENDINGPOOLADDRESS);
  const lendingPool = await LendingPoolAddressesProviderInst.methods.getLendingPool().call();
  //console.log('Lending pool is: ', lendingPool);
  const LendingPoolInst = new web3.eth.Contract(LendingPool.abi, lendingPool);
  const reserveData = await LendingPoolInst.methods.getReserveData(reserveAddrETH).call();
  //console.log('Reserve Data: ', reserveData);
  const userAccountData = await LendingPoolInst.methods.getUserAccountData(TRADERACCOUNTADDR).call();
  //console.log('userAccountData: ', userAccountData);

  var flashloanAmount = web3.utils.toHex(loanAmount * 10 ** 18);
  var byteMemoryData = '0x';

  console.log('FlashLoan Creating tx');
  const tx =  LendingPoolInst.methods.flashLoan(receiverContract, reserveAddrETH, flashloanAmount, byteMemoryData);

  console.log('Sending tx');
  var rx = await Util.sendTransaction(web3, tx, TRADERACCOUNTADDR, process.env.PRIVATEKEY, lendingPool);
  console.log('Done');

  getEvent('ethToToken');
  getEvent('tokenToEth');
  getEvent('profitTake');
  getEvent('tradePre');
  getEvent('tradeMade');
  getExchangeRate();

  let receiver_ending_bal = await web3.eth.getBalance(receiverContract);
  console.log("Receiver Contract ETH starting balance: ", web3.utils.fromWei(receiver_starting_bal, 'ether'));
  console.log("Receiver Contract ETH ending balance: ", web3.utils.fromWei(receiver_ending_bal, 'ether'));
  let wallet_ending_bal = await web3.eth.getBalance(process.env.TRADERWALLETADDR);
  console.log("Trader Wallet ETH starting balance: ", web3.utils.fromWei(wallet_starting_bal, 'ether'));
  console.log("Trader Wallet ETH ending balance: ", web3.utils.fromWei(wallet_ending_bal, 'ether'));

  let receiver_diff = new web3.utils.BN(receiver_starting_bal).sub(new web3.utils.BN(receiver_ending_bal));
  console.log("<< Receiver Contract ETH Diff : " + web3.utils.fromWei(receiver_diff, 'ether') + " >>");
  let wallet_diff = new web3.utils.BN(wallet_starting_bal).sub(new web3.utils.BN(wallet_ending_bal));
  console.log("<< Trader Wallet ETH Diff : " + web3.utils.fromWei(wallet_diff, 'ether') + " >>");
  let total_spent = receiver_diff.add(wallet_diff);
  console.log("<< Total ETH Spent : " + web3.utils.fromWei(total_spent, 'ether') + " >>");

}
testFlashLoanTrading();


async function withdrawETH(){
  let withdraw = await ArbSlippageTradingInst.methods.withdrawETH().send({
    from:TRADERACCOUNTADDR,
    gasLimit: 800000
  });
  console.log('withdraw: ', withdraw);

  let receiver_bal = await web3.eth.getBalance(receiverContract);
  console.log("Receiver Contract ETH balance: ", web3.utils.fromWei(receiver_bal, 'ether'));
  let wallet_bal = await web3.eth.getBalance(process.env.TRADERWALLETADDR);
  console.log("Trader Wallet ETH balance: ", web3.utils.fromWei(wallet_bal, 'ether'));
}
//withdrawETH();

async function withdrawDAI(){
  let withdraw = await ArbSlippageTradingInst.methods.withdrawDAI().send({
    from:TRADERACCOUNTADDR,
    gasLimit: 800000
  });
  console.log('withdraw: ', withdraw);
  let receiver_bal = await daiContract.methods.balanceOf(receiverContract).call();
  console.log("Receiver Contract DAI balance: ", web3.utils.fromWei(receiver_bal, 'ether'));
  let wallet_bal = await daiContract.methods.balanceOf(process.env.TRADERWALLETADDR).call();
  console.log("Trader Wallet DAI balance: ", web3.utils.fromWei(wallet_bal, 'ether'));
}
//withdrawDAI();


// get exchnage rate from Kyber and Uniswap
async function getExchangeRate(){

  let ethToDaiRate = await KyberContractInst.methods.getExpectedRate(ethAddr, daiAddr, srcQty).call().then(function(result){
    console.log(web3.utils.fromWei(srcQty) + ' ETH is ' + web3.utils.fromWei(result['expectedRate'], 'ether') + ' DAI(kyber - expectedRate)');
    console.log(web3.utils.fromWei(srcQty) + ' ETH is ' + web3.utils.fromWei(result['slippageRate'], 'ether') + ' DAI(kyber - slippageRate)');
  });

  // get uniswap ETH to DAI rate, this give 1 eth.
  // exchangeContract.methods.getTokenToEthOutputPrice(eth_bought).call()
  let daiOutPrice = await UniswapContractInst.methods.getTokenToEthOutputPrice(srcQty).call();
  console.log('1 ETH is ' + web3.utils.fromWei(daiOutPrice, 'ether') + ' DAI(uniswap)');
  // ETH to DAI sell price
  // exchangeContract.methods.getTokenToEthInputPrice(tokens_sold).call()
  let fakeDai = web3.utils.toHex(100 * 10 ** 18);
  let pfakeDai = new web3.utils.BN('1000000000000000000');
  let daiSellPrice = await UniswapContractInst.methods.getTokenToEthInputPrice(fakeDai.toString()).call();
  //console.log(web3.utils.fromWei(pfakeDai) + ' DAI is ' + web3.utils.fromWei(daiSellPrice, 'ether') + ' ETH(uniswap)');
}


async function getEvent(eventname){
  await ArbSlippageTradingInst.getPastEvents(eventname, {
      fromBlock: 'latest',
      toBlock: 'latest'
  }, (error, events) => {
      if (!error){
        var obj=JSON.parse(JSON.stringify(events));
        var array = Object.keys(obj)

        console.log("Event-" + eventname, obj[array[0]].returnValues);

      } else {
        console.log(error)
      }})
};
