// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "../utils/IPermit.sol";

interface IStakingV1 is IPermit {
    event Stake(address indexed account, uint amount);
    event Unstake(address indexed account, uint amount);
    event Claim(address indexed account, uint reward);
    event SetPausedFunctions(
        bool pausedStake,
        bool pausedUnstake,
        bool pausedClaim
    );
    event RefundUnused(
        address indexed token,
        address indexed account,
        uint amount
    );

    // Info of each user.
    struct UserInfo {
        uint stake;
        uint reward;
        uint snapshotRewardPerToken;
    }

    // Info of functions to be paused
    struct PauseInfo {
        bool pausedStake;
        bool pausedUnstake;
        bool pausedClaim;
    }

    // Params for initialize function
    struct InitializeParams {
        address accessRegistry;
        address stakeToken;
        address rewardToken;
    }

    // user functions

    function stake(uint _amount) external;

    function stakeWithPermit(PermitDetails calldata _details) external;

    function claim() external;

    function unstake(uint _amount) external;

    function pendingReward(address _account) external view returns (uint);

    function totalStakes() external view returns (uint);

    // administrative functions

    function setPausedFunctions(PauseInfo calldata _pauseInfo) external;
}
