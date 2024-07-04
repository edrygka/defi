const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");
const { ecsign } = require("ethereumjs-util");
const { getApprovalDigest } = require("../utils/crypto");
const { mockedAccounts } = require("../utils/mockedAccounts");

// TODO: Add tests for Voting part(after DAO implementation)

describe("EGO token", function () {
  let EGO;
  let AccessRegistry;
  let owner;
  let userA;
  let userB;
  let initialSupply;

  beforeEach(async () => {
    [owner, userA, userB] = await ethers.getSigners();
    initialSupply = BigNumber.from(100_000).mul(BigNumber.from(10).pow(18));
    const EGOContract = await ethers.getContractFactory("EGO");
    const AccessRegistryContract = await ethers.getContractFactory("AccessRegistry");

    AccessRegistry = await AccessRegistryContract.deploy(owner.address);
    await AccessRegistry.deployed();

    EGO = await EGOContract.deploy(initialSupply, owner.address, AccessRegistry.address);
    await EGO.deployed();
  });

  it("name, symbol, decimals", async () => {
    expect(await EGO.name()).to.eq("EGO");
    expect(await EGO.symbol()).to.eq("EGO");
    expect(await EGO.decimals()).to.eq(18);
  });

  it("initial supply", async () => {
    expect(await EGO.balanceOf(owner.address)).to.eq(initialSupply);
    expect(await EGO.totalSupply()).to.eq(initialSupply);
  });

  it("initial supply: exceed", async () => {
    initialSupply = BigNumber.from(100_000_000_000).mul(BigNumber.from(10).pow(18));
    const EGOContract = await ethers.getContractFactory("EGO");

    await expect(EGOContract.deploy(initialSupply, owner.address, AccessRegistry.address)).to.be.revertedWith(
      "ERC20Capped: cap exceeded"
    );
  });

  it("max supply", async () => {
    const MAX_SUPPLY = await EGO.MAX_SUPPLY();
    expect(MAX_SUPPLY).to.eq(BigNumber.from(1_000_000_000).mul(BigNumber.from(10).pow(18)));

    // Wrong person
    await expect(EGO.connect(userA).mint(userB.address, 1)).to.be.revertedWith("EGO: FORBIDDEN");

    // Cap exceeded
    const MINTER_ROLE = await EGO.MINTER_ROLE();
    await AccessRegistry.grantRole(MINTER_ROLE, owner.address);
    await expect(EGO.connect(owner).mint(userB.address, MAX_SUPPLY)).to.be.revertedWith("ERC20Capped: cap exceeded");
  });

  it("mint", async () => {
    await expect(EGO.connect(userA).mint(userA.address, "100")).to.be.revertedWith("EGO: FORBIDDEN");
    expect(await EGO.balanceOf(userA.address)).to.eq("0");

    const MINTER_ROLE = await EGO.MINTER_ROLE();
    await AccessRegistry.grantRole(MINTER_ROLE, owner.address);
    await expect(EGO.connect(owner).mint(userA.address, "100"))
      .to.emit(EGO, "Transfer")
      .withArgs(ethers.constants.AddressZero, userA.address, "100");

    expect(await EGO.balanceOf(userA.address)).to.eq("100");
  });

  it("burn", async () => {
    expect(await EGO.balanceOf(owner.address)).to.eq(initialSupply);

    // Mint tokens to userA
    const MINTER_ROLE = await EGO.MINTER_ROLE();
    await AccessRegistry.grantRole(MINTER_ROLE, owner.address);

    const amountToMint = BigNumber.from("100");
    await expect(EGO.mint(userA.address, amountToMint))
      .to.emit(EGO, "Transfer")
      .withArgs(ethers.constants.AddressZero, userA.address, amountToMint);

    expect(await EGO.balanceOf(owner.address)).to.eq(initialSupply);
    expect(await EGO.balanceOf(userA.address)).to.eq(amountToMint);

    // Burn userA tokens after mint
    await expect(EGO.connect(userA).burn(amountToMint))
      .to.emit(EGO, "Transfer")
      .withArgs(userA.address, ethers.constants.AddressZero, amountToMint);

    expect(await EGO.balanceOf(userA.address)).to.eq("0");

    // Burn owner tokens
    const ownerAmountToBurn = BigNumber.from("1000000");
    await expect(EGO.burn(ownerAmountToBurn))
      .to.emit(EGO, "Transfer")
      .withArgs(owner.address, ethers.constants.AddressZero, ownerAmountToBurn);
    const newOwnerBalance = initialSupply.sub(ownerAmountToBurn);
    expect(await EGO.balanceOf(owner.address)).to.eq(newOwnerBalance);

    // Transfer tokens to userA
    const amountToTransfer = BigNumber.from("1000");
    await expect(EGO.transfer(userA.address, amountToTransfer))
      .to.emit(EGO, "Transfer")
      .withArgs(owner.address, userA.address, amountToTransfer);

    expect(await EGO.balanceOf(owner.address)).to.eq(newOwnerBalance.sub(amountToTransfer));
    expect(await EGO.balanceOf(userA.address)).to.eq(amountToTransfer);

    // Burn userA tokens after transfer
    await expect(EGO.connect(userA).burn(amountToTransfer))
      .to.emit(EGO, "Transfer")
      .withArgs(userA.address, ethers.constants.AddressZero, amountToTransfer);

    expect(await EGO.balanceOf(userA.address)).to.eq("0");
  });

  it("permit", async () => {
    const TestPermitContract = await ethers.getContractFactory("TestPermit");
    const TestPermit = await TestPermitContract.deploy(EGO.address);
    await TestPermit.deployed();

    const { chainId } = await ethers.provider.getNetwork();
    const nonce = await EGO.nonces(owner.address);
    const amount = BigNumber.from(100).mul(BigNumber.from(10).pow(18));
    const deadline = ethers.constants.MaxUint256;

    const digest = await getApprovalDigest(
      EGO,
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

    const userEGOBalance = await EGO.balanceOf(owner.address);
    const contractEGOBalance = await EGO.balanceOf(TestPermit.address);

    await TestPermit.transferWithPermit({
      amount,
      deadline,
      approveMax: false,
      v,
      r,
      s,
    });

    expect(await EGO.balanceOf(owner.address)).to.be.eq(userEGOBalance.sub(amount));
    expect(await EGO.balanceOf(TestPermit.address)).to.be.eq(contractEGOBalance.add(amount));
  });
});
