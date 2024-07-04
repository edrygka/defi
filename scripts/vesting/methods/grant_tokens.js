"use strict";

const { ethers } = require("hardhat");
const { parseAddress, getTxParams } = require("../../../utils/operational");
const { logAll, logTx } = require("../../../utils/logger");

// START configure script
const config = {
  vesting: parseAddress("VESTING"),
  ego: parseAddress("EGO_TOKEN"),
  addAllowance: true,
  grantInfos: [
    {
      account: "0x8b09cd2Dd711c70e939A8Aee42DB8b3871e72D57",
      amount: ethers.utils.parseUnits("10", "ether").toString(),
      start: Math.floor(Date.now() / 1000 + 500),
      duration: 600,
    },
    {
      account: "0xbdc695caE7F2149115295F069212BBa17B0C3F21",
      amount: ethers.utils.parseUnits("20", "ether").toString(),
      start: Math.floor(Date.now() / 1000 + 600),
      duration: 900,
    },
  ],
};
// END

async function getVesting() {
  const factory = await ethers.getContractFactory("LinearVesting");

  return factory.attach(config.vesting);
}

async function getEgoToken() {
  const factory = await ethers.getContractFactory("EGO");

  return factory.attach(config.ego);
}

async function main() {
  await logAll("GRANT VESTING TOKENS", { config });

  if (config.addAllowance) {
    let amount = "0";
    config.grantInfos.forEach((el) => {
      amount = ethers.BigNumber.from(amount).add(el.amount).toString();
    });

    const egoToken = await getEgoToken();
    const tx = await egoToken.approve(config.vesting, amount, getTxParams());
    await tx.wait();
    await logTx("EGO", "approve", tx);
  }

  const vesting = await getVesting();
  const tx = await vesting.bulkGrantTokens(config.grantInfos, getTxParams());
  await tx.wait();
  await logTx("Vesting", "bulkGrantTokens", tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
