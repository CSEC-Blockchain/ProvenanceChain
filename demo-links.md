# ProvenanceChain Demo Links

## Smart Contract Details
- **Address**: `0x322813fd9a801c5507c9de605d63cea4f2ce6c44`
- **Network**: Anvil Localhost (`http://127.0.0.1:8545`, Chain ID: `31337`)
- **Deployer/Admin**: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

---

## 1. Public Consumer Scan Pages (Zero Wallet, Reads Chain Directly)
- **Batch #1 (VERIFIED AUTHENTIC)**:
  👉 [http://localhost:3000/v/1](http://localhost:3000/v/1)
  *Full 3-step unbroken custody chain: Sidama Coffee Co-op &rarr; Addis Export Co. &rarr; Roast & Co.*

- **Batch #2 (CAUTION - Stuck at Producer)**:
  👉 [http://localhost:3000/v/2](http://localhost:3000/v/2)
  *Caution alert: batch has not reached a verified shop holder.*

- **Batch #3 (RECALLED - Safety Alert)**:
  👉 [http://localhost:3000/v/3](http://localhost:3000/v/3)
  *Recalled banner with official reason: "Quality seal defect detected in packaging line 4B".*

- **Batch #999 (NOT FOUND)**:
  👉 [http://localhost:3000/v/999](http://localhost:3000/v/999)
  *Counterfeit / unrecognized product code.*

---

## 2. Role-Based Business Portals (MetaMask Required)
- **/producer**: [http://localhost:3000/producer](http://localhost:3000/producer) - Register batches & initiate transfer
- **/distributor**: [http://localhost:3000/distributor](http://localhost:3000/distributor) - Accept incoming & send to shops
- **/shop**: [http://localhost:3000/shop](http://localhost:3000/shop) - Accept incoming & mark sold out
- **/admin**: [http://localhost:3000/admin](http://localhost:3000/admin) - Grant/revoke roles & set business display names

---

## 3. Demo Wallets (Anvil Pre-Funded Private Keys)
- **Admin**: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` (`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`)
- **Producer (Sidama Coffee Co-op)**: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` (`0x70997970C51812dc3A010C7d01b50e0d17dc79C8`)
- **Distributor (Addis Export Co.)**: `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` (`0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`)
- **Shop (Roast & Co.)**: `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` (`0x90F79bf6EB2c4f870365E785982E1f101E93b906`)
