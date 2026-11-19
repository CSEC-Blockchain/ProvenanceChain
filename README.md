# ProvenanceChain

> **Role-Based Product Authenticity & Custody Provenance on Ethereum**  
> Enforcing tamper-proof supply chain custody handovers on-chain with MetaMask, Next.js, and OpenZeppelin smart contracts. Zero database — 100% blockchain as the single source of truth.

---

## 1. System Overview

Counterfeit and adulterated products (such as single-origin specialty coffee, baby formula, olive oil, and pharmaceuticals) cost billions annually and pose serious health risks. Centralized supply chain tracking systems rely on closed databases that can be quietly altered, backdated, or fabricated by malicious insiders or compromised API credentials.

**ProvenanceChain** solves this by enforcing immutable, cryptographically signed handovers directly on the Ethereum blockchain:

1. **Role-Enforced Custody Transitions**:
   $$\text{Producer} \longrightarrow \text{Distributor} \longrightarrow \text{Retail Shop}$$
   $$\text{Producer} \longrightarrow \text{Retail Shop (Direct)}$$
   $$\text{Distributor} \longrightarrow \text{Distributor (Multi-Tier Logistics)}$$
   Any unauthorized custody transfer (e.g. Shop &rarr; Producer or random unauthorized wallet) reverts at the EVM contract level.

2. **Dual Handover Engine**:
   - **⚡ Direct Transfer**: Transfers custody and appends an immutable `CustodyEvent` to the blockchain audit trail immediately.
   - **🔐 Two-Step Transfer**: Initiates transfer and marks the batch *In Transit*. Custody and timeline events are only finalized when the designated recipient verifies and signs `acceptTransfer`.

3. **Zero-Friction Consumer Verification**:
   - Consumers scan the product QR code (`https://<domain>/v/<batchId>`) using any standard smartphone camera.
   - The page queries the blockchain directly via a public RPC client with **no MetaMask required, no wallet connection, and zero crypto needed**.
   - Displays a prominent color-coded verdict (✅ AUTHENTIC, ⚠️ CAUTION, ❌ RECALLED, ❌ NOT FOUND) and an interactive chronological audit trail.

4. **Zero Backend Database**:
   - The Ethereum smart contract is the single source of truth.
   - All product batch details, cryptographic metadata hashes, display names, and custody logs are read directly from on-chain state.

---

## 2. Live Public Testnet Deployment

ProvenanceChain is deployed on **Ethereum Sepolia Testnet**:

