// https://github.com/Uniswap/uniswap-v1/blob/master/contracts/uniswap_exchange.vy#L266
// https://uniswap.org/docs/v1/smart-contracts/exchange/#tokentoethtransferinput
// https://developer.kyber.network/docs/KyberNetworkProxy/#swapethertotoken


const process = require('process');
const rdl = require('readline');
const std = process.stdout

require('dotenv').config();
const Web3 = require('web3');
const fs = require('fs');
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.INFURENDPOINT));

const UniswapExchangeABI = JSON.parse(fs.readFileSync('build/contracts/UniswapExchangeInterface.json'))
const uniSwapWBTCExAddress = '0x4d2f5cFbA55AE412221182D8475bC85799A5644b'; // https://etherscan.io/address/0x4d2f5cfba55ae412221182d8475bc85799a5644b
const UniswapContractInst = new web3.eth.Contract(UniswapExchangeABI.abi, uniSwapWBTCExAddress);

const KyberExchangeABI = JSON.parse(fs.readFileSync('build/contracts/KyberNetworkProxy.json'))
const kyberExchangeAddress = '0x818E6FECD516Ecc3849DAf6845e3EC868087B755';
const KyberContractInst = new web3.eth.Contract(KyberExchangeABI.abi, kyberExchangeAddress);

var wbtcPriceSellUniswap = 0;
var wbtcPriceBuyKyber = 0;
var profit;


async function getExchangeRate(){
  let ethAddr = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  let wbtcAddr = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'; // https://etherscan.io/token/0x2260fac5e5542a773aa44fbcfedf7c193bc2c599
  let srcQty = web3.utils.toHex(1 * 10 ** 18); // 1 eth

  let ethToWbtcRate = await KyberContractInst.methods.getExpectedRate(ethAddr, wbtcAddr, srcQty).call().then(function(result){
    //console.log(web3.utils.fromWei(srcQty) + ' ETH is ' + web3.utils.fromWei(result['expectedRate'], 'ether') + ' WBTC(kyber - expectedRate)');
    //console.log(web3.utils.fromWei(srcQty) + ' ETH is ' + web3.utils.fromWei(result['slippageRate'], 'ether') + ' WBTC(kyber - slippageRate)');

    wbtcPriceBuyKyber = result['expectedRate'];
    //console.log('wbtcPriceBuyKyber: ', wbtcPriceBuyKyber);
  });

  // Get uniswap ETH to WBTC rate, this give 1 eth. By usig getTokenToEthOutputPrice, we know WBTC rate based on 1 ETH.
  let wbtcOutPriceRaw = await UniswapContractInst.methods.getTokenToEthOutputPrice(srcQty).call();
  let wbtcOutPrice = web3.utils.fromWei(web3.utils.toHex(wbtcOutPriceRaw * 10 ** 10));
  //console.log('wbtcOutPrice: ' , wbtcOutPrice);
  //console.log(web3.utils.fromWei(srcQty) + ' ETH is ' + wbtcOutPrice + ' WBTC(uniswap)');

  wbtcPriceSellUniswap = wbtcOutPriceRaw;
  //console.log('wbtcPriceSellUniswap: ', wbtcPriceSellUniswap);

  // ETH to WBTC sell price
  // exchangeContract.methods.getTokenToEthInputPrice(tokens_sold).call()
  //let fakeWbtc = web3.utils.toHex(100 * 10 ** 18);
  //let wbtcSellPrice = await UniswapContractInst.methods.getTokenToEthInputPrice(fakeWbtc.toString()).call();
  //let pfakeWbtc = new web3.utils.BN('1000000000000000000');
  //console.log(web3.utils.fromWei(pfakeWbtc) + ' WBTC is ' + web3.utils.fromWei(wbtcSellPrice, 'ether') + ' ETH(uniswap)');

  // This calculate max ETH amount we can get from Uniswap based on WBTC amount(wbtcPriceBuyKyber) we get from Kyber.
  //console.log('wbtcPriceBuyKyber: ', wbtcPriceBuyKyber);
  let wbtcPriceBuyKyberRaw = wbtcPriceBuyKyber/10 ** 10;
  let wbtcToEthRate = await UniswapContractInst.methods.getTokenToEthInputPrice(wbtcPriceBuyKyberRaw).call();
  //console.log('wbtcToEthRate: ', wbtcToEthRate);
  let intSrcQty = new web3.utils.BN(web3.utils.fromWei(parseInt(srcQty).toString(), 'wei'));
  let intWbtcToEthRate = new web3.utils.BN(wbtcToEthRate); // max ETH amount we can get from Uniswap based on WBTC amount(wbtcPriceBuyKyber) we get from Kyber.
  //console.log(web3.utils.fromWei(intWbtcToEthRate) + " : " + web3.utils.fromWei(intSrcQty));
  profit = intWbtcToEthRate.sub(intSrcQty);

  /*
  console.log("BUY-KYBER-EXCHANGE:", web3.utils.fromWei(wbtcPriceBuyKyber.toString()));
  console.log("SELL-UNISWAP-EXCHANGE:", wbtcOutPrice);
  console.log('profit: ', web3.utils.fromWei(profit));
  */


  // print on terminal.
  std.write( web3.utils.fromWei(intWbtcToEthRate) + " : " + web3.utils.fromWei(intSrcQty) +
  " | profit: " + web3.utils.fromWei(profit) )
  rdl.cursorTo(std, 0)

}

