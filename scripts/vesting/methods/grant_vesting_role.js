"use strict";

const { ethers } = require("hardhat");
const { parseAddress, getTxParams } = require("../../../utils/operational");
const { logAll, logTx } = require("../../../utils/logger");

// START configure script
const config = {
  vesting: parseAddress("VESTING"),
  accessRegistry: parseAddress("ACCESS_REGISTRY"),
  grantTo: "0x19ec1E4b714990620edf41fE28e9a1552953a7F4",
};
// END

async function getVesting() {
  const factory = await ethers.getContractFactory("LinearVesting");

  return factory.attach(config.vesting);
}

async function getAccessRegistry() {
  const factory = await ethers.getContractFactory("AccessRegistry");

  return factory.attach(config.accessRegistry);
}

async function main() {
  await logAll("GRANT VESTING ROLE", { config });

  const vesting = await getVesting();
  const accessRegistry = await getAccessRegistry();
  const vestingRole = await vesting.vestingRole();

  const tx = await accessRegistry.grantRole(vestingRole, config.grantTo, getTxParams());
  await tx.wait();
  await logTx("AccessRegistry", "grantRole", tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
