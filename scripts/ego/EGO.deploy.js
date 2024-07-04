"use strict";

const { ethers } = require("hardhat");
const { parseAddress, getTxParams } = require("../../utils/operational");
const { logAll, logTx } = require("../../utils/logger");

// START configure script
const config = {
  initialSupply: ethers.utils.parseUnits("1000000000", "ether").toString(),
  owner: "0x19ec1E4b714990620edf41fE28e9a1552953a7F4",
  accessRegistry: parseAddress("ACCESS_REGISTRY"),
};
// END

async function deployEGO() {
  const factory = await ethers.getContractFactory("EGO");
  const contract = await factory.deploy(config.initialSupply, config.owner, config.accessRegistry, getTxParams());
  await contract.deployed();
  await logTx("EGO", "deploy", contract);

  return contract;
}

async function main() {
  await logAll("DEPLOY EGO TOKEN", { config });

  await deployEGO();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
