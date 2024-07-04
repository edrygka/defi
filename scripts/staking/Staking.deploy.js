"use strict";

const { ethers } = require("hardhat");
const { getTxParams } = require("../../utils/operational");
const { logAll, logTx } = require("../../utils/logger");

async function deployStakingV1() {
  const factory = await ethers.getContractFactory("StakingV1");
  const contract = await factory.deploy(getTxParams());
  await contract.deployed();
  await logTx("StakingV1", "deploy", contract);

  return contract;
}

async function main() {
  await logAll("DEPLOY STAKING V1 CONTRACT");

  await deployStakingV1();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
