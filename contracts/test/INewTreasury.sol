// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "../interfaces/treasury/ITreasuryV1.sol";

interface INewTreasury is ITreasuryV1 {
    function newMethod(address) external returns (string memory);
}
