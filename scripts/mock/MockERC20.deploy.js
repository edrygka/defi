"use strict";

const { ethers } = require("hardhat");
const { getTxParams } = require("../../utils/operational");
const { logAll, logTx } = require("../../utils/logger");

// START configure script
const config = {
  name: "Tether USD",
  symbol: "USDT",
};
// END

async function deployMockERC20() {
  const factory = await ethers.getContractFactory("MockERC20");
  const contract = await factory.deploy(config.name, config.symbol, getTxParams());
  await contract.deployed();
  await logTx("MockERC20", "deploy", contract);

  return contract;
}

async function main() {
  await logAll("DEPLOY ERC20 MOCK", { config });

  await deployMockERC20();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
