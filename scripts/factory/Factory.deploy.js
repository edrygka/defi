"use strict";

const { ethers } = require("hardhat");
const { parseAddress, getTxParams } = require("../../utils/operational");
const { logAll, logTx } = require("../../utils/logger");

// START configure script
const config = {
  accessRegistry: parseAddress("ACCESS_REGISTRY"),
};
// END

async function deployFactory() {
  const factory = await ethers.getContractFactory("Factory");

  const contract = await factory.deploy(config.accessRegistry, getTxParams());
  await contract.deployed();
  await logTx("Factory", "deploy", contract);

  return contract;
}

async function main() {
  await logAll("DEPLOY FACTORY CONTRACT", {
    config,
  });

  await deployFactory();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
