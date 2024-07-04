"use strict";

const chai = require("chai");
const expect = chai.expect;
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");
const { ecsign } = require("ethereumjs-util");
const {
  getApprovalDigest,
  fastForwardTo,
  currentBlockTimestamp,
  filterMutativeFunctions,
  handleTx,
} = require("../utils/crypto");
const { weeks, minutes } = require("../utils/time");
const { mockedAccounts } = require("../utils/mockedAccounts");
const {
  sumBN,
  combineItems,
  makeRandomArray,
  makeFloatRange,
  makeRange,
  makePiecewiseLinearBN,
} = require("../utils/math");
const { parseTokens } = require("../utils/parse");

const { solidity } = require("ethereum-waffle");
const { keccak256 } = require("@ethersproject/keccak256");
const { toUtf8Bytes } = require("@ethersproject/strings");

chai.use(solidity);

describe("Staking", () => {
  let rewardToken;
  let stakeToken;
  let accessRegistry;
  let staking;
  let stakingImpl;
  let defaultAdminRole;
  let stakingAdminRole;
  let proxy;
  /* eslint-disable */
  let owner, alice, bob, charlie, defaultAdmin, stakingAdmin;
  /* eslint-enable */
  let initialSupply;
  let NOW;
  const BN_ZERO = BigNumber.from("0");
  const THREE_ZEROES_BN = new Array(3).fill(BN_ZERO);
  const OPERATIONS = ["stake", "unstake", "claim"];

  const params = {
    stakingAdminRoleName: "STAKING_ADMIN_ROLE",
    timeSkip: 0,
    duration: 0,
    totalRewardAmount: BN_ZERO,
    amount1: parseTokens(100, 18),
    amount2: parseTokens(200, 18),
    amount3: parseTokens(700, 18),
    epsilon: BigNumber.from(10 ** 6),
  };

  async function configureParams() {
    NOW = await currentBlockTimestamp(ethers.provider);
    const timeSkip = minutes(1);
    const duration = weeks(1);
    const start = NOW + duration;

    const end = start + duration;
    const start1 = end + timeSkip;
    const end1 = start1 + duration;
    const start2 = end1 + timeSkip;
    const end2 = start2 + duration;
    const finish = end2 + timeSkip;

    params.timeSkip = timeSkip;
    params.duration = duration;
    params.finish = finish;

    params.start = start;
    params.end = end;

    params.intervals = [
      { amount: params.amount1, start: start, end: end },
      { amount: params.amount2, start: start1, end: end1 },
      { amount: params.amount3, start: start2, end: end2 },
    ];

    params.totalRewardAmount = sumBN(params.intervals.map((x) => x.amount));
  }

  const deployAccessRegistry = async (_ownerAddress) => {
    const AccessRegistry = await ethers.getContractFactory("AccessRegistry");
    const _accessRegistry = await AccessRegistry.deploy(_ownerAddress);
    await _accessRegistry.deployed();
    return _accessRegistry;
  };

  const deployRewardToken = async (_initialSupply, _ownerAddress, _accessRegistryAddress) => {
    const RewardToken = await ethers.getContractFactory("EGO");
    const _rewardToken = await RewardToken.deploy(_initialSupply, _ownerAddress, _accessRegistryAddress);
    await _rewardToken.deployed();
    return _rewardToken;
  };

  const deployStakeToken = async (_ownerAddress) => {
    const StakeToken = await ethers.getContractFactory("EAXE");
    const _stakeToken = await StakeToken.deploy(_ownerAddress);
    await _stakeToken.deployed();
    return _stakeToken;
  };

  const deployStaking = async (_accessRegistryAddress, _stakeTokenAddress, _rewardTokenAddress) => {
    // deploy staking contract
    const Staking = await ethers.getContractFactory("StakingV1");
    const _stakingImpl = await Staking.deploy();
    await _stakingImpl.deployed();

    const BaseProxy = await ethers.getContractFactory("BaseProxy");
    const encodedInitializeCall = _stakingImpl.interface.encodeFunctionData("initialize", [
      {
        accessRegistry: _accessRegistryAddress,
        stakeToken: _stakeTokenAddress,
        rewardToken: _rewardTokenAddress,
      },
    ]);

    const _proxy = await BaseProxy.deploy(_stakingImpl.address, encodedInitializeCall);
    await _proxy.deployed();

    const _staking = _stakingImpl.attach(_proxy.address);

    const _defaultAdminRole = await _staking.DEFAULT_ADMIN_ROLE();
    const _stakingAdminRole = await _staking.STAKING_ADMIN_ROLE();

    return [_staking, _proxy, _stakingImpl, _defaultAdminRole, _stakingAdminRole];
  };

  // grant user with default admin role
  // required for upgrade and pause/unpause functions
  const grantDefaultAdminRole = async (defaultAdminAddress) => {
    await accessRegistry.grantRole(defaultAdminRole, defaultAdminAddress);
  };

  // grant user with staking admin role
  // required to add/remove intervals
  const grantStakingAdminRole = async (stakingAdminAddress) => {
    await accessRegistry.grantRole(stakingAdminRole, stakingAdminAddress);
  };

  beforeEach(async () => {
    initialSupply = parseTokens(1_000_000_000, 18);

    [owner, alice, bob, charlie, defaultAdmin, stakingAdmin] = await ethers.getSigners();

    accessRegistry = await deployAccessRegistry(owner.address);

    rewardToken = await deployRewardToken(initialSupply, owner.address, accessRegistry.address);

    stakeToken = await deployStakeToken(owner.address);

    [staking, proxy, stakingImpl, defaultAdminRole, stakingAdminRole] = await deployStaking(
      accessRegistry.address,
      stakeToken.address,
      rewardToken.address
    );

    // grant roles
    await grantDefaultAdminRole(defaultAdmin.address);
    await grantStakingAdminRole(stakingAdmin.address);

    await configureParams();
  });

  it("should have enough balance to unstake after claiming all reward", async () => {
    const { intervals, totalRewardAmount } = params;

    // deploy alternate staking
    [staking] = await deployStaking(accessRegistry.address, rewardToken.address, rewardToken.address);

    const stakeAmount = parseTokens("10");
    const totalTokensAmount = stakeAmount.add(totalRewardAmount);

    await rewardToken.connect(owner).transfer(stakingAdmin.address, totalTokensAmount);

    await rewardToken.connect(stakingAdmin).approve(staking.address, totalTokensAmount);

    await staking.connect(stakingAdmin).stake(stakeAmount);

    await staking.connect(stakingAdmin).appendIntervals(intervals);

    await fastForwardTo(ethers.provider, intervals[2].end);

    await expect(staking.connect(stakingAdmin).claim())
      .to.emit(staking, "Claim")
      .withArgs(stakingAdmin.address, totalRewardAmount);

    await expect(staking.connect(stakingAdmin).unstake(stakeAmount))
      .to.emit(staking, "Unstake")
      .withArgs(stakingAdmin.address, stakeAmount)
      .to.emit(rewardToken, "Transfer")
      .withArgs(staking.address, stakingAdmin.address, stakeAmount);

    expect(await rewardToken.balanceOf(staking.address)).to.be.eq("0");
  });

  it("should revert on initialization from implementation contract", async () => {
    await expect(
      stakingImpl.initialize({
        accessRegistry: accessRegistry.address,
        stakeToken: stakeToken.address,
        rewardToken: rewardToken.address,
      })
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("initialize", async () => {
    expect(await staking.FACTOR()).to.be.eq(BigNumber.from("10").pow(18));
    expect(await staking.accessRegistry()).to.be.eq(accessRegistry.address);
    expect(await staking.stakeToken()).to.be.eq(stakeToken.address);
    expect(await staking.rewardToken()).to.be.eq(rewardToken.address);
    expect(await staking.totalStakes()).to.be.eq(0);
    expect(await staking.lastUpdateTime()).to.be.eq(0);
    expect(await staking.snapshotRewardPerToken()).to.be.eq("0");
    expect(await staking.paidAmount()).to.be.eq("0");
    expect(await staking.totalRewardAmount()).to.be.eq("0");
    expect(await staking.intervalsCount()).to.be.eq("0");
    expect(await staking.STAKING_ADMIN_ROLE()).to.be.eq(keccak256(toUtf8Bytes(params.stakingAdminRoleName)));

    expect(await stakeToken.balanceOf(staking.address)).to.be.eq("0");
    expect(await rewardToken.balanceOf(staking.address)).to.be.eq("0");
  });

  it("should revert on initialization if access registry address wrong", async () => {
    const StakingContract = await ethers.getContractFactory("StakingV1");
    const stakingImplementation = await StakingContract.deploy();

    const BaseProxy = await ethers.getContractFactory("BaseProxy");
    const encodedInitializeCall = stakingImplementation.interface.encodeFunctionData("initialize", [
      {
        accessRegistry: staking.address,
        stakeToken: stakeToken.address,
        rewardToken: rewardToken.address,
      },
    ]);
    await expect(BaseProxy.deploy(stakingImplementation.address, encodedInitializeCall)).to.be.revertedWith(
      "Staking: UNSUPPORTED_INTERFACE"
    );
  });

  it("user can unstake any time: stake + unstake immediately", async () => {
    const stakeOfAlice = BigNumber.from(100).mul(BigNumber.from(10).pow(18));
    await stakeToken.transfer(alice.address, stakeOfAlice);

    await stakeToken.connect(alice).approve(staking.address, stakeOfAlice);

    await expect(staking.connect(alice).stake(stakeOfAlice))
      .to.emit(staking, "Stake")
      .withArgs(alice.address, stakeOfAlice);

    await expect(staking.connect(alice).unstake(stakeOfAlice))
      .to.emit(staking, "Unstake")
      .withArgs(alice.address, stakeOfAlice);

    expect(await stakeToken.balanceOf(staking.address)).to.eq(0);
    expect(await stakeToken.balanceOf(alice.address)).to.eq(stakeOfAlice);
  });

  it("should revert on stake with zero amount", async () => {
    await expect(staking.connect(alice).stake(0)).to.be.revertedWith("Staking: ZERO_AMOUNT");
  });

  // withdrawing from non-existant stake looks like user has nothing to withdraw
  it("should revert on withdraw with non exist account", async () => {
    await expect(staking.connect(alice).claim()).to.be.revertedWith("Staking: NOTHING_TO_CLAIM");
  });

  // users can't unstake more than they staked
  it("should revert on unstake with invalid amount", async () => {
    const stakeOfAlice = BigNumber.from(100).mul(BigNumber.from(10).pow(18));
    await stakeToken.transfer(alice.address, stakeOfAlice);

    await stakeToken.connect(alice).approve(staking.address, stakeOfAlice);

    await expect(staking.connect(alice).stake(stakeOfAlice))
      .to.emit(staking, "Stake")
      .withArgs(alice.address, stakeOfAlice);

    await expect(staking.connect(alice).unstake(stakeOfAlice.add(1))).to.be.revertedWith("Staking: INVALID_AMOUNT");

    await expect(staking.connect(alice).unstake(0)).to.be.revertedWith("Staking: INVALID_AMOUNT");
  });

  // user can unstake by parts
  it("stake + unstake by 3 parts", async () => {
    const stakeOfAlice = BigNumber.from(100).mul(BigNumber.from(10).pow(18));
    await stakeToken.transfer(alice.address, stakeOfAlice);

    await stakeToken.connect(alice).approve(staking.address, stakeOfAlice);

    await expect(staking.connect(alice).stake(stakeOfAlice))
      .to.emit(staking, "Stake")
      .withArgs(alice.address, stakeOfAlice);

    expect(await stakeToken.balanceOf(staking.address)).to.eq(stakeOfAlice);
    expect(await stakeToken.balanceOf(alice.address)).to.eq(0);
    expect(await staking.totalStakes()).to.eq(stakeOfAlice);

    // Unstake 50% stakeToken
    const halfStakeAmount = stakeOfAlice.sub(BigNumber.from(50).mul(BigNumber.from(10).pow(18)));
    await expect(staking.connect(alice).unstake(halfStakeAmount))
      .to.emit(staking, "Unstake")
      .withArgs(alice.address, halfStakeAmount);

    expect(await stakeToken.balanceOf(staking.address)).to.eq(halfStakeAmount);
    expect(await stakeToken.balanceOf(alice.address)).to.eq(halfStakeAmount);

    // Unstake 25% stakeToken
    const secondPart = halfStakeAmount.div(2);
    await expect(staking.connect(alice).unstake(secondPart))
      .to.emit(staking, "Unstake")
      .withArgs(alice.address, secondPart);

    expect(await stakeToken.balanceOf(staking.address)).to.eq(secondPart);
    expect(await stakeToken.balanceOf(alice.address)).to.eq(halfStakeAmount.add(secondPart));

    // Unstake the rest 25% stakeToken
    await expect(staking.connect(alice).unstake(secondPart))
      .to.emit(staking, "Unstake")
      .withArgs(alice.address, secondPart);

    expect(await stakeToken.balanceOf(staking.address)).to.eq(0);
    expect(await stakeToken.balanceOf(alice.address)).to.eq(stakeOfAlice);
  });

  it("upgrade to next version", async () => {
    // deploy updated staking contract
    const UpdatedStakingContract = await ethers.getContractFactory("UpdatedStaking");
    const updatedStakingImpl = await UpdatedStakingContract.deploy();

    expect(await staking.stakeToken()).to.eq(stakeToken.address);

    await staking.upgradeTo(updatedStakingImpl.address);

    expect(await updatedStakingImpl.attach(proxy.address).stakeToken()).to.eq(stakeToken.address);
    expect(await updatedStakingImpl.attach(proxy.address).test()).to.eq("success");
  });

  it("should revert on upgrade to next version, not owner", async () => {
    const UpdatedStakingContract = await ethers.getContractFactory("UpdatedStaking");
    const updatedStakingImpl = await UpdatedStakingContract.deploy();

    await expect(staking.connect(alice).upgradeTo(updatedStakingImpl.address)).to.be.revertedWith("Staking: FORBIDDEN");
  });

  it("stake with permit", async () => {
    const stakeAmount = BigNumber.from(1000).mul(BigNumber.from(10).pow(18));
    await stakeToken.transfer(alice.address, stakeAmount);

    const { chainId } = await ethers.provider.getNetwork();
    const nonce = await stakeToken.nonces(alice.address);
    const deadline = ethers.constants.MaxUint256;

    const digest = await getApprovalDigest(
      stakeToken,
      {
        owner: alice.address,
        spender: staking.address,
        value: stakeAmount,
      },
      nonce,
      deadline,
      chainId
    );
    const { v, r, s } = ecsign(
      Buffer.from(digest.slice(2), "hex"),
      Buffer.from(mockedAccounts[1].privateKey.slice(2), "hex")
    );

    await expect(
      staking.connect(alice).stakeWithPermit({
        deadline: deadline,
        amount: stakeAmount,
        v: v,
        r: r,
        s: s,
      })
    )
      .to.emit(staking, "Stake")
      .withArgs(alice.address, stakeAmount);

    expect(await stakeToken.balanceOf(alice.address)).to.be.eq(0);
    expect(await stakeToken.balanceOf(staking.address)).to.be.eq(stakeAmount);
  });

  it("should return only known mutative functions", async () => {
    const stakingContract = await ethers.getContractFactory("StakingV1");
    const functions = Object.values(stakingContract.interface.functions);

    const { fallbackFnc, mutable } = filterMutativeFunctions(functions);

    expect(fallbackFnc.length).to.be.eq(0);
    expect(mutable).to.be.eql([
      "appendIntervals",
      "claim",
      "initialize",
      "removeIntervals",
      "setPausedFunctions",
      "stake",
      "stakeWithPermit",
      "unstake",
      "upgradeTo",
      "upgradeToAndCall",
    ]);
  });

  const filterEvents = (eventsArray, eventName) => {
    return eventsArray.filter((e) => e.event === eventName).map((e) => e.args);
  };

  // this test ensures that users get fair share of rewards depending on their stake
  // between every interval when conditions change:
  // e.g. someone stakes/unstakes or claims
  it("multiple users stake/claim/unstake many times check claim amounts", async () => {
    // number of points in the range of definition to carry on operations
    let numPoints = 30; // another 3 claims will be added at the end so not const

    const { intervals, timeSkip, totalRewardAmount } = params;
    const accuracyFactor = BigNumber.from("10").pow("18");
    const epsilon = BigNumber.from("10").pow("6");
    const totalEpsilon = epsilon.mul("10");

    const users = [alice, bob, charlie];
    const supplyAmount = parseTokens(100_000);
    const stakes = [20_000, 30_000, 50_000].map((x) => parseTokens(x));
    const userData = combineItems(users, stakes);

    // prepare staking environment

    await rewardToken.transfer(stakingAdmin.address, params.totalRewardAmount);
    await rewardToken.connect(stakingAdmin).approve(staking.address, totalRewardAmount);

    await staking.connect(stakingAdmin).appendIntervals(intervals); // setup rewards
    expect(await rewardToken.balanceOf(staking.address)).to.eq(totalRewardAmount);

    // give tokens to users
    await Promise.all(users.map((u) => stakeToken.transfer(u.address, supplyAmount)));

    await Promise.all(users.map((u) => stakeToken.connect(u).approve(staking.address, supplyAmount)));

    // do initial stakes
    await Promise.all(userData.map((data) => staking.connect(data[0]).stake(data[1])));

    const points = makeFloatRange(
      intervals[0].start + timeSkip,
      intervals[intervals.length - 1].end - timeSkip / 2,
      numPoints
    ).map((x) => Math.round(x));

    // make user data structures
    const makeUserInfo = (user, initialStake) => {
      return {
        user: user,
        stake: initialStake,
        pendingReward: BN_ZERO,
        claimedReward: BN_ZERO,
        totalClaimed: BN_ZERO,
      };
    };
    const userInfos = userData.map((data) => makeUserInfo(data[0], data[1]));

    // staking reward function emulation
    const plannerFunction = makePiecewiseLinearBN(intervals);

    // calculates user share of reward between 2 points
    const calcUserReward = (userInfo, prev, curr) => {
      const userStake = userInfo.stake;
      const totalStake = sumBN(userInfos.map((ui) => ui.stake));
      const deltaReward = plannerFunction(curr).sub(plannerFunction(prev));
      return deltaReward.mul(userStake).mul(accuracyFactor).div(totalStake);
    };

    const userSequence = makeRandomArray(userInfos, numPoints);
    const operationSequence = makeRandomArray(OPERATIONS, numPoints);
    // fixed amounts for stake/unstake operations
    const amountSequense = makeRange(numPoints + users.length).map((i) => parseTokens((i + 1) * 100));

    let nextPoint = points[numPoints - 1] + timeSkip;

    // add claim operations at the end one per each user
    userInfos.forEach((ui) => {
      userSequence.push(ui);
      operationSequence.push("claim");
      points.push(nextPoint);
      nextPoint += timeSkip;
      ++numPoints;
    });

    const updateRewards = (prev, curr) => {
      userInfos.forEach((ui) => {
        const reward = calcUserReward(ui, prev, curr);
        ui.pendingReward = ui.pendingReward.add(reward);
      });
    };

    // the real time points for calculating rewards
    let currPoint;
    let prevPoint = intervals[0].start;

    for (const i of makeRange(numPoints)) {
      const ts = points[i];
      const op = operationSequence[i];
      const ui = userSequence[i];
      const amount = amountSequense[i];

      await fastForwardTo(ethers.provider, ts);

      if (op === "stake") {
        const [_ts, _events] = await handleTx(staking.connect(ui.user).stake(amount), ethers.provider);
        currPoint = _ts;

        const [stakeEvent] = filterEvents(_events, "Stake");
        expect(stakeEvent.account).to.be.eq(ui.user.address);
        expect(stakeEvent.amount).to.be.eq(amount);

        updateRewards(prevPoint, currPoint);

        ui.stake = ui.stake.add(amount);
      } else if (op === "unstake") {
        const [_ts, _events] = await handleTx(staking.connect(ui.user).unstake(amount), ethers.provider);
        currPoint = _ts;

        const [unstakeEvent] = filterEvents(_events, "Unstake");

        expect(unstakeEvent.account).to.be.eq(ui.user.address);
        expect(unstakeEvent.amount).to.be.eq(amount);

        const [claimEvent] = filterEvents(_events, "Claim");

        updateRewards(prevPoint, currPoint);

        ui.claimedReward = ui.pendingReward.div(accuracyFactor);
        ui.pendingReward = BN_ZERO;
        ui.totalClaimed = ui.totalClaimed.add(ui.claimedReward);
        ui.stake = ui.stake.sub(amount);

        expect(ui.claimedReward).to.be.closeTo(claimEvent.reward, epsilon);
      } else if (op === "claim") {
        const [_ts, _events] = await handleTx(staking.connect(ui.user).claim(), ethers.provider);
        currPoint = _ts;

        const [claimEvent] = filterEvents(_events, "Claim");

        expect(claimEvent.account).to.be.eq(ui.user.address);

        updateRewards(prevPoint, currPoint);

        ui.claimedReward = ui.pendingReward.div(accuracyFactor);
        ui.pendingReward = BN_ZERO;
        ui.totalClaimed = ui.totalClaimed.add(ui.claimedReward);

        expect(ui.claimedReward).to.be.closeTo(claimEvent.reward, epsilon);
      }

      prevPoint = currPoint;
    }

    const totalClaimed = sumBN(userInfos.map((ui) => ui.totalClaimed));
    const paidAmount = await staking.paidAmount();

    expect(totalClaimed).to.be.closeTo(paidAmount, totalEpsilon);

    expect(await staking.totalRewardAmount()).to.be.closeTo(paidAmount, totalEpsilon);
  });

  it("3 users stake by steps, complex case", async () => {
    const { intervals, timeSkip, duration, totalRewardAmount } = params;
    const [i0, i1, i2] = intervals;

    const users = [alice, bob, charlie];
    const entities = [staking, alice, bob, charlie];
    const stakes = [100, 200, 700].map((x) => parseTokens(x));
    const [stakeOfAlice, stakeOfBob, stakeOfCharlie] = stakes;
    const userData = combineItems(users, stakes);

    await rewardToken.transfer(stakingAdmin.address, params.totalRewardAmount);
    await rewardToken.connect(stakingAdmin).approve(staking.address, totalRewardAmount);

    await staking.connect(stakingAdmin).appendIntervals(intervals);
    expect(await rewardToken.balanceOf(staking.address)).to.eq(totalRewardAmount);

    // stake
    await Promise.all(userData.map((item) => stakeToken.transfer(item[0].address, item[1])));

    await expect(staking.connect(alice).stake(stakeOfAlice)).to.be.revertedWith("ERC20: insufficient allowance");
    await expect(staking.connect(bob).stake(stakeOfBob)).to.be.revertedWith("ERC20: insufficient allowance");
    await expect(staking.connect(charlie).stake(stakeOfCharlie)).to.be.revertedWith("ERC20: insufficient allowance");

    // approve to staking
    await Promise.all(userData.map((item) => stakeToken.connect(item[0]).approve(staking.address, item[1])));

    // alice stakes stakeOfAlice
    await expect(staking.connect(alice).stake(stakeOfAlice))
      .to.emit(staking, "Stake")
      .withArgs(alice.address, stakeOfAlice);

    await expect(staking.connect(alice).claim()).to.be.revertedWith("Staking: NOTHING_TO_CLAIM");

    expect(await Promise.all(entities.map((u) => stakeToken.balanceOf(u.address)))).to.be.eql([
      stakeOfAlice,
      BN_ZERO,
      stakeOfBob,
      stakeOfCharlie,
    ]);

    // balances = 0
    expect(await Promise.all(users.map((u) => rewardToken.balanceOf(u.address)))).to.be.eql(THREE_ZEROES_BN);

    // pending rewards = 0
    expect(await Promise.all(users.map((u) => staking.pendingReward(u.address)))).to.be.eql(THREE_ZEROES_BN);

    // NOTHING TO CLAIM BEFORE START
    await expect(staking.connect(bob).claim()).to.be.revertedWith("Staking: NOTHING_TO_CLAIM");

    // wrong amount
    await expect(staking.connect(bob).unstake(stakeOfAlice)).to.be.revertedWith("Staking: INVALID_AMOUNT");

    await fastForwardTo(ethers.provider, i0.end);

    const firstReward = i0.amount;

    const firstRewardUserAShare = firstReward.mul(stakeOfAlice).div(await staking.totalStakes());

    // pending reward
    expect(await staking.pendingReward(alice.address)).to.be.closeTo(firstRewardUserAShare, 1000000);

    expect(await staking.pendingReward(bob.address)).to.be.eq(0); // non existant stake

    // withdraw reward
    const castedReward = parseTokens(100);
    await expect(staking.connect(alice).claim()).to.emit(staking, "Claim").withArgs(alice.address, castedReward);

    expect(await Promise.all(entities.map((e) => stakeToken.balanceOf(e.address)))).to.be.eql([
      stakeOfAlice,
      BN_ZERO,
      stakeOfBob,
      stakeOfCharlie,
    ]);

    expect(await Promise.all(entities.map((e) => rewardToken.balanceOf(e.address)))).to.be.eql([
      totalRewardAmount.sub(castedReward),
      castedReward,
      BN_ZERO,
      BN_ZERO,
    ]);

    // NO REWARD BETWEEN INTERVALS

    await fastForwardTo(ethers.provider, i1.start);
    expect(await staking.pendingReward(alice.address)).to.be.eq(0);

    expect(await Promise.all(entities.map((e) => stakeToken.balanceOf(e.address)))).to.be.eql([
      stakeOfAlice,
      BigNumber.from(0),
      stakeOfBob,
      stakeOfCharlie,
    ]);

    expect(await Promise.all(entities.map((e) => rewardToken.balanceOf(e.address)))).to.be.eql([
      totalRewardAmount.sub(castedReward),
      castedReward,
      BN_ZERO,
      BN_ZERO,
    ]);

    // stake bob
    await expect(staking.connect(bob).stake(stakeOfBob)).to.emit(staking, "Stake").withArgs(bob.address, stakeOfBob);

    expect(await Promise.all(entities.map((e) => stakeToken.balanceOf(e.address)))).to.be.eql([
      stakeOfAlice.add(stakeOfBob),
      BN_ZERO,
      BN_ZERO,
      stakeOfCharlie,
    ]);

    expect(await Promise.all(entities.map((e) => rewardToken.balanceOf(e.address)))).to.be.eql([
      i1.amount.add(i2.amount),
      castedReward,
      BN_ZERO,
      BN_ZERO,
    ]);

    // timeSkip is 1 day ~ 1/7 of the interval
    await fastForwardTo(ethers.provider, i1.start + timeSkip);

    expect(await staking.totalStakes()).to.be.eq(stakeOfAlice.add(stakeOfBob));

    const secondPartReward = i1.amount.mul(timeSkip).div(duration);

    const firstShareOfUserA = secondPartReward // alice share
      .mul(stakeOfAlice)
      .div(stakeOfAlice.add(stakeOfBob));

    const firstShareOfUserB = secondPartReward // bob share
      .mul(stakeOfBob)
      .div(stakeOfAlice.add(stakeOfBob));

    // check pending reward
    const epsilon = parseTokens(1).div(1000);
    expect(await staking.pendingReward(alice.address)).to.be.closeTo(firstShareOfUserA, epsilon);

    // 1 second reward (0.003 rewardToken)
    expect(await staking.pendingReward(bob.address)).to.be.closeTo(firstShareOfUserB, epsilon);

    // to the end of 2-nd interval
    await fastForwardTo(ethers.provider, i1.end);

    // check pending reward
    const thirdShareOfUserA = i1.amount.mul(stakeOfAlice).div(stakeOfAlice.add(stakeOfBob));

    const thirdShareOfUserB = i1.amount.mul(stakeOfBob).div(stakeOfAlice.add(stakeOfBob));

    expect(await staking.pendingReward(alice.address)).to.be.closeTo(thirdShareOfUserA, epsilon);
    expect(await staking.pendingReward(bob.address)).to.be.closeTo(thirdShareOfUserB, epsilon);

    // 2nd interval is over, charlie stakes stakeOfCharlie
    await expect(staking.connect(charlie).stake(stakeOfCharlie))
      .to.emit(staking, "Stake")
      .withArgs(charlie.address, stakeOfCharlie);

    // 1 day of the 3-rd interval
    let totalStakes = stakeOfAlice.add(stakeOfBob).add(stakeOfCharlie);

    // current interval is [i2.start, i2.start + timeSkip)
    await fastForwardTo(ethers.provider, i2.start + timeSkip);

    // check pending reward
    expect(await staking.totalStakes()).to.be.eq(stakeOfAlice.add(stakeOfBob).add(stakeOfCharlie));

    const fourthRewardAmount = i2.amount.mul(timeSkip).div(duration);
    NOW = await currentBlockTimestamp(ethers.provider);

    const fourthUsersShares = stakes.map((s) => fourthRewardAmount.mul(s).div(totalStakes));
    const fourthUsersPendingRewards = await Promise.all(users.map((user) => staking.pendingReward(user.address)));

    // alice
    expect(fourthUsersPendingRewards[0]).to.be.closeTo(fourthUsersShares[0].add(thirdShareOfUserA), epsilon);
    // bob
    expect(fourthUsersPendingRewards[1]).to.be.closeTo(fourthUsersShares[1].add(thirdShareOfUserB), epsilon);
    // charlie has just staked, so has no reward for prev period
    expect(fourthUsersPendingRewards[2]).to.be.closeTo(fourthUsersShares[2], epsilon);

    // now alice withdraws
    const rewardBalanceBefore = await rewardToken.balanceOf(alice.address);
    await expect(staking.connect(alice).claim()).to.emit(staking, "Claim");

    const rewardBalanceAfter = await rewardToken.balanceOf(alice.address);

    expect(rewardBalanceAfter).to.be.closeTo(rewardBalanceBefore.add(fourthUsersPendingRewards[0]), epsilon);

    // pending rewards for users didn't change, except for alice
    const fifthUsersPendingRewards = await Promise.all(users.map((u) => staking.pendingReward(u.address)));

    expect(fifthUsersPendingRewards[0]).to.be.closeTo(BigNumber.from("0"), epsilon);
    expect(fifthUsersPendingRewards[1]).to.be.closeTo(fourthUsersShares[1].add(thirdShareOfUserB), epsilon);
    expect(fifthUsersPendingRewards[2]).to.be.closeTo(fourthUsersShares[2], epsilon);

    // bob unstakes (and claims)
    const rewardBalanceBefore1 = await rewardToken.balanceOf(bob.address);
    await expect(staking.connect(bob).unstake(stakeOfBob))
      .to.emit(staking, "Unstake")
      .withArgs(bob.address, stakeOfBob)
      .to.emit(staking, "Claim");

    const rewardBalanceAfter1 = await rewardToken.balanceOf(bob.address);
    expect(rewardBalanceBefore1.add(fifthUsersPendingRewards[1])).to.be.closeTo(rewardBalanceAfter1, epsilon);

    // bob took his stake back
    expect(await stakeToken.balanceOf(bob.address)).to.be.eq(stakeOfBob);
    totalStakes = stakeOfAlice.add(stakeOfCharlie);
    expect(await stakeToken.balanceOf(staking.address)).to.be.eq(totalStakes);

    // wait till end of interval
    await fastForwardTo(ethers.provider, i2.end);

    const sixthUsersPendingRewards = await Promise.all(users.map((u) => staking.pendingReward(u.address)));

    const sixthCalculatedRewardOfUserA = i2.amount
      .mul(stakeOfAlice)
      .div(totalStakes)
      .mul(duration - timeSkip)
      .div(duration);

    // reward for first part of interval where C had stakeC/(stakeA+stakeB+stakeC)
    const firstPartOfSixthCalculatedRewardOfUserC = i2.amount
      .mul(timeSkip)
      .div(duration)
      .mul(stakeOfCharlie)
      .div(stakeOfAlice.add(stakeOfBob).add(stakeOfCharlie));

    // reward for second part of interval where C had stakeC/(stakeA+stakeC)
    const secondPartOfSixthCalculatedRewardOfUserC = i2.amount
      .mul(stakeOfCharlie)
      .div(totalStakes)
      .mul(duration - timeSkip)
      .div(duration);

    expect(sixthUsersPendingRewards[0]).to.be.closeTo(sixthCalculatedRewardOfUserA, epsilon);
    expect(sixthUsersPendingRewards[1]).to.be.eq(0);
    expect(sixthUsersPendingRewards[2]).to.be.closeTo(
      firstPartOfSixthCalculatedRewardOfUserC.add(secondPartOfSixthCalculatedRewardOfUserC),
      epsilon
    );
  });

  it("1 user stake -> wait -> get reward", async () => {
    const { intervals, totalRewardAmount } = params;
    const [i0, i1, i2] = intervals;

    // setup planner
    await rewardToken.transfer(stakingAdmin.address, params.totalRewardAmount);
    await rewardToken.connect(stakingAdmin).approve(staking.address, totalRewardAmount);

    // define rewards
    await staking.connect(stakingAdmin).appendIntervals(intervals);

    expect(await rewardToken.balanceOf(staking.address)).to.eq(totalRewardAmount);

    const userStake = parseTokens("100");
    await stakeToken.transfer(alice.address, userStake);
    await stakeToken.connect(alice).approve(staking.address, userStake);

    await expect(staking.connect(alice).stake(userStake)).to.emit(staking, "Stake").withArgs(alice.address, userStake);

    await fastForwardTo(ethers.provider, i0.end);

    expect(await staking.pendingReward(alice.address)).to.be.eq(i0.amount);

    await expect(staking.connect(alice).claim()).to.emit(staking, "Claim").withArgs(alice.address, i0.amount);

    await fastForwardTo(ethers.provider, i1.end);

    expect(await staking.pendingReward(alice.address)).to.be.eq(i1.amount);

    await fastForwardTo(ethers.provider, i2.end);
    expect(await staking.pendingReward(alice.address)).to.be.eq(i1.amount.add(i2.amount));

    await expect(staking.connect(alice).claim())
      .to.emit(staking, "Claim")
      .withArgs(alice.address, i1.amount.add(i2.amount));

    await expect(staking.connect(alice).unstake(userStake))
      .to.emit(staking, "Unstake")
      .withArgs(alice.address, i0.amount);
  });

  it("can prolong staking by appending intervals", async () => {
    const { intervals, totalRewardAmount, timeSkip } = params;
    const [i0, i1, i2] = intervals;

    // setup planner
    await rewardToken.transfer(stakingAdmin.address, totalRewardAmount);
    await rewardToken.connect(stakingAdmin).approve(staking.address, totalRewardAmount);

    // define rewards
    const _totalReward = i0.amount.add(i1.amount);
    await staking.connect(stakingAdmin).appendIntervals([i0, i1]);
    expect(await rewardToken.balanceOf(staking.address)).to.eq(_totalReward);

    // stake
    const userStake = parseTokens("100");
    await stakeToken.transfer(alice.address, userStake);
    await stakeToken.connect(alice).approve(staking.address, userStake);

    await expect(staking.connect(alice).stake(userStake)).to.emit(staking, "Stake").withArgs(alice.address, userStake);

    await fastForwardTo(ethers.provider, i1.end);

    expect(await staking.pendingReward(alice.address)).to.be.eq(_totalReward);

    await expect(staking.connect(alice).claim()).to.emit(staking, "Claim").withArgs(alice.address, _totalReward);

    await fastForwardTo(ethers.provider, i1.end + timeSkip / 2);

    // no reward yet
    expect(await staking.connect(alice).pendingReward(alice.address)).to.be.eq(BN_ZERO);

    // append new interval
    await staking.connect(stakingAdmin).appendIntervals([i2]);

    await fastForwardTo(ethers.provider, i2.end);
    expect(await staking.connect(alice).pendingReward(alice.address)).to.be.eq(i2.amount);

    await expect(staking.connect(alice).claim()).to.emit(staking, "Claim").withArgs(alice.address, i2.amount);

    await fastForwardTo(ethers.provider, i2.end + timeSkip);
    // no reward again
    expect(await staking.connect(alice).pendingReward(alice.address)).to.be.eq(BN_ZERO);
  });

  it("stake-> wait until the end of 1 interval -> get reward", async () => {
    const { intervals, totalRewardAmount } = params;
    const [i0] = intervals;

    // setup planner
    await rewardToken.transfer(stakingAdmin.address, params.totalRewardAmount);
    await rewardToken.connect(stakingAdmin).approve(staking.address, totalRewardAmount);

    await staking.connect(stakingAdmin).appendIntervals(intervals);

    expect(await staking.totalRewardAmount()).to.be.eq(totalRewardAmount);

    expect(await rewardToken.balanceOf(staking.address)).to.eq(totalRewardAmount);

    // stake
    const stakes = [100, 200, 700].map((x) => parseTokens(x));
    const totalStakes = sumBN(stakes);

    const [stakeOfAlice, stakeOfBob, stakeOfCharlie] = stakes;

    await stakeToken.transfer(alice.address, stakeOfAlice);
    await stakeToken.transfer(bob.address, stakeOfBob);
    await stakeToken.transfer(charlie.address, stakeOfCharlie);

    await stakeToken.connect(alice).approve(staking.address, stakeOfAlice);
    await stakeToken.connect(bob).approve(staking.address, stakeOfBob);
    await stakeToken.connect(charlie).approve(staking.address, stakeOfCharlie);

    await expect(staking.connect(alice).stake(stakeOfAlice))
      .to.emit(staking, "Stake")
      .withArgs(alice.address, stakeOfAlice);

    await expect(staking.connect(bob).stake(stakeOfBob)).to.emit(staking, "Stake").withArgs(bob.address, stakeOfBob);

    await expect(staking.connect(charlie).stake(stakeOfCharlie))
      .to.emit(staking, "Stake")
      .withArgs(charlie.address, stakeOfCharlie);

    expect(await staking.pendingReward(alice.address)).to.be.eq(0);
    expect(await staking.pendingReward(bob.address)).to.be.eq(0);
    expect(await staking.pendingReward(charlie.address)).to.be.eq(0);

    await fastForwardTo(ethers.provider, i0.end);

    expect(await Promise.all([alice, bob, charlie].map((u) => staking.pendingReward(u.address)))).to.be.eql(
      stakes.map((s) => i0.amount.mul(s).div(totalStakes))
    );
  });

  it("stake -> wait until the end of last interval -> all rewards distributed according to shares", async () => {
    const { intervals, totalRewardAmount } = params;

    const users = [alice, bob, charlie];
    const stakes = [100, 200, 700].map((x) => parseTokens(x));
    const userData = combineItems(users, stakes);

    const totalStakes = sumBN(stakes);
    const [stakeOfAlice, stakeOfBob, stakeOfCharlie] = stakes;

    // setup planner
    await rewardToken.transfer(stakingAdmin.address, totalRewardAmount);
    await rewardToken.connect(stakingAdmin).approve(staking.address, totalRewardAmount);

    await staking.connect(stakingAdmin).appendIntervals(intervals);

    const end = intervals[intervals.length - 1].end;

    // simple check
    expect(await staking.totalRewardAmount()).to.be.eq(totalRewardAmount);
    expect(await rewardToken.balanceOf(staking.address)).to.eq(totalRewardAmount);

    // stake all
    await Promise.all(
      userData.map((item) => {
        const [u, s] = item;
        return stakeToken.transfer(u.address, s);
      })
    );

    await Promise.all(
      userData.map((item) => {
        const [u, s] = item;
        return stakeToken.connect(u).approve(staking.address, s);
      })
    );

    await expect(staking.connect(alice).stake(stakeOfAlice))
      .to.emit(staking, "Stake")
      .withArgs(alice.address, stakeOfAlice);

    await expect(staking.connect(bob).stake(stakeOfBob)).to.emit(staking, "Stake").withArgs(bob.address, stakeOfBob);

    await expect(staking.connect(charlie).stake(stakeOfCharlie))
      .to.emit(staking, "Stake")
      .withArgs(charlie.address, stakeOfCharlie);

    const initialRewards = await Promise.all(users.map(async (u) => staking.pendingReward(u.address)));
    expect(initialRewards).to.be.eql(THREE_ZEROES_BN);

    // wait till the very end
    await fastForwardTo(ethers.provider, end);
    const shares = stakes.map((x) => x.mul(totalRewardAmount).div(totalStakes));

    const finalRewards = await Promise.all(users.map((u) => staking.pendingReward(u.address)));

    expect(finalRewards).to.be.eql(shares);
  });

  it("setPausedFunctions should revert if callee not admin", async () => {
    const pauseStake = {
      pausedStake: true,
      pausedUnstake: false,
      pausedClaim: false,
    };
    await expect(staking.connect(alice).setPausedFunctions(pauseStake)).to.be.revertedWith("Staking: FORBIDDEN");
  });

  it("setPausedFunctions should pause contract functions", async () => {
    const stakeOfAlice = BigNumber.from(100).mul(BigNumber.from(10).pow(18));
    await stakeToken.transfer(alice.address, BigNumber.from(stakeOfAlice).mul(4));

    await stakeToken.connect(alice).approve(staking.address, BigNumber.from(stakeOfAlice).mul(4));

    await expect(staking.connect(alice).stake(stakeOfAlice))
      .to.emit(staking, "Stake")
      .withArgs(alice.address, stakeOfAlice);

    expect(await staking.totalStakes()).to.eq(stakeOfAlice);

    const pauseStake = {
      pausedStake: true,
      pausedUnstake: false,
      pausedClaim: false,
    };
    await expect(staking.connect(defaultAdmin).setPausedFunctions(pauseStake))
      .to.emit(staking, "SetPausedFunctions")
      .withArgs(true, false, false);

    // try to stake
    await expect(staking.connect(alice).stake(stakeOfAlice)).to.be.revertedWith("Staking: METHOD_PAUSED");

    // try to unstake
    await expect(staking.connect(alice).unstake(stakeOfAlice)).to.emit(staking, "Unstake");

    // try to withdraw : not paused, fails for another reason
    await expect(staking.connect(alice).claim()).to.be.revertedWith("Staking: NOTHING_TO_CLAIM");

    const pauseUnstake = {
      pausedStake: false,
      pausedUnstake: true,
      pausedClaim: false,
    };

    await expect(staking.connect(defaultAdmin).setPausedFunctions(pauseUnstake))
      .to.emit(staking, "SetPausedFunctions")
      .withArgs(false, true, false);

    await expect(staking.connect(alice).stake(stakeOfAlice))
      .to.emit(staking, "Stake")
      .withArgs(alice.address, stakeOfAlice);

    await expect(staking.connect(alice).unstake(stakeOfAlice)).to.be.revertedWith("Staking: METHOD_PAUSED");

    // try to withdraw : not paused, fails for another reason
    await expect(staking.connect(alice).claim()).to.be.revertedWith("Staking: NOTHING_TO_CLAIM");

    const pauseWithdraw = {
      pausedStake: false,
      pausedUnstake: false,
      pausedClaim: true,
    };
    await expect(staking.connect(defaultAdmin).setPausedFunctions(pauseWithdraw))
      .to.emit(staking, "SetPausedFunctions")
      .withArgs(false, false, true);

    await expect(staking.connect(alice).claim()).to.be.revertedWith("Staking: METHOD_PAUSED");

    await expect(staking.connect(alice).unstake(stakeOfAlice)).to.emit(staking, "Unstake");
  });

  it("stake -> unstake without reward on periods with no reward", async () => {
    const { intervals, totalRewardAmount, timeSkip } = params;
    const [i0, i1, i2] = intervals;

    // setup planner
    await rewardToken.transfer(stakingAdmin.address, totalRewardAmount);
    await rewardToken.connect(stakingAdmin).approve(staking.address, totalRewardAmount);

    await staking.connect(stakingAdmin).appendIntervals(intervals);

    expect(await staking.totalRewardAmount()).to.be.eq(totalRewardAmount);

    expect(await rewardToken.balanceOf(staking.address)).to.eq(totalRewardAmount);

    // stake
    const stakes = [100, 200, 700].map((x) => parseTokens(x));
    const [stakeOfAlice, stakeOfBob, stakeOfCharlie] = stakes;

    await stakeToken.transfer(alice.address, stakeOfAlice);
    await stakeToken.transfer(bob.address, stakeOfBob);
    await stakeToken.transfer(charlie.address, stakeOfCharlie);

    await stakeToken.connect(alice).approve(staking.address, stakeOfAlice);
    await stakeToken.connect(bob).approve(staking.address, stakeOfBob);
    await stakeToken.connect(charlie).approve(staking.address, stakeOfCharlie);

    // alice stakes before start
    await expect(staking.connect(alice).stake(stakeOfAlice))
      .to.emit(staking, "Stake")
      .withArgs(alice.address, stakeOfAlice);

    await fastForwardTo(ethers.provider, i0.end);

    // bob stakes after i0 ends
    await expect(staking.connect(bob).stake(stakeOfBob)).to.emit(staking, "Stake").withArgs(bob.address, stakeOfBob);

    // bob unstakes before i1 starts
    await fastForwardTo(ethers.provider, i1.start - timeSkip / 2); //  before start

    // bob is going to have no reward
    expect(await staking.pendingReward(bob.address)).to.be.eq(0);
    // alice takes all the reward
    expect(await staking.pendingReward(alice.address)).to.be.eq(i0.amount);

    // bob unstakes but gets no reward
    await expect(staking.connect(bob).unstake(stakeOfBob))
      .to.emit(staking, "Unstake")
      .withArgs(bob.address, stakeOfBob)
      .to.not.emit(staking, "Claim");

    expect(await rewardToken.balanceOf(bob.address)).to.be.eq(0);

    // alice unstakes and takes all the reward of i0
    await expect(staking.connect(alice).unstake(stakeOfAlice))
      .to.emit(staking, "Unstake")
      .withArgs(alice.address, stakeOfAlice)
      .to.emit(staking, "Claim")
      .withArgs(alice.address, i0.amount)
      .to.emit(rewardToken, "Transfer")
      .withArgs(staking.address, alice.address, i0.amount);

    await fastForwardTo(ethers.provider, i1.end);
    // all users do stake again
    await stakeToken.connect(alice).approve(staking.address, stakeOfAlice);
    await stakeToken.connect(bob).approve(staking.address, stakeOfBob);
    await stakeToken.connect(charlie).approve(staking.address, stakeOfCharlie);
    await staking.connect(alice).stake(stakeOfAlice);
    await staking.connect(bob).stake(stakeOfBob);
    await staking.connect(charlie).stake(stakeOfCharlie);

    // wait till the start of i2
    await fastForwardTo(ethers.provider, i2.start - timeSkip / 2); //  before start

    expect(await staking.pendingReward(alice.address)).to.be.eq(0);
    expect(await staking.pendingReward(bob.address)).to.be.eq(0);
    expect(await staking.pendingReward(charlie.address)).to.be.eq(0);

    // all users unstake
    await staking.connect(alice).unstake(stakeOfAlice);
    await staking.connect(bob).unstake(stakeOfBob);
    await staking.connect(charlie).unstake(stakeOfCharlie);

    // but get no reward
    expect(await rewardToken.balanceOf(alice.address)).to.be.eq(i0.amount); // didn't change
    expect(await rewardToken.balanceOf(bob.address)).to.be.eq(0);
    expect(await rewardToken.balanceOf(charlie.address)).to.be.eq(0);
  });

  it("supportsInterface ok", async () => {
    const InterfaceGetter = await ethers.getContractFactory("InterfaceGetter");
    const interfaceRegistry = await InterfaceGetter.deploy();
    await interfaceRegistry.deployed();

    const getIds = async (names) => await Promise.all(names.map((_name) => interfaceRegistry.getInterfaceId(_name)));

    const ids = await getIds(["IStakingV1", "IERC165Upgradeable", "IERC721Receiver", "ITreasuryV1", "IAccessControl"]);

    const results = await Promise.all(ids.map((id) => staking.supportsInterface(id)));

    expect(results).to.be.eql([true, true, false, false, false]);
  });

  it("check refund unused tokens on remove intervals", async () => {
    const { intervals, totalRewardAmount } = params;
    const [i0, i1, i2] = intervals;

    // setup planner
    await rewardToken.transfer(stakingAdmin.address, params.totalRewardAmount);
    await rewardToken.connect(stakingAdmin).approve(staking.address, totalRewardAmount);

    // define rewards
    await staking.connect(stakingAdmin).appendIntervals(intervals);

    expect(await rewardToken.balanceOf(staking.address)).to.eq(totalRewardAmount);

    const userStake = parseTokens("100");
    await stakeToken.transfer(alice.address, userStake);
    await stakeToken.connect(alice).approve(staking.address, userStake);

    await expect(staking.connect(alice).stake(userStake)).to.emit(staking, "Stake").withArgs(alice.address, userStake);

    // forward to the middle of the first interval
    await fastForwardTo(ethers.provider, Math.round((i0.start + i0.end) / 2));

    // cannot remove intervals, which are already started
    await expect(staking.connect(stakingAdmin).removeIntervals(0)).to.be.revertedWith(
      "StakingPlanner: ALREADY_STARTED"
    );

    // all excessive funds are withdrawn on intervals removal
    await expect(staking.connect(stakingAdmin).removeIntervals(1))
      .to.emit(staking, "IntervalsRemoved")
      .withArgs(2)
      .to.emit(rewardToken, "Transfer")
      .withArgs(staking.address, stakingAdmin.address, i1.amount.add(i2.amount));

    // but still enough to pay rewards
    // forward to the middle of the first interval
    await fastForwardTo(ethers.provider, i2.end);
    expect(await staking.pendingReward(alice.address)).to.be.eq(i0.amount);

    await expect(staking.connect(alice).claim()).to.emit(staking, "Claim").withArgs(alice.address, i0.amount);

    expect(await staking.paidAmount()).to.be.eq(i0.amount);
    expect(await staking.totalRewardAmount()).to.be.eq(i0.amount);

    expect(await rewardToken.balanceOf(staking.address)).to.be.eq(BN_ZERO);
  });
});
