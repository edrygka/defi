"use strict";

const { ethers } = require("hardhat");
const { parseAddress, getTxParams } = require("../../utils/operational");
const { logAll, logTx } = require("../../utils/logger");

// START configure script
const config = {
  rewardToken: parseAddress("EGO_TOKEN"),
  accessRegistry: parseAddress("ACCESS_REGISTRY"),
  role: "VESTING_ROLE",
};
// END

async function deployVesting() {
  const factory = await ethers.getContractFactory("LinearVesting");
  const contract = await factory.deploy(config.rewardToken, config.accessRegistry, config.role, getTxParams());
  await contract.deployed();
  await logTx("LinearVesting", "deploy", contract);

  return contract;
}

async function main() {
  await logAll("DEPLOY VESTING CONTRACT", { config });

  await deployVesting();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
