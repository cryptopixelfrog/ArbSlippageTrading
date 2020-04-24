require('dotenv').config();

const ArbSlippageTrading = artifacts.require("ArbSlippageTrading");

module.exports = function (deployer) {
  deployer.deploy(ArbSlippageTrading, { from:process.env.TRADERWALLETADDR }); // this will make the TRADERWALLETADDR as owner.
}
