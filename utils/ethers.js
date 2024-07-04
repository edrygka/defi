/** UTILITY FUNCTIONS **/
const { waffle } = require("hardhat");

async function sendEthers(from, to, amount) {
  const params = {
    to: to.address,
    value: amount.toHexString(),
    gasLimit: 30000,
  };
  /* const txHash = */
  await from.sendTransaction(params);
}

async function ethersBalance(addr) {
  return await waffle.provider.getBalance(addr);
}

function carefulExecute(func) {
  return new Promise((resolve, reject) => {
    func()
      .then((receipt) => {
        console.log(`transaction sent, waiting for confirmation`);

        receipt
          .wait()
          .then(() => {
            console.log("transaction confirmed");
            resolve();
          })
          .catch((error) => {
            reject(error);
          });
      })
      .catch((err) => reject(err));
  });
}

function getBNInterval(value, delta) {
  return {
    low: value.sub(delta),
    high: value.add(delta),
  };
}

module.exports = {
  sendEthers,
  ethersBalance,
  carefulExecute,
  getBNInterval,
};
