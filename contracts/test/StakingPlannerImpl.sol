// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "../staking/StakingPlanner.sol";

contract StakingPlannerImpl is StakingPlanner {
    function rewardAt(uint32 _ts) external view returns (uint) {
        return _valueAt(_ts);
    }

    function deltaReward(uint32 _from, uint32 _to)
        external
        view
        returns (uint)
    {
        return _deltaReward(_from, _to);
    }

    function findInterval(uint32 _x)
        external
        view
        returns (
            uint prevSum,
            uint amount,
            uint32 start,
            uint32 end
        )
    {
        IntervalInfo memory i = _findInterval(_x);
        return (i.prevSum, i.amount, i.start, i.end);
    }

    function appendIntervals(Interval[] memory _data) external {
        _appendIntervals(_data);
    }

    function removeIntervals(uint _index) external {
        _removeIntervals(_index);
    }
}
