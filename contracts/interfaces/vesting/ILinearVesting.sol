// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

interface ILinearVesting {
    event TokensGranted(
        address indexed account,
        uint amount,
        uint32 start,
        uint32 duration
    );

    event TokensClaimed(address indexed account, uint amount);

    struct VestingInfo {
        uint total; // total amount of tokens granted
        uint claimed; // amount of tokens user already claimed
        uint32 start; // unlock start in seconds
        uint32 duration; // unlock duration in seconds
    }

    struct GrantInfo {
        address account; // grant beneficiary account
        uint amount; // amount of tokens granted
        uint32 start; // unlock start date in seconds
        uint32 duration; // unlock duration in seconds
    }

    /**
     * USER FUNCTIONS
     */

    function vestingInfo(address _account)
        external
        view
        returns (
            uint total,
            uint claimed,
            uint32 start,
            uint32 duration
        );

    function available(address _account) external view returns (uint);

    function claim(address _account) external;

    /**
     * ADMIN FUNCTIONS
     */
    function bulkGrantTokens(GrantInfo[] memory _grants) external;
}
