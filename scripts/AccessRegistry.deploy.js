"use strict";

const { ethers } = require("hardhat");
const { getTxParams } = require("../utils/operational");
const { logAll, logTx } = require("../utils/logger");

const config = {
  admin: "0x19ec1E4b714990620edf41fE28e9a1552953a7F4",
};

async function deployAccessRegistry() {
  const factory = await ethers.getContractFactory("AccessRegistry");
  const contract = await factory.deploy(config.admin, getTxParams());
  await contract.deployed();
  await logTx("AccessRegistry", "deploy", contract);

  return contract;
}

async function main() {
  await logAll("DEPLOY ACCESS REGISTRY", { config });

  await deployAccessRegistry();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
