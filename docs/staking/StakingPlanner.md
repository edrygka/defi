# Solidity API

## StakingPlanner

_manages reward amount based on piecewise-linear function_

### totalRewardAmount

```solidity
uint256 totalRewardAmount
```

### intervals

```solidity
struct IStakingPlanner.IntervalInfo[] intervals
```

### intervalsCount

```solidity
function intervalsCount() external view returns (uint256)
```

_returns the number of intervals_

### _deltaReward

```solidity
function _deltaReward(uint32 _from, uint32 _to) internal view returns (uint256)
```

_calculates reward amount between 2 dates_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _from | uint32 | the least date |
| _to | uint32 | the greater date |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | delta reward amount required that _from <= _to, otherwise 0 is returned |

### _appendIntervals

```solidity
function _appendIntervals(struct IStakingPlanner.Interval[] _intervals) internal virtual
```

_add multiple intervals to the tail of intervals array_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _intervals | struct IStakingPlanner.Interval[] | array of intervals |

### _removeIntervals

```solidity
function _removeIntervals(uint256 _index) internal
```

_removes the last interval if it is not started yet_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _index | uint256 | first interval of the tail to be removed and transfer unused funds to the admin |

### _findInterval

```solidity
function _findInterval(uint32 _x) internal view returns (struct IStakingPlanner.IntervalInfo _info)
```

_looks for closest interval for the _x value_

### _valueAt

```solidity
function _valueAt(uint32 _x) internal view returns (uint256)
```

_calculates function value at specified time point_

