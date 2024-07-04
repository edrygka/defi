// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

interface IStakingPlanner {
    event IntervalAdded(uint amount, uint32 start, uint32 end);
    event IntervalsRemoved(uint count);

    struct Interval {
        uint amount;
        uint32 start;
        uint32 end;
    }

    struct IntervalInfo {
        uint prevSum;
        uint amount;
        uint32 start;
        uint32 end;
    }

    function totalRewardAmount() external view returns (uint); // auto-generated

    function intervals(uint _index)
        external
        view
        returns (
            uint prevSum,
            uint amount,
            uint32 start,
            uint32 end
        );

    function intervalsCount() external view returns (uint);

    // administrative functions

    function appendIntervals(Interval[] memory _data) external;

    function removeIntervals(uint _index) external;
}
