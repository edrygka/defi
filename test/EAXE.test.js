const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");
const { ecsign } = require("ethereumjs-util");
const { getApprovalDigest } = require("../utils/crypto");
const { mockedAccounts } = require("../utils/mockedAccounts");

describe("EAXE token", function () {
  let EAXE;
  let owner;
  const maxSupply = BigNumber.from(1_000_000).mul(BigNumber.from(10).pow(18));

  beforeEach(async () => {
    [owner] = await ethers.getSigners();
    const EAXEContract = await ethers.getContractFactory("EAXE");

    EAXE = await EAXEContract.deploy(owner.address);
    await EAXE.deployed();
  });

  it("name, symbol, decimals", async () => {
    expect(await EAXE.name()).to.eq("Ego Scholarship");
    expect(await EAXE.symbol()).to.eq("EAXE");
    expect(await EAXE.decimals()).to.eq(18);
  });

  it("initial, max supply", async () => {
    expect(await EAXE.balanceOf(owner.address)).to.eq(maxSupply);
    expect(await EAXE.totalSupply()).to.eq(maxSupply);
  });

  it("permit", async () => {
    const TestPermitContract = await ethers.getContractFactory("TestPermit");
    const TestPermit = await TestPermitContract.deploy(EAXE.address);
    await TestPermit.deployed();

    const { chainId } = await ethers.provider.getNetwork();
    const nonce = await EAXE.nonces(owner.address);
    const amount = BigNumber.from(100).mul(BigNumber.from(10).pow(18));
    const deadline = ethers.constants.MaxUint256;

    const digest = await getApprovalDigest(
      EAXE,
      {
        owner: owner.address,
        spender: TestPermit.address,
        value: amount,
      },
      nonce,
      deadline,
      chainId
    );
    const { v, r, s } = ecsign(
      Buffer.from(digest.slice(2), "hex"),
      Buffer.from(mockedAccounts[0].privateKey.slice(2), "hex")
    );

    const userEGOBalance = await EAXE.balanceOf(owner.address);
    const contractEGOBalance = await EAXE.balanceOf(TestPermit.address);

    await TestPermit.transferWithPermit({
      amount,
      deadline,
      approveMax: false,
      v,
      r,
      s,
    });

    expect(await EAXE.balanceOf(owner.address)).to.be.eq(userEGOBalance.sub(amount));
    expect(await EAXE.balanceOf(TestPermit.address)).to.be.eq(contractEGOBalance.add(amount));
  });
});
