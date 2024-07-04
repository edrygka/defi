"use strict";

const { keccak256 } = require("@ethersproject/keccak256");
const { toUtf8Bytes } = require("@ethersproject/strings");
const { defaultAbiCoder } = require("@ethersproject/abi");
const { pack: solidityPack } = require("@ethersproject/solidity");

const PERMIT_TYPEHASH = keccak256(
  toUtf8Bytes("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)")
);

function getDomainSeparator(name, tokenAddress, chainId) {
  return keccak256(
    defaultAbiCoder.encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        keccak256(toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
        keccak256(toUtf8Bytes(name)),
        keccak256(toUtf8Bytes("1")),
        chainId,
        tokenAddress,
      ]
    )
  );
}

async function getApprovalDigest(token, approve, nonce, deadline, chainId) {
  const name = await token.name();
  const DOMAIN_SEPARATOR = getDomainSeparator(name, token.address, chainId);
  return keccak256(
    solidityPack(
      ["bytes1", "bytes1", "bytes32", "bytes32"],
      [
        "0x19",
        "0x01",
        DOMAIN_SEPARATOR,
        keccak256(
          defaultAbiCoder.encode(
            ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
            [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce, deadline]
          )
        ),
      ]
    )
  );
}

async function currentBlockTimestamp(provider) {
  const latestBlockNumber = await provider.getBlockNumber();
  const block = await provider.getBlock(latestBlockNumber);
  return block.timestamp;
}

async function fastForwardTo(provider, timestamp) {
  await provider.send("evm_mine", [timestamp]);
}

async function receiptTimestamp(provider, receipt) {
  const block = await provider.getBlock(receipt.blockNumber);
  return block.timestamp;
}

async function handleTx(txPromise, provider) {
  const tx = await txPromise;
  const receipt = await tx.wait();
  const txTimestamp = await receiptTimestamp(provider, receipt);
  return [txTimestamp, receipt.events];
}

function filterMutativeFunctions(functions) {
  const mutable = functions
    .filter(
      ({ type, stateMutability }) => type === "function" && stateMutability !== "view" && stateMutability !== "pure"
    )
    .map(({ name }) => name);

  const fallbackFnc = functions.filter(({ type }) => type === "fallback");

  return { fallbackFnc, mutable };
}

module.exports = {
  PERMIT_TYPEHASH,
  getDomainSeparator,
  getApprovalDigest,
  currentBlockTimestamp,
  fastForwardTo,
  receiptTimestamp,
  handleTx,
  filterMutativeFunctions,
};
