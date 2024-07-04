// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";

interface IPermit {
    // Permit details structure
    struct PermitDetails {
        uint deadline;
        uint amount;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }
}
