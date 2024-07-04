# Solidity API

## IntervalLinearFunction

### SegmentInfo

```solidity
struct SegmentInfo {
  uint128 amount;
  uint32 x0;
  uint32 x1;
}

```

### \_segments

```solidity
struct IntervalLinearFunction.SegmentInfo[] _segments
```

### \_valueAt

```solidity
function _valueAt(uint32 _x) internal view returns (uint128)
```

segments information array

### \_removeLastSegment

```solidity
function _removeLastSegment() internal
```

### \_addSegment

```solidity
function _addSegment(uint128 _amount, uint32 _x0, uint32 _x1) internal
```

### \_segmentsCount

```solidity
function _segmentsCount() internal view returns (uint256)
```

### \_segmentAt

```solidity
function _segmentAt(uint256 _index) internal view returns (uint128 amount, uint32 x0, uint32 x1)
```

### \_lastSegment

```solidity
function _lastSegment() internal view returns (uint128 amount, uint32 x0, uint32 x1)
```

### \_calculate

```solidity
function _calculate(uint128 _amount, uint32 _x0, uint32 _x1, uint32 _x) internal pure returns (uint128)
```
