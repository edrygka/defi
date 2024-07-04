# Solidity API

## LinearVesting

### DEFAULT_ADMIN_ROLE

```solidity
bytes32 DEFAULT_ADMIN_ROLE
```

### accessRegistry

```solidity
contract IAccessControl accessRegistry
```

### rewardToken

```solidity
contract IERC20 rewardToken
```

### vestingRole

```solidity
bytes32 vestingRole
```

### vestingInfo

```solidity
mapping(address => struct ILinearVesting.VestingInfo) vestingInfo
```

USER FUNCTIONS

### totalVested

```solidity
uint256 totalVested
```

### totalClaimed

```solidity
uint256 totalClaimed
```

### onlyRole

```solidity
modifier onlyRole(bytes32 roleName)
```

### constructor

```solidity
constructor(address _rewardToken, address _accessRegistry, string _roleName) public
```

| Name | Type | Description |
| ---- | ---- | ----------- |
| _rewardToken | address | reward token address |
| _accessRegistry | address | access registry address |
| _roleName | string |  |

### available

```solidity
function available(address _account) public view returns (uint256)
```

_returns amount of tokens available to claim_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _account | address | address of account |

### claim

```solidity
function claim(address _account) external
```

_claims and withdraws all the tokens unlocked up to now_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _account | address | address of account |

### bulkGrantTokens

```solidity
function bulkGrantTokens(struct ILinearVesting.GrantInfo[] _grants) external
```

_adds multiple vesting records which have the same parameters_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _grants | struct ILinearVesting.GrantInfo[] | list of GrantInfo items |

### recoverERC20

```solidity
function recoverERC20(contract IERC20 _token, address _to, uint256 _amount) external
```

_allows admin recover tokens sent to this contract occasionally_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _token | contract IERC20 | address of token |
| _to | address | recipient address |
| _amount | uint256 | amount of tokens to send |

### _vestingReward

```solidity
function _vestingReward(uint256 _total, uint32 _start, uint32 _duration, uint32 _ts, uint256 _claimed) internal pure returns (uint256)
```

INTERNAL FUNCTIONS

### supportsInterface

```solidity
function supportsInterface(bytes4 _interfaceId) public view returns (bool)
```

_check whether interface is supported_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _interfaceId | bytes4 | interface id |