/*
let cron = setInterval(function(){
  getExchangeRate();
  std.clearLine()
  if( wbtcPriceBuyKyber > wbtcPriceSellUniswap){
    console.log(web3.utils.fromWei(wbtcPriceBuyKyber.toString(), 'ether') +" : "+ web3.utils.fromWei(wbtcPriceSellUniswap.toString(), 'ether') +
    "\n profit: " + web3.utils.fromWei(profit.toString(), 'ether'));
    console.log("<< Got Arbitrage >>");
    let date_arb_start = new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'});
    console.log("Arbitrage starts at: " + date_arb_start + "\n");
    //stopCron();
    let cron2 = setInterval(function(){
      if(wbtcPriceBuyKyber > wbtcPriceSellUniswap){
        console.log(web3.utils.fromWei(wbtcPriceBuyKyber.toString(), 'ether') +" : "+ web3.utils.fromWei(wbtcPriceSellUniswap.toString(), 'ether') +
        "\n profit: " + web3.utils.fromWei(profit.toString(), 'ether'));
      } else if (wbtcPriceSellUniswap > wbtcPriceBuyKyber){
        let date_arb_end = new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'});
        console.log("Arbitrage ends at: " + date_arb_end + "\n");
        stopCron(cron2);
        stopCron(cron);
      }
    }, 1000);
  }else if(wbtcPriceSellUniswap > wbtcPriceBuyKyber){
    //console.log("Negative Arbitrage\n");
  }
}, 1000);
function stopCron(cron){ clearInterval(cron); };
*/


let cron = setCron();

function setCron(){
  setInterval(function(){
    getExchangeRate();
    std.clearLine();
    if( wbtcPriceBuyKyber > wbtcPriceSellUniswap){
      console.log(web3.utils.fromWei(wbtcPriceBuyKyber.toString(), 'ether') +" : "+ web3.utils.fromWei(wbtcPriceSellUniswap.toString(), 'ether') +
      "\n profit: " + web3.utils.fromWei(profit.toString(), 'ether'));
      console.log("<< Got Arbitrage >>");
      let date_arb_start = new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'});
      console.log("Arbitrage starts at: " + date_arb_start + "\n");
      //clearInterval(this);
      let cron2 = setDuration();
    }else if(wbtcPriceBuyKyber < wbtcPriceSellUniswap){
      //console.log("Negative Arbitrage");
    }
  }, 1000)
}

function setDuration(){
  setInterval(function(){
    if(wbtcPriceBuyKyber > wbtcPriceSellUniswap){
      console.log(web3.utils.fromWei(wbtcPriceBuyKyber.toString(), 'ether') +" : "+ web3.utils.fromWei(wbtcPriceSellUniswap.toString(), 'ether') +
      "\n profit: " + web3.utils.fromWei(profit.toString(), 'ether'));
    } else if (wbtcPriceBuyKyber < wbtcPriceSellUniswap){
      let date_arb_end = new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'});
      console.log("Arbitrage ends at: " + date_arb_end + "\n");
      clearInterval(this);
      setCron();
    }
  }, 1000);
}
