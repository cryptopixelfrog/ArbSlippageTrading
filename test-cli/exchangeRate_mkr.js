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
const uniSwapMKRExAddress = '0x2C4Bd064b998838076fa341A83d007FC2FA50957';
const UniswapContractInst = new web3.eth.Contract(UniswapExchangeABI.abi, uniSwapMKRExAddress);

const KyberExchangeABI = JSON.parse(fs.readFileSync('build/contracts/KyberNetworkProxy.json'))
const kyberExchangeAddress = '0x818E6FECD516Ecc3849DAf6845e3EC868087B755';
const KyberContractInst = new web3.eth.Contract(KyberExchangeABI.abi, kyberExchangeAddress);

var mkrPriceSellUniswap = 0;
var mkrPriceBuyKyber = 0;
var profit;


async function getExchangeRate(){
  let ethAddr = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  let mkrAddr = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'; // https://etherscan.io/token/0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2
  let srcQty = web3.utils.toHex(1 * 10 ** 18); // 1 eth

  let ethToMkrRate = await KyberContractInst.methods.getExpectedRate(ethAddr, mkrAddr, srcQty).call().then(function(result){
    //console.log(web3.utils.fromWei(srcQty) + ' ETH is ' + web3.utils.fromWei(result['expectedRate'], 'ether') + ' MKR(kyber - expectedRate)');
    //console.log(web3.utils.fromWei(srcQty) + ' ETH is ' + web3.utils.fromWei(result['slippageRate'], 'ether') + ' MKR(kyber - slippageRate)');
    mkrPriceBuyKyber = parseInt(result['expectedRate']);
  });

  // Get uniswap ETH to MKR rate, this give 1 eth. By usig getTokenToEthOutputPrice, we know MKR rate based on 1 ETH.
  let mkrOutPrice = await UniswapContractInst.methods.getTokenToEthOutputPrice(srcQty).call();
  //console.log(web3.utils.fromWei(srcQty) + ' ETH is ' + web3.utils.fromWei(mkrOutPrice, 'ether') + ' MKR(uniswap)');

  mkrPriceSellUniswap = parseInt(mkrOutPrice);

  // ETH to MKR sell price
  // exchangeContract.methods.getTokenToEthInputPrice(tokens_sold).call()
  //let fakeMkr = web3.utils.toHex(100 * 10 ** 18);
  //let mkrSellPrice = await UniswapContractInst.methods.getTokenToEthInputPrice(fakeMkr.toString()).call();
  //let pfakeMkr = new web3.utils.BN('1000000000000000000');
  //console.log(web3.utils.fromWei(pfakeMkr) + ' MKR is ' + web3.utils.fromWei(mkrSellPrice, 'ether') + ' ETH(uniswap)');

  // This calculate max ETH amount we can get from Uniswap based on MKR amount(mkrPriceBuyKyber) we get from Kyber.
  let mkrToEthRate = await UniswapContractInst.methods.getTokenToEthInputPrice(mkrPriceBuyKyber.toString()).call();
  let intSrcQty = new web3.utils.BN(web3.utils.fromWei(parseInt(srcQty).toString(), 'wei'));
  let intMkrToEthRate = new web3.utils.BN(mkrToEthRate); // max ETH amount we can get from Uniswap based on MKR amount(mkrPriceBuyKyber) we get from Kyber.
  //console.log(web3.utils.fromWei(intMkrToEthRate) + " : " + web3.utils.fromWei(intSrcQty));
  profit = intMkrToEthRate.sub(intSrcQty);

  /*
  console.log("BUY-KYBER-EXCHANGE:", web3.utils.fromWei(mkrPriceBuyKyber.toString()));
  console.log("SELL-UNISWAP-EXCHANGE:", web3.utils.fromWei(mkrOutPrice));
  console.log('profit: ', web3.utils.fromWei(profit));
  */

  // print on terminal.
  std.write( web3.utils.fromWei(intMkrToEthRate) + " : " + web3.utils.fromWei(intSrcQty) +
  " | profit: " + web3.utils.fromWei(profit) )
  rdl.cursorTo(std, 0)

}

/*
let cron = setInterval(function(){
  getExchangeRate();
  std.clearLine()
  if( mkrPriceBuyKyber > mkrPriceSellUniswap){
    console.log(web3.utils.fromWei(mkrPriceBuyKyber.toString(), 'ether') +" : "+ web3.utils.fromWei(mkrPriceSellUniswap.toString(), 'ether') +
    "\n profit: " + web3.utils.fromWei(profit.toString(), 'ether'));
    console.log("<< Got Arbitrage >>");
    let date_arb_start = new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'});
    console.log("Arbitrage starts at: " + date_arb_start + "\n");
    //stopCron(cron);
    let cron2 = setInterval(function(){
      if(mkrPriceBuyKyber > mkrPriceSellUniswap){
        console.log(web3.utils.fromWei(mkrPriceBuyKyber.toString(), 'ether') +" : "+ web3.utils.fromWei(mkrPriceSellUniswap.toString(), 'ether') +
        "\n profit: " + web3.utils.fromWei(profit.toString(), 'ether'));
      } else if (mkrPriceBuyKyber < mkrPriceSellUniswap){
        let date_arb_end = new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'});
        console.log("Arbitrage ends at: " + date_arb_end + "\n");
        stopCron(cron2);
        stopCron(cron);
      }
    }, 1000);
  }else if(mkrPriceBuyKyber < mkrPriceSellUniswap){
    //console.log("Negative Arbitrage\n");
  }
}, 1000)
function stopCron(cron){
  clearInterval(cron);
};
*/

let cron = setCron();

function setCron(){
  setInterval(function(){
    getExchangeRate();
    std.clearLine();
    if( mkrPriceBuyKyber > mkrPriceSellUniswap){
      console.log(web3.utils.fromWei(mkrPriceBuyKyber.toString(), 'ether') +" : "+ web3.utils.fromWei(mkrPriceSellUniswap.toString(), 'ether') +
      "\n profit: " + web3.utils.fromWei(profit, 'ether'));
      console.log("<< Got Arbitrage >>");
      let date_arb_start = new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'});
      console.log("Arbitrage starts at: " + date_arb_start + "\n================\n");
      clearInterval(this);
      let cron2 = setDuration();
    }else if(mkrPriceBuyKyber < mkrPriceSellUniswap){
      //console.log("Negative Arbitrage");
    }
  }, 2000)
}

function setDuration(){
  getExchangeRate();
  setInterval(function(){
    if(mkrPriceBuyKyber > mkrPriceSellUniswap){
      console.log(web3.utils.fromWei(mkrPriceBuyKyber.toString(), 'ether') +" : "+ web3.utils.fromWei(mkrPriceSellUniswap.toString(), 'ether') +
      "\n profit: " + web3.utils.fromWei(profit.toString(), 'ether'));
    } else if (mkrPriceBuyKyber < mkrPriceSellUniswap){
      let date_arb_end = new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'});
      console.log("Arbitrage ends at: " + date_arb_end + "\n=================\n");
      setCron();
      clearInterval(this);
    }
  }, 1000);
}
