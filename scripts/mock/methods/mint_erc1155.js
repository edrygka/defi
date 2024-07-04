"use strict";

const { ethers } = require("hardhat");

const { parseAddress, getTxParams } = require("../../../utils/operational");
const { logAll, logTx } = require("../../../utils/logger");

const config = {
  mockERC1155: parseAddress("MOCK_ERC1155"),
  recipient: "0x19ec1E4b714990620edf41fE28e9a1552953a7F4",
  subtokensIds: [20, 21, 22, 23, 24],
  mintAmounts: [30, 20, 10, 40, 50],
};

async function getMockERC1155() {
  const factory = await ethers.getContractFactory("MockERC1155");
  return factory.attach(config.mockERC1155);
}

async function main() {
  await logAll("MINT ERC1155 TOKEN", { config });

  const mock = await getMockERC1155();

  console.log("Minting...");

  const tx = await mock.mintBatch(config.recipient, config.subtokensIds, config.mintAmounts, getTxParams());
  await tx.wait();
  await logTx("MockERC1155", "mint", tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
