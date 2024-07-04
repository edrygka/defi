"use strict";

const { ethers } = require("hardhat");
const { parseAddress, getTxParams } = require("../../../utils/operational");
const { logAll, logTx } = require("../../../utils/logger");

// START configure script
const config = {
  mockERC721: parseAddress("MOCK_ERC721"),
  fromNum: "100",
  toNum: "105",
  recipient: "0x19ec1E4b714990620edf41fE28e9a1552953a7F4",
};
// END

async function getMockERC721() {
  const factory = await ethers.getContractFactory("MockERC721");

  return factory.attach(config.mockERC721);
}

async function main() {
  await logAll("MINT NFTS", { config });

  const mock = await getMockERC721();

  for (let i = config.fromNum; i <= config.toNum; i++) {
    const tx = await mock.mint(config.recipient, i, getTxParams());
    await tx.wait();
    await logTx("MockERC721", "mint", tx);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
