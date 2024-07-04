"use strict";

const { ethers } = require("hardhat");
const { parseAddress, getTxParams } = require("../../../utils/operational");
const { logAll, logTx } = require("../../../utils/logger");

// START configure script
const config = {
  governor: parseAddress("GOVERNOR"),
  targets: ["0xe429440f6ee38787f0ef84167b0686af20c627bb", "0xc94bd8fcf36fbc3c31d0208b7fbbd9a386e51a56"],
  signatures: ["sendMessage(address,uint256)", "updateData(uint8,address)"],
  signaturesValues: [
    ["0xe429440f6ee38787f0ef84167b0686af20c627bb", ethers.utils.parseUnits("20", "ether").toString()],
    ["111", "0xc94bd8fcf36fbc3c31d0208b7fbbd9a386e51a56"],
  ],
  values: [ethers.utils.parseUnits("111", "ether").toString(), ethers.utils.parseUnits("222", "ether").toString()],
  description: "Some description 045",
};
// END

async function main() {
  if (config.signatures.length !== config.signaturesValues.length) {
    throw new Error("Invalid signatures values");
  }

  // START create calldata
  const ABI = [];
  for (let i = 0; i < config.signatures.length; i++) {
    ABI.push(`function ${config.signatures[i]}`);
  }

  const iface = new ethers.utils.Interface(ABI);
  config.calldatas = config.signatures.map((sig, i) => {
    return iface.encodeFunctionData(sig.split("(")[0], config.signaturesValues[i]);
  });
  // END

  await logAll("CREATE PROPOSAL", { config });

  const factory = await ethers.getContractFactory("EgoGovernorV1");
  const governor = factory.attach(config.governor);
  const tx = await governor.propose(
    config.targets, // address[]
    config.values, // uint256[]
    config.signatures, // string[]
    config.calldatas, // bytes[]
    config.description, // string
    getTxParams()
  );
  await tx.wait();
  await logTx("EgoGovernorV1", "propose", tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
