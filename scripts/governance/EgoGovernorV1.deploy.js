"use strict";

const { ethers } = require("hardhat");
const { parseAddress, getTxParams } = require("../../utils/operational");
const { logAll, logTx } = require("../../utils/logger");

// START configure script
const config = {
  redeployImplementation: true,
};

const deployConfig = {
  accessRegistry: parseAddress("ACCESS_REGISTRY"),
  token: parseAddress("EGO_TOKEN"),
  quorumNumerator: ethers.utils.parseUnits("0.2", 27).toString(), // 0.2 * 100%
  autonomousQuorumNumerator: ethers.utils.parseUnits("0.3", 27).toString(), // 0.3 * 100%
  denominator: ethers.utils.parseUnits("1", "27").toString(), // 100%
  votingDelay: 30, // blocks
  votingPeriod: 60, // blocks
  preventLateQuorum: 90, // blocks
  proposalThreshold: ethers.utils.parseUnits("100", "ether").toString(), // amount
  blocksPerProposals: 11520, // blocks (2 days in seconds if 1 block = 15 seconds)
};
// END

async function deployGovernor() {
  const factory = await ethers.getContractFactory("EgoGovernorV1");

  let contract;
  if (config.redeployImplementation) {
    contract = await factory.deploy(getTxParams());
    await contract.deployed();
    await logTx("EgoGovernorV1", "deploy", contract);
  } else {
    contract = factory.attach(parseAddress("GOVERNOR_IMPLEMENTATION"));
  }

  return contract;
}

async function deployProxy(implementation) {
  const proxyFactory = await ethers.getContractFactory("BaseProxy");
  const proxy = await proxyFactory.deploy(
    implementation.address,
    implementation.interface.encodeFunctionData("initialize", [deployConfig]),
    getTxParams()
  );
  await proxy.deployed();
  await logTx("BaseProxy", "deploy", proxy);

  const implementationFactory = await ethers.getContractFactory("EgoGovernorV1");

  return implementationFactory.attach(proxy.address);
}

async function main() {
  await logAll("DEPLOY EGO GOVERNOR V1 CONTRACT", {
    config,
    "Deploy config": deployConfig,
  });

  await deployProxy(await deployGovernor());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
