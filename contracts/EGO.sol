// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.8;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract EGO is Context, ERC20Capped, ERC20Burnable, ERC20Votes {
    uint public constant MAX_SUPPLY = 1_000_000_000 * 10**18;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    IAccessControl public accessRegistry;

    constructor(
        uint _initialSupply,
        address _admin,
        address _accessRegistry
    ) ERC20("EGO", "EGO") ERC20Capped(MAX_SUPPLY) ERC20Permit("EGO") {
        super._mint(_admin, _initialSupply);
        accessRegistry = IAccessControl(_accessRegistry);
    }

    /**
     * @dev mint tokens to specific address
     * @param _account destination address
     * @param _amount tokens to be minted
     */
    function mint(address _account, uint _amount) external {
        _mint(_account, _amount);
    }

    modifier onlyRole(bytes32 _role) {
        require(accessRegistry.hasRole(_role, _msgSender()), "EGO: FORBIDDEN");
        _;
    }

    function _mint(address _account, uint _amount)
        internal
        virtual
        override(ERC20, ERC20Capped, ERC20Votes)
        onlyRole(MINTER_ROLE)
    {
        super._mint(_account, _amount);
    }

    function _burn(address _account, uint _amount)
        internal
        virtual
        override(ERC20, ERC20Votes)
    {
        super._burn(_account, _amount);
    }

    function _afterTokenTransfer(
        address _from,
        address _to,
        uint _amount
    ) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(_from, _to, _amount);
    }
}
