// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/IERC165Upgradeable.sol";

import "../interfaces/treasury/ITreasuryV1.sol";
import "../interfaces/vesting/ILinearVesting.sol";

import "../interfaces/staking/IStakingPlanner.sol";
import "../interfaces/staking/IStakingV1.sol";

contract InterfaceGetter {
    mapping(string => bytes4) public interfaces;

    function register(string memory _name, bytes4 _id) public {
        interfaces[_name] = _id;
    }

    constructor() {
        register(type(ITreasuryV1).name, type(ITreasuryV1).interfaceId);

        register(type(IERC721Receiver).name, type(IERC721Receiver).interfaceId);
        register(
            type(IERC721ReceiverUpgradeable).name,
            type(IERC721ReceiverUpgradeable).interfaceId
        );
        register(
            type(IERC165Upgradeable).name,
            type(IERC165Upgradeable).interfaceId
        );
        register(type(IERC165).name, type(IERC165).interfaceId);
        register(
            type(IERC20Upgradeable).name,
            type(IERC20Upgradeable).interfaceId
        );
        register(type(IAccessControl).name, type(IAccessControl).interfaceId);
        register(type(ILinearVesting).name, type(ILinearVesting).interfaceId);
        register(type(IStakingPlanner).name, type(IStakingPlanner).interfaceId);
        register(type(IStakingV1).name, type(IStakingV1).interfaceId);
        register(
            type(IERC1155ReceiverUpgradeable).name,
            type(IERC1155ReceiverUpgradeable).interfaceId
        );
    }

    function getInterfaceId(string memory _name)
        external
        view
        returns (bytes4)
    {
        bytes4 id = interfaces[_name];
        require(id != bytes4(0), "InterfaceGetter: INTERFACE_NOT_REGISTERED");
        return id;
    }
}
