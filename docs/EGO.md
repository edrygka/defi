# Solidity API

## EGO

### MAX_SUPPLY

```solidity
uint256 MAX_SUPPLY
```

### MINTER_ROLE

```solidity
bytes32 MINTER_ROLE
```

### accessRegistry

```solidity
contract IAccessControl accessRegistry
```

### constructor

```solidity
constructor(uint256 _initialSupply, address _admin, address _accessRegistry) public
```

### mint

```solidity
function mint(address _account, uint256 _amount) external
```

_mint tokens to specific address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _account | address | destination address |
| _amount | uint256 | tokens to be minted |

### onlyRole

```solidity
modifier onlyRole(bytes32 _role)
```

### _mint

```solidity
function _mint(address _account, uint256 _amount) internal virtual
```

### _burn

```solidity
function _burn(address _account, uint256 _amount) internal virtual
```

### _afterTokenTransfer

```solidity
function _afterTokenTransfer(address _from, address _to, uint256 _amount) internal
```

