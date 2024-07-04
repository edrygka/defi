// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "@openzeppelin/contracts/access/IAccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";

import "../interfaces/staking/IStakingV1.sol";
import "./StakingPlanner.sol";

contract StakingV1 is
    IStakingV1,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC165Upgradeable,
    StakingPlanner
{
    uint public constant FACTOR = 1e18;
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant STAKING_ADMIN_ROLE =
        keccak256(abi.encodePacked("STAKING_ADMIN_ROLE"));

    using SafeERC20 for IERC20;
    using SafeCast for uint;

    IAccessControl public accessRegistry;
    address public stakeToken;
    address public rewardToken;
    uint32 public lastUpdateTime;
    uint public snapshotRewardPerToken;
    uint public paidAmount;
    uint public totalStakes;

    mapping(address => UserInfo) public users;

    PauseInfo public pauseInfo;

    modifier onlyRole(bytes32 role) {
        require(accessRegistry.hasRole(role, msg.sender), "Staking: FORBIDDEN");
        _;
    }

    modifier notPaused(bool paused) {
        require(!paused, "Staking: METHOD_PAUSED");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    /**
     * @dev Initializes interface to init staking storage
     * @param _initParams initializer params
     */
    function initialize(InitializeParams calldata _initParams)
        external
        initializer
        notZeroAddress(_initParams.accessRegistry)
        notZeroAddress(_initParams.stakeToken)
        notZeroAddress(_initParams.rewardToken)
    {
        require(
            IERC165Upgradeable(_initParams.accessRegistry).supportsInterface(
                type(IAccessControl).interfaceId
            ),
            "Staking: UNSUPPORTED_INTERFACE"
        );

        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __ERC165_init();

        accessRegistry = IAccessControl(_initParams.accessRegistry);

        stakeToken = _initParams.stakeToken;
        rewardToken = _initParams.rewardToken;
    }

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
            _interfaceId == type(IStakingV1).interfaceId ||
            super.supportsInterface(_interfaceId);
    }

    /**
     * @dev Calculates pending user reward
     * @param _account address of user to get reward
     * @return reward amount
     */
    function pendingReward(address _account) external view returns (uint) {
        UserInfo memory _user = users[_account];
        uint _poolRewardPerToken = snapshotRewardPerToken +
            _incRewardPerToken();
        return _userReward(_user, _poolRewardPerToken);
    }

    /**
     * @dev Stake
     * @param _amount amount of tokens to be staked
     */
    function stake(uint _amount)
        external
        notPaused(pauseInfo.pausedStake)
        nonReentrant
    {
        _stake(_amount);
    }

    /**
     * @dev Stake with permit
     * @param _details permit details
     */
    function stakeWithPermit(PermitDetails calldata _details)
        external
        notPaused(pauseInfo.pausedStake)
        nonReentrant
    {
        IERC20Permit(stakeToken).permit(
            msg.sender,
            address(this),
            _details.amount,
            _details.deadline,
            _details.v,
            _details.r,
            _details.s
        );
        _stake(_details.amount);
    }

    /**
     * @dev Get user's staked tokens
     * @param _amount amount to unstake
     */
    function unstake(uint _amount)
        external
        notPaused(pauseInfo.pausedUnstake)
        nonReentrant
    {
        require(
            users[msg.sender].stake >= _amount && _amount != 0,
            "Staking: INVALID_AMOUNT"
        );

        UserInfo storage user = _updateState(msg.sender);
        _claim(user);

        totalStakes -= _amount;
        user.stake -= _amount;

        IERC20(stakeToken).safeTransfer(msg.sender, _amount);
        emit Unstake(msg.sender, _amount);
    }

    /**
     * @dev Withdraw reward from stake
     */
    function claim() external notPaused(pauseInfo.pausedClaim) nonReentrant {
        UserInfo storage _user = _updateState(msg.sender);

        require(_user.reward > 0, "Staking: NOTHING_TO_CLAIM");
        _claim(_user);
    }

    /**
     * @dev Set functions to be paused/unpaused
     * @param _pauseInfo which functions to block
     */
    function setPausedFunctions(PauseInfo calldata _pauseInfo)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        pauseInfo = _pauseInfo;
        emit SetPausedFunctions(
            _pauseInfo.pausedStake,
            _pauseInfo.pausedUnstake,
            _pauseInfo.pausedClaim
        );
    }

    /**
     * @dev appends intervals of reward
     * @param _data array of intervals
     */
    function appendIntervals(Interval[] memory _data)
        external
        onlyRole(STAKING_ADMIN_ROLE)
    {
        _appendIntervals(_data);

        uint _requiredAmount = totalRewardAmount - paidAmount;
        if (rewardToken == stakeToken) {
            _requiredAmount += totalStakes;
        }

        uint _balance = IERC20(rewardToken).balanceOf(address(this));

        if (_requiredAmount > _balance) {
            IERC20(rewardToken).safeTransferFrom(
                msg.sender,
                address(this),
                _requiredAmount - _balance
            );
        }
    }

    /**
     * @dev remove all intervals starting with provided index
     * and send all exceeding tokens to sender (admin) account
     * @param _index first interval to be removed
     */
    function removeIntervals(uint _index)
        external
        onlyRole(STAKING_ADMIN_ROLE)
    {
        _removeIntervals(_index);
        _refundUnusedTokens();
    }

    /// @dev withdraws unused tokens
    function _refundUnusedTokens() internal {
        IERC20 _token = IERC20(rewardToken);

        uint _balance = _token.balanceOf(address(this));
        uint _requiredAmount = totalRewardAmount - paidAmount;
        if (rewardToken == stakeToken) {
            _requiredAmount += totalStakes;
        }

        if (_balance > _requiredAmount) {
            uint _amount = _balance - _requiredAmount;
            _token.safeTransfer(msg.sender, _amount);
            emit RefundUnused(rewardToken, msg.sender, _amount);
        }
    }

    function _authorizeUpgrade(address)
        internal
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {}

    function _incRewardPerToken() private view returns (uint) {
        if (totalStakes > 0) {
            uint _reward = _deltaReward(
                lastUpdateTime,
                block.timestamp.toUint32()
            );
            return (_reward * FACTOR) / totalStakes;
        }

        return 0;
    }

    function _claim(UserInfo storage user) private {
        uint reward = user.reward;
        if (reward > 0) {
            user.reward = 0;
            paidAmount += reward;

            IERC20(rewardToken).safeTransfer(msg.sender, reward);

            emit Claim(msg.sender, reward);
        }
    }

    function _updateState(address _user)
        internal
        returns (UserInfo storage user)
    {
        snapshotRewardPerToken += _incRewardPerToken();
        lastUpdateTime = block.timestamp.toUint32();

        user = users[_user];
        user.reward = _userReward(user, snapshotRewardPerToken);
        user.snapshotRewardPerToken = snapshotRewardPerToken;
    }

    function _stake(uint _amount) private {
        require(_amount != 0, "Staking: ZERO_AMOUNT");

        UserInfo storage user = _updateState(msg.sender);

        user.stake += _amount;
        totalStakes += _amount;

        IERC20(stakeToken).safeTransferFrom(msg.sender, address(this), _amount);

        emit Stake(msg.sender, _amount);
    }

    function _userReward(UserInfo memory _user, uint _poolRewardPerToken)
        private
        pure
        returns (uint)
    {
        return
            ((_poolRewardPerToken - _user.snapshotRewardPerToken) *
                _user.stake) /
            FACTOR +
            _user.reward;
    }
}
