// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ProvenanceRegistry
 * @notice Pure on-chain product authenticity and custody chain tracker.
 * @dev Enforces valid supply chain flow: Producer -> Distributor -> Shop or Producer -> Shop.
 */
contract ProvenanceRegistry is AccessControl, Pausable {
    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------
    bytes32 public constant PRODUCER_ROLE = keccak256("PRODUCER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant SHOP_ROLE = keccak256("SHOP_ROLE");

    // -------------------------------------------------------------------------
    // Handover Mode Configuration
    // -------------------------------------------------------------------------
    // Set to true for TWO_STEP handover (initiate + accept).
    // Set to false for DIRECT handover (instant transferCustody).
    bool public constant HANDOVER_MODE_TWO_STEP = true;

    // -------------------------------------------------------------------------
    // Data Types
    // -------------------------------------------------------------------------
    enum BatchStatus {
        Active,
        Recalled,
        SoldOut
    }

    struct Batch {
        uint256 id;
        address producer;
        address currentHolder;
        address pendingHolder;
        string productName;
        string origin;
        bytes32 metadataHash;
        uint32 unitCount;
        uint64 createdAt;
        BatchStatus status;
    }

    struct CustodyEvent {
        address from;
        address to;
        uint64 timestamp;
        string location;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    uint256 private _batchIdCounter;

    mapping(uint256 => Batch) private _batches;
    mapping(uint256 => CustodyEvent[]) private _history;

    /// @notice Human-readable name for each registered business entity (set by ADMIN)
    mapping(address => string) public displayName;

    // -------------------------------------------------------------------------
    // Custom Errors
    // -------------------------------------------------------------------------
    error BatchNotFound(uint256 batchId);
    error BatchNotActive(uint256 batchId, BatchStatus currentStatus);
    error BatchAlreadyRecalled(uint256 batchId);
    error UnauthorizedCaller(address caller);
    error NotPendingRecipient(address caller, address expected);
    error NoPendingTransfer(uint256 batchId);
    error InvalidRecipient(address recipient);
    error InvalidPath(address from, address to);
    error InvalidUnitCount();
    error EmptyString();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event DisplayNameUpdated(address indexed account, string name);
    event BatchCreated(
        uint256 indexed batchId,
        address indexed producer,
        string productName,
        string origin,
        bytes32 metadataHash,
        uint32 unitCount,
        uint64 createdAt
    );
    event TransferInitiated(
        uint256 indexed batchId,
        address indexed from,
        address indexed to,
        string location,
        uint64 timestamp
    );
    event TransferCancelled(uint256 indexed batchId, address indexed from);
    event CustodyTransferred(
        uint256 indexed batchId,
        address indexed from,
        address indexed to,
        string location,
        uint64 timestamp
    );
    event BatchRecalled(uint256 indexed batchId, address indexed caller, string reason);
    event BatchSoldOut(uint256 indexed batchId, address indexed shop);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address admin) {
        if (admin == address(0)) revert InvalidRecipient(address(0));
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Admin Functions
    // -------------------------------------------------------------------------
    /**
     * @notice Set or update the business display name for an address.
     */
    function setDisplayName(address account, string calldata name)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (account == address(0)) revert InvalidRecipient(address(0));
        displayName[account] = name;
        emit DisplayNameUpdated(account, name);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // -------------------------------------------------------------------------
    // Producer Functions
    // -------------------------------------------------------------------------
    /**
     * @notice Creates a new product batch with permanent on-chain custody record.
     */
    function createBatch(
        string calldata productName,
        string calldata origin,
        bytes32 metadataHash,
        uint32 unitCount,
        string calldata location
    ) external onlyRole(PRODUCER_ROLE) whenNotPaused returns (uint256) {
        if (unitCount == 0) revert InvalidUnitCount();
        if (bytes(productName).length == 0 || bytes(origin).length == 0) revert EmptyString();

        _batchIdCounter++;
        uint256 batchId = _batchIdCounter;
        uint64 nowTs = uint64(block.timestamp);

        _batches[batchId] = Batch({
            id: batchId,
            producer: msg.sender,
            currentHolder: msg.sender,
            pendingHolder: address(0),
            productName: productName,
            origin: origin,
            metadataHash: metadataHash,
            unitCount: unitCount,
            createdAt: nowTs,
            status: BatchStatus.Active
        });

        // First custody event: mint from address(0) to producer
        _history[batchId].push(CustodyEvent({
            from: address(0),
            to: msg.sender,
            timestamp: nowTs,
            location: location
        }));

        emit BatchCreated(
            batchId,
            msg.sender,
            productName,
            origin,
            metadataHash,
            unitCount,
            nowTs
        );

        emit CustodyTransferred(
            batchId,
            address(0),
            msg.sender,
            location,
            nowTs
        );

        return batchId;
    }

    // -------------------------------------------------------------------------
    // Custody Handover: TWO-STEP (Default)
    // -------------------------------------------------------------------------
    /**
     * @notice Initiates a custody handover to an allowed downstream role.
     */
    function initiateTransfer(uint256 batchId, address to, string calldata location)
        external
        whenNotPaused
    {
        Batch storage batch = _batches[batchId];
        if (batch.id == 0) revert BatchNotFound(batchId);
        if (batch.status != BatchStatus.Active) revert BatchNotActive(batchId, batch.status);
        if (batch.currentHolder != msg.sender) revert UnauthorizedCaller(msg.sender);
        if (to == address(0) || to == msg.sender) revert InvalidRecipient(to);

        // Validate allowed custody path:
        // Producer -> Distributor
        // Producer -> Shop
        // Distributor -> Shop
        _validatePath(msg.sender, to);

        batch.pendingHolder = to;
        uint64 nowTs = uint64(block.timestamp);

        emit TransferInitiated(batchId, msg.sender, to, location, nowTs);
    }

    /**
     * @notice The designated pending recipient accepts custody of the batch.
     */
    function acceptTransfer(uint256 batchId, string calldata location)
        external
        whenNotPaused
    {
        Batch storage batch = _batches[batchId];
        if (batch.id == 0) revert BatchNotFound(batchId);
        if (batch.status != BatchStatus.Active) revert BatchNotActive(batchId, batch.status);
        if (batch.pendingHolder == address(0)) revert NoPendingTransfer(batchId);
        if (batch.pendingHolder != msg.sender) revert NotPendingRecipient(msg.sender, batch.pendingHolder);

        address from = batch.currentHolder;
        batch.currentHolder = msg.sender;
        batch.pendingHolder = address(0);
        uint64 nowTs = uint64(block.timestamp);

        _history[batchId].push(CustodyEvent({
            from: from,
            to: msg.sender,
            timestamp: nowTs,
            location: location
        }));

        emit CustodyTransferred(batchId, from, msg.sender, location, nowTs);
    }

    /**
     * @notice Cancels a pending transfer before recipient accepts.
     */
    function cancelTransfer(uint256 batchId) external whenNotPaused {
        Batch storage batch = _batches[batchId];
        if (batch.id == 0) revert BatchNotFound(batchId);
        if (batch.currentHolder != msg.sender) revert UnauthorizedCaller(msg.sender);
        if (batch.pendingHolder == address(0)) revert NoPendingTransfer(batchId);

        batch.pendingHolder = address(0);
        emit TransferCancelled(batchId, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Custody Handover: DIRECT (Alternative Mode)
    // -------------------------------------------------------------------------
    /**
     * @notice Direct one-step custody handover without confirmation.
     * @dev To use this mode exclusively across the app, call transferCustody directly
     *      instead of initiateTransfer + acceptTransfer.
     */
    function transferCustody(uint256 batchId, address to, string calldata location)
        external
        whenNotPaused
    {
        Batch storage batch = _batches[batchId];
        if (batch.id == 0) revert BatchNotFound(batchId);
        if (batch.status != BatchStatus.Active) revert BatchNotActive(batchId, batch.status);
        if (batch.currentHolder != msg.sender) revert UnauthorizedCaller(msg.sender);
        if (to == address(0) || to == msg.sender) revert InvalidRecipient(to);

        _validatePath(msg.sender, to);

        address from = msg.sender;
        batch.currentHolder = to;
        batch.pendingHolder = address(0);
        uint64 nowTs = uint64(block.timestamp);

        _history[batchId].push(CustodyEvent({
            from: from,
            to: to,
            timestamp: nowTs,
            location: location
        }));

        emit CustodyTransferred(batchId, from, to, location, nowTs);
    }

    // -------------------------------------------------------------------------
    // Status Transitions
    // -------------------------------------------------------------------------
    /**
     * @notice Recalls a batch. Callable by the batch's producer or ADMIN.
     */
    function recallBatch(uint256 batchId, string calldata reason) external whenNotPaused {
        Batch storage batch = _batches[batchId];
        if (batch.id == 0) revert BatchNotFound(batchId);
        if (batch.status == BatchStatus.Recalled) revert BatchAlreadyRecalled(batchId);

        bool isAdmin = hasRole(DEFAULT_ADMIN_ROLE, msg.sender);
        bool isProducer = (batch.producer == msg.sender);
        if (!isAdmin && !isProducer) revert UnauthorizedCaller(msg.sender);

        batch.status = BatchStatus.Recalled;
        batch.pendingHolder = address(0);

        emit BatchRecalled(batchId, msg.sender, reason);
    }

    /**
     * @notice Marks a batch as sold out. Current holder must hold SHOP_ROLE.
     */
    function markSoldOut(uint256 batchId) external whenNotPaused {
        Batch storage batch = _batches[batchId];
        if (batch.id == 0) revert BatchNotFound(batchId);
        if (batch.status != BatchStatus.Active) revert BatchNotActive(batchId, batch.status);
        if (batch.currentHolder != msg.sender) revert UnauthorizedCaller(msg.sender);
        if (!hasRole(SHOP_ROLE, msg.sender)) revert UnauthorizedCaller(msg.sender);

        batch.status = BatchStatus.SoldOut;
        batch.pendingHolder = address(0);

        emit BatchSoldOut(batchId, msg.sender);
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------
    function getBatch(uint256 batchId) external view returns (Batch memory) {
        Batch memory b = _batches[batchId];
        if (b.id == 0) revert BatchNotFound(batchId);
        return b;
    }

    function getHistory(uint256 batchId) external view returns (CustodyEvent[] memory) {
        if (_batches[batchId].id == 0) revert BatchNotFound(batchId);
        return _history[batchId];
    }

    function batchCount() external view returns (uint256) {
        return _batchIdCounter;
    }

    function getRole(address account) external view returns (string memory) {
        if (hasRole(DEFAULT_ADMIN_ROLE, account)) return "ADMIN";
        if (hasRole(PRODUCER_ROLE, account)) return "PRODUCER";
        if (hasRole(DISTRIBUTOR_ROLE, account)) return "DISTRIBUTOR";
        if (hasRole(SHOP_ROLE, account)) return "SHOP";
        return "NONE";
    }

    // -------------------------------------------------------------------------
    // Internal Helper: Role-Based Path Validation
    // -------------------------------------------------------------------------
    function _validatePath(address from, address to) internal view {
        bool fromProducer = hasRole(PRODUCER_ROLE, from);
        bool fromDistributor = hasRole(DISTRIBUTOR_ROLE, from);

        bool toDistributor = hasRole(DISTRIBUTOR_ROLE, to);
        bool toShop = hasRole(SHOP_ROLE, to);

        // Allowed paths:
        // 1. Producer -> Distributor
        // 2. Producer -> Shop
        // 3. Distributor -> Shop
        if (fromProducer && (toDistributor || toShop)) {
            return;
        }
        if (fromDistributor && toShop) {
            return;
        }

        revert InvalidPath(from, to);
    }
}
