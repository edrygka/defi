// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "@openzeppelin/contracts/access/IAccessControl.sol";
import "./interfaces/IFactory.sol";

import "./BaseProxy.sol";

contract Factory is IFactory {
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    address public accessRegistry;
    address[] public contracts;

    modifier onlyRole(bytes32 role) {
        require(
            IAccessControl(accessRegistry).hasRole(role, msg.sender),
            "Factory: FORBIDDEN"
        );
        _;
    }

    constructor(address _accessRegistry) {
        accessRegistry = _accessRegistry;
    }

    /// @notice Deploy `proxy` for `_implementation` with `_initializeData`
    /// @param _implementation contract address
    /// @param _initializeData bytes for `initialize` call
    function deploy(address _implementation, bytes memory _initializeData)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        BaseProxy proxy = new BaseProxy(_implementation, _initializeData);
        contracts.push(address(proxy));

        emit Deployed(msg.sender, address(proxy), _implementation);
    }
}
