// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ProvenanceRegistry.sol";

contract ProvenanceRegistryTest is Test {
    ProvenanceRegistry public registry;

    address public admin = address(0xAD);
    address public producer = address(0xB01);
    address public distributor = address(0xD01);
    address public shop = address(0x501);
    address public relayer = address(0x777);
    address public randomUser = address(0x999);

    bytes32 public constant TEST_HASH = keccak256("batch-test-metadata");

    event BatchCreated(
        uint256 indexed batchId,
        address indexed producer,
        string productName,
        string origin,
        bytes32 metadataHash,
        uint32 unitCount,
        uint64 createdAt
    );
    event CustodyTransferred(
        uint256 indexed batchId,
        address indexed from,
        address indexed to,
        string location,
        uint64 timestamp
    );
    event TransferInitiated(
        uint256 indexed batchId,
        address indexed from,
        address indexed to,
        string location,
        uint64 timestamp
    );
    event BatchRecalled(uint256 indexed batchId, address indexed caller, string reason);
    event BatchSoldOut(uint256 indexed batchId, address indexed shop);

    function setUp() public {
        vm.startPrank(admin);
        registry = new ProvenanceRegistry(admin);

        // Grant initial roles
        registry.grantRole(registry.PRODUCER_ROLE(), producer);
        registry.grantRole(registry.DISTRIBUTOR_ROLE(), distributor);
        registry.grantRole(registry.SHOP_ROLE(), shop);
        registry.grantRole(registry.RELAYER_ROLE(), relayer);

        // Set human-readable display names
        registry.setDisplayName(producer, "Sidama Coffee Co-op");
        registry.setDisplayName(distributor, "Addis Export Co.");
        registry.setDisplayName(shop, "Roast & Co.");
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // 1. Role Verification & Batch Creation
    // -------------------------------------------------------------------------
    function test_ProducerCanCreateBatch() public {
        vm.prank(producer);
        uint256 id = registry.createBatch(
            "Sidama Single Origin",
            "Sidama, Ethiopia",
            TEST_HASH,
            50,
            "Sidama Washing Station"
        );

        assertEq(id, 1);
        assertEq(registry.batchCount(), 1);

        ProvenanceRegistry.Batch memory b = registry.getBatch(1);
        assertEq(b.id, 1);
        assertEq(b.producer, producer);
        assertEq(b.currentHolder, producer);
        assertEq(b.pendingHolder, address(0));
        assertEq(b.productName, "Sidama Single Origin");
        assertEq(b.origin, "Sidama, Ethiopia");
        assertEq(b.metadataHash, TEST_HASH);
        assertEq(b.unitCount, 50);
        assertTrue(b.status == ProvenanceRegistry.BatchStatus.Active);

        // Verify initial custody event from address(0) to producer
        ProvenanceRegistry.CustodyEvent[] memory hist = registry.getHistory(1);
        assertEq(hist.length, 1);
        assertEq(hist[0].from, address(0));
        assertEq(hist[0].to, producer);
        assertEq(hist[0].location, "Sidama Washing Station");
    }

    function test_NonProducerCannotCreateBatch() public {
        vm.prank(distributor);
        vm.expectRevert();
        registry.createBatch("Coffee", "Origin", TEST_HASH, 10, "Station");

        vm.prank(randomUser);
        vm.expectRevert();
        registry.createBatch("Coffee", "Origin", TEST_HASH, 10, "Station");
    }

    // -------------------------------------------------------------------------
    // 2. Happy Path: Producer -> Distributor -> Shop (TWO-STEP)
    // -------------------------------------------------------------------------
    function test_HappyPathTwoStepCustodyChain() public {
        // Step 1: Producer creates batch
        vm.prank(producer);
        uint256 id = registry.createBatch(
            "Sidama Single Origin",
            "Sidama, Ethiopia",
            TEST_HASH,
            50,
            "Sidama Washing Station"
        );

        // Step 2: Producer initiates transfer to Distributor
        vm.prank(producer);
        registry.initiateTransfer(id, distributor, "Bole Airport Hub");

        ProvenanceRegistry.Batch memory b1 = registry.getBatch(id);
        assertEq(b1.currentHolder, producer);
        assertEq(b1.pendingHolder, distributor);

        // Step 3: Distributor accepts transfer
        vm.prank(distributor);
        registry.acceptTransfer(id, "Addis Central Warehouse");

        ProvenanceRegistry.Batch memory b2 = registry.getBatch(id);
        assertEq(b2.currentHolder, distributor);
        assertEq(b2.pendingHolder, address(0));

        // Step 4: Distributor initiates transfer to Shop
        vm.prank(distributor);
        registry.initiateTransfer(id, shop, "Addis Distribution Center");

        // Step 5: Shop accepts transfer
        vm.prank(shop);
        registry.acceptTransfer(id, "Downtown Coffee Bar");

        ProvenanceRegistry.Batch memory b3 = registry.getBatch(id);
        assertEq(b3.currentHolder, shop);
        assertEq(b3.pendingHolder, address(0));

        // Verify History: exactly 3 events, ordered, correct from/to
        ProvenanceRegistry.CustodyEvent[] memory hist = registry.getHistory(id);
        assertEq(hist.length, 3);

        // Event 1: 0x0 -> Producer
        assertEq(hist[0].from, address(0));
        assertEq(hist[0].to, producer);
        assertEq(hist[0].location, "Sidama Washing Station");

        // Event 2: Producer -> Distributor
        assertEq(hist[1].from, producer);
        assertEq(hist[1].to, distributor);
        assertEq(hist[1].location, "Addis Central Warehouse");

        // Event 3: Distributor -> Shop
        assertEq(hist[2].from, distributor);
        assertEq(hist[2].to, shop);
        assertEq(hist[2].location, "Downtown Coffee Bar");

        // Step 6: Shop marks batch SoldOut
        vm.prank(shop);
        registry.markSoldOut(id);

        ProvenanceRegistry.Batch memory bFinal = registry.getBatch(id);
        assertTrue(bFinal.status == ProvenanceRegistry.BatchStatus.SoldOut);
    }

    // -------------------------------------------------------------------------
    // 3. Direct Transfer Route: Producer -> Shop (Direct Path)
    // -------------------------------------------------------------------------
    function test_ProducerCanTransferDirectlyToShop() public {
        vm.prank(producer);
        uint256 id = registry.createBatch("Coffee", "Origin", TEST_HASH, 20, "Origin Site");

        // Producer -> Shop allowed directly
        vm.prank(producer);
        registry.initiateTransfer(id, shop, "Direct Dispatch");

        vm.prank(shop);
        registry.acceptTransfer(id, "Shop Delivery Dock");

        ProvenanceRegistry.Batch memory b = registry.getBatch(id);
        assertEq(b.currentHolder, shop);

        ProvenanceRegistry.CustodyEvent[] memory hist = registry.getHistory(id);
        assertEq(hist.length, 2);
        assertEq(hist[1].from, producer);
        assertEq(hist[1].to, shop);
    }

    // -------------------------------------------------------------------------
    // 4. Invalid Paths Revert
    // -------------------------------------------------------------------------
    function test_InvalidCustodyPathsRevert() public {
        vm.prank(producer);
        uint256 id = registry.createBatch("Coffee", "Origin", TEST_HASH, 20, "Station");

        // Producer cannot transfer to another Producer or Random Address
        vm.prank(producer);
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.InvalidPath.selector, producer, randomUser));
        registry.initiateTransfer(id, randomUser, "Void");

        // Distributor receives batch
        vm.prank(producer);
        registry.initiateTransfer(id, distributor, "Depot");
        vm.prank(distributor);
        registry.acceptTransfer(id, "Depot");

        // Distributor cannot transfer back to Producer
        vm.prank(distributor);
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.InvalidPath.selector, distributor, producer));
        registry.initiateTransfer(id, producer, "Return");

        // Distributor cannot transfer to Random User
        vm.prank(distributor);
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.InvalidPath.selector, distributor, randomUser));
        registry.initiateTransfer(id, randomUser, "Void");

        // Distributor CAN transfer to another Distributor
        address distributor2 = address(0xD02);
        bytes32 distRole = registry.DISTRIBUTOR_ROLE();
        vm.prank(admin);
        registry.grantRole(distRole, distributor2);

        vm.prank(distributor);
        registry.initiateTransfer(id, distributor2, "Regional Depot to Local Depot");
        vm.prank(distributor2);
        registry.acceptTransfer(id, "Local Depot");
        assertEq(registry.getBatch(id).currentHolder, distributor2);
    }

    // -------------------------------------------------------------------------
    // 5. Handover Authorization Checks
    // -------------------------------------------------------------------------
    function test_OnlyPendingRecipientCanAccept() public {
        vm.prank(producer);
        uint256 id = registry.createBatch("Coffee", "Origin", TEST_HASH, 20, "Station");

        vm.prank(producer);
        registry.initiateTransfer(id, distributor, "Transit");

        // Random user or shop cannot accept
        vm.prank(randomUser);
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.NotPendingRecipient.selector, randomUser, distributor));
        registry.acceptTransfer(id, "Stolen");

        vm.prank(shop);
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.NotPendingRecipient.selector, shop, distributor));
        registry.acceptTransfer(id, "Interception");
    }

    function test_NonHolderCannotInitiateTransfer() public {
        vm.prank(producer);
        uint256 id = registry.createBatch("Coffee", "Origin", TEST_HASH, 20, "Station");

        vm.prank(randomUser);
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.UnauthorizedCaller.selector, randomUser));
        registry.initiateTransfer(id, distributor, "Hack");
    }

    function test_CancelPendingTransfer() public {
        vm.prank(producer);
        uint256 id = registry.createBatch("Coffee", "Origin", TEST_HASH, 20, "Station");

        vm.prank(producer);
        registry.initiateTransfer(id, distributor, "Transit");

        // Non-holder cannot cancel
        vm.prank(randomUser);
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.UnauthorizedCaller.selector, randomUser));
        registry.cancelTransfer(id);

        // Producer cancels
        vm.prank(producer);
        registry.cancelTransfer(id);

        ProvenanceRegistry.Batch memory b = registry.getBatch(id);
        assertEq(b.pendingHolder, address(0));

        // Recipient can no longer accept
        vm.prank(distributor);
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.NoPendingTransfer.selector, id));
        registry.acceptTransfer(id, "Warehouse");
    }

    // -------------------------------------------------------------------------
    // 6. Recalled Batch Blocks Transfers
    // -------------------------------------------------------------------------
    function test_RecalledBatchBlocksTransfers() public {
        vm.prank(producer);
        uint256 id = registry.createBatch("Medicine", "Origin", TEST_HASH, 100, "Factory");

        // Producer recalls batch
        vm.prank(producer);
        registry.recallBatch(id, "Contamination detected in test sample");

        ProvenanceRegistry.Batch memory b = registry.getBatch(id);
        assertTrue(b.status == ProvenanceRegistry.BatchStatus.Recalled);

        // Cannot transfer recalled batch
        vm.prank(producer);
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.BatchNotActive.selector, id, ProvenanceRegistry.BatchStatus.Recalled));
        registry.initiateTransfer(id, distributor, "Transit");
    }

    function test_AdminCanRecallAnyBatch() public {
        vm.prank(producer);
        uint256 id = registry.createBatch("Coffee", "Origin", TEST_HASH, 10, "Station");

        vm.prank(admin);
        registry.recallBatch(id, "Regulatory non-compliance");

        ProvenanceRegistry.Batch memory b = registry.getBatch(id);
        assertTrue(b.status == ProvenanceRegistry.BatchStatus.Recalled);
    }

    // -------------------------------------------------------------------------
    // 7. Direct Transfer Mode
    // -------------------------------------------------------------------------
    function test_DirectTransferCustodyAlternative() public {
        vm.prank(producer);
        uint256 id = registry.createBatch("Coffee", "Origin", TEST_HASH, 10, "Farm");

        vm.prank(producer);
        registry.transferCustody(id, distributor, "Instant Handover Point");

        ProvenanceRegistry.Batch memory b = registry.getBatch(id);
        assertEq(b.currentHolder, distributor);

        ProvenanceRegistry.CustodyEvent[] memory hist = registry.getHistory(id);
        assertEq(hist.length, 2);
        assertEq(hist[1].from, producer);
        assertEq(hist[1].to, distributor);
        assertEq(hist[1].location, "Instant Handover Point");
    }

    // -------------------------------------------------------------------------
    // 8. Role Revocation & Views
    // -------------------------------------------------------------------------
    function test_RoleRevocationTakesEffectImmediately() public {
        bytes32 prodRole = registry.PRODUCER_ROLE();
        vm.prank(admin);
        registry.revokeRole(prodRole, producer);

        vm.prank(producer);
        vm.expectRevert();
        registry.createBatch("Coffee", "Origin", TEST_HASH, 10, "Station");
    }

    function test_GetRoleView() public view {
        assertEq(registry.getRole(admin), "ADMIN");
        assertEq(registry.getRole(producer), "PRODUCER");
        assertEq(registry.getRole(distributor), "DISTRIBUTOR");
        assertEq(registry.getRole(shop), "SHOP");
        assertEq(registry.getRole(randomUser), "NONE");
    }

    // -------------------------------------------------------------------------
    // 9. Fuzz Test: Random callers can never move a batch they don't hold
    // -------------------------------------------------------------------------
    function testFuzz_RandomCallerCannotInitiate(address caller, address recipient) public {
        vm.assume(caller != producer);
        vm.assume(caller != address(0));

        vm.prank(producer);
        uint256 id = registry.createBatch("Coffee", "Origin", TEST_HASH, 10, "Station");

        vm.prank(caller);
        vm.expectRevert();
        registry.initiateTransfer(id, recipient, "Location");
    }

    // -------------------------------------------------------------------------
    // 10. Phase 2: Anti-Copy Unit Verification & Claim Tests
    // -------------------------------------------------------------------------
    function _hashPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

    function _setupBatchWithUnits(uint32 count) internal returns (
        uint256 batchId,
        bytes32[] memory secrets,
        bytes32[] memory secretHashes,
        bytes32[] memory leaves,
        bytes32 unitsRoot
    ) {
        require(count == 2, "Helper currently generates 2 units");
        secrets = new bytes32[](2);
        secretHashes = new bytes32[](2);
        leaves = new bytes32[](2);

        secrets[0] = keccak256("secret_unit_0");
        secrets[1] = keccak256("secret_unit_1");
        secretHashes[0] = keccak256(abi.encodePacked(secrets[0]));
        secretHashes[1] = keccak256(abi.encodePacked(secrets[1]));

        vm.prank(producer);
        // We know this will be batchId 1
        batchId = 1;
        leaves[0] = keccak256(abi.encodePacked(batchId, uint32(0), secretHashes[0]));
        leaves[1] = keccak256(abi.encodePacked(batchId, uint32(1), secretHashes[1]));
        unitsRoot = _hashPair(leaves[0], leaves[1]);

        uint256 id = registry.createBatch(
            "Organic Specialty Lot",
            "Yirgacheffe, Ethiopia",
            TEST_HASH,
            count,
            "Washing Station",
            unitsRoot
        );
        assertEq(id, batchId);
    }

    function test_ClaimUnit_HappyPath() public {
        (
            uint256 batchId,
            ,
            bytes32[] memory secretHashes,
            bytes32[] memory leaves,
            
        ) = _setupBatchWithUnits(2);

        bytes32[] memory proof0 = new bytes32[](1);
        proof0[0] = leaves[1];

        assertFalse(registry.isClaimed(batchId, 0));
        assertEq(registry.claimedAt(batchId, 0), 0);
        assertTrue(registry.verifyUnit(batchId, 0, secretHashes[0], proof0));

        vm.prank(relayer);
        registry.claimUnit(batchId, 0, secretHashes[0], proof0);

        assertTrue(registry.isClaimed(batchId, 0));
        assertEq(registry.claimedAt(batchId, 0), block.timestamp);
        assertFalse(registry.isClaimed(batchId, 1));
    }

    function test_ClaimUnit_SecondClaimReverts() public {
        (
            uint256 batchId,
            ,
            bytes32[] memory secretHashes,
            bytes32[] memory leaves,
            
        ) = _setupBatchWithUnits(2);

        bytes32[] memory proof0 = new bytes32[](1);
        proof0[0] = leaves[1];

        vm.prank(relayer);
        registry.claimUnit(batchId, 0, secretHashes[0], proof0);

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.UnitAlreadyClaimed.selector, batchId, 0));
        registry.claimUnit(batchId, 0, secretHashes[0], proof0);
    }

    function test_ClaimUnit_WrongSecretReverts() public {
        (
            uint256 batchId,
            ,
            ,
            bytes32[] memory leaves,
            
        ) = _setupBatchWithUnits(2);

        bytes32[] memory proof0 = new bytes32[](1);
        proof0[0] = leaves[1];

        bytes32 fakeSecretHash = keccak256("fake_secret");

        vm.prank(relayer);
        vm.expectRevert(ProvenanceRegistry.InvalidProof.selector);
        registry.claimUnit(batchId, 0, fakeSecretHash, proof0);
    }

    function test_ClaimUnit_WrongSerialReverts() public {
        (
            uint256 batchId,
            ,
            bytes32[] memory secretHashes,
            bytes32[] memory leaves,
            
        ) = _setupBatchWithUnits(2);

        bytes32[] memory proof0 = new bytes32[](1);
        proof0[0] = leaves[1];

        // Using secretHash 0 with serial 1 should revert
        vm.prank(relayer);
        vm.expectRevert(ProvenanceRegistry.InvalidProof.selector);
        registry.claimUnit(batchId, 1, secretHashes[0], proof0);
    }

    function test_ClaimUnit_TamperedProofReverts() public {
        (
            uint256 batchId,
            ,
            bytes32[] memory secretHashes,
            ,
            
        ) = _setupBatchWithUnits(2);

        bytes32[] memory tamperedProof = new bytes32[](1);
        tamperedProof[0] = keccak256("tampered_leaf");

        vm.prank(relayer);
        vm.expectRevert(ProvenanceRegistry.InvalidProof.selector);
        registry.claimUnit(batchId, 0, secretHashes[0], tamperedProof);
    }

    function test_ClaimUnit_NonRelayerReverts() public {
        (
            uint256 batchId,
            ,
            bytes32[] memory secretHashes,
            bytes32[] memory leaves,
            
        ) = _setupBatchWithUnits(2);

        bytes32[] memory proof0 = new bytes32[](1);
        proof0[0] = leaves[1];

        vm.prank(randomUser);
        vm.expectRevert();
        registry.claimUnit(batchId, 0, secretHashes[0], proof0);
    }

    function test_ClaimUnit_RecalledBatchReverts() public {
        (
            uint256 batchId,
            ,
            bytes32[] memory secretHashes,
            bytes32[] memory leaves,
            
        ) = _setupBatchWithUnits(2);

        bytes32[] memory proof0 = new bytes32[](1);
        proof0[0] = leaves[1];

        // Recall batch as Admin
        vm.prank(admin);
        registry.recallBatch(batchId, "Emergency Safety Recall");

        vm.prank(relayer);
        vm.expectRevert();
        registry.claimUnit(batchId, 0, secretHashes[0], proof0);
    }

    function testFuzz_MerkleVerification(bytes32 secret0, bytes32 secret1) public {
        vm.assume(secret0 != bytes32(0) && secret1 != bytes32(0));
        vm.assume(secret0 != secret1);

        bytes32 secretHash0 = keccak256(abi.encodePacked(secret0));
        bytes32 secretHash1 = keccak256(abi.encodePacked(secret1));

        uint256 batchId = 1;
        bytes32 leaf0 = keccak256(abi.encodePacked(batchId, uint32(0), secretHash0));
        bytes32 leaf1 = keccak256(abi.encodePacked(batchId, uint32(1), secretHash1));
        bytes32 unitsRoot = _hashPair(leaf0, leaf1);

        vm.prank(producer);
        registry.createBatch("Coffee", "Origin", TEST_HASH, 2, "Station", unitsRoot);

        bytes32[] memory proof0 = new bytes32[](1);
        proof0[0] = leaf1;

        assertTrue(registry.verifyUnit(batchId, 0, secretHash0, proof0));
        assertFalse(registry.verifyUnit(batchId, 0, secretHash1, proof0));
    }
}
