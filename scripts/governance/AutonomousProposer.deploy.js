"use strict";

const { ethers } = require("hardhat");
const { parseAddress, getTxParams } = require("../../utils/operational");
const { logAll, logTx } = require("../../utils/logger");

// START configure script
const config = {
  accessRegistry: parseAddress("ACCESS_REGISTRY"),
  token: parseAddress("EGO_TOKEN"),
  governor: parseAddress("GOVERNOR"),
  stakeAmount: ethers.utils.parseUnits("20", "ether").toString(),
};
// END

async function deployAutonomousProposer() {
  const factory = await ethers.getContractFactory("AutonomousProposer");
  const contract = await factory.deploy(config.token, config.governor, config.stakeAmount, getTxParams());
  await contract.deployed();
  await logTx("AutonomousProposer", "deploy", contract);

  return contract;
}

async function getGovernor() {
  const factory = await ethers.getContractFactory("EgoGovernorV1");

  return factory.attach(config.governor);
}

async function getAccessRegistry() {
  const factory = await ethers.getContractFactory("AccessRegistry");

  return factory.attach(config.accessRegistry);
}

async function main() {
  await logAll("DEPLOY AUTONOMOUS PROPOSER CONTRACT", { config });

  const autonomousProposer = await deployAutonomousProposer();

  const governor = await getGovernor();
  const accessRegistry = await getAccessRegistry();
  const AUTONOMOUS_DAO_ROLE = await governor.AUTONOMOUS_DAO_ROLE();

  const tx = await accessRegistry.grantRole(AUTONOMOUS_DAO_ROLE, autonomousProposer.address, getTxParams());
  await tx.wait();
  await logTx("AccessRegistry", "grantRole", tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
