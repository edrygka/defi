// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract AccessRegistry is AccessControl {
    constructor(address _admin) {
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender); // need to call renounce later
    }
}
