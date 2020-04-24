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

// 0x2a1530C4C41db0B0b2bB646CB5Eb1A67b7158667 - uniswap dai (https://etherscan.io/address/0x2a1530c4c41db0b0b2bb646cb5eb1a67b7158667)
// 0x2C4Bd064b998838076fa341A83d007FC2FA50957 - uniswap knc (https://etherscan.io/address/2c4bd064b998838076fa341a83d007fc2fa50957)
// 0x49c4f9bc14884f6210F28342ceD592A633801a8b - uniswap knc (https://etherscan.io/address/0x49c4f9bc14884f6210f28342ced592a633801a8b)
const UniswapExchangeABI = JSON.parse(fs.readFileSync('build/contracts/UniswapExchangeInterface.json'))
const uniSwapKNCExAddress = '0x49c4f9bc14884f6210F28342ceD592A633801a8b';
const UniswapContractInst = new web3.eth.Contract(UniswapExchangeABI.abi, uniSwapKNCExAddress);

const KyberExchangeABI = JSON.parse(fs.readFileSync('build/contracts/KyberNetworkProxy.json'))
const kyberExchangeAddress = '0x818E6FECD516Ecc3849DAf6845e3EC868087B755';
const KyberContractInst = new web3.eth.Contract(KyberExchangeABI.abi, kyberExchangeAddress);

var kncPriceSellUniswap = 0;
var kncPriceBuyKyber = 0;
var profit;


async function getExchangeRate(){
  let ethAddr = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  let kncAddr = '0xdd974d5c2e2928dea5f71b9825b8b646686bd200'; // https://etherscan.io/token/0xdd974d5c2e2928dea5f71b9825b8b646686bd200
  let srcQty = web3.utils.toHex(1 * 10 ** 18); // 1 eth

  let ethToKncRate = await KyberContractInst.methods.getExpectedRate(ethAddr, kncAddr, srcQty).call().then(function(result){
    //console.log(web3.utils.fromWei(srcQty) + ' ETH is ' + web3.utils.fromWei(result['expectedRate'], 'ether') + ' KNC(kyber - expectedRate)');
    //console.log(web3.utils.fromWei(srcQty) + ' ETH is ' + web3.utils.fromWei(result['slippageRate'], 'ether') + ' KNC(kyber - slippageRate)');

    kncPriceBuyKyber = parseInt(result['expectedRate']);
  });

  // Get uniswap ETH to KNC rate, this give 1 eth. By usig getTokenToEthOutputPrice, we know KNC rate based on 1 ETH.
  let kncOutPrice = await UniswapContractInst.methods.getTokenToEthOutputPrice(srcQty).call();
  //console.log(web3.utils.fromWei(srcQty) + ' ETH is ' + web3.utils.fromWei(kncOutPrice, 'ether') + ' KNC(uniswap)');

  kncPriceSellUniswap = parseInt(kncOutPrice);

  // ETH to KNC sell price
  // exchangeContract.methods.getTokenToEthInputPrice(tokens_sold).call()
  //let fakeKnc = web3.utils.toHex(100 * 10 ** 18);
  //let kncSellPrice = await UniswapContractInst.methods.getTokenToEthInputPrice(fakeKnc.toString()).call();
  //let pfakeKnc = new web3.utils.BN('1000000000000000000');
  //console.log(web3.utils.fromWei(pfakeKnc) + ' KNC is ' + web3.utils.fromWei(kncSellPrice, 'ether') + ' ETH(uniswap)');

  // This calculate max ETH amount we can get from Uniswap based on KNC amount(kncPriceBuyKyber) we get from Kyber.
  let kncToEthRate = await UniswapContractInst.methods.getTokenToEthInputPrice(kncPriceBuyKyber.toString()).call();
  let intSrcQty = new web3.utils.BN(web3.utils.fromWei(parseInt(srcQty).toString(), 'wei'));
  let intKncToEthRate = new web3.utils.BN(kncToEthRate); // max ETH amount we can get from Uniswap based on KNC amount(kncPriceBuyKyber) we get from Kyber.
  //console.log(web3.utils.fromWei(intKncToEthRate) + " : " + web3.utils.fromWei(intSrcQty));
  profit = intKncToEthRate.sub(intSrcQty);

  /*
  console.log("BUY-KYBER-EXCHANGE:", web3.utils.fromWei(kncPriceBuyKyber.toString()));
  console.log("SELL-UNISWAP-EXCHANGE:", web3.utils.fromWei(kncOutPrice));
  console.log('profit: ', web3.utils.fromWei(profit));
  */

  // print on terminal.
  std.write( web3.utils.fromWei(intKncToEthRate) + " : " + web3.utils.fromWei(intSrcQty) +
  " | profit: " + web3.utils.fromWei(profit) )
  rdl.cursorTo(std, 0)

}

/*
let cron = setInterval(function(){
  getExchangeRate();
  std.clearLine()
  if( kncPriceBuyKyber > kncPriceSellUniswap){
    console.log(web3.utils.fromWei(kncPriceBuyKyber.toString(), 'ether') +" : "+ web3.utils.fromWei(kncPriceSellUniswap.toString(), 'ether') +
    "\n profit: " + web3.utils.fromWei(profit.toString(), 'ether'));
    console.log("<< Got Arbitrage >>");
    let date_arb_start = new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'});
    console.log("Arbitrage starts at: " + date_arb_start + "\n");
    //stopCron();
    let cron2 = setInterval(function(){
      if(kncPriceBuyKyber > kncPriceSellUniswap){
        console.log(web3.utils.fromWei(kncPriceBuyKyber.toString(), 'ether') +" : "+ web3.utils.fromWei(kncPriceSellUniswap.toString(), 'ether') +
        "\n profit: " + web3.utils.fromWei(profit.toString(), 'ether'));
      } else if (kncPriceSellUniswap > kncPriceBuyKyber){
        let date_arb_end = new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'});
        console.log("Arbitrage ends at: " + date_arb_end + "\n");
        stopCron(cron2);
        stopCron(cron);
      }
    }, 1000);
  }else if(kncPriceSellUniswap > kncPriceBuyKyber){
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
    if( kncPriceBuyKyber > kncPriceSellUniswap){
      console.log(web3.utils.fromWei(kncPriceBuyKyber.toString(), 'ether') +" : "+ web3.utils.fromWei(kncPriceSellUniswap.toString(), 'ether') +
      "\n profit: " + web3.utils.fromWei(profit.toString(), 'ether'));
      console.log("<< Got Arbitrage >>");
      let date_arb_start = new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'});
      console.log("Arbitrage starts at: " + date_arb_start + "\n");
      //clearInterval(this);
      let cron2 = setDuration();
    }else if(kncPriceBuyKyber < kncPriceSellUniswap){
      //console.log("Negative Arbitrage");
    }
  }, 1000)
}

function setDuration(){
  setInterval(function(){
    if(kncPriceBuyKyber > kncPriceSellUniswap){
      console.log(web3.utils.fromWei(kncPriceBuyKyber.toString(), 'ether') +" : "+ web3.utils.fromWei(kncPriceSellUniswap.toString(), 'ether') +
      "\n profit: " + web3.utils.fromWei(profit.toString(), 'ether'));
    } else if (kncPriceBuyKyber < kncPriceSellUniswap){
      let date_arb_end = new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'});
      console.log("Arbitrage ends at: " + date_arb_end + "\n");
      clearInterval(this);
      setCron();
    }
  }, 1000);
}
