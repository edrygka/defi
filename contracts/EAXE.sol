// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.8;

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract EAXE is Context, ERC20Permit {
    uint public constant MAX_SUPPLY = 1_000_000 * 10**18;

    constructor(address _owner)
        ERC20("Ego Scholarship", "EAXE")
        ERC20Permit("Ego Scholarship")
    {
        _mint(_owner, MAX_SUPPLY);
    }
}
