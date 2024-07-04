// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

interface IFactory {
    event Deployed(address deployer, address proxy, address implementation);

    function deploy(address _implementation, bytes memory initializeData_)
        external;
}
