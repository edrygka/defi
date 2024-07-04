"use strict";

const yesno = require("yesno");
const { ethers } = require("hardhat");
const { utils } = require("ethers");

const requestConfirmation = async (message = "Ready to continue?") => {
  const ok = await yesno({
    yesValues: ["", "yes", "y", "yes"],
    question: message,
  });
  if (!ok) {
    throw new Error("Script cancelled.");
  }
  console.log("");
};

const parseBigNumber = (property, decimals = 0, defaultValue = undefined) => {
  let value = process.env[property];
  if (isUndefined(value)) {
    assertDefined(property, defaultValue);
    value = defaultValue.toString();
  } else {
    assertDefined(property, value);
  }

  return ethers.utils.parseUnits(value, decimals);
};

const parseAddress = (property) => {
  const value = process.env[property];
  assertDefined(property, value);
  try {
    return ethers.utils.getAddress(value);
  } catch (e) {
    throw new Error(`Invalid address ${property}: ${value}`);
  }
};

const parseString = (property) => {
  const value = process.env[property];
  assertDefined(property, value);
  return value;
};

const encodeParameters = (types, values) => {
  const abi = new utils.AbiCoder();
  return abi.encode(types, values);
};

const getTxParams = () => {
  return {
    gasPrice: parseBigNumber("GAS_PRICE"),
    gasLimit: parseBigNumber("GAS_LIMIT"),
  };
};

const assertDefined = (property, obj) => {
  if (obj === undefined || obj === null) {
    throw new Error(`Undefined property: ${property}`);
  }
};

const isUndefined = (obj) => {
  return obj === undefined || obj === null;
};

module.exports = {
  requestConfirmation,
  parseBigNumber,
  parseAddress,
  parseString,
  encodeParameters,
  getTxParams,
};
