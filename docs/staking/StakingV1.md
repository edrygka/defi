# Solidity API

## StakingV1

### FACTOR

```solidity
uint256 FACTOR
```

### DEFAULT_ADMIN_ROLE

```solidity
bytes32 DEFAULT_ADMIN_ROLE
```

### STAKING_ADMIN_ROLE

```solidity
bytes32 STAKING_ADMIN_ROLE
```

### accessRegistry

```solidity
contract IAccessControl accessRegistry
```

### stakeToken

```solidity
address stakeToken
```

### rewardToken

```solidity
address rewardToken
```

### lastUpdateTime

```solidity
uint32 lastUpdateTime
```

### snapshotRewardPerToken

```solidity
uint256 snapshotRewardPerToken
```

### paidAmount

```solidity
uint256 paidAmount
```

### totalStakes

```solidity
uint256 totalStakes
```

### users

```solidity
mapping(address => struct IStakingV1.UserInfo) users
```

### pauseInfo

```solidity
struct IStakingV1.PauseInfo pauseInfo
```

### onlyRole

```solidity
modifier onlyRole(bytes32 role)
```

### notPaused

```solidity
modifier notPaused(bool paused)
```

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(struct IStakingV1.InitializeParams _initParams) external
```

_Initializes interface to init staking storage_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _initParams | struct IStakingV1.InitializeParams | initializer params |

### supportsInterface

```solidity
function supportsInterface(bytes4 _interfaceId) public view virtual returns (bool)
```

_Check contract supports provided interface_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _interfaceId | bytes4 | id of the interface |

### pendingReward

```solidity
function pendingReward(address _account) external view returns (uint256)
```

_Calculates pending user reward_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _account | address | address of user to get reward |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | reward amount |

### stake

```solidity
function stake(uint256 _amount) external
```

_Stake_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | amount of tokens to be staked |

### stakeWithPermit

```solidity
function stakeWithPermit(struct IStakingV1.PermitStakeDetails _details) external
```

_Stake with permit_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _details | struct IStakingV1.PermitStakeDetails | permit details |

### unstake

```solidity
function unstake(uint256 _amount) external
```

_Get user's staked tokens_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | amount to unstake |

### claim

```solidity
function claim() external
```

_Withdraw reward from stake_

### setPausedFunctions

```solidity
function setPausedFunctions(struct IStakingV1.PauseInfo _pauseInfo) external
```

_Set functions to be paused/unpaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _pauseInfo | struct IStakingV1.PauseInfo | which functions to block |

### appendIntervals

```solidity
function appendIntervals(struct IStakingPlanner.Interval[] _data) external
```

_appends intervals of reward_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _data | struct IStakingPlanner.Interval[] | array of intervals |

### removeIntervals

```solidity
function removeIntervals(uint256 _index) external
```

_remove all intervals starting with provided index
and send all exceeding tokens to sender (admin) account_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _index | uint256 | first interval to be removed |

### _refundUnusedTokens

```solidity
function _refundUnusedTokens() internal
```

_withdraws unused tokens_

### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address) internal
```

### _incRewardPerToken

```solidity
function _incRewardPerToken() private view returns (uint256)
```

### _claim

```solidity
function _claim(struct IStakingV1.UserInfo user) private
```

### _updateState

```solidity
function _updateState(address _user) internal returns (struct IStakingV1.UserInfo user)
```

### _stake

```solidity
function _stake(uint256 _amount) private
```

### _userReward

```solidity
function _userReward(struct IStakingV1.UserInfo _user, uint256 _poolRewardPerToken) private pure returns (uint256)
```

