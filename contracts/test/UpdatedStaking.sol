// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "../staking/StakingV1.sol";

contract UpdatedStaking is StakingV1 {
    function test() external pure returns (string memory result) {
        result = "success";
    }
}
