export const CHAINS = {
  ANVIL: {
    id: 31337,
    name: 'Anvil Localhost',
    rpcUrl: 'http://127.0.0.1:8545',
  },
  BASE_SEPOLIA: {
    id: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
  },
} as const;

export const CONTRACT_ADDRESSES: Record<number, `0x${string}`> = {
  // Anvil local development address
  31337: '0x322813fd9a801c5507c9de605d63cea4f2ce6c44',
  // Base Sepolia default placeholder
  84532: '0x322813fd9a801c5507c9de605d63cea4f2ce6c44',
};

export function getContractAddress(chainId?: number): `0x${string}` {
  const envAddr = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_CONTRACT_ADDRESS : undefined;
  if (envAddr && envAddr.startsWith('0x')) {
    return envAddr as `0x${string}`;
  }
  if (chainId && CONTRACT_ADDRESSES[chainId]) {
    return CONTRACT_ADDRESSES[chainId];
  }
  return CONTRACT_ADDRESSES[31337];
}

