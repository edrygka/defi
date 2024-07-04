// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";

contract TestPermit {
    using SafeERC20 for IERC20;

    struct TransferWithPermitParams {
        uint amount; // 256
        uint deadline; // 256
        bool approveMax; // 8
        uint8 v; // 8 + 8
        bytes32 r; // 256
        bytes32 s; // 256
    }

    address public token;

    constructor(address _token) {
        token = _token;
    }

    function transferWithPermit(TransferWithPermitParams calldata _params)
        external
    {
        IERC20Permit(token).permit(
            msg.sender,
            address(this),
            _params.approveMax ? type(uint).max : _params.amount,
            _params.deadline,
            _params.v,
            _params.r,
            _params.s
        );
        IERC20(token).safeTransferFrom(
            msg.sender,
            address(this),
            _params.amount
        );
    }
}
