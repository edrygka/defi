# Solidity API

## AutonomousProposer

### token

```solidity
contract IERC20 token
```

`EGO` token contract address

### governor

```solidity
contract IEgoGovernorV1 governor
```

`EgoGovernor` contract address

### stakeAmount

```solidity
uint256 stakeAmount
```

Minimum Ego tokens required to create a autonomous proposal

### users

```solidity
mapping(uint256 => address) users
```

The proposal authors

### constructor

```solidity
constructor(address _token, address _governor, uint256 _stakeAmount) public
```

Construct a factory for autonomous proposals

| Name | Type | Description |
| ---- | ---- | ----------- |
| _token | address | `EGO` token contract address |
| _governor | address | `EgoGovernor` contract address |
| _stakeAmount | uint256 | The minimum amount of EGO tokes required for creation of a autonomous proposal |

### create

```solidity
function create(address[] _targets, uint256[] _values, string[] _signatures, bytes[] _calldatas, string _description) external
```

Create a new autonomous proposal
Call `EGO.approve(AutonomousProposer.address, stakeAmount)` before calling this method

| Name | Type | Description |
| ---- | ---- | ----------- |
| _targets | address[] | The ordered list of target addresses for calls to be made |
| _values | uint256[] | The ordered list of values (i.e. msg.value) to be passed to the calls to be made |
| _signatures | string[] | function signatures for proposal calls |
| _calldatas | bytes[] | The ordered list of calldata to be passed to each call |
| _description | string | The block at which voting begins: holders must delegate their votes prior to this block |

### cancel

```solidity
function cancel(uint256 _proposalId) external
```

Cancel the autonomous proposal, send back staked EGO tokens

| Name | Type | Description |
| ---- | ---- | ----------- |
| _proposalId | uint256 | ID of proposal to be cancelled |

### withdraw

```solidity
function withdraw(uint256 _proposalId) external
```

Withdraw staked EGO's back if proposal finished or was rejected by admin

| Name | Type | Description |
| ---- | ---- | ----------- |
| _proposalId | uint256 | ID of proposal |

### supportsInterface

```solidity
function supportsInterface(bytes4 _interfaceId) public view returns (bool)
```

_Check contract supports provided interface_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _interfaceId | bytes4 | id of the interface |

