"use strict";

const { ethers } = require("hardhat");
const { getTxParams } = require("../../utils/operational");
const { logAll, logTx } = require("../../utils/logger");

// START configure script
const config = {
  name: "Best NFT",
  symbol: "BNFT",
  baseURI: "https://github.com/",
};
// END

async function deployMockERC721() {
  const factory = await ethers.getContractFactory("MockERC721");
  const contract = await factory.deploy(config.baseURI, config.name, config.symbol, getTxParams());
  await contract.deployed();
  await logTx("MockERC721", "deploy", contract);

  return contract;
}

async function main() {
  await logAll("DEPLOY ERC721 MOCK", { config });

  await deployMockERC721();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
