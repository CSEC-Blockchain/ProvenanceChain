import { createWalletClient, createPublicClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { activeChain, anvilChain, sepoliaChain, baseSepoliaChain } from './wagmi';
import { getContractAddress, ProvenanceRegistryABI } from './viem';

export function getRelayerAccount() {
  const pk =
    process.env.RELAYER_PRIVATE_KEY ||
    process.env.SPONSOR_PRIVATE_KEY ||
    (activeChain.id === 11155111
      ? '0xcfc6355ab811df498c5ba33448b2cdb01e283af3b3eb34ffe495404631197da5'
      : '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

  const cleanPk = pk.startsWith('0x') ? (pk as Hex) : (`0x${pk}` as Hex);
  return privateKeyToAccount(cleanPk);
}

export function getRelayerWalletClient() {
  const account = getRelayerAccount();
  const transportUrl =
    process.env.NEXT_PUBLIC_RPC_URL ||
    (activeChain.id === 11155111
      ? 'https://ethereum-sepolia-rpc.publicnode.com'
      : 'http://127.0.0.1:8545');

  return createWalletClient({
    account,
    chain: activeChain,
    transport: http(transportUrl),
  });
}

export async function submitClaimUnitOnChain(
  batchId: number,
  serial: number,
  secretHash: `0x${string}`,
  proof: `0x${string}`[]
): Promise<`0x${string}`> {
  const walletClient = getRelayerWalletClient();
  const contractAddress = getContractAddress();

  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi: ProvenanceRegistryABI,
    functionName: 'claimUnit',
    args: [BigInt(batchId), serial, secretHash, proof],
  });

  return hash;
}
