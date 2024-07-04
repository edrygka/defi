// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

abstract contract CommonChecks {
    modifier notZeroAddress(address _addr) {
        require(_addr != address(0), "CommonChecks: ZERO_ADDRESS");
        _;
    }

    modifier notEmptyString(string memory _str) {
        require(bytes(_str).length > 0, "CommonChecks: STRING_IS_EMPTY");
        _;
    }
}
