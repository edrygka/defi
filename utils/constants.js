const parseUnits = require("./parse");

const ETHERS_10K = parseUnits.ETHERS("10000");
const ETHERS_100 = parseUnits.ETHERS("100");
const ETHERS_10 = parseUnits.ETHERS("10");
const ETHERS_1 = parseUnits.ETHERS("1");

const USDT_10K = parseUnits.USDT("10000");
const USDT_100 = parseUnits.USDT("100");
const USDT_10 = parseUnits.USDT("10");
const USDT_1 = parseUnits.USDT("1");

const ETH = {
  _10K: ETHERS_10K,
  _100: ETHERS_100,
  _10: ETHERS_10,
  _1: ETHERS_1,
};
const USDT = { _10K: USDT_10K, _100: USDT_100, _10: USDT_10, _1: USDT_1 };

module.exports = {
  ETH,
  USDT,
};
