"use strict";

const { expect } = require("chai");
const { makeRange, makeFloatRange, cartesianProduct, makeBoxedLinear } = require("../../utils/math");

describe("Test math utils", () => {
  describe("test makeRange", () => {
    it("makeRange correct", async () => {
      expect(makeRange(2, 3)).to.be.eql([3, 4]);
      expect(makeRange(4, 5)).to.be.eql([5, 6, 7, 8]);
      expect(makeRange(1, 0)).to.be.eql([0]);
      expect(makeRange(0, 10)).to.be.eql([]);
    });
  });

  describe("Test makeFloatRange", () => {
    it("test makeFloatRange", async () => {
      expect(makeFloatRange(1, 2, 2)).to.be.eql([1, 2]);

      expect(makeFloatRange(2.0, 3.0, 5)).to.be.eql([2.0, 2.25, 2.5, 2.75, 3.0]);
    });
  });

  describe("test cartesian product", () => {
    it("simple test", async () => {
      const A = [1, 2];
      const B = ["a", "b"];

      expect(cartesianProduct(A, B)).to.be.eql([
        [1, "a"],
        [1, "b"],
        [2, "a"],
        [2, "b"],
      ]);
    });

    it("multiple sets", async () => {
      const r = makeRange(3, 1, 1);
      expect(r).to.be.eql([1, 2, 3]);
      expect(cartesianProduct(r, r, r)).to.be.eql([
        [1, 1, 1],
        [1, 1, 2],
        [1, 1, 3],
        [1, 2, 1],
        [1, 2, 2],
        [1, 2, 3],
        [1, 3, 1],
        [1, 3, 2],
        [1, 3, 3],
        [2, 1, 1],
        [2, 1, 2],
        [2, 1, 3],
        [2, 2, 1],
        [2, 2, 2],
        [2, 2, 3],
        [2, 3, 1],
        [2, 3, 2],
        [2, 3, 3],
        [3, 1, 1],
        [3, 1, 2],
        [3, 1, 3],
        [3, 2, 1],
        [3, 2, 2],
        [3, 2, 3],
        [3, 3, 1],
        [3, 3, 2],
        [3, 3, 3],
      ]);
    });
  });

  describe("test boxedLinear function", () => {
    const params = {
      start: -10,
      end: 12,
      low: -15,
      high: 20,
      epsilon: 0.00001,
    };

    it("min before start", async () => {
      const func = makeBoxedLinear(params.start, params.end, params.low, params.high);
      makeFloatRange(params.start - 10, params.start, 100).forEach((x) =>
        expect(func(x)).to.be.closeTo(params.low, params.epsilon)
      );
    });

    it("max after end", async () => {
      const func = makeBoxedLinear(params.start, params.end, params.low, params.high);
      makeFloatRange(params.end, params.end + 10, 100).forEach((x) =>
        expect(func(x)).to.be.closeTo(params.high, params.epsilon)
      );
    });

    it("linear in between", async () => {
      const k = (params.high - params.low) / (params.end - params.start);
      const b = params.low - params.start * k;

      const func = makeBoxedLinear(params.start, params.end, params.low, params.high);

      makeFloatRange(params.start, params.end, 100).forEach((x) => {
        expect(func(x)).to.be.closeTo(k * x + b, params.epsilon);
      });
    });
  });
});
