import { createPublicClient, createWalletClient, http, parseEther, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const anvilChain = defineChain({
  id: 31337,
  name: 'Anvil Localhost',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
});

export async function fundWallets() {
  const rpc = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
  const publicClient = createPublicClient({ chain: anvilChain, transport: http(rpc) });

  const sponsorKey = (process.env.SPONSOR_PRIVATE_KEY ||
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as `0x${string}`;

  const sponsorAccount = privateKeyToAccount(sponsorKey);
  const walletClient = createWalletClient({
    account: sponsorAccount,
    chain: anvilChain,
    transport: http(rpc),
  });

  const targets = [
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Producer
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Distributor
    '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Shop
    '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', // Verifier
  ];

  console.log('--- Funding Business Wallets from Gas Faucet ---');
  for (const target of targets) {
    const bal = await publicClient.getBalance({ address: target as `0x${string}` });
    if (bal < parseEther('0.1')) {
      const hash = await walletClient.sendTransaction({
        to: target as `0x${string}`,
        value: parseEther('1.0'),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`Funded ${target} with 1.0 ETH (tx: ${hash})`);
    } else {
      console.log(`${target} already funded (${bal} wei)`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fundWallets()
    .then(() => console.log('Wallet funding complete.'))
    .catch(console.error);
}

