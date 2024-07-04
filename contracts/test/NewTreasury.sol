// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "../treasury/TreasuryV1.sol";

contract NewTreasury is TreasuryV1 {
    string public constant VALUE = "NEW TREASURY 12345";

    function newMethod() public pure returns (string memory) {
        return VALUE;
    }
}
