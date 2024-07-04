"use strict";

const { ethers } = require("hardhat");
const { parseAddress, getTxParams } = require("../../utils/operational");
const { logAll, logTx } = require("../../utils/logger");

// START configure script
const config = {
  redeployImplementation: true,
  addMultisigWallet: true,
  multisigWallet: "0x19ec1E4b714990620edf41fE28e9a1552953a7F4",
};

const deployConfig = {
  treasuryRole: "TREASURY_ROLE",
  accessRegistry: parseAddress("ACCESS_REGISTRY"),
};
// END

async function deployTreasury() {
  const factory = await ethers.getContractFactory("TreasuryV1");

  let contract;
  if (config.redeployImplementation) {
    contract = await factory.deploy(getTxParams());
    await contract.deployed();
    await logTx("TreasuryV1", "deploy", contract);
  } else {
    contract = factory.attach(parseAddress("TREASURY_IMPLEMENTATION"));
  }

  return contract;
}

async function deployProxy(implementation) {
  const proxyFactory = await ethers.getContractFactory("BaseProxy");
  const proxy = await proxyFactory.deploy(
    implementation.address,
    implementation.interface.encodeFunctionData("initialize", [deployConfig.accessRegistry, deployConfig.treasuryRole]),
    getTxParams()
  );
  await proxy.deployed();
  await logTx("BaseProxy", "deploy", proxy);

  const implementationFactory = await ethers.getContractFactory("TreasuryV1");

  return implementationFactory.attach(proxy.address);
}

async function getAccessRegistry() {
  const factory = await ethers.getContractFactory("AccessRegistry");

  return factory.attach(deployConfig.accessRegistry);
}

async function main() {
  await logAll("DEPLOY TREASURY CONTRACT", {
    config,
    "Deploy config": deployConfig,
  });

  const proxy = await deployProxy(await deployTreasury());

  if (config.addMultisigWallet) {
    const accessRegistry = await getAccessRegistry();
    const treasuryRole = await proxy.treasuryRole();

    const tx = await accessRegistry.grantRole(treasuryRole, config.multisigWallet, getTxParams());
    await tx.wait();
    await logTx("AccessRegistry", "grantRole", tx);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
