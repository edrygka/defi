// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "../utils/CommonChecks.sol";

import "../interfaces/treasury/ITreasuryV1.sol";

contract TreasuryV1 is
    ITreasuryV1,
    CommonChecks,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    ERC721HolderUpgradeable,
    ERC1155HolderUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x0;
    bytes32 public treasuryRole;

    IAccessControl public accessRegistry;

    modifier onlyRole(bytes32 _role) {
        require(
            accessRegistry.hasRole(_role, msg.sender),
            "Treasury: FORBIDDEN"
        );
        _;
    }

    constructor() initializer {}

    function initialize(address _accessRegistry, string calldata _roleName)
        external
        virtual
        initializer
        notZeroAddress(_accessRegistry)
        notEmptyString(_roleName)
    {
        require(
            IERC165(_accessRegistry).supportsInterface(
                type(IAccessControl).interfaceId
            ),
            "Treasury: UNSUPPORTED_ADDRESS"
        );

        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        __ERC165_init();
        __ERC721Holder_init();
        __ERC1155Holder_init();

        accessRegistry = IAccessControl(_accessRegistry);
        treasuryRole = keccak256(abi.encodePacked(_roleName));
    }

    /**
     * ETHERS TRANSFERS *
     */

    /**
     * @dev receive ethers
     */
    receive() external payable {
        emit EthersReceived(msg.sender, msg.value);
    }

    /**
     * @dev transfer specified ethers amount from threasury to specified destination
     * @param _to destination address
     * @param _amount ethers amount value
     */
    function transferEthers(address _to, uint _amount)
        external
        onlyRole(treasuryRole)
        notZeroAddress(_to)
    {
        (bool success, ) = _to.call{value: _amount}("");
        require(success, "Treasury: TRANSFER_ETHERS_FAILED");

        emit EthersTransfered(_to, _amount);
    }

    /**
     * TRANSFER FUNGIBLES AND NFTs *
     */

    /**
     * @dev transfer specified ERC20 tokens amount from threasury to specified destination
     * @param _token token address to transfer
     * @param _to destination address
     * @param _amount tokens amount value
     */
    function transferErc20(
        address _token,
        address _to,
        uint _amount
    ) external nonReentrant onlyRole(treasuryRole) {
        IERC20(_token).safeTransfer(_to, _amount);
        emit ERC20Transfered(_to, _token, _amount);
    }

    /**
     * @dev transfer specified ERC721 from threasury to specified destination
     * @param _token ERC721 token contract address
     * @param _to destination address
     * @param _tokenId token id
     */
    function transferErc721(
        address _token,
        address _to,
        uint _tokenId
    ) external nonReentrant onlyRole(treasuryRole) {
        IERC721(_token).safeTransferFrom(address(this), _to, _tokenId);
        emit ERC721Transfered(_to, _token, _tokenId);
    }

    /**
     * @dev transfer specified ERC1155 from treasury to specified receiver
     * @param _token ERC1155 token contract address
     * @param _to receiver address
     * @param _id subtoken id
     * @param _amount subtokens amount
     * @param _data data bytes
     */
    function transferErc1155(
        address _token,
        address _to,
        uint _id,
        uint _amount,
        bytes memory _data
    ) external nonReentrant onlyRole(treasuryRole) {
        IERC1155(_token).safeTransferFrom(
            address(this),
            _to,
            _id,
            _amount,
            _data
        );
        emit ERC1155Transfered(_to, _token, _id, _amount, _data);
    }

    /**
     * @dev transfer specified ERC1155 from treasury to specified receiver
     * @param _token ERC1155 token contract address
     * @param _to receiver address
     * @param _ids subtoken ids array
     * @param _amounts subtokens amounts array
     * @param _data data bytes
     */
    function transferBatchErc1155(
        address _token,
        address _to,
        uint[] memory _ids,
        uint[] memory _amounts,
        bytes memory _data
    ) external nonReentrant onlyRole(treasuryRole) {
        IERC1155(_token).safeBatchTransferFrom(
            address(this),
            _to,
            _ids,
            _amounts,
            _data
        );
        emit ERC1155BatchTransfered(_to, _token, _ids, _amounts, _data);
    }

    /**
     * SUPPORT IERC165
     */

    /**
     * @dev Check contract supports provided interface
     * @param _interfaceId id of the interface
     */
    function supportsInterface(bytes4 _interfaceId)
        public
        view
        virtual
        override
        returns (bool)
    {
        return
            _interfaceId == type(ITreasuryV1).interfaceId ||
            super.supportsInterface(_interfaceId);
    }

    /**
     * SUPPORT UPGRADEABILITY
     */

    /**
     * @dev called by proxy to authorize upgrader
     */
    function _authorizeUpgrade(address)
        internal
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {}
}
