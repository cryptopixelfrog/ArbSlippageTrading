// https://github.com/Uniswap/uniswap-v1/blob/master/contracts/uniswap_exchange.vy#L266
// https://uniswap.org/docs/v1/smart-contracts/exchange/#tokentoethtransferinput
// https://developer.kyber.network/docs/KyberNetworkProxy/#swapethertotoken
require('dotenv').config();
const fs = require('fs');

const process = require('process');
const rdl = require('readline');
const std = process.stdout

const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.INFURENDPOINT));

const UniswapExchangeABI = JSON.parse(fs.readFileSync('build/contracts/UniswapExchangeInterface.json'))
const uniSwapDAIExAddress = '0x2a1530C4C41db0B0b2bB646CB5Eb1A67b7158667';
const UniswapContractInst = new web3.eth.Contract(UniswapExchangeABI.abi, uniSwapDAIExAddress);

const KyberExchangeABI = JSON.parse(fs.readFileSync('build/contracts/KyberNetworkProxy.json'))
const kyberExchangeAddress = '0x818E6FECD516Ecc3849DAf6845e3EC868087B755';
const KyberContractInst = new web3.eth.Contract(KyberExchangeABI.abi, kyberExchangeAddress);

var daiPriceSellUniswap = 0;
var daiPriceBuyKyber = 0;
var profit;


async function getExchangeRate(){
  let ethAddr = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  let daiAddr = '0x6b175474e89094c44da98b954eedeac495271d0f';
  let srcQty = web3.utils.toHex(1 * 10 ** 18); // 1 eth

  let ethToDaiRate = await KyberContractInst.methods.getExpectedRate(ethAddr, daiAddr, srcQty).call().then(function(result){
    //console.log(web3.utils.fromWei(srcQty) + ' ETH is ' + web3.utils.fromWei(result['expectedRate'], 'ether') + ' DAI(kyber - expectedRate)');
    //console.log(web3.utils.fromWei(srcQty) + ' ETH is ' + web3.utils.fromWei(result['slippageRate'], 'ether') + ' DAI(kyber - slippageRate)');
    //console.log("BUY-KYBER-EXCHANGE:", web3.utils.fromWei(result['expectedRate']));
    daiPriceBuyKyber = parseInt(result['expectedRate']);
  });

  // Get uniswap ETH to DAI rate, this give 1 eth. By usig getTokenToEthOutputPrice, we know DAI rate based on 1 ETH.
  let daiOutPrice = await UniswapContractInst.methods.getTokenToEthOutputPrice(srcQty).call(); // eth amount -> dai amount
  //console.log(web3.utils.fromWei(srcQty) + ' ETH is ' + web3.utils.fromWei(daiOutPrice, 'ether') + ' DAI(uniswap)');
  //console.log("SELL-UNISWAP-EXCHANGE:", web3.utils.fromWei(daiOutPrice));
  daiPriceSellUniswap = parseInt(daiOutPrice);

  // ETH to DAI sell price
  // exchangeContract.methods.getTokenToEthInputPrice(tokens_sold).call()
  //let fakeDai = web3.utils.toHex(100 * 10 ** 18);
  //let daiSellPrice = await UniswapContractInst.methods.getTokenToEthInputPrice(fakeDai.toString()).call();
  //let pfakeDai = new web3.utils.BN('1000000000000000000');
  //console.log(web3.utils.fromWei(pfakeDai) + ' DAI is ' + web3.utils.fromWei(daiSellPrice, 'ether') + ' ETH(uniswap)');

  // This calculate max ETH amount we can get from Uniswap based on DAI amount(daiPriceBuyKyber) we get from Kyber.
  let daiToEthRate = await UniswapContractInst.methods.getTokenToEthInputPrice(daiPriceBuyKyber.toString()).call();
  let intSrcQty = new web3.utils.BN(web3.utils.fromWei(parseInt(srcQty).toString(), 'wei'));
  let intDaiToEthRate = new web3.utils.BN(daiToEthRate);
  //console.log(web3.utils.fromWei(intDaiToEthRate) + " : " + web3.utils.fromWei(intSrcQty));
  profit = intDaiToEthRate.sub(intSrcQty);
  //console.log('profit: ', web3.utils.fromWei(profit));

  // print on terminal.
  std.write( web3.utils.fromWei(intDaiToEthRate) + " : " + web3.utils.fromWei(intSrcQty) +
  " | profit: " + web3.utils.fromWei(profit) )
  rdl.cursorTo(std, 0)

}

/*
let cron = setInterval(function(){
  getExchangeRate();
  std.clearLine()
  if( daiPriceBuyKyber > daiPriceSellUniswap){
    console.log(web3.utils.fromWei(daiPriceBuyKyber.toString(), 'ether') +" : "+ web3.utils.fromWei(daiPriceSellUniswap.toString(), 'ether') +
    "\n profit: " + web3.utils.fromWei(profit.toString(), 'ether'));
    console.log("<< Got Arbitrage >>");
    let date_arb_start = new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'});
    console.log("Arbitrage starts at: " + date_arb_start + "\n");
    //stopCron();
    let cron2 = setInterval(function(){
      if(daiPriceBuyKyber > daiPriceSellUniswap){
        console.log(web3.utils.fromWei(daiPriceBuyKyber.toString(), 'ether') +" : "+ web3.utils.fromWei(daiPriceSellUniswap.toString(), 'ether') +
        "\n profit: " + web3.utils.fromWei(profit.toString(), 'ether'));
      } else if (daiPriceSellUniswap > daiPriceBuyKyber){
        let date_arb_end = new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'});
        console.log("Arbitrage ends at: " + date_arb_end + "\n");
        stopCron(cron2);
        stopCron(cron);
      }
    }, 1000);
  }else if(daiPriceSellUniswap > daiPriceBuyKyber){
    //console.log("Negative Arbitrage\n");
  }
}, 1000)
function stopCron(cron){ clearInterval(cron); };
*/


let cron = setCron();

function setCron(){
  setInterval(function(){
    getExchangeRate();
    std.clearLine();
    if( daiPriceBuyKyber > daiPriceSellUniswap){
      console.log(web3.utils.fromWei(daiPriceBuyKyber.toString(), 'ether') +" : "+ web3.utils.fromWei(daiPriceSellUniswap.toString(), 'ether') +
      "\n profit: " + web3.utils.fromWei(profit.toString(), 'ether'));
      console.log("<< Got Arbitrage >>");
      let date_arb_start = new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'});
      console.log("Arbitrage starts at: " + date_arb_start + "\n");
      //clearInterval(this);
      let cron2 = setDuration();
    }else if(daiPriceBuyKyber < daiPriceSellUniswap){
      //console.log("Negative Arbitrage");
    }
  }, 1000)
}

function setDuration(){
  setInterval(function(){
    if(daiPriceBuyKyber > daiPriceSellUniswap){
      console.log(web3.utils.fromWei(daiPriceBuyKyber.toString(), 'ether') +" : "+ web3.utils.fromWei(daiPriceSellUniswap.toString(), 'ether') +
      "\n profit: " + web3.utils.fromWei(profit.toString(), 'ether'));
    } else if (daiPriceBuyKyber < daiPriceSellUniswap){
      let date_arb_end = new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'});
      console.log("Arbitrage ends at: " + date_arb_end + "\n");
      setCron();
      clearInterval(this);
    }
  }, 1000);
}
