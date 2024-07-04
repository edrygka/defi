"use strict";

const assert = require("assert");
const { BigNumber } = require("ethers");

function makeRange(size, startAt = 0) {
  return [...Array(size).keys()].map((i) => i + startAt);
}
function makeFloatRange(first, last, count) {
  assert(count >= 2, "makeFloatRange: at least 2 points are required");
  // make an array of points starting with 0
  const points = makeRange(count);
  const step = (last - first) / (count - 1);
  return points.map((i) => first + step * i);
}

/**
 * Composes cartesian product of input arrays -
 * Cartesian product is a collection of all possible combinations (ordered) of items from each input array.
 * Consider A = [a1, a2], B = [b1, b2] => A x B = [[a1, b1], [a1, b2], [a2, b1], [a2, b2]]
 * @param  {...any} a any number of arrays
 * @returns cartesian product of provided arrays
 */
function cartesianProduct(...a) {
  return a.reduce((a, b) => a.flatMap((d) => b.map((e) => [...d, e])), [[]]);
}

/**
 * Combines two arrays into array of pairs
 */
function combineItems(a, b) {
  assert(Array.isArray(a) && Array.isArray(b) && a.length === b.length, "arguments must be arrays");

  return makeRange(a.length).map((i) => [a[i], b[i]]);
}

/**
 * selects and returns random item of provided array
 * @param arr array of items
 * @returns random item of the array
 */
function randomItem(arr) {
  assert(Array.isArray(arr), "argument is not an array");
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * creates an array of random items taken from source array
 * @param array source array to select random items from
 * @param numItems number of items
 * @returns
 */
function makeRandomArray(array, numItems) {
  return Array.from({ length: numItems }, () => randomItem(array));
}

/**
 * Models boxed linear function
 * @param {*} start interval start
 * @param {*} end interval end
 * @param {*} from value from
 * @param {*} to value to
 */
function makeBoxedLinear(start, end, from, to) {
  assert(end > start, "end must be greater than or equal to start");

  return (x) => {
    if (x <= start) return from;
    if (x >= end) return to;

    return ((x - start) * (to - from)) / (end - start) + from;
  };
}

/**
 * Simulates boxed linear function operating on BigNumbers
 * @param {*} start interval start
 * @param {*} end interval end
 * @param {*} from value from
 * @param {*} to value to
 * @returns result of calculations
 */
function makeBoxedLinearBN(start, end, from, to) {
  assert(end.gt(start), "end must be greater than or equal to start");

  return (x) => {
    if (x.lte(start)) return from;
    if (x.gte(end)) return to;

    return x.sub(start).mul(to.sub(from)).div(end.sub(start)).add(from);
  };
}

/**
 * Splits value into result of integer division and rest
 * @param {Number} value value to divide
 * @param {Number} divider divider
 * @returns array of 2 items: result of division and rest
 */
function splitByDividor(value, divider) {
  return [~~(value / divider), value % divider];
}

/**
 * Splits value into array of numbers, being multiplied by array of dividors
 * and summarized gives original value
 * value, [d1, d2, ..., d[n]] => [r1, r2, .., r[n], r[n+1]] : r1*d1 + r2*d2 + ... r[n]*d[n] + r[n+1] === value
 * @param {Number} value to split
 * @param {Array of Numbers} dividors
 * @returns array of results of divisions and the rest
 */
function splitByDividors(value, dividors) {
  let rest = value;
  const results = [];

  dividors.forEach((x) => {
    const [_result, _rest] = splitByDividor(rest, x);
    rest = _rest;
    results.push(_result);
  });
  results.push(rest);
  return results;
}

/**
 * calculates the sum of array items
 * @param {} arr array of numbers
 * @returns sum of array items
 */
function sum(arr) {
  return arr.reduce((prev, curr) => prev + curr, 0);
}

/**
 * calculates the sum of big numbers array
 * @param {} arr array of BigNumber
 * @returns sum of array items
 */
function sumBN(arr) {
  return arr.reduce((prev, curr) => prev.add(curr), BigNumber.from("0"));
}
/**
 * creates piecewise-linear emulating function based on intervals data
 * operates on big numbers (BigNumber data type)
 * @param {*} intervalsInfo
 * @returns function object
 */
const makePiecewiseLinearBN = (intervalsInfo) => {
  const fns = intervalsInfo.map((s) =>
    makeBoxedLinearBN(BigNumber.from(s.start), BigNumber.from(s.end), BigNumber.from("0"), BigNumber.from(s.amount))
  );

  const emulatingFunction = (x) => fns.reduce((res, f) => res.add(f(BigNumber.from(x))), BigNumber.from("0"));

  return emulatingFunction;
};

module.exports = {
  makeRange,
  makeFloatRange,
  cartesianProduct,
  combineItems,
  randomItem,
  makeRandomArray,
  makeBoxedLinear,
  makeBoxedLinearBN,
  makePiecewiseLinearBN,
  splitByDividor,
  splitByDividors,
  sum,
  sumBN,
};
