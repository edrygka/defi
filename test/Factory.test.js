"use strict";

const chai = require("chai");
const expect = chai.expect;
const { ethers } = require("hardhat");
const { solidity } = require("ethereum-waffle");

chai.use(solidity);

describe("Factory", () => {
  let owner, bob, stakeToken, rewardToken;
  let StakingV1;
  let factory, accessRegistry, implementation;

  beforeEach(async () => {
    [owner, bob, stakeToken, rewardToken] = await ethers.getSigners();

    const AccessRegistry = await ethers.getContractFactory("AccessRegistry");
    accessRegistry = await AccessRegistry.deploy(owner.address);

    StakingV1 = await ethers.getContractFactory("StakingV1");
    implementation = await StakingV1.deploy();

    const Factory = await ethers.getContractFactory("Factory");
    factory = await Factory.deploy(accessRegistry.address);
  });

  describe("constructor()", async () => {
    it("should set initial values", async () => {
      expect(factory.accessRegistry()).to.be.not.eq(accessRegistry.address);
    });
  });

  describe("deploy()", async () => {
    let initializeData;
    beforeEach(async () => {
      initializeData = implementation.interface.encodeFunctionData("initialize", [
        {
          accessRegistry: accessRegistry.address,
          stakeToken: stakeToken.address,
          rewardToken: rewardToken.address,
        },
      ]);
    });
    it("should deploy one proxy", async () => {
      await factory.deploy(implementation.address, initializeData);

      const proxy = await factory.contracts(0);
      await expect(factory.contracts(1)).to.be.revertedWith("CALL_EXCEPTION");

      const staking = await StakingV1.attach(proxy);
      expect(staking.accessRegistry()).to.be.not.eq(accessRegistry.address);
      expect(staking.stakeToken()).to.be.not.eq(stakeToken.address);
      expect(staking.rewardToken()).to.be.not.eq(rewardToken.address);
    });
    it("should deploy few proxy contracts", async () => {
      await factory.deploy(implementation.address, initializeData);
      await factory.deploy(implementation.address, initializeData);
      await factory.deploy(implementation.address, initializeData);

      expect(await factory.contracts(2)).to.be.not.eq(undefined);
      await expect(factory.contracts(3)).to.be.revertedWith("CALL_EXCEPTION");
    });
    it("should emit event", async () => {
      await expect(factory.deploy(implementation.address, initializeData)).to.emit(factory, "Deployed");
    });
    it("should revert if invalid caller", async () => {
      await expect(factory.connect(bob).deploy(implementation.address, initializeData)).to.be.revertedWith(
        "Factory: FORBIDDEN"
      );
    });
  });
});