| Parameter | Value |
| :--- | :--- |
| **Live Web App (Vercel)** | [https://provenance-chain-mu.vercel.app](https://provenance-chain-mu.vercel.app) |
| **Smart Contract Address** | [`0x2746f2f4a94dff0a0eda7deb38446d650a9fb1a8`](https://sepolia.etherscan.io/address/0x2746f2f4a94dff0a0eda7deb38446d650a9fb1a8) |
| **Network Name** | Ethereum Sepolia Testnet |
| **Chain ID** | `11155111` |
| **Root Admin Account** | `0x6411585cE9370C91B6926B85C761f902C4443fbF` |
| **Block Explorer** | [Etherscan Sepolia](https://sepolia.etherscan.io/address/0x2746f2f4a94dff0a0eda7deb38446d650a9fb1a8) |

> [!NOTE]
> **Connecting via MetaMask**: Switch your MetaMask wallet to the **Sepolia** network (Chain ID: `11155111`). When connecting with the root deployer account (`0x6411...3fbF`), the application automatically detects and displays your **`ADMIN`** role badge in the navigation header and unlocks the `/admin` portal.

---

## 3. Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Roles ["Supply Chain Actors (MetaMask Authenticated)"]
        ADMIN["Platform Admin<br/>(DEFAULT_ADMIN_ROLE)"]
        PRODUCER["Certified Producer<br/>(PRODUCER_ROLE)"]
        DISTRIBUTOR["Logistics Distributor<br/>(DISTRIBUTOR_ROLE)"]
        SHOP["Retail Shop<br/>(SHOP_ROLE)"]
    end

    subgraph Contract ["Ethereum Smart Contract: ProvenanceRegistry.sol"]
        BATCHES[("Batches Mapping<br/>id, producer, currentHolder, status")]
        HISTORY[("Append-Only Custody Log<br/>from, to, timestamp, location")]
        NAMES[("Display Names Registry<br/>address -> string")]
        ROLES[("AccessControl RBAC<br/>Admin, Producer, Distributor, Shop")]
    end

    subgraph PublicExplorer ["Public Scan Explorer (Zero Wallet Required)"]
        PHONE["Consumer Smartphone Camera"]
        SCANPAGE["Scan Explorer (/v/[batchId])<br/>Verdict + Chronological Journey"]
    end

    ADMIN -->|grantRole & setDisplayName| ROLES
    ADMIN -->|Global Activity Feed & Recall| BATCHES
    PRODUCER -->|createBatch| BATCHES
    PRODUCER -->|transferCustody / initiateTransfer| HISTORY
    DISTRIBUTOR -->|acceptTransfer & dispatch onward| HISTORY
    SHOP -->|acceptTransfer & markSoldOut| BATCHES

    PHONE -->|Scans Package QR Code| SCANPAGE
    SCANPAGE -->|Reads On-Chain State via Viem Public Client| Contract
```

---

## 3. Supply Chain Roles & Responsibilities

| Role | Contract Identifier | Allowed Actions | Portal Route |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `DEFAULT_ADMIN_ROLE` | Grant/revoke roles, assign business display names, monitor global supply chain activities, and issue emergency safety recalls. | `/admin` |
| **PRODUCER** | `PRODUCER_ROLE` | Register new product batches on-chain, generate & download package QR code labels, and initiate custody transfers to distributors or shops. | `/producer` |
| **DISTRIBUTOR** | `DISTRIBUTOR_ROLE` | Accept incoming shipments from certified producers, dispatch shipments onward to regional distributors or licensed retail shops. | `/distributor` |
| **SHOP** | `SHOP_ROLE` | Accept incoming wholesale shipments, manage retail shelf inventory, and mark batches as Sold Out. | `/shop` |
| **CONSUMER** | *(None)* | Read-only access to verify package authenticity, inspect full unbroken custody history, and check safety alerts without any wallet. | `/v/[batchId]` |

---

## 4. Tech Stack

- **Smart Contract**: Solidity `^0.8.24`, OpenZeppelin Contracts (`AccessControl`, `Pausable`), custom errors, append-only structs.
- **Framework & Tooling**: Foundry (`anvil`, `forge`, `cast`), Viem 2, Wagmi 2.
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Lucide icons.
- **Wallet Integration**: MetaMask via injected EIP-1193 connector, automatic chain detection, and nonce desync handling.
- **Testing**: Foundry test suite (unit + fuzz testing), Vitest unit tests, Playwright end-to-end stories.

---

## 5. Local Setup & Quickstart

### Prerequisites
- Node.js `v18+` and `npm`
- Foundry CLI suite:
  ```bash
  curl -L https://foundry.paradigm.xyz | bash
  foundryup
  ```

### 1. Install Dependencies
```bash
git clone https://github.com/your-username/ProvenanceChain.git
cd ProvenanceChain
npm install
```

### 2. Start the Local Blockchain Node (Anvil)
Run Anvil with a 1-second continuous block time to auto-mine all transactions:
```bash
~/.foundry/bin/anvil --port 8545 --host 0.0.0.0 --block-time 1
```

### 3. Deploy & Seed Smart Contract
In a second terminal, seed the smart contract with demo roles, verified entities, and test batches:
```bash
npm run seed
```

### 4. Start the Web Application
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 6. Configuring MetaMask

### Adding Anvil Localhost to MetaMask
1. Open MetaMask &rarr; Click the **Network Selector** (top left).
2. Click **Add Network** &rarr; **Add a network manually**.
3. Fill in the network parameters:
   - **Network Name**: `Anvil Localhost`
   - **RPC URL**: `http://127.0.0.1:8545`
   - **Chain ID**: `31337`
   - **Currency Symbol**: `ETH`
4. Click **Save** and switch to `Anvil Localhost`.

### Adding Base Sepolia (Public Testnet)
- **Network Name**: `Base Sepolia`
- **RPC URL**: `https://sepolia.base.org`
- **Chain ID**: `84532`
- **Currency Symbol**: `ETH`
- **Block Explorer URL**: `https://sepolia.basescan.org`

> [!TIP]
> **Resolving `nonce too low` in Local Development**:  
> If you restart Anvil, MetaMask's internal transaction counter can get ahead of the chain.  
> Fix in 5 seconds: In MetaMask &rarr; **Settings** &rarr; **`</> Developer tools`** &rarr; click **`Clear activity and nonce data`** &rarr; confirm.

---

## 7. Pre-Funded Demo Wallets

The seed script pre-funds and configures the following demo accounts on Anvil:

| Role | Business Display Name | Address | Private Key |
| :--- | :--- | :--- | :--- |
| **Admin** | Platform Administrator | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| **Producer** | Sidama Coffee Co-op | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| **Distributor** | Addis Export Co. | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| **Shop** | Roast & Co. | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |

*(To test any role, open MetaMask &rarr; Import Account &rarr; paste the private key).*

---

## 8. 2-Minute Demo Evaluation Guide

### 1. Consumer Scan Explorer (No Wallet Needed)
1. Open **[http://localhost:3000/v/1](http://localhost:3000/v/1)**:
   - **Verdict**: 🟢 **VERIFIED AUTHENTIC**
   - **Custody Audit Trail**: Exactly 3 immutable events (*Sidama Coffee Co-op &rarr; Addis Export Co. &rarr; Roast & Co.*).
   - **Integrity**: *100% Complete Unbroken Custody*.
2. Open **[http://localhost:3000/v/2](http://localhost:3000/v/2)**:
   - **Verdict**: 🟡 **CAUTION ADVISED** (Product still held at producer facility).
3. Open **[http://localhost:3000/v/3](http://localhost:3000/v/3)**:
   - **Verdict**: 🔴 **PRODUCT RECALLED** with official safety notice (*"Quality seal defect detected in packaging line 4B"*).
4. Open **[http://localhost:3000/v/999](http://localhost:3000/v/999)**:
   - **Verdict**: 🔴 **COUNTERFEIT / NOT FOUND** (Batch does not exist on-chain).

### 2. Supply Chain Lifecycle with MetaMask
1. **Producer Portal (`/producer`)**:
   - Connect MetaMask with a Producer account.
   - Enter batch details: *"Organic Gesha Micro-Lot"*, Origin: *"Guji, Ethiopia"*, Units: `100`.
   - Click **Sign in MetaMask & Register Batch**.
   - Download the generated QR Code package label.
   - Click **Send Onward**, choose **⚡ Direct Transfer**, select **Addis Export Co.**, and confirm.
2. **Distributor Portal (`/distributor`)**:
   - The batch is now in custody!
   - Click **Dispatch Onward**, choose **⚡ Direct Transfer**, select **Roast & Co. (Shop)**, and confirm.
3. **Retail Shop Portal (`/shop`)**:
   - The batch is now in store inventory!
   - Click **Mark Sold Out** and confirm.
4. **Scan Again**:
   - Open `/v/<yourBatchId>`: observe the complete 3-event unbroken custody timeline and authentic verdict.

### 3. Platform Administration (`/admin`)
- Connect with Admin wallet (`0xf39F...2266` or any assigned admin).
- View the **Global Activity Feed**: inspect real-time statuses across all supply chain batches.
- Click **Recall** on any batch to broadcast an on-chain safety recall.

---

## 9. Design Decisions & Trade-Offs

### Why Blockchain?
Centralized databases (e.g. AWS RDS or Firebase) introduce single points of failure. Any administrator, corrupted script, or compromised database credential can silently overwrite records or alter timestamps. A smart contract guarantees:
- **Append-Only Immutability**: Historical custody events cannot be deleted, edited, or reordered once mined.
- **Decentralized Verification**: Consumers and regulatory bodies verify authenticity directly against the blockchain without trusting private APIs.

### Why 2-Step Handover vs Direct Handover?
- **2-Step Handover (`initiateTransfer` &rarr; `acceptTransfer`)**:  
  Prevents a malicious sender from dumping defective or hazardous inventory onto an unsuspecting recipient's address. The receiver must cryptographically acknowledge receipt before custody transfers.
- **Direct Handover (`transferCustody`)**:  
  Included for high-throughput automated scanning where physical barcode scanners or ERP integrations trigger instant custody handoffs.

---

## 10. Test Suite

Run the full automated test suite covering smart contracts, shared cryptographic utilities, and browser flows:

```bash
# 1. Run all tests
npm test

# 2. Run smart contract unit + fuzz tests (Foundry)
npm run test:contracts

# 3. Run shared Merkle/cryptographic package tests (Vitest)
npm run test:shared

# 4. Run browser end-to-end tests (Playwright)
npm run test:e2e
```
