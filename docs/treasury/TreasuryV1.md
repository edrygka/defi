# Solidity API

## TreasuryV1

### DEFAULT_ADMIN_ROLE

```solidity
bytes32 DEFAULT_ADMIN_ROLE
```

### treasuryRole

```solidity
bytes32 treasuryRole
```

### accessRegistry

```solidity
contract IAccessControl accessRegistry
```

### onlyRole

```solidity
modifier onlyRole(bytes32 _role)
```

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(address _accessRegistry, string _roleName) external virtual
```

### receive

```solidity
receive() external payable
```

_receive ethers_

### transferEthers

```solidity
function transferEthers(address _to, uint256 _amount) external
```

_transfer specified ethers amount from threasury to specified destination_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _to | address | destination address |
| _amount | uint256 | ethers amount value |

### transferErc20

```solidity
function transferErc20(address _token, address _to, uint256 _amount) external
```

_transfer specified ERC20 tokens amount from threasury to specified destination_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _token | address | token address to transfer |
| _to | address | destination address |
| _amount | uint256 | tokens amount value |

### transferErc721

```solidity
function transferErc721(address _token, address _to, uint256 _tokenId) external
```

_transfer specified ERC721 from threasury to specified destination_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _token | address | ERC721 token contract address |
| _to | address | destination address |
| _tokenId | uint256 | token id |

### transferErc1155

```solidity
function transferErc1155(address _token, address _to, uint256 _id, uint256 _amount, bytes _data) external
```

_transfer specified ERC1155 from treasury to specified receiver_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _token | address | ERC1155 token contract address |
| _to | address | receiver address |
| _id | uint256 | subtoken id |
| _amount | uint256 | subtokens amount |
| _data | bytes | data bytes |

### transferBatchErc1155

```solidity
function transferBatchErc1155(address _token, address _to, uint256[] _ids, uint256[] _amounts, bytes _data) external
```

_transfer specified ERC1155 from treasury to specified receiver_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _token | address | ERC1155 token contract address |
| _to | address | receiver address |
| _ids | uint256[] | subtoken ids array |
| _amounts | uint256[] | subtokens amounts array |
| _data | bytes | data bytes |

### supportsInterface

```solidity
function supportsInterface(bytes4 _interfaceId) public view virtual returns (bool)
```

_Check contract supports provided interface_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _interfaceId | bytes4 | id of the interface |

### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address) internal
```

_called by proxy to authorize upgrader_

