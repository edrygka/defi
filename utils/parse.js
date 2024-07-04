"use strict";

const { ethers } = require("hardhat");

const USDT_DECIMALS = 6;
const ETHER_DECIMALS = 18;
const DEFAULT_DECIMALS = 18;

function USDT(value) {
  return ethers.utils.parseUnits(value, USDT_DECIMALS);
}

function ETHERS(value) {
  return ethers.utils.parseUnits(value, ETHER_DECIMALS);
}

function parseTokens(x, decimals) {
  const _decimals = decimals === undefined ? DEFAULT_DECIMALS : decimals;
  return ethers.utils.parseUnits(x.toString(), _decimals);
}

module.exports = {
  USDT,
  ETHERS,
  parseTokens,
};
