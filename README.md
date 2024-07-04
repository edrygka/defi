[![Build](https://github.com/Heatherglade/EgoContracts/actions/workflows/tests.yml/badge.svg)](https://github.com/Heatherglade/EgoContracts/actions/workflows/tests.yml)

# Installation

1. Run `nvm use` to make sure you are using node 16.13 version(install it if you don't have one)
2. Run `npm install` in project root directory
3. Run `npm run rebuild` in project root directory

# Deployment

Here you can find deployment instructions/commands
Don't forget to setup private key in `.env` file

## AccessRegistry

To deploy AccessRegistry:

```sh
GAS_PRICE=70000000000 GAS_LIMIT=2000000 ADMIN=0xd844768C56f20A91901ec76042F30907cEf5ee7B npx hardhat run --network goerli scripts/AccessRegistry.deploy.js
```

## StakingV1

To deploy StakingV1 contract run:

```sh
GAS_PRICE=100000000000 GAS_LIMIT=500000 STAKE_TOKEN=0xA5b8eF6F922d1AbAaaeEAE4F269390bD3f30dfA9 REWARD_TOKEN=0xe102691033B997F3081CB654A86e68abDBA3A78f ACCESS_REGISTRY=0x1c9E150386e47C910dF19dEc7eBb77D41245b6d2 npx hardhat run --network goerli scripts/staking/Staking.deploy.js
```

Verify Proxy:

```sh
npx hardhat verify --contract contracts/BaseProxy.sol:BaseProxy PROXY_ADDRESS "IMPLEMENTATION_ADDRESS" ENCODED_INITIALIZE_CALL --network goerli
```

The `ENCODED_INITIALIZE_CALL` value can be obtained during staking deployment by running the Staking.deploy.js script.

Verify Implementation:

```sh
npx hardhat --network goerli verify --contract contracts/staking/StakingV1.sol:StakingV1 IMPLEMENTATION_ADDRESS
```

To grant staking admin role:

First you need to specify the `grantTo` account address in the config section of the grant_admin_role.js script.
```sh
GAS_PRICE=100000000000 GAS_LIMIT=100000 ACCESS_REGISTRY=0x1c9E150386e47C910dF19dEc7eBb77D41245b6d2 STAKING=0x0d4e7d2900E283e96F8DF15aE4b1C8979d7D040c npx hardhat run --network goerli scripts/staking/methods/grant_staking_role.js
```

## TreasuryV1

To deploy treasury:

```sh
GAS_PRICE=70000000000 GAS_LIMIT=5000000 ACCESS_REGISTRY=0xC6d28d2DAE6Fdb6a7728232aEbD2BFb903ce17a0 npx hardhat run --network goerli scripts/treasury/TreasuryV1.deploy.js
```

## LinearVesting

To deploy vesting:

```sh
GAS_PRICE=30000000000 GAS_LIMIT=5000000 EGO_TOKEN=0x38AaE2d13c4c1c461d33e12e04c40B1a4f4e5CFd ACCESS_REGISTRY=0xC6d28d2DAE6Fdb6a7728232aEbD2BFb903ce17a0 npx hardhat run --network goerli scripts/vesting/Vesting.deploy.js
```

To verify vesting:

```sh
npx hardhat verify --network goerli --contract contracts/vesting/LinearVesting.sol:LinearVesting VESTING_ADDRESS "EGO_TOKEN" "ACCESS_REGISTRY" "VESTING_ROLE"
```

To grant vester role:

```sh
GAS_PRICE=3000000000 GAS_LIMIT=200000 ACCESS_REGISTRY=0xC6d28d2DAE6Fdb6a7728232aEbD2BFb903ce17a0 VESTING=0xdCDf3AE3D27AC96b1A3c033e294faa9D763E3896 npx hardhat run --network goerli scripts/vesting/methods/grant_vesting_role.js
```

To add vesting record:

```sh
GAS_PRICE=3000000000 GAS_LIMIT=400000 EGO_TOKEN=0x38AaE2d13c4c1c461d33e12e04c40B1a4f4e5CFd VESTING=0xdCDf3AE3D27AC96b1A3c033e294faa9D763E3896 npx hardhat run --network goerli scripts/vesting/methods/grant_tokens.js
```

## Factory

To deploy Factory run:

```sh
GAS_PRICE=3000000000 GAS_LIMIT=1000000 ACCESS_REGISTRY=0xC6d28d2DAE6Fdb6a7728232aEbD2BFb903ce17a0 npx hardhat run --network goerli scripts/factory/Factory.deploy.js
```

To deploy StakingV1 proxy run:

```sh
GAS_PRICE=3000000000 GAS_LIMIT=450000 FACTORY=0x366F9387827A401FE55E42a92c3879D297086c5c STAKING_IMPLEMENTATION=0x4f139EE9A186d95A198641d34837eE5381501BCb  ACCESS_REGISTRY=0xC6d28d2DAE6Fdb6a7728232aEbD2BFb903ce17a0 STAKE_TOKEN=0xA5b8eF6F922d1AbAaaeEAE4F269390bD3f30dfA9 REWARD_TOKEN=0xe102691033B997F3081CB654A86e68abDBA3A78f npx hardhat run --network goerli scripts/factory/methods/deploy-staking.js
```

# Tokens

## EGO Token

To deploy EGO contract run:

```sh
GAS_PRICE=3000000000 GAS_LIMIT=5000000 ACCESS_REGISTRY=0x1fEbf4D9620780b772cFaC1Ee7339cC329588f8A npx hardhat run --network goerli scripts/ego/EGO.deploy.js
```

Verify EGO:

```sh
npx hardhat verify EGO_ADDRESS "INIT_SUPPLY" "OWNER" "ACCESS_REGISTRY" --network goerli
```

To grant minter role:

```sh
GAS_PRICE=3000000000 GAS_LIMIT=200000 ACCESS_REGISTRY=0xC6d28d2DAE6Fdb6a7728232aEbD2BFb903ce17a0 EGO_TOKEN=0x38AaE2d13c4c1c461d33e12e04c40B1a4f4e5CFd npx hardhat run --network goerli scripts/ego/methods/grant_minter_role.js
```

## EAXE Token

To deploy EAXE:

```sh
GAS_PRICE=3000000000 GAS_LIMIT=5000000 npx hardhat run --network goerli scripts/EAXE.deploy.js
```

Verify EAXE:

```sh
npx hardhat verify EAXE_ADDRESS "OWNER_ADDRESS" --network goerli
```

# Governance

## EgoGovernor

To deploy governor:

```sh
GAS_PRICE=3000000000 GAS_LIMIT=4000000 EGO_TOKEN=0xB1314B66db087b9E36Bf3FF1600029d5700AD0E9 ACCESS_REGISTRY=0xC6d28d2DAE6Fdb6a7728232aEbD2BFb903ce17a0 npx hardhat run --network goerli scripts/governance/EgoGovernorV1.deploy.js
```

To grant DAO_ADMIN_ROLE:

```sh
GAS_PRICE=3000000000 GAS_LIMIT=100000 ACCESS_REGISTRY=0xC6d28d2DAE6Fdb6a7728232aEbD2BFb903ce17a0 GOVERNOR=0x4486b3b53a9545d829AA26bf2290CCa815a1725B npx hardhat run --network goerli scripts/governance/methods/grant_dao_admin_role.js
```

Create proposal:

```sh
GAS_PRICE=3000000000 GAS_LIMIT=200000 GOVERNOR=0x4486b3b53a9545d829AA26bf2290CCa815a1725B npx hardhat run --network goerli scripts/governance/methods/create_proposal.js
```

## AutonomousProposer

To deploy Autonomous Proposer:

```sh
GAS_PRICE=3000000000 GAS_LIMIT=2000000 EGO_TOKEN=0xB1314B66db087b9E36Bf3FF1600029d5700AD0E9 ACCESS_REGISTRY=0xC6d28d2DAE6Fdb6a7728232aEbD2BFb903ce17a0 GOVERNOR=0x4486b3b53a9545d829AA26bf2290CCa815a1725B npx hardhat run --network goerli scripts/governance/AutonomousProposer.deploy.js
```

# Launchpad

## RandomGenerator

To deploy Random Generator
```sh
GAS_PRICE=70000000000 GAS_LIMIT=2000000 ACCESS_REGISTRY=0x20022C1822A379CEBBa4fc7D8130720C96Eb10f8 VRF_COORDINATOR=0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D SALE=0xCBA45a88Ae10Cb75C52C81848C8b738eC85004F4 npx hardhat run --network goerli scripts/RandomGenerator.deploy.js
```

# Mocks

## Mock ERC1155

To deploy mock ERC1155 token:
```sh
GAS_PRICE=100000000000 GAS_LIMIT=2000000 npx hardhat run --network goerli scripts/mock/MockERC1155.deploy.js
```

To mint ERC1155 token subtoken ids to a user you need first to specify following parameters:
`recepient` address, `subtokensIds` array of ids and `mintAmounts` array of subtoken amounts in the `config` section of the mint_erc1155.js script.

Then run the following:
```sh
GAS_PRICE=100000000000 GAS_LIMIT=200000 MOCK_ERC1155=0x47b213Fb0C39C218831a8D72Be19F7317181aEBB npx hardhat run --network goerli scripts/mock/methods/mint_erc1155.js
```

## Mock ERC20

Before deploying you may want to specify token `name` and `symbol` parameters in the `config` section of the MockERC20.deploy.js script

To deploy mock ERC20 token run the following:

```sh
GAS_PRICE=100000000000 GAS_LIMIT=1000000 npx hardhat run --network goerli scripts/mock/MockERC20.deploy.js
```

## Mock ERC721
Before deploying you may want to specify token `name`, `symbol` and `baseURI` parameters in the `config` section of the MockERC721.deploy.js script.

To deploy mock ERC721 token run the following:
```sh
GAS_PRICE=100000000000 GAS_LIMIT=2000000 npx hardhat run --network goerli scripts/mock/MockERC721.deploy.js
```
Minting ERC721 tokens:
Before minting you need to specify `recepient`, `fromNum` and `toNum` parameters in the `config` section of the mint_erc721.js script.

To mint tokens run the following:
```sh
GAS_PRICE=100000000000 GAS_LIMIT=1000000 MOCK_ERC721=0x07929b7AaFab992C0DFE9fE65428310764Bf1307 npx hardhat run --network goerli scripts/mock/methods/mint_erc721.js
```