const chai = require("chai");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const { parseTokens } = require("../utils/parse");

const { makeRange, makeFloatRange, makePiecewiseLinearBN, randomItem } = require("../utils/math");

const { currentBlockTimestamp, fastForwardTo } = require("../utils/crypto");
const { BigNumber } = require("ethers");

chai.use(solidity);

describe("StakingPlanner", function () {
  let NOW;
  let planner;
  const BN_ZERO = BigNumber.from("0");

  const params = {
    delta: 100,
    duration: 1000,
    totalAmount: BigNumber.from("100").mul(BigNumber.from("10").pow(18)),

    amount1: BigNumber.from("20").mul(BigNumber.from("10").pow(18)),
    amount2: BigNumber.from("30").mul(BigNumber.from("10").pow(18)),
    amount3: BigNumber.from("50").mul(BigNumber.from("10").pow(18)),

    epsilon: BigNumber.from("10").pow(6),
    plannerAdminRoleName: "INTERVAL_PLANNER_ADMIN_ROLE",
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

  const checkIntervalEq = (intervalInfo, intervalParams) => {
    expect([intervalInfo.amount, intervalInfo.start, intervalInfo.end]).to.be.eql([
      intervalParams.amount,
      intervalParams.start,
      intervalParams.end,
    ]);
  };

  function configureParams() {
    const delta = 100; // seconds
    const start = NOW + delta;
    const duration = 1000;
    const end = start + duration;
    const start1 = end + delta;
    const end1 = start1 + duration;
    const start2 = end1 + delta;
    const end2 = start2 + duration;
    const finish = end2 + delta;

    params.delta = delta;
    params.duration = duration;
    params.finish = finish;

    params.start = start;
    params.end = end;

    params.intervals = [
      { amount: params.amount1, start: start, end: end },
      { amount: params.amount2, start: start1, end: end1 },
      { amount: params.amount3, start: start2, end: end2 },
    ];
  }

  beforeEach(async () => {
    // deploy planner
    const StakingPlanner = await ethers.getContractFactory("StakingPlannerImpl");
    planner = await StakingPlanner.deploy();
    await planner.deployed();

    NOW = await currentBlockTimestamp(ethers.provider);

    configureParams();
  });

  const addInterval = (amount, start, end) => planner.appendIntervals([{ amount: amount, start: start, end: end }]);

  /**
   * GENERAL CHECKS *
   */

  it("Check properties & configuration at start", async () => {
    expect(await planner.totalRewardAmount()).to.be.eq("0");
    expect(await planner.intervalsCount()).to.be.eq("0");

    expect(await Promise.all([0, 1, 2, 100, 500, 12123].map((x) => planner.rewardAt(x)))).to.be.eql(
      new Array(6).fill(BN_ZERO)
    );
  });

  it("add invalid interval fails", async () => {
    const [interval] = params.intervals;

    await expect(addInterval(interval.amount, interval.start, interval.start)).to.be.revertedWith(
      "StakingPlanner: INVALID_ARG"
    );

    await expect(addInterval(interval.amount, interval.end, interval.start)).to.be.revertedWith(
      "StakingPlanner: INVALID_ARG"
    );
  });

  it("add interval with start in the past fails", async () => {
    const { delta } = params;

    await expect(addInterval(parseTokens(100), NOW - delta, NOW + delta)).to.be.revertedWith(
      "StakingPlanner: INVALID_START"
    );

    await expect(addInterval(parseTokens(100), NOW - delta * 2, NOW - delta)).to.be.revertedWith(
      "StakingPlanner: INVALID_START"
    );
  });

  it("add interval with start in the past when there are already intervals, fails", async () => {
    const { intervals } = params;
    const [i0, i1, i2] = intervals;
    await expect(planner.appendIntervals([i0])).not.to.be.reverted;

    await fastForwardTo(ethers.provider, i1.start);

    // i1 has already started, must fail
    await expect(planner.appendIntervals([i0])).to.be.revertedWith("StakingPlanner: INVALID_START");

    // i2 didn't start yet, must succeed
    await expect(planner.appendIntervals([i2])).not.to.be.reverted;
  });

  it("add inconsistent interval fails", async () => {
    const { amount1, start, end, delta } = params;
    await addInterval(amount1, start, end);

    expect(await planner.intervalsCount()).to.be.eq("1");
    // new start must be gte last end
    await expect(addInterval(amount1, end - delta, end + delta)).to.be.revertedWith("StakingPlanner: INVALID_START");
  });

  it("add 1 interval by appendIntervals success", async () => {
    const requiredAmount = parseTokens(100);
    const now = await currentBlockTimestamp(ethers.provider);
    const start = now + 100;
    const end = now + 1000;
    const intervals = [
      {
        amount: requiredAmount,
        start: start,
        end: end,
      },
    ];

    await expect(planner.appendIntervals(intervals))
      .to.emit(planner, "IntervalAdded")
      .withArgs(requiredAmount, start, end);

    // intervals added
    expect(await planner.intervalsCount()).to.be.eq(1);

    expect(await planner.intervals(0)).to.be.eql([BigNumber.from("0"), requiredAmount, start, end]);
  });

  it("add load of intervals success", async () => {
    const intervalsCount = 200;
    const duration = 86400; // 1 day
    const timeSkip = 300; // 5 min
    const baseAmount = parseTokens("100");
    const randomAmounts = [10, 15, 20, 25, 30, 35].map((x) => parseTokens(x));
    const now = await currentBlockTimestamp(ethers.provider);

    const intervalsData = generateIntervals(
      now + timeSkip,
      intervalsCount,
      duration,
      timeSkip,
      baseAmount,
      randomAmounts
    );

    // add all intervals at once
    await planner.appendIntervals(intervalsData);

    // intervals added
    expect(await planner.intervalsCount()).to.be.eq(intervalsCount);

    const indexes = makeRange(intervalsCount);
    const intervals = await Promise.all(indexes.map((i) => planner.intervals(i)));

    let prevSum = BigNumber.from("0");
    indexes.forEach((i) => {
      const data = intervalsData[i];
      const interval = intervals[i];
      expect([prevSum, data.amount, data.begin, data.end]).to.be.eql([
        interval.prevSum,
        interval.amount,
        interval.begin,
        interval.end,
      ]);
      // increase prevSum by current amount
      prevSum = prevSum.add(data.amount);
    });
  });

  it("removeIntervals emits IntervalRemoved & changes totalRewardAmount", async () => {
    const { intervals, amount1 } = params;
    await planner.appendIntervals(intervals);

    await expect(planner.removeIntervals(1)).to.emit(planner, "IntervalsRemoved").withArgs(BigNumber.from("2"));

    expect(await planner.totalRewardAmount()).to.be.eq(amount1);

    await expect(planner.removeIntervals(0)).to.emit(planner, "IntervalsRemoved").withArgs(BigNumber.from("1"));

    expect(await planner.totalRewardAmount()).to.be.eq(0);
  });

  it("can remove interval before it started", async () => {
    const { intervals } = params;

    await planner.appendIntervals(intervals);
    expect(await planner.intervalsCount()).to.be.eq(intervals.length);
    checkIntervalEq(await planner.intervals(2), intervals[2]);

    await planner.removeIntervals(2);
    expect(await planner.intervalsCount()).to.be.eq("2");
    checkIntervalEq(await planner.intervals(1), intervals[1]);

    await planner.removeIntervals(1);
    expect(await planner.intervalsCount()).to.be.eq("1");
    checkIntervalEq(await planner.intervals(0), intervals[0]);

    await planner.removeIntervals(0);
    expect(await planner.intervalsCount()).to.be.eq("0");
  });

  it("remove all intervals success", async () => {
    const { intervals } = params;

    await planner.appendIntervals(intervals);
    expect(await planner.intervalsCount()).to.be.eq(intervals.length);
    checkIntervalEq(await planner.intervals(2), intervals[2]);

    await expect(planner.removeIntervals(0)).to.emit(planner, "IntervalsRemoved").withArgs(BigNumber.from("3"));

    expect(await planner.totalRewardAmount()).to.be.eq("0");
  });

  it("when no intervals, removeIntervals fails", async () => {
    await expect(planner.removeIntervals(0)).to.be.revertedWith("StakingPlanner: OUT_OF_BOUND");
  });

  it("can't remove interval after it started", async () => {
    const { intervals, delta } = params;

    await planner.appendIntervals(intervals);

    const lastInterval = intervals[intervals.length - 1];

    // last interval has started, but not finished yet
    const forwardTimestamp = lastInterval.start + delta;
    await fastForwardTo(ethers.provider, forwardTimestamp);

    await expect(planner.removeIntervals(2)).to.be.revertedWith("StakingPlanner: ALREADY_STARTED");
  });

  it("check function using plausible data", async () => {
    const { intervals, delta } = params;

    await planner.appendIntervals(intervals);

    expect(await planner.intervalsCount()).to.be.eq(intervals.length); // 3

    const numPoints = 100;
    const range = makeFloatRange(
      intervals[0].start - delta,
      intervals[intervals.length - 1].end + delta,
      numPoints
    ).map((x) => Math.round(x));

    const results = await Promise.all(range.map((x) => planner.rewardAt(x)));

    const emulatingFunction = makePiecewiseLinearBN(intervals);
    const emulatedResults = range.map((x) => emulatingFunction(BigNumber.from(x)));

    expect(emulatedResults).to.be.eql(results);
  });

  it("find interval zero when no intervals", async () => {
    // the argument value doesn't matter when no intervals
    expect(await planner.intervalsCount()).to.be.eq("0");
    expect(await planner.findInterval(1)).to.be.eql([BigNumber.from("0"), BigNumber.from("0"), 0, 0]);
  });

  it("find interval success", async () => {
    // check that findInterval finds correct interval
    const { intervals, delta } = params;
    const [i0, i1, i2] = intervals;
    const ext0 = [BigNumber.from("0"), i0.amount, i0.start, i0.end];
    const ext1 = [i0.amount, i1.amount, i1.start, i1.end];
    const ext2 = [i0.amount.add(i1.amount), i2.amount, i2.start, i2.end];

    await planner.appendIntervals(intervals);

    // before first interval start
    expect(await planner.findInterval(i0.start - delta)).to.be.eql(ext0);
    // first start
    expect(await planner.findInterval(i0.start)).to.be.eql(ext0);
    // in the middle of the first interval
    expect(await planner.findInterval((i0.start + i0.end) / 2)).to.be.eql(ext0);
    // first end
    expect(await planner.findInterval(i0.end)).to.be.eql(ext0);
    // after first end before second start
    expect(await planner.findInterval((i0.end + i1.start) / 2)).to.be.eql(ext1);
    // second start
    expect(await planner.findInterval(i1.start)).to.be.eql(ext1);
    // after second start before second end
    expect(await planner.findInterval((i1.start + i1.end) / 2)).to.be.eql(ext1);
    // second end
    expect(await planner.findInterval(i1.end)).to.be.eql(ext1);
    // after second end before third start
    expect(await planner.findInterval((i1.end + i2.start) / 2)).to.be.eql(ext2);
    // third start
    expect(await planner.findInterval(i2.start)).to.be.eql(ext2);
    // after third start before third end
    expect(await planner.findInterval((i2.start + i2.end) / 2)).to.be.eql(ext2);
    // third end
    expect(await planner.findInterval(i2.end)).to.be.eql(ext2);

    // after last end
    expect(await planner.findInterval(i2.end + delta)).to.be.eql(ext2);
  });

  it("delta on invalid args returns 0", async () => {
    const [s] = params.intervals;
    await addInterval(s.amount, s.start, s.end);

    expect(await planner.deltaReward(s.end, s.start)).to.be.eq(0);
  });

  it("delta calculate success", async () => {
    const { intervals } = params;
    const [i0, i1, i2] = intervals;

    await planner.appendIntervals(intervals);
    expect(await planner.intervalsCount()).to.be.eq(intervals.length); // 3

    expect(await Promise.all(intervals.map((i) => planner.deltaReward(i.start, i.end)))).to.be.eql(
      intervals.map((i) => i.amount)
    );

    expect(await planner.deltaReward(i0.start, i1.end)).to.be.eq(i0.amount.add(i1.amount));
    expect(await planner.deltaReward(i1.start, i2.end)).to.be.eq(i1.amount.add(i2.amount));
    expect(await planner.deltaReward(i0.start, i2.end)).to.be.eq(await planner.totalRewardAmount());
  });

  it("check deltaReward accuracy", async () => {
    const { intervals, delta } = params;

    await planner.appendIntervals(intervals);
    expect(await planner.intervalsCount()).to.be.eq(intervals.length); // 3

    const emulatingFunction = makePiecewiseLinearBN(intervals);
    const emulatingDelta = (x0, x1) => emulatingFunction(x1) - emulatingFunction(x0);

    const numPoints = 100;
    const points = makeFloatRange(
      intervals[0].start - delta,
      intervals[intervals.length - 1].end + delta,
      numPoints
    ).map((x) => Math.round(x));

    const randomPair = (arr) => {
      const it1 = randomItem(arr);
      const it2 = randomItem(arr);

      return it1 < it2 ? [it1, it2] : [it2, it1];
    };

    const numPairs = 100;
    const pairs = makeRange(numPairs).map(() => randomPair(points));

    const results = await Promise.all(pairs.map((x) => planner.deltaReward(x[0], x[1])));

    const emulatedResults = pairs
      .map((x) => emulatingDelta(BigNumber.from(x[0]), BigNumber.from(x[1])))
      .map((x) => BigNumber.from(x.toString()));

    expect(emulatedResults).to.be.eql(results);
  });

  it("after finish reward is full", async () => {
    const { intervals } = params;

    await planner.appendIntervals(intervals);

    // forward to the time point where some amount is unlocked
    const lastInterval = intervals[intervals.length - 1];
    await fastForwardTo(ethers.provider, lastInterval.end);

    const unlockedNow = await planner.rewardAt(lastInterval.end);
    const totalAmount = await planner.totalRewardAmount();

    expect(unlockedNow).to.be.eq(totalAmount);
  });

  it("check rewardAt function", async () => {
    const { intervals } = params;
    const epsilon = BigNumber.from("1");

    await planner.appendIntervals(intervals);

    // forward to the time point where some amount is unlocked
    const [firstInterval, , lastInterval] = intervals;
    const numPoints = 100;

    const range = makeFloatRange(firstInterval.start, lastInterval.end, numPoints).map((x) => Math.floor(x));

    const emulatingFunction = makePiecewiseLinearBN(intervals);

    for (const x of range) {
      await fastForwardTo(ethers.provider, x);
      const rewardValue = await planner.rewardAt(x);
      const emulatedValue = emulatingFunction(x);
      expect(emulatedValue).to.be.eq(rewardValue);
    }

    const unlockedNow = await planner.rewardAt(lastInterval.end);
    const totalAmount = await planner.totalRewardAmount();

    // all the tokens unlocked
    expect(unlockedNow).to.be.closeTo(totalAmount, epsilon);
  });
});
