"use strict";

const { ethers } = require("hardhat");
const { parseAddress, getTxParams } = require("../utils/operational");
const { logAll, logTx } = require("../utils/logger");

// START configure script
const config = {
  accessRegistry: parseAddress("ACCESS_REGISTRY"),
  vrfCoordinator: parseAddress("VRF_COORDINATOR"),
  sale: parseAddress("SALE"),
  keyHash: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15", // https://docs.chain.link/docs/vrf/v2/subscription/supported-networks/#ethereum-mainnet
  subscriptionId: "6059", // https://docs.chain.link/docs/vrf/v2/subscription/
};
// END

async function deployRandomGenerator() {
  const factory = await ethers.getContractFactory("RandomGenerator");
  const contract = await factory.deploy(
    config.accessRegistry,
    config.vrfCoordinator,
    config.keyHash,
    config.subscriptionId,
    getTxParams()
  );
  await contract.deployed();
  await logTx("RandomGenerator", "deploy", contract);

  return contract;
}

async function getSale() {
  // const factory = await ethers.getContractFactory("SALE");

  // return factory.attach(config.sale);
  return config.sale;
}

async function getAccessRegistry() {
  const factory = await ethers.getContractFactory("AccessRegistry");

  return factory.attach(config.accessRegistry);
}

async function main() {
  await logAll("DEPLOY RANDOM GENERATOR CONTRACT", { config });

  const randomGenerator = await deployRandomGenerator();

  const sale = await getSale();
  const accessRegistry = await getAccessRegistry();
  const ADD_SEED_ROLE = await randomGenerator.ADD_SEED_ROLE();

  const tx = await accessRegistry.grantRole(ADD_SEED_ROLE, sale, getTxParams());
  await tx.wait();
  await logTx("AccessRegistry", "grantRole", tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
