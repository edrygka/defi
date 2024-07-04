"use strict";

const { ethers } = require("hardhat");
const { parseAddress, getTxParams } = require("../../../utils/operational");
const { logAll, logTx } = require("../../../utils/logger");

// START configure script
const config = {
  factory: parseAddress("FACTORY"),
  implementation: parseAddress("STAKING_IMPLEMENTATION"),
  accessRegistry: parseAddress("ACCESS_REGISTRY"),
  stakeToken: parseAddress("STAKE_TOKEN"),
  rewardToken: parseAddress("REWARD_TOKEN"),
};
// END

async function getStakingImplementation() {
  const StakingV1 = await ethers.getContractFactory("StakingV1");

  return StakingV1.attach(config.implementation);
}

async function getFactory() {
  const Factory = await ethers.getContractFactory("Factory");

  return Factory.attach(config.factory);
}

async function main() {
  await logAll("DEPLOY STAKING", { config });

  const factory = await getFactory();
  const implementation = await getStakingImplementation();

  const initializeData = implementation.interface.encodeFunctionData("initialize", [
    {
      accessRegistry: config.accessRegistry,
      stakeToken: config.stakeToken,
      rewardToken: config.rewardToken,
    },
  ]);

  const tx = await factory.deploy(implementation.address, initializeData, getTxParams());
  await tx.wait();
  await logTx("Factory", "deploy", tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
