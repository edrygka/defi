const { ethers } = require("hardhat");
const { parseBigNumber, requestConfirmation } = require("./operational");

const logAll = async (title, params = {}) => {
  logTitle(title);
  await logNetwork();

  for (const [key, value] of Object.entries(params)) {
    logParams(key, value);
  }

  console.log("");

  await requestConfirmation();

  console.log("Deploying...");
};

const logTitle = (message) => {
  console.log(`----------------- ${message} -----------------`);
};

const logNetwork = async () => {
  console.log(`\nNetwork info:`);

  const indent = 10;
  const network = (await ethers.provider.getNetwork()).name;

  log("sender", await ethers.provider.getSigner().getAddress(), indent);
  log("network", network === "unknown" ? "hardhat" : network, indent);
  log("gas price", `${parseBigNumber("GAS_PRICE") / 10 ** 9} Gwei`, indent);
  log("gas limit", `${parseBigNumber("GAS_LIMIT")} Gas`, indent);
};

const logTx = async (contractName, functionName, tx) => {
  console.log(`\n${contractName}.${functionName}():`);

  const indent = 9;
  if (tx.hash === undefined) {
    log("address", tx.address, indent);
    tx = tx.deployTransaction;
  }

  const gasUsed = (await ethers.provider.getTransactionReceipt(tx.hash)).gasUsed;
  const gasLimit = parseBigNumber("GAS_LIMIT");
  const usagePercent = ((gasUsed * 100) / gasLimit).toFixed(2);
  const gasPrice = tx.gasPrice.toString();

  log("hash", tx.hash, indent);
  log("gas used", `${gasLimit} | ${gasUsed} (${usagePercent}%) Gas`, indent);
  log("gas price", `${gasPrice / 10 ** 9} Gwei`, indent);
  log("tx fee", `${(gasUsed * gasPrice) / 10 ** 18} Ether`, indent);
};

const logParams = (title, params) => {
  let maxKeyLen = 0;
  for (const [key] of Object.entries(params)) {
    if (key.length > maxKeyLen) maxKeyLen = key.length;
  }

  console.log(`\n${title.charAt(0).toUpperCase() + title.slice(1)}:`);
  for (const [key, value] of Object.entries(params)) {
    let str = `- ${key}: ` + " ".repeat(maxKeyLen - key.length);
    if (Array.isArray(value)) {
      value.forEach((el) => (str += JSON.stringify(el) + ", \n" + " ".repeat(maxKeyLen + 4)));
    } else {
      str += value;
    }
    console.log(str);
  }
};

const log = (key, value, indent) => {
  console.log(`- ${key}: ` + " ".repeat(indent - key.length) + value);
};

module.exports = {
  logAll,
  logTx,
  logParams,
  logNetwork,
  logTitle,
};
