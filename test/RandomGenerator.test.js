const chai = require("chai");
const expect = chai.expect;
const { ethers } = require("hardhat");
const { filterMutativeFunctions } = require("../utils/crypto");
const { solidity } = require("ethereum-waffle");
const { smock } = require("@defi-wonderland/smock");
const { ETH } = require("../utils/constants");

chai.use(solidity);
chai.use(smock.matchers);

describe("Random Generator", () => {
  let owner, alice, bob;
  let accessRegistry;
  let fakeVrfCoordinator;
  let randomGenerator;
  const subscriptionId = 1;
  const keyHash = "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15";
  const requestId = 1234;

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();
    const AccessRegistry = await ethers.getContractFactory("AccessRegistry");
    accessRegistry = await AccessRegistry.deploy(owner.address);

    // const VrfCoordinator = await ethers.getContractFactory("VRFTestCoordinator");
    const FakeVrfCoordinator = await smock.mock("TestVRFCoordinator");
    fakeVrfCoordinator = await FakeVrfCoordinator.deploy(owner.address, owner.address, owner.address, {
      value: ETH._1,
    }); // we don't care about params here

    const RandomGenerator = await ethers.getContractFactory("RandomGenerator");
    randomGenerator = await RandomGenerator.deploy(
      accessRegistry.address,
      fakeVrfCoordinator.address,
      keyHash,
      subscriptionId
    );

    // grant seed role
    const ADD_SEED_ROLE = randomGenerator.ADD_SEED_ROLE();
    await accessRegistry.grantRole(ADD_SEED_ROLE, alice.address);
  });

  describe("Constructor", () => {
    it("should set all params correctly", async () => {
      expect(await randomGenerator.accessRegistry()).to.be.eq(accessRegistry.address);
      expect(await randomGenerator.vrfCoordinator()).to.be.eq(fakeVrfCoordinator.address);
      expect(await randomGenerator.subscriptionId()).to.be.eq(subscriptionId);
      expect(await randomGenerator.keyHash()).to.be.eq(keyHash);
    });
  });

  describe("requestRandom", () => {
    it("should request random successfully", async () => {
      fakeVrfCoordinator.requestRandomWords.returns(requestId);

      const confirmations = 3;
      const callbackGasLimit = 100000;
      const numberWords = 1;

      await randomGenerator.connect(alice).requestRandom(confirmations, callbackGasLimit, numberWords);

      expect(await randomGenerator.sales(requestId)).to.eq(alice.address);
      expect(fakeVrfCoordinator.requestRandomWords.atCall(0)).to.have.been.calledWith(
        keyHash,
        subscriptionId,
        confirmations,
        callbackGasLimit,
        numberWords
      );
    });

    it("should revert on request random if already requested", async () => {
      const randomNumber = [33333];
      fakeVrfCoordinator.requestRandomWords.returns(requestId);

      const confirmations = 3;
      const callbackGasLimit = 100000;
      const numberWords = 1;
      await randomGenerator.connect(alice).requestRandom(confirmations, callbackGasLimit, numberWords);

      expect(await randomGenerator.sales(requestId)).to.eq(alice.address);
      expect(fakeVrfCoordinator.requestRandomWords.atCall(0)).to.have.been.calledWith(
        keyHash,
        subscriptionId,
        confirmations,
        callbackGasLimit,
        numberWords
      );

      await randomGenerator.connect(fakeVrfCoordinator.wallet).rawFulfillRandomWords(requestId, randomNumber);

      await expect(
        randomGenerator.connect(alice).requestRandom(confirmations, callbackGasLimit, numberWords)
      ).to.be.revertedWith("RG: ALREADY_REQUESTED");
    });

    it("should revert on request random if callee don't has ADD_SEED_ROLE", async () => {
      const confirmations = 3;
      const callbackGasLimit = 100000;
      const numberWords = 1;

      await expect(
        randomGenerator.connect(bob).requestRandom(confirmations, callbackGasLimit, numberWords)
      ).to.be.revertedWith("RG: FORBIDDEN");
    });
  });

  describe("fulfillRandomWords", () => {
    it("should successfully fulfil request for sale", async () => {
      const randomNumber = [33333, 2222, 12];
      fakeVrfCoordinator.requestRandomWords.returns(requestId);

      const confirmations = 3;
      const callbackGasLimit = 100000;
      const numberWords = 3;
      await randomGenerator.connect(alice).requestRandom(confirmations, callbackGasLimit, numberWords);

      expect(await randomGenerator.sales(requestId)).to.eq(alice.address);
      expect(fakeVrfCoordinator.requestRandomWords.atCall(0)).to.have.been.calledWith(
        keyHash,
        subscriptionId,
        confirmations,
        callbackGasLimit,
        numberWords
      );

      await randomGenerator.connect(fakeVrfCoordinator.wallet).rawFulfillRandomWords(requestId, randomNumber);

      expect(await randomGenerator.getRandomLength(alice.address)).to.eq(randomNumber.length);

      randomNumber.forEach(async (randomVal, i) => {
        expect(await randomGenerator.getRandomWord(alice.address, i)).to.eq(randomVal);
      });
    });

    it("should revert on fulfil request if this sale already has random value", async () => {
      const randomNumber = [33333];
      fakeVrfCoordinator.requestRandomWords.returns(requestId);

      const confirmations = 3;
      const callbackGasLimit = 100000;
      const numberWords = 1;
      await randomGenerator.connect(alice).requestRandom(confirmations, callbackGasLimit, numberWords);

      expect(await randomGenerator.sales(requestId)).to.eq(alice.address);
      expect(fakeVrfCoordinator.requestRandomWords.atCall(0)).to.have.been.calledWith(
        keyHash,
        subscriptionId,
        confirmations,
        callbackGasLimit,
        numberWords
      );

      await randomGenerator.connect(fakeVrfCoordinator.wallet).rawFulfillRandomWords(requestId, randomNumber);

      expect(await randomGenerator.getRandomLength(alice.address)).to.eq(randomNumber.length);

      expect(await randomGenerator.getRandomWord(alice.address, 0)).to.eq(randomNumber[0]);

      await expect(
        randomGenerator.connect(fakeVrfCoordinator.wallet).rawFulfillRandomWords(requestId, [12345])
      ).to.be.revertedWith("RG: EXISTS");
    });
  });

  describe("setKeyHash", () => {
    it("should successfully set new key hash value", async () => {
      expect(await randomGenerator.keyHash()).to.be.eq(keyHash);

      const newKeyHash = "0xff8dedfbfa60af186cf3c830acbc32c05aae823045ae5ea7da1e45fbfaba4f92";
      await randomGenerator.setKeyHash(newKeyHash);

      expect(await randomGenerator.keyHash()).to.be.eq(newKeyHash);
    });

    it("should revert on setting new key hash if callee not admin", async () => {
      expect(await randomGenerator.keyHash()).to.be.eq(keyHash);

      const newKeyHash = "0xff8dedfbfa60af186cf3c830acbc32c05aae823045ae5ea7da1e45fbfaba4f92";
      await expect(randomGenerator.connect(alice).setKeyHash(newKeyHash)).to.be.revertedWith("RG: FORBIDDEN");

      expect(await randomGenerator.keyHash()).to.be.eq(keyHash);
    });
  });

  describe("setSubscriptionId", () => {
    it("should successfully set new subscription id value", async () => {
      expect(await randomGenerator.subscriptionId()).to.be.eq(subscriptionId);

      const newSubscriptionId = 234;
      await randomGenerator.setSubscriptionId(newSubscriptionId);

      expect(await randomGenerator.subscriptionId()).to.be.eq(newSubscriptionId);
    });

    it("should revert on setting new subscription id if callee not admin", async () => {
      expect(await randomGenerator.subscriptionId()).to.be.eq(subscriptionId);

      const newSubscriptionId = 234;
      await expect(randomGenerator.connect(alice).setSubscriptionId(newSubscriptionId)).to.be.revertedWith(
        "RG: FORBIDDEN"
      );

      expect(await randomGenerator.subscriptionId()).to.be.eq(subscriptionId);
    });
  });

  describe("Mutative", () => {
    it("should return only known public mutative functions", async () => {
      const RandomGenerator = await ethers.getContractFactory("RandomGenerator");
      const functions = Object.values(RandomGenerator.interface.functions);

      const { fallbackFnc, mutable } = filterMutativeFunctions(functions);

      expect(fallbackFnc.length).to.be.eq(0);
      expect(mutable).to.be.eql(["rawFulfillRandomWords", "requestRandom", "setKeyHash", "setSubscriptionId"]);
    });
  });
});
