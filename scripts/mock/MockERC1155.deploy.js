"use strict";

const { ethers } = require("hardhat");
const { getTxParams } = require("../../utils/operational");
const { logAll, logTx } = require("../../utils/logger");

// START configure script
const config = {
  baseURI: "https://github.com/",
};
// END

async function deployMockERC1155() {
  const factory = await ethers.getContractFactory("MockERC1155");
  const contract = await factory.deploy(config.baseURI, getTxParams());
  await contract.deployed();
  await logTx("MockERC1155", "deploy", contract);

  return contract;
}

async function main() {
  await logAll("DEPLOY ERC1155 MOCK", { config });

  await deployMockERC1155();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
