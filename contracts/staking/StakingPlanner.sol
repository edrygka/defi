// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "@openzeppelin/contracts/utils/math/SafeCast.sol";

import "../interfaces/staking/IStakingPlanner.sol";
import "../utils/CommonChecks.sol";

/// @dev manages reward amount based on piecewise-linear function
abstract contract StakingPlanner is IStakingPlanner, CommonChecks {
    using SafeCast for uint;

    uint public totalRewardAmount;
    IntervalInfo[] public intervals;

    /// @dev returns the number of intervals
    function intervalsCount() external view returns (uint) {
        return intervals.length;
    }

    /// @dev calculates reward amount between 2 dates
    /// @param _from the least date
    /// @param _to the greater date
    /// @return delta reward amount
    /// required that _from <= _to, otherwise 0 is returned
    function _deltaReward(uint32 _from, uint32 _to)
        internal
        view
        returns (uint)
    {
        return (_from < _to) ? _valueAt(_to) - _valueAt(_from) : 0;
    }

    /// @dev add multiple intervals to the tail of intervals array
    /// @param _intervals array of intervals
    function _appendIntervals(Interval[] memory _intervals) internal virtual {
        require(_intervals.length > 0, "StakingPlanner: NO_DATA");

        uint _totalRewardAmount = totalRewardAmount;
        uint32 _prevEnd = block.timestamp.toUint32();
        if (intervals.length > 0) {
            uint32 _lastEnd = intervals[intervals.length - 1].end;
            if (_lastEnd > _prevEnd) {
                _prevEnd = _lastEnd;
            }
        }

        for (uint i = 0; i < _intervals.length; i++) {
            Interval memory _interval = _intervals[i];
            require(
                _interval.start < _interval.end,
                "StakingPlanner: INVALID_ARG"
            );
            require(_interval.amount > 0, "StakingPlanner: ZERO_AMOUNT");
            require(
                _prevEnd < _interval.start,
                "StakingPlanner: INVALID_START"
            );

            intervals.push(
                IntervalInfo({
                    prevSum: _totalRewardAmount,
                    amount: _interval.amount,
                    start: _interval.start,
                    end: _interval.end
                })
            );
            _totalRewardAmount += _interval.amount;
            _prevEnd = _interval.end;

            emit IntervalAdded(
                _interval.amount,
                _interval.start,
                _interval.end
            );
        }

        totalRewardAmount = _totalRewardAmount;
    }

    /// @dev removes the last interval if it is not started yet
    /// @param _index first interval of the tail to be removed
    /// and transfer unused funds to the admin
    function _removeIntervals(uint _index) internal {
        uint _length = intervals.length;
        require(_index < _length, "StakingPlanner: OUT_OF_BOUND");
        require(
            block.timestamp < intervals[_index].start,
            "StakingPlanner: ALREADY_STARTED"
        );

        uint _count = _length - _index;
        uint _newRewardAmount = intervals[_index].prevSum;

        for (uint i = 0; i < _count; i++) {
            intervals.pop();
        }

        totalRewardAmount = _newRewardAmount;
        emit IntervalsRemoved(_count);
    }

    /// @dev looks for closest interval for the _x value
    function _findInterval(uint32 _x)
        internal
        view
        returns (IntervalInfo memory _info)
    {
        uint length = intervals.length;
        if (length == 0) {
            return IntervalInfo({prevSum: 0, amount: 0, start: 0, end: 0});
        }

        uint low;
        uint mid;
        uint high = length - 1;
        while (low < high) {
            mid = (high + low) / 2;
            if (intervals[mid].end < _x) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }

        return intervals[high];
    }

    /// @dev calculates function value at specified time point
    function _valueAt(uint32 _x) internal view returns (uint) {
        if (intervals.length == 0) return 0;

        IntervalInfo memory _interval = _findInterval(_x);
        if (_x <= _interval.start) {
            return _interval.prevSum;
        }
        if (_x >= _interval.end) {
            return _interval.prevSum + _interval.amount;
        }

        return
            _interval.prevSum +
            ((_x - _interval.start) * _interval.amount) /
            (_interval.end - _interval.start);
    }
}
