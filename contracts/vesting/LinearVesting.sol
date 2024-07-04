// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "@openzeppelin/contracts/access/IAccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import "../interfaces/vesting/ILinearVesting.sol";

import "../utils/CommonChecks.sol";

contract LinearVesting is
    ILinearVesting,
    ERC165,
    CommonChecks,
    ReentrancyGuard
{
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    using SafeERC20 for IERC20;
    using SafeCast for uint;

    IAccessControl public accessRegistry;
    IERC20 public rewardToken;
    bytes32 public vestingRole;

    mapping(address => VestingInfo) public vestingInfo;

    uint public totalVested; // total amount of tokens to be vested
    uint public totalClaimed; // total amout of tokens already claimed by users

    modifier onlyRole(bytes32 roleName) {
        require(
            accessRegistry.hasRole(roleName, msg.sender),
            "Vesting: FORBIDDEN"
        );
        _;
    }

    /**
     * @param _rewardToken reward token address
     * @param _accessRegistry access registry address
     */
    constructor(
        address _rewardToken,
        address _accessRegistry,
        string memory _roleName
    )
        notZeroAddress(_rewardToken)
        notZeroAddress(_accessRegistry)
        notEmptyString(_roleName)
    {
        require(
            IERC165(_accessRegistry).supportsInterface(
                type(IAccessControl).interfaceId
            ),
            "Vesting: UNSUPPORTED_ADDRESS"
        );

        accessRegistry = IAccessControl(_accessRegistry);
        rewardToken = IERC20(_rewardToken);
        vestingRole = keccak256(abi.encodePacked(_roleName));
    }

    /**
     * @dev returns amount of tokens available to claim
     * @param _account address of account
     */
    function available(address _account) public view returns (uint) {
        VestingInfo memory info = vestingInfo[_account];
        return
            _vestingReward(
                info.total,
                info.start,
                info.duration,
                block.timestamp.toUint32(),
                info.claimed
            );
    }

    /**
     * @dev claims and withdraws all the tokens unlocked up to now
     * @param _account address of account
     */
    function claim(address _account) external {
        VestingInfo storage info = vestingInfo[_account];

        uint _amount = _vestingReward(
            info.total,
            info.start,
            info.duration,
            block.timestamp.toUint32(),
            info.claimed
        );

        require(_amount > 0, "Vesting: CLAIM_ZERO");

        info.claimed += _amount;
        totalClaimed += _amount;

        rewardToken.safeTransfer(_account, _amount);

        emit TokensClaimed(_account, _amount);
    }

    /**
     * @dev adds multiple vesting records which have the same parameters
     * @param _grants list of GrantInfo items
     */
    function bulkGrantTokens(GrantInfo[] memory _grants)
        external
        onlyRole(vestingRole)
    {
        uint _totalAmount;

        for (uint8 i = 0; i < _grants.length; ++i) {
            uint amount = _grants[i].amount;
            require(
                amount > 0 &&
                    _grants[i].start > block.timestamp &&
                    _grants[i].duration > 0,
                "Vesting: INVALID_DATA"
            );
            _totalAmount += amount;
        }

        require(
            rewardToken.balanceOf(msg.sender) >= _totalAmount,
            "Vesting: NOT_ENOUGH_BALANCE"
        );

        for (uint8 i = 0; i < _grants.length; ++i) {
            GrantInfo memory grant = _grants[i];
            require(
                vestingInfo[grant.account].total == 0,
                "Vesting: RECORD_EXISTS"
            );

            vestingInfo[grant.account] = VestingInfo({
                total: grant.amount,
                claimed: 0,
                start: grant.start,
                duration: grant.duration
            });

            emit TokensGranted(
                grant.account,
                grant.amount,
                grant.start,
                grant.duration
            );
        }
        totalVested += _totalAmount;

        rewardToken.safeTransferFrom(msg.sender, address(this), _totalAmount);
    }

    /**
     * @dev allows admin recover tokens sent to this contract occasionally
     * @param _token address of token
     * @param _to recipient address
     * @param _amount amount of tokens to send
     */
    function recoverERC20(
        IERC20 _token,
        address _to,
        uint _amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_token == rewardToken) {
            require(
                _token.balanceOf(address(this)) - totalVested + totalClaimed >=
                    _amount,
                "Vesting: NOT_ENOUGH"
            );
        }
        _token.safeTransfer(_to, _amount);
    }

    /**
     * INTERNAL FUNCTIONS
     */
    function _vestingReward(
        uint _total,
        uint32 _start,
        uint32 _duration,
        uint32 _ts,
        uint _claimed
    ) internal pure returns (uint) {
        if (_ts <= _start) return 0;
        if (_start + _duration <= _ts) return _total - _claimed;

        return (_total * (_ts - _start)) / _duration - _claimed;
    }

    /**
     * IERC165 support
     */

    /**
     * @dev check whether interface is supported
     * @param _interfaceId interface id
     */
    function supportsInterface(bytes4 _interfaceId)
        public
        view
        override
        returns (bool)
    {
        return
            _interfaceId == type(ILinearVesting).interfaceId ||
            super.supportsInterface(_interfaceId);
    }
}
