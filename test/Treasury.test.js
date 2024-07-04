const { expect } = require("chai");
const { ethers } = require("hardhat");

const { ETH, USDT } = require("../utils/constants");
const { makeRange } = require("../utils/math");
const { sendEthers, ethersBalance } = require("../utils/ethers");
const { BigNumber } = require("ethers");

describe("Treasury", function () {
  const MINT_AMOUNT = ETH._10K;
  const treasuryRole = "EGO_TREASURY_ROLE";
  const ZERO_ADDRESS = ethers.constants.AddressZero;

  let admin;
  let alice;
  let bob;
  let eva;

  let accessRegistry;
  let treasury;
  let treasuryImpl;
  let mockToken;
  let tetherToken;
  let erc721;
  let erc1155;

  async function deployBaseContracts() {
    const AccessRegistry = await ethers.getContractFactory("AccessRegistry");
    accessRegistry = await AccessRegistry.deploy(eva.address); // eva is second admin

    // get contracts prototypes
    const Treasury = await ethers.getContractFactory("TreasuryV1");
    const BaseProxy = await ethers.getContractFactory("BaseProxy");

    // deploy treasury impl
    treasuryImpl = await Treasury.deploy();
    await treasuryImpl.deployed();

    const encodedInitializeCall = treasuryImpl.interface.encodeFunctionData("initialize", [
      accessRegistry.address,
      treasuryRole,
    ]);

    const proxy = await BaseProxy.deploy(treasuryImpl.address, encodedInitializeCall);
    await proxy.deployed();

    treasury = treasuryImpl.attach(proxy.address);
    await expect(treasury.initialize(accessRegistry.address, treasuryRole)).to.be.revertedWith(
      "Initializable: contract is already initialized"
    );

    expect(treasury.address).to.not.eq(treasuryImpl.address);
  }

  async function deployErc20ishTokens() {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock EGO", "mEGO");

    const TetherToken = await ethers.getContractFactory("TetherToken");
    tetherToken = await TetherToken.deploy(ETH._10K, "Mock USD", "mUSD", 6);
  }

  async function deployNft() {
    const MockNFT = await ethers.getContractFactory("MockERC721");
    erc721 = await MockNFT.deploy("a.b.c", "Test NFT", "TNFT");
  }

  async function deployERC1155() {
    const MockERC155 = await ethers.getContractFactory("MockERC1155");
    erc1155 = await MockERC155.deploy("URI1155");
  }

  async function mintERC20(addr) {
    await mockToken.mint(addr, MINT_AMOUNT);
  }

  async function mintTether(addr, amount) {
    await tetherToken.issue(amount);
    await tetherToken.transfer(addr, amount);
  }

  async function mintNFTs(toAddress, startIndex, count) {
    const range = makeRange(count, startIndex);
    await Promise.all(range.map((element) => erc721.safeMint(toAddress, element)));

    return range;
  }

  async function grantTransferer(addr) {
    const TRANSFERER_ROLE = await treasury.treasuryRole();
    await accessRegistry.grantRole(TRANSFERER_ROLE, addr);
    expect(await accessRegistry.hasRole(TRANSFERER_ROLE, addr)).to.be.true;
  }

  beforeEach(async () => {
    [admin, alice, bob, eva] = await ethers.getSigners();
    await deployBaseContracts();
  });

  /**
   * GENERAL CHECKS *
   */

  it("Check properties & configuration", async () => {
    await expect(treasury.initialize(accessRegistry.address, treasuryRole)).to.be.revertedWith(
      "Initializable: contract is already initialized"
    );

    expect(treasury.address).to.be.not.eq(treasuryImpl.address);

    await expect(treasuryImpl.initialize(accessRegistry.address, treasuryRole)).to.be.revertedWith(
      "Initializable: contract is already initialized"
    );

    expect(await treasury.accessRegistry()).to.be.equal(accessRegistry.address);

    const defaultAdminRole = await accessRegistry.DEFAULT_ADMIN_ROLE();

    expect(await accessRegistry.hasRole(defaultAdminRole, admin.address)).to.be.true;
    expect(await accessRegistry.hasRole(defaultAdminRole, eva.address)).to.be.true;
    expect(await accessRegistry.hasRole(defaultAdminRole, bob.address)).to.be.false;
  });

  it("transfer tokens works", async () => {
    await deployErc20ishTokens();
    // mint to treasury
    await mintERC20(treasury.address);
    // check token balance
    expect(await mockToken.balanceOf(treasury.address)).to.eq(MINT_AMOUNT);

    await grantTransferer(alice.address);

    // transferer alice transfers tokens: treasury -> bob
    await expect(treasury.connect(alice).transferErc20(mockToken.address, bob.address, MINT_AMOUNT))
      .to.emit(treasury, "ERC20Transfered")
      .withArgs(bob.address, mockToken.address, MINT_AMOUNT);

    expect(await mockToken.balanceOf(treasury.address)).to.eq("0");

    expect(await mockToken.balanceOf(bob.address)).to.eq(MINT_AMOUNT);
  });

  it("transfer tether ok", async () => {
    await deployErc20ishTokens();
    await mintTether(treasury.address, USDT._10K);

    expect(await tetherToken.balanceOf(treasury.address)).to.eq(USDT._10K);

    await grantTransferer(admin.address);

    expect(await tetherToken.basisPointsRate()).to.eq("0");

    await expect(treasury.transferErc20(tetherToken.address, bob.address, USDT._100))
      .to.emit(tetherToken, "Transfer")
      .withArgs(treasury.address, bob.address, USDT._100);

    expect(await tetherToken.balanceOf(bob.address)).to.eq(USDT._100);

    await expect(treasury.transferErc20(tetherToken.address, bob.address, USDT._100))
      .to.emit(treasury, "ERC20Transfered")
      .withArgs(bob.address, tetherToken.address, USDT._100);

    expect(await tetherToken.balanceOf(bob.address)).to.eq(USDT._100.mul("2"));

    expect(await tetherToken.balanceOf(treasury.address)).to.eq(USDT._10K.sub(USDT._100.mul("2")));
  });

  it("transfer tokens non-transferer fails", async () => {
    await deployErc20ishTokens();
    // mint to treasury
    await mintERC20(treasury.address);
    // check tokens balance
    expect(await mockToken.balanceOf(treasury.address)).to.eq(MINT_AMOUNT);

    // transferer alice transfers tokens: treasury -> bob
    await expect(treasury.transferErc20(mockToken.address, bob.address, MINT_AMOUNT)).to.be.revertedWith(
      "Treasury: FORBIDDEN"
    );
  });

  it("transfer tokens rejects on zero address receiver", async () => {
    await deployErc20ishTokens();
    // mint to treasury
    await mintERC20(treasury.address);

    await grantTransferer(admin.address);

    // transferer alice transfers tokens: treasury -> zero address
    await expect(
      treasury.transferErc20(mockToken.address, ethers.constants.AddressZero, MINT_AMOUNT)
    ).to.be.revertedWith("ERC20: transfer to the zero address");
  });

  it("transfer tokens rejects on zero token address", async () => {
    await deployErc20ishTokens();
    // mint to treasury
    await mintERC20(treasury.address);

    await grantTransferer(admin.address);

    // transferer alice transfers tokens: treasury -> bob
    await expect(treasury.transferErc20(ethers.constants.AddressZero, bob.address, MINT_AMOUNT)).to.be.revertedWith(
      "Address: call to non-contract"
    );
  });

  it("transfer ethers ok", async () => {
    expect(await ethersBalance(treasury.address)).to.eq("0");
    const SEND_AMOUNT = ETH._1;
    await sendEthers(admin, treasury, SEND_AMOUNT);
    expect(await ethersBalance(treasury.address)).to.eq(SEND_AMOUNT);

    await grantTransferer(alice.address);
    const balanceBefore = await ethersBalance(bob.address);

    await expect(treasury.connect(alice).transferEthers(bob.address, SEND_AMOUNT))
      .to.emit(treasury, "EthersTransfered")
      .withArgs(bob.address, SEND_AMOUNT);

    const balanceAfter = await ethersBalance(bob.address);
    expect(balanceBefore.add(SEND_AMOUNT)).to.eq(balanceAfter);
    expect(await ethersBalance(treasury.address)).to.eq("0");
  });

  it("transfer ethers should revert if receiver zero address", async () => {
    expect(await ethersBalance(treasury.address)).to.eq("0");
    const SEND_AMOUNT = ETH._1;
    await sendEthers(admin, treasury, SEND_AMOUNT);

    await grantTransferer(alice.address);

    await expect(treasury.connect(alice).transferEthers(ethers.constants.AddressZero, ETH._10K)).to.be.revertedWith(
      "CommonChecks: ZERO_ADDRESS"
    );
  });

  it("transfer ethers should revert if transfer amount bigger than balance", async () => {
    expect(await ethersBalance(treasury.address)).to.eq("0");
    const SEND_AMOUNT = ETH._1;
    await sendEthers(admin, treasury, SEND_AMOUNT);

    await grantTransferer(alice.address);

    await expect(treasury.connect(alice).transferEthers(bob.address, ETH._10K)).to.be.revertedWith(
      "Treasury: TRANSFER_ETHERS_FAILED"
    );
  });

  it("transfer ethers non-tranferer fails", async () => {
    expect(await ethersBalance(treasury.address)).to.eq("0");
    const SEND_AMOUNT = ETH._1;
    await sendEthers(admin, treasury, SEND_AMOUNT);
    await expect(treasury.transferEthers(bob.address, SEND_AMOUNT)).to.be.revertedWith("Treasury: FORBIDDEN");
  });

  describe("check ERC721 support", () => {
    beforeEach(async () => {
      await deployNft();
    });

    it("mint nfts ok", async () => {
      const START_INDEX = 10;
      const AMOUNT = 5;
      const range = await mintNFTs(treasury.address, START_INDEX, AMOUNT);

      expect(range.length).to.eq(5);
      const elements = await Promise.all(makeRange(5, 10).map((element) => erc721.ownerOf(element)));
      elements.forEach((element) => expect(element).to.be.equal(treasury.address));
    });

    it("transfer nfts non-tranferer fails", async () => {
      const START_INDEX = 10;
      const AMOUNT = 5;
      const range = await mintNFTs(treasury.address, START_INDEX, AMOUNT);

      await expect(treasury.connect(alice).transferErc721(erc721.address, bob.address, range[0])).to.be.revertedWith(
        "Treasury: FORBIDDEN"
      );
    });

    it("transfer nfts ok", async () => {
      const START_INDEX = 10;
      const AMOUNT = 5;
      const range = await mintNFTs(treasury.address, START_INDEX, AMOUNT);

      await grantTransferer(alice.address);

      const id = range[0];

      await expect(treasury.connect(alice).transferErc721(erc721.address, bob.address, id))
        .to.emit(treasury, "ERC721Transfered")
        .withArgs(bob.address, erc721.address, id);

      expect(await erc721.ownerOf(id)).to.eq(bob.address);
    });

    it("tranfer nfts should revert if nft address zero", async () => {
      await grantTransferer(alice.address);

      await expect(
        treasury.connect(alice).transferErc721(ethers.constants.AddressZero, bob.address, 0)
      ).to.be.revertedWith("Transaction reverted: function call to a non-contract account");
    });

    it("tranfer nfts should revert if receiver address zero", async () => {
      const START_INDEX = 10;
      const AMOUNT = 5;
      const range = await mintNFTs(treasury.address, START_INDEX, AMOUNT);

      await grantTransferer(alice.address);

      const id = range[0];

      await expect(
        treasury.connect(alice).transferErc721(erc721.address, ethers.constants.AddressZero, id)
      ).to.be.revertedWith("ERC721: transfer to the zero address");
    });
  });

  describe("ERC1155 support", () => {
    beforeEach(async () => {
      await deployERC1155();
    });
    it("single mint ERC1155 to treasury ok", async () => {
      const [PB, WOOD] = [3, 4];
      const amountPB = 123;

      await expect(erc1155.mint(treasury.address, PB, amountPB))
        .to.emit(erc1155, "TransferSingle")
        .withArgs(admin.address, ZERO_ADDRESS, treasury.address, PB, amountPB);

      expect(await erc1155.balanceOf(treasury.address, PB)).to.be.eq(amountPB);
      // not minted
      expect(await erc1155.balanceOf(treasury.address, WOOD)).to.be.eq(0);
    });

    it("batch mint ERC1155 to treasury ok", async () => {
      const [GOLD, SILVER, PLATINUM, WOOD] = [0, 1, 2, 3];
      const subtokensIds = [GOLD, SILVER, PLATINUM];
      const amounts = [11, 22, 33];

      await expect(erc1155.mintBatch(treasury.address, subtokensIds, amounts))
        .to.emit(erc1155, "TransferBatch")
        .withArgs(admin.address, ZERO_ADDRESS, treasury.address, subtokensIds, amounts);

      expect(await erc1155.balanceOfBatch(new Array(3).fill(treasury.address), subtokensIds)).to.be.eql(
        amounts.map((x) => BigNumber.from(x))
      );

      // not minted
      expect(await erc1155.balanceOf(treasury.address, WOOD)).to.be.eq(0);
    });

    it("transfer erc1155 non-tranferer fails", async () => {
      const ids = [1, 2, 3];
      const amounts = [100, 200, 300];

      await erc1155.mintBatch(treasury.address, ids, amounts);

      await expect(
        treasury.connect(alice).transferBatchErc1155(erc1155.address, bob.address, ids, amounts, [])
      ).to.be.revertedWith("Treasury: FORBIDDEN");
    });

    it("batch transfer erc1155 ok", async () => {
      await grantTransferer(alice.address);

      const ids = [1, 2, 3].map((x) => BigNumber.from(x));
      const amounts = [100, 200, 300].map((x) => BigNumber.from(x));
      const data = Buffer.from("123");
      const hexData = "0x" + data.toString("hex");

      await erc1155.mintBatch(treasury.address, ids, amounts);

      await expect(treasury.connect(alice).transferBatchErc1155(erc1155.address, bob.address, ids, amounts, data))
        .to.emit(erc1155, "TransferBatch")
        .withArgs(treasury.address, treasury.address, bob.address, ids, amounts)
        .to.emit(treasury, "ERC1155BatchTransfered")
        .withArgs(bob.address, erc1155.address, ids, amounts, hexData);

      expect(await erc1155.balanceOfBatch(new Array(3).fill(bob.address), ids)).to.be.eql(amounts);
    });

    it("single transfer erc1155 ok", async () => {
      await grantTransferer(alice.address);

      const id = BigNumber.from(4);
      const amount = BigNumber.from(100);
      const data = Buffer.from("123");
      const hexData = "0x" + data.toString("hex");

      await erc1155.mint(treasury.address, id, amount);

      await expect(treasury.connect(alice).transferErc1155(erc1155.address, bob.address, id, amount, data))
        .to.emit(erc1155, "TransferSingle")
        .withArgs(treasury.address, treasury.address, bob.address, id, amount)
        .to.emit(treasury, "ERC1155Transfered")
        .withArgs(bob.address, erc1155.address, id, amount, hexData);

      expect(await erc1155.balanceOf(bob.address, id)).to.be.eql(amount);
    });

    it("tranfer erc1155 should revert if token address zero", async () => {
      await grantTransferer(alice.address);
      await erc1155.mint(treasury.address, 1, 1);

      await expect(treasury.connect(alice).transferErc1155(ZERO_ADDRESS, bob.address, 1, 1, [])).to.be.revertedWith(
        "Transaction reverted: function call to a non-contract account"
      );

      await expect(
        treasury.connect(alice).transferBatchErc1155(ZERO_ADDRESS, bob.address, [1], [1], [])
      ).to.be.revertedWith("Transaction reverted: function call to a non-contract account");
    });

    it("erc1155 tranfer token should revert if receiver address zero", async () => {
      await erc1155.mint(treasury.address, 1, 1);

      await grantTransferer(alice.address);

      await expect(
        treasury.connect(alice).transferBatchErc1155(erc1155.address, ZERO_ADDRESS, [1], [1], [])
      ).to.be.revertedWith("ERC1155: transfer to the zero address");

      await expect(treasury.connect(alice).transferErc1155(erc1155.address, ZERO_ADDRESS, 1, 1, [])).to.be.revertedWith(
        "ERC1155: transfer to the zero address"
      );
    });
  });

  it("upgrade ok", async () => {
    const NewTreasury = await ethers.getContractFactory("contracts/test/NewTreasury.sol:NewTreasury");
    const newTreasuryImpl = await NewTreasury.deploy();
    await newTreasuryImpl.deployed();

    await treasury.upgradeTo(newTreasuryImpl.address);

    await expect(treasury.initialize(accessRegistry.address, treasuryRole)).to.be.revertedWith(
      "Initializable: contract is already initialized"
    );

    await expect(treasuryImpl.initialize(accessRegistry.address, treasuryRole)).to.be.revertedWith(
      "Initializable: contract is already initialized"
    );

    const updatedTreasury = newTreasuryImpl.attach(treasury.address);

    const value = await updatedTreasury.VALUE();
    expect(value).to.eq("NEW TREASURY 12345");

    const res = await newTreasuryImpl.newMethod();
    expect(res).to.eq(value);
  });

  it("upgrade non-authorized fails", async () => {
    const NewTreasury = await ethers.getContractFactory("contracts/test/NewTreasury.sol:NewTreasury");
    const newTreasuryImpl = await NewTreasury.deploy();
    await newTreasuryImpl.deployed();

    await expect(treasury.connect(alice).upgradeTo(newTreasuryImpl.address)).to.be.revertedWith("Treasury: FORBIDDEN");
  });

  it("supportsInterface ok", async () => {
    const InterfaceGetter = await ethers.getContractFactory("InterfaceGetter");
    const getter = await InterfaceGetter.deploy();
    await getter.deployed();

    const getIds = async (names) => await Promise.all(names.map((n) => getter.getInterfaceId(n)));

    const ids = await getIds([
      "ITreasuryV1",
      "IERC721ReceiverUpgradeable",
      "IERC1155ReceiverUpgradeable",
      "IERC165Upgradeable",
      "IERC20Upgradeable",
      "IAccessControl",
    ]);

    const results = await Promise.all(ids.map((id) => treasury.supportsInterface(id)));

    expect(results).to.be.eql([true, false, true, true, false, false]);
  });
});
