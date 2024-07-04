"use strict";

const { ethers } = require("hardhat");
const { parseAddress, getTxParams } = require("../../../utils/operational");
const { logAll, logTx } = require("../../../utils/logger");

// START configure script
const config = {
  egoToken: parseAddress("EGO_TOKEN"),
  accessRegistry: parseAddress("ACCESS_REGISTRY"),
  grantTo: "0x19ec1E4b714990620edf41fE28e9a1552953a7F4",
};
// END

async function getEgoToken() {
  const factory = await ethers.getContractFactory("EGO");

  return factory.attach(config.egoToken);
}

async function getAccessRegistry() {
  const factory = await ethers.getContractFactory("AccessRegistry");

  return factory.attach(config.accessRegistry);
}

async function main() {
  await logAll("GRANT MINTER ROLE", { config });

  const egoToken = await getEgoToken();
  const accessRegistry = await getAccessRegistry();
  const DAO_ADMIN_ROLE = await egoToken.MINTER_ROLE();

  const tx = await accessRegistry.grantRole(DAO_ADMIN_ROLE, config.grantTo, getTxParams());
  await tx.wait();
  await logTx("AccessRegistry", "grantRole", tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
