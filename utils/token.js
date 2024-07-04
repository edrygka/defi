"use strict";

const { ethers } = require("hardhat");

exports.getTokenInfo = async (tokenAddress) => {
  try {
    const token = await ethers.getContractAt("IERC20Metadata", tokenAddress);
    const tokenName = await token.name();
    const tokenSymbol = await token.symbol();
    const tokenDecimals = await token.decimals();

    return { name: tokenName, symbol: tokenSymbol, decimals: tokenDecimals };
  } catch (error) {
    return "failed";
  }
};

exports.formatTokenInfo = (info) => {
  try {
    return `name: ${info.name}, symbol: ${info.symbol}, decimals: ${info.decimals}`;
  } catch (error) {
    return "failed";
  }
};
