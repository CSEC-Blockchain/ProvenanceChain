import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  defineChain,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ProvenanceRegistryABI } from '../packages/shared/src/abi';
import * as fs from 'fs';
import * as path from 'path';

const anvilChain = defineChain({
  id: 31337,
  name: 'Anvil Localhost',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
});

// Standard Anvil test accounts
const ACCOUNTS = {
  admin: {
    name: 'Platform Administrator',
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Hex,
    key: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex,
  },
  producer: {
    name: 'Sidama Coffee Co-op',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Hex,
    key: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as Hex,
  },
  distributor: {
    name: 'Addis Export Co.',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as Hex,
    key: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' as Hex,
  },
  shop: {
    name: 'Roast & Co.',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' as Hex,
    key: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' as Hex,
  },
};

async function main() {
  console.log('====================================================');
  console.log('   PROVENANCECHAIN: SMART CONTRACT SEED ENGINE      ');
  console.log('====================================================\n');

  const rpc = 'http://127.0.0.1:8545';
  const transport = http(rpc);
  const publicClient = createPublicClient({ chain: anvilChain, transport });

  const adminAccount = privateKeyToAccount(ACCOUNTS.admin.key);
  const producerAccount = privateKeyToAccount(ACCOUNTS.producer.key);
  const distributorAccount = privateKeyToAccount(ACCOUNTS.distributor.key);
  const shopAccount = privateKeyToAccount(ACCOUNTS.shop.key);

  const adminWallet = createWalletClient({ account: adminAccount, chain: anvilChain, transport });
  const producerWallet = createWalletClient({ account: producerAccount, chain: anvilChain, transport });
  const distributorWallet = createWalletClient({ account: distributorAccount, chain: anvilChain, transport });
  const shopWallet = createWalletClient({ account: shopAccount, chain: anvilChain, transport });

  // 1. Deploy Smart Contract
  console.log('1. Deploying ProvenanceRegistry smart contract...');
  const artifactPath = path.resolve(
    process.cwd(),
    'contracts/out/ProvenanceRegistry.sol/ProvenanceRegistry.json'
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  const deployHash = await adminWallet.deployContract({
    abi: ProvenanceRegistryABI,
    bytecode: artifact.bytecode.object as Hex,
    args: [ACCOUNTS.admin.address],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const contractAddress = receipt.contractAddress!;
  console.log(`   ProvenanceRegistry deployed at: ${contractAddress}`);

  // 2. Grant Roles & Set Display Names
  console.log('2. Granting on-chain roles & setting display names...');
  const PRODUCER_ROLE = keccak256(toHex('PRODUCER_ROLE'));
  const DISTRIBUTOR_ROLE = keccak256(toHex('DISTRIBUTOR_ROLE'));
  const SHOP_ROLE = keccak256(toHex('SHOP_ROLE'));

  await adminWallet.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'grantRole',
    args: [PRODUCER_ROLE, ACCOUNTS.producer.address],
  });
  await adminWallet.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'setDisplayName',
    args: [ACCOUNTS.producer.address, ACCOUNTS.producer.name],
  });

  await adminWallet.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'grantRole',
    args: [DISTRIBUTOR_ROLE, ACCOUNTS.distributor.address],
  });
  await adminWallet.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'setDisplayName',
    args: [ACCOUNTS.distributor.address, ACCOUNTS.distributor.name],
  });

  await adminWallet.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'grantRole',
    args: [SHOP_ROLE, ACCOUNTS.shop.address],
  });
  await adminWallet.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'setDisplayName',
    args: [ACCOUNTS.shop.address, ACCOUNTS.shop.name],
  });

  // Also pre-fund and grant roles to common MetaMask test address if desired
  const commonMetaMask = '0x6411585ce9378c91b6926b85c761f902c4443fbf' as Hex;
  await adminWallet.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'grantRole',
    args: [PRODUCER_ROLE, commonMetaMask],
  });
  await adminWallet.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'grantRole',
    args: [DISTRIBUTOR_ROLE, commonMetaMask],
  });
  await adminWallet.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'grantRole',
    args: [SHOP_ROLE, commonMetaMask],
  });
  await adminWallet.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'setDisplayName',
    args: [commonMetaMask, 'Verified Business Partner'],
  });
  await adminWallet.sendTransaction({
    to: commonMetaMask,
    value: BigInt('20000000000000000000'), // 20 ETH
  });

  // Update .env files
  const envContent = `NEXT_PUBLIC_RPC_URL="http://127.0.0.1:8545"
NEXT_PUBLIC_CHAIN_ID="31337"
NEXT_PUBLIC_CONTRACT_ADDRESS="${contractAddress}"
SPONSOR_PRIVATE_KEY="${ACCOUNTS.admin.key}"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
`;
  fs.writeFileSync('.env', envContent);
  if (fs.existsSync('apps/web')) {
    fs.writeFileSync('apps/web/.env', envContent);
  }

  // 3. Create Batch #1 (Authentic: Producer -> Distributor -> Shop)
  console.log('3. Creating Batch #1: Specialty Coffee (50 units, complete journey)...');
  const metadata1 = {
    productName: 'Sidama Single Origin Heirloom',
    origin: 'Sidama, Ethiopia',
    harvestDate: 'November 2026',
    elevation: '2,100m',
    process: 'Natural Washed',
  };
  const hash1 = keccak256(toHex(JSON.stringify(metadata1)));

  await producerWallet.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'createBatch',
    args: ['Sidama Single Origin Heirloom', 'Sidama, Ethiopia', hash1, 50, 'Sidama Washing Station'],
  });

  // Producer -> Distributor
  await producerWallet.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'initiateTransfer',
    args: [BigInt(1), ACCOUNTS.distributor.address, 'Bole Cargo Freight Terminal'],
  });
  await distributorWallet.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'acceptTransfer',
    args: [BigInt(1), 'Addis Central Export Warehouse'],
  });

  // Distributor -> Shop
  await distributorWallet.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'initiateTransfer',
    args: [BigInt(1), ACCOUNTS.shop.address, 'Addis Distribution Hub'],
  });
  await shopWallet.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'acceptTransfer',
    args: [BigInt(1), 'Downtown Coffee Bar - Retail Store'],
  });

  // 4. Create Batch #2 (Caution Example: stays at Producer)
  console.log('4. Creating Batch #2: Sidama Reserve (20 units, Caution: stuck at Producer)...');
  const hash2 = keccak256(toHex('batch-2-caution-example'));
  await producerWallet.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'createBatch',
    args: ['Sidama Reserve Microlot', 'Yirgacheffe, Ethiopia', hash2, 20, 'Highland Processing Mill'],
  });

  // 5. Create Batch #3 (Recalled Example)
  console.log('5. Creating Batch #3: Baby Formula (100 units, Recalled)...');
  const hash3 = keccak256(toHex('batch-3-recalled-formula'));
  await producerWallet.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'createBatch',
    args: ['Organic Infant Formula Stage 1', 'Waikato, New Zealand', hash3, 100, 'Hamilton Dairy Plant'],
  });
  await producerWallet.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'recallBatch',
    args: [BigInt(3), 'Quality seal defect detected in packaging line 4B'],
  });

  // Write demo-links.md
  const demoLinksContent = `# ProvenanceChain Demo Links

## Smart Contract Details
- **Address**: \`${contractAddress}\`
- **Network**: Anvil Localhost (\`http://127.0.0.1:8545\`, Chain ID: \`31337\`)
- **Deployer/Admin**: \`${ACCOUNTS.admin.address}\`

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
- **Admin**: \`${ACCOUNTS.admin.key}\` (\`${ACCOUNTS.admin.address}\`)
- **Producer (Sidama Coffee Co-op)**: \`${ACCOUNTS.producer.key}\` (\`${ACCOUNTS.producer.address}\`)
- **Distributor (Addis Export Co.)**: \`${ACCOUNTS.distributor.key}\` (\`${ACCOUNTS.distributor.address}\`)
- **Shop (Roast & Co.)**: \`${ACCOUNTS.shop.key}\` (\`${ACCOUNTS.shop.address}\`)
`;

  fs.writeFileSync('demo-links.md', demoLinksContent);
  console.log('\n====================================================');
  console.log('   DEMO SCENARIOS SEEDED & READY                    ');
  console.log('====================================================');
  console.log('1. AUTHENTIC (Green):   http://localhost:3000/v/1');
  console.log('2. CAUTION (Amber):     http://localhost:3000/v/2');
  console.log('3. RECALLED (Red):      http://localhost:3000/v/3');
  console.log('4. NOT FOUND (Red):     http://localhost:3000/v/999');
  console.log('====================================================\n');
  console.log('Wrote demo links to demo-links.md');
}

main().catch(console.error);
