const chai = require("chai");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const { keccak256 } = require("@ethersproject/keccak256");
const { toUtf8Bytes } = require("@ethersproject/strings");

const { ETH } = require("../utils/constants");
const { makeRange, makeBoxedLinear } = require("../utils/math");
const { currentBlockTimestamp, fastForwardTo } = require("../utils/crypto");
const { BigNumber } = require("ethers");
const { getBNInterval } = require("../utils/ethers");

chai.use(solidity);

describe("LinearVesting", function () {
  let NOW;

  let admin;
  let alice;
  let bob;
  let charlie;
  let vester;

  let accessRegistry, mockToken, vesting, interfaceRegistry;
  const params = {
    delta: 100,
    duration: 1000,
    vestAmount: BigNumber.from("10").mul(BigNumber.from("10").pow(18)),
    epsilon: BigNumber.from("10").pow(6),
    mintAmount: ETH._10K,
    vestingRoleName: "LINEAR_VESTING_ROLE",
  };

  async function deployContracts() {
    const AccessRegistry = await ethers.getContractFactory("AccessRegistry");
    accessRegistry = await AccessRegistry.deploy(charlie.address); // charlie is second admin
    await accessRegistry.deployed();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock EGO", "mEGO");
    await mockToken.deployed();

    // get contracts prototypes
    const Vesting = await ethers.getContractFactory("LinearVesting");

    // deploy treasury impl
    vesting = await Vesting.deploy(mockToken.address, accessRegistry.address, params.vestingRoleName);
    await vesting.deployed();

    const InterfaceGetter = await ethers.getContractFactory("InterfaceGetter");
    interfaceRegistry = await InterfaceGetter.deploy();
    await interfaceRegistry.deployed();
  }

  /* eslint-disable */
  async function mintTokens(addr, amount) {
    await mockToken.mint(addr, amount);
  }
  /* eslint-enable */

  async function grantVester(addr) {
    const vestingRole = await vesting.vestingRole();
    await accessRegistry.connect(admin).grantRole(vestingRole, addr);
  }

  const grantTokens = async (account, amount, start, duration) => {
    await vesting
      .connect(vester)
      .bulkGrantTokens([{ account: account, amount: amount, start: start, duration: duration }]);
  };

  beforeEach(async () => {
    [admin, alice, bob, charlie, vester] = await ethers.getSigners();
    await deployContracts();

    await grantVester(vester.address);

    await mintTokens(vester.address, params.mintAmount);

    await mockToken.connect(vester).approve(vesting.address, params.mintAmount);

    NOW = await currentBlockTimestamp(ethers.provider);
    const start = NOW + params.delta;

    params.start = start;
    params.finish = start + params.duration;
  });

  /**
   * GENERAL CHECKS *
   */

  it("Check properties & configuration", async () => {
    expect(await vesting.accessRegistry()).to.be.equal(accessRegistry.address);

    expect(await vesting.rewardToken()).to.be.equal(mockToken.address);

    const vestingRole = await vesting.vestingRole();
    expect(vestingRole).to.be.eq(keccak256(toUtf8Bytes(params.vestingRoleName)));

    expect(await vesting.totalVested()).to.be.eq("0");
    expect(await vesting.totalClaimed()).to.be.eq("0");
  });

  it("supportsInterface ok", async () => {
    await interfaceRegistry.deployed();

    const getIds = async (names) => await Promise.all(names.map((n) => interfaceRegistry.getInterfaceId(n)));

    const ids = await getIds([
      "ILinearVesting",
      "IERC165",
      "IERC721ReceiverUpgradeable",
      "ITreasuryV1",
      "IAccessControl",
    ]);

    const results = await Promise.all(ids.map((id) => vesting.supportsInterface(id)));

    expect(results).to.be.eql([true, true, false, false, false]);
  });

  it("bulkGrantTokens should revert on invalid data", async () => {
    await expect(
      vesting.connect(vester).bulkGrantTokens([
        {
          account: alice.address,
          amount: 0,
          start: params.start,
          duration: params.duration,
        },
      ])
    ).to.be.revertedWith("Vesting: INVALID_DATA");

    await expect(
      vesting.connect(vester).bulkGrantTokens([
        {
          account: alice.address,
          amount: params.mintAmount,
          start: NOW - 1,
          duration: params.duration,
        },
      ])
    ).to.be.revertedWith("Vesting: INVALID_DATA");

    await expect(
      vesting.connect(vester).bulkGrantTokens([
        {
          account: alice.address,
          amount: params.mintAmount,
          start: params.start,
          duration: 0,
        },
      ])
    ).to.be.revertedWith("Vesting: INVALID_DATA");
  });

  it("bulkGrantTokens single grant success", async () => {
    const { vestAmount, start, duration } = params;
    await expect(
      vesting.connect(vester).bulkGrantTokens([
        {
          account: alice.address,
          amount: vestAmount,
          start: start,
          duration: duration,
        },
      ])
    )
      .to.emit(vesting, "TokensGranted")
      .withArgs(alice.address, vestAmount, start, duration);

    // check user stats
    expect(await vesting.vestingInfo(alice.address)).to.be.eql([vestAmount, BigNumber.from("0"), start, duration]);
    expect(await vesting.available(alice.address)).to.be.eq(0); // vesting not started yet
  });

  it("bulkGrantTokens duplicate record fails", async () => {
    const { vestAmount, start, duration } = params;
    await expect(
      vesting.connect(vester).bulkGrantTokens([
        {
          account: alice.address,
          amount: vestAmount,
          start: start,
          duration: duration,
        },
      ])
    )
      .to.emit(vesting, "TokensGranted")
      .withArgs(alice.address, vestAmount, start, duration);

    await expect(
      vesting.connect(vester).bulkGrantTokens([
        {
          account: alice.address,
          amount: vestAmount,
          start: start,
          duration: duration,
        },
      ])
    ).to.be.revertedWith("Vesting: RECORD_EXISTS");
  });

  it("bulkGrantTokens not authorized fails", async () => {
    const { start, duration, vestAmount } = params;
    const grants = [alice, bob, charlie].map((acc) => {
      return {
        account: acc.address,
        amount: vestAmount,
        start: start,
        duration: duration,
      };
    });

    await expect(vesting.connect(alice).bulkGrantTokens(grants)).to.be.revertedWith("Vesting: FORBIDDEN");
  });

  it("bulkGrantTokens not enough tokens fails", async () => {
    const { start, duration, mintAmount } = params;
    const grants = [alice, bob, charlie].map((acc) => {
      return {
        account: acc.address,
        amount: mintAmount,
        start: start,
        duration: duration,
      };
    });

    await expect(vesting.connect(vester).bulkGrantTokens(grants)).to.be.revertedWith("Vesting: NOT_ENOUGH_BALANCE");
  });

  it("bulkGrantTokens success", async () => {
    const { start, duration, vestAmount } = params;
    const accounts = [alice.address, bob.address, charlie.address];
    const grants = accounts.map((acc) => {
      return {
        account: acc,
        amount: vestAmount,
        start: start,
        duration: duration,
      };
    });

    await expect(vesting.connect(vester).bulkGrantTokens(grants))
      .to.emit(vesting, "TokensGranted")
      .withArgs(alice.address, vestAmount, start, duration)
      .withArgs(bob.address, vestAmount, start, duration)
      .withArgs(charlie.address, vestAmount, start, duration);
  });

  it("mass grant tokens success", async () => {
    const { start, duration, vestAmount } = params;
    const signers = await ethers.getSigners();
    const count = 20;

    const grants = makeRange(count).map((i) => {
      return {
        account: signers[i].address,
        amount: vestAmount,
        start: start,
        duration: duration,
      };
    });

    await expect(vesting.connect(vester).bulkGrantTokens(grants))
      .to.emit(vesting, "TokensGranted")
      .withArgs(signers[0].address, vestAmount, start, duration)
      .withArgs(signers[1].address, vestAmount, start, duration)
      .withArgs(signers[2].address, vestAmount, start, duration)
      .withArgs(signers[3].address, vestAmount, start, duration)
      .withArgs(signers[4].address, vestAmount, start, duration)
      .withArgs(signers[5].address, vestAmount, start, duration)
      .withArgs(signers[6].address, vestAmount, start, duration)
      .withArgs(signers[7].address, vestAmount, start, duration)
      .withArgs(signers[8].address, vestAmount, start, duration)
      .withArgs(signers[9].address, vestAmount, start, duration)
      .withArgs(signers[10].address, vestAmount, start, duration)
      .withArgs(signers[11].address, vestAmount, start, duration)
      .withArgs(signers[12].address, vestAmount, start, duration)
      .withArgs(signers[13].address, vestAmount, start, duration)
      .withArgs(signers[14].address, vestAmount, start, duration)
      .withArgs(signers[15].address, vestAmount, start, duration)
      .withArgs(signers[16].address, vestAmount, start, duration)
      .withArgs(signers[17].address, vestAmount, start, duration)
      .withArgs(signers[18].address, vestAmount, start, duration)
      .withArgs(signers[19].address, vestAmount, start, duration);

    const totalVested = BigNumber.from(vestAmount).mul(BigNumber.from(count));
    expect(await vesting.totalVested()).to.be.eq(totalVested);

    await fastForwardTo(ethers.provider, start + duration);

    await Promise.all(
      grants.map(async (grant) => {
        await expect(vesting.claim(grant.account))
          .to.emit(vesting, "TokensClaimed")
          .withArgs(grant.account, grant.amount);
      })
    );
    expect(await vesting.totalClaimed()).to.be.eq(totalVested);
  });

  it("claim no record fails", async () => {
    await expect(vesting.connect(alice).claim(alice.address)).to.be.revertedWith("Vesting: CLAIM_ZERO");
  });

  it("claim before start fails", async () => {
    const { start, duration, vestAmount } = params;

    await vesting.connect(vester).bulkGrantTokens([
      {
        account: alice.address,
        amount: vestAmount,
        start: start,
        duration: duration,
      },
    ]);

    await expect(vesting.claim(alice.address)).to.be.revertedWith("Vesting: CLAIM_ZERO");
    expect(await vesting.available(alice.address)).to.be.eq(0); // vesting not started yet
  });

  it("claim success", async () => {
    const { start, finish, duration, vestAmount, epsilon } = params;
    const halfVesting = Math.round(start + duration / 2);

    await grantTokens(alice.address, vestAmount, start, duration);

    await fastForwardTo(ethers.provider, halfVesting);

    const claimAmount = await vesting.available(alice.address);
    const boxedLinear = makeBoxedLinear(start, finish, 0, vestAmount);
    const val = boxedLinear(halfVesting);
    const modeledValue = Math.round(val).toString();

    const { low, high } = getBNInterval(claimAmount, epsilon);

    expect(modeledValue).to.be.within(low, high);

    await expect(vesting.claim(alice.address))
      .to.emit(vesting, "TokensClaimed")
      .withArgs(alice.address, () => true);

    expect(await mockToken.balanceOf(alice.address)).to.be.gte(claimAmount);
    expect((await vesting.vestingInfo(alice.address))[1]).to.be.gte(claimAmount);
  });

  it("total vested and claimed", async () => {
    const { vestAmount, start, delta, duration, finish } = params;
    let totalVested = BigNumber.from(0);
    let totalClaimed = BigNumber.from(0);

    const checkVestedAndClaimed = async () => {
      totalClaimed = (await vesting.vestingInfo(alice.address))[1];
      totalClaimed = totalClaimed.add((await vesting.vestingInfo(bob.address))[1]);
      totalClaimed = totalClaimed.add((await vesting.vestingInfo(charlie.address))[1]);

      expect(await vesting.totalVested()).to.be.eq(totalVested);
      expect(await vesting.totalClaimed()).to.be.eq(totalClaimed);
    };

    await checkVestedAndClaimed();

    await grantTokens(alice.address, vestAmount, start, duration);
    totalVested = totalVested.add(BigNumber.from(vestAmount));

    await checkVestedAndClaimed();

    await grantTokens(bob.address, vestAmount, start, duration);
    totalVested = totalVested.add(BigNumber.from(vestAmount));

    await checkVestedAndClaimed();

    await grantTokens(charlie.address, vestAmount, start, duration);
    totalVested = totalVested.add(BigNumber.from(vestAmount));

    await checkVestedAndClaimed();

    await fastForwardTo(ethers.provider, start + delta);

    const aliceAvail1 = await vesting.available(alice.address);
    expect(aliceAvail1).gt(BigNumber.from(0));

    await vesting.claim(alice.address);
    expect((await vesting.vestingInfo(alice.address))[1]).to.be.gte(BigNumber.from(aliceAvail1));

    await checkVestedAndClaimed();

    const bobAvail1 = await vesting.available(bob.address);
    expect(bobAvail1).gt(BigNumber.from(0));
    await vesting.claim(bob.address);
    expect((await vesting.vestingInfo(bob.address))[1]).to.be.gte(BigNumber.from(bobAvail1));

    await checkVestedAndClaimed();

    await fastForwardTo(ethers.provider, start + delta * 2);

    const charlieAvail1 = await vesting.available(charlie.address);
    expect(charlieAvail1).gt(BigNumber.from(0));
    await vesting.claim(charlie.address);

    await checkVestedAndClaimed();

    const aliceAvail2 = await vesting.available(alice.address);
    expect(aliceAvail2).gt(BigNumber.from(0));

    const bobAvail2 = await vesting.available(bob.address);
    expect(bobAvail2).gt(BigNumber.from(0));

    await vesting.connect(alice).claim(alice.address);

    await checkVestedAndClaimed();

    await vesting.connect(bob).claim(bob.address);

    await checkVestedAndClaimed();

    await fastForwardTo(ethers.provider, finish + delta);

    const aliceAvail3 = await vesting.available(alice.address);
    const sumAlice = BigNumber.from(aliceAvail3).add((await vesting.vestingInfo(alice.address))[1]);
    expect(sumAlice).to.be.eq(BigNumber.from(vestAmount));

    const bobAvail3 = await vesting.available(bob.address);
    const sumBob = BigNumber.from(bobAvail3).add((await vesting.vestingInfo(bob.address))[1]);
    expect(sumBob).to.be.eq(BigNumber.from(vestAmount));

    const charliAvail2 = await vesting.available(charlie.address);
    const sumCharlie = BigNumber.from(charliAvail2).add((await vesting.vestingInfo(charlie.address))[1]);
    expect(sumCharlie).to.be.eq(BigNumber.from(vestAmount));

    await vesting.claim(alice.address);
    await checkVestedAndClaimed();

    await vesting.claim(bob.address);
    await checkVestedAndClaimed();

    await vesting.claim(charlie.address);

    await checkVestedAndClaimed();

    expect(totalVested).to.be.eq(BigNumber.from(vestAmount).mul(BigNumber.from(3)));

    expect(totalClaimed).to.be.eq(totalVested);
  });

  it("recover ERC20 accidentally transferred to vesting contract", async () => {
    const randomERC = await ethers.getContractFactory("MockERC20");
    const randomERCToken = await randomERC.deploy("RandomERC", "RERC");
    await randomERCToken.deployed();

    const amountToRecover = BigNumber.from("1000");
    await randomERCToken.mint(vesting.address, amountToRecover);

    expect(await randomERCToken.balanceOf(vesting.address)).to.be.eq(amountToRecover);

    await expect(
      vesting.connect(alice).recoverERC20(randomERCToken.address, alice.address, amountToRecover)
    ).to.be.revertedWith("Vesting: FORBIDDEN");

    await vesting.recoverERC20(randomERCToken.address, alice.address, amountToRecover);

    expect(await randomERCToken.balanceOf(vesting.address)).to.be.eq(0);
    expect(await randomERCToken.balanceOf(alice.address)).to.be.eq(amountToRecover);

    const { vestAmount, start, duration } = params;
    await expect(
      vesting.connect(vester).bulkGrantTokens([
        {
          account: alice.address,
          amount: vestAmount,
          start: start,
          duration: duration,
        },
      ])
    )
      .to.emit(vesting, "TokensGranted")
      .withArgs(alice.address, vestAmount, start, duration);

    // check user stats
    expect(await vesting.vestingInfo(alice.address)).to.be.eql([vestAmount, BigNumber.from("0"), start, duration]);
    expect(await vesting.available(alice.address)).to.be.eq(0); // vesting not started yet

    await expect(vesting.recoverERC20(mockToken.address, bob.address, amountToRecover)).to.be.revertedWith(
      "Vesting: NOT_ENOUGH"
    );

    await mockToken.mint(vesting.address, amountToRecover);

    await vesting.recoverERC20(mockToken.address, bob.address, amountToRecover);

    expect(await mockToken.balanceOf(vesting.address)).to.be.eq(vestAmount);
    expect(await mockToken.balanceOf(bob.address)).to.be.eq(amountToRecover);
  });
});
