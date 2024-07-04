# Solidity API

## RandomGenerator

### DEFAULT_ADMIN_ROLE

```solidity
bytes32 DEFAULT_ADMIN_ROLE
```

### ADD_SEED_ROLE

```solidity
bytes32 ADD_SEED_ROLE
```

### accessRegistry

```solidity
contract IAccessControl accessRegistry
```

### vrfCoordinator

```solidity
contract VRFCoordinatorV2Interface vrfCoordinator
```

### subscriptionId

```solidity
uint64 subscriptionId
```

### keyHash

```solidity
bytes32 keyHash
```

### sales

```solidity
mapping(uint256 => address) sales
```

### requests

```solidity
mapping(address => struct IRandomGenerator.Request) requests
```

### constructor

```solidity
constructor(address _accessRegistry, address _vrfCoordinator, bytes32 _keyHash, uint32 _subscriptionId) public
```

### supportsInterface

```solidity
function supportsInterface(bytes4 _interfaceId) public view returns (bool)
```

_Check contract supports provided interface_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _interfaceId | bytes4 | id of the interface |

### onlyRole

```solidity
modifier onlyRole(bytes32 _role)
```

### getRandomWord

```solidity
function getRandomWord(address _sale, uint256 _index) external view returns (uint256)
```

_Returns random value for specific sale_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _sale | address | address of sale contract |
| _index | uint256 | number of random value in array |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | random value |

### getRandomLength

```solidity
function getRandomLength(address _sale) external view returns (uint256)
```

_Returns length of random array for specific sale_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _sale | address | address of sale contract |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | random array length |

### setKeyHash

```solidity
function setKeyHash(bytes32 _newKeyHash) external
```

_Setter for keyHash variable_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newKeyHash | bytes32 | keyHsah for chainlink random requests |

### setSubscriptionId

```solidity
function setSubscriptionId(uint32 _newSubscriptionId) external
```

_Setter for subscriptionId variable_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newSubscriptionId | uint32 | id of subcription for chainlink random requests |

### requestRandom

```solidity
function requestRandom(uint16 _confirmations, uint32 _callbackGasLimit, uint32 _numWords) public returns (uint256 requestId)
```

_Request random number for sale. There should be enough LINK before request_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _confirmations | uint16 | how many blocks you'd like the oracle to wait before responding to the request |
| _callbackGasLimit | uint32 | gas limit of reverse(callback) function |
| _numWords | uint32 | the number of uint256 random values |

| Name | Type | Description |
| ---- | ---- | ----------- |
| requestId | uint256 | Request |

### fulfillRandomWords

```solidity
function fulfillRandomWords(uint256 _requestId, uint256[] _randomWords) internal
```

### _setKeyHash

```solidity
function _setKeyHash(bytes32 _newKeyHash) internal
```

### _setSubscriptionId

```solidity
function _setSubscriptionId(uint32 _newSubscriptionId) internal
```

