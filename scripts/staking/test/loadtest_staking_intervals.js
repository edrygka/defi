"use strict";

const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");
const { makeRange, randomItem, sumBN } = require("../../../utils/math");
const { currentBlockTimestamp } = require("../../../utils/crypto");

const { parseAddress, getTxParams, requestConfirmation } = require("../../../utils/operational");

const { logTx, logNetwork, logTitle, logParams } = require("../../../utils/logger");

const { parseTokens } = require("../../../utils/parse");

const logAll = async (title, params) => {
  logTitle(title);
  await logNetwork();

  for (const [key, value] of Object.entries(params)) {
    logParams(key, value);
  }

  console.log("");
};

const params = {
  intervalsCount: 10,
  duration: 3, // seconds
  timeskip: 2, // seconds
  baseAmount: parseTokens("1", 18).div(BigNumber.from("100")),
  randomAmounts: [0].map((x) => parseTokens(x, 18)),
};

const config = {
  stakingAddress: parseAddress("STAKING"),
};

function generateIntervals(start, count, duration, timeSkip, baseAmount, randomAmounts) {
  return makeRange(count).map((i) => {
    const item = {
      amount: randomItem(randomAmounts).add(baseAmount),
      start: start + i * duration + i * timeSkip,
      end: start + (i + 1) * duration + i * timeSkip,
    };
    return item;
  });
}

async function main() {
  await logAll("LOAD TEST OF STAKING ON MULTIPLE INTERVALS", { config });

  const stakingInstance = await ethers.getContractAt("StakingV1", config.stakingAddress);

  // show all intervals
  const numIntervals = await stakingInstance.intervalsCount();
  console.log("number of existing intervals: %d", numIntervals);

  let lastEnd = 0;
  if (numIntervals > 0) {
    [, , , lastEnd] = await stakingInstance.intervalAt(numIntervals - 1);
    console.log("last end is ", lastEnd);
  }

  const [admin] = await ethers.getSigners();
  console.log("admin is %s", admin.address);

  const stakeTokenAddress = await stakingInstance.stakeToken();
  const rewardTokenAddress = await stakingInstance.rewardToken();
  const rewardToken = await ethers.getContractAt("IERC20", rewardTokenAddress);
  const adminBalance = await rewardToken.balanceOf(admin.address);
  const now = await currentBlockTimestamp(ethers.provider);

  logParams("ADVANCED CONFIG", {
    StakeToken: stakeTokenAddress,
    RewardToken: rewardTokenAddress,
    AdminBalance: adminBalance,
    NOW: now,
  });

  // generate many random intervals
  if (lastEnd < now) {
    lastEnd = now;
  }

  const start = lastEnd + 200;
  const intervals = generateIntervals(
    start, // start
    params.intervalsCount,
    params.duration,
    params.timeskip,
    params.baseAmount,
    params.randomAmounts
  );

  const requiredAmount = sumBN(intervals.map((x) => x.amount));

  console.log("required amount of tokens is", requiredAmount.toString());

  await requestConfirmation("start adding intervals?");

  await rewardToken.approve(stakingInstance.address, requiredAmount);

  const txParams = {
    gasPrice: getTxParams().gasPrice,
    gasLimit: 80000 * params.intervalsCount,
  };

  const tx = await stakingInstance.appendIntervals(intervals, txParams);
  await tx.wait();

  logTx("StakingV1", "appendIntervals", tx);

  console.log("completed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
