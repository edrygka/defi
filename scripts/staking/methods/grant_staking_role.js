"use strict";

const { ethers } = require("hardhat");
const { parseAddress, getTxParams } = require("../../../utils/operational");
const { logAll, logTx } = require("../../../utils/logger");

// START configure script
const config = {
  accessRegistry: parseAddress("ACCESS_REGISTRY"),
  staking: parseAddress("STAKING"),
  grantTo: "0x19ec1E4b714990620edf41fE28e9a1552953a7F4",
};
// END

async function getStaking() {
  const staking = await ethers.getContractAt("StakingV1", config.staking);
  return staking;
}

async function getAccessRegistry() {
  const factory = await ethers.getContractFactory("AccessRegistry");

  return factory.attach(config.accessRegistry);
}

async function main() {
  await logAll("GRANT STAKING ADMIN ROLE", { config });

  const staking = await getStaking();
  const accessRegistry = await getAccessRegistry();
  const STAKING_ADMIN_ROLE = await staking.STAKING_ADMIN_ROLE();

  const tx = await accessRegistry.grantRole(STAKING_ADMIN_ROLE, config.grantTo, getTxParams());
  await tx.wait();
  await logTx("AccessRegistry", "grantRole", tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
