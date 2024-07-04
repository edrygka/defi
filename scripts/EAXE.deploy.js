"use strict";

const { ethers } = require("hardhat");
const { getTxParams } = require("../utils/operational");
const { logAll, logTx } = require("../utils/logger");

// START configure script
const config = {
  owner: "0x19ec1E4b714990620edf41fE28e9a1552953a7F4",
};
// END

async function deployEAXE() {
  const factory = await ethers.getContractFactory("EAXE");
  const contract = await factory.deploy(config.owner, getTxParams());
  await contract.deployed();
  await logTx("EAXE", "deploy", contract);

  return contract;
}

async function main() {
  await logAll("DEPLOY EAXE TOKEN", { config });

  await deployEAXE();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
