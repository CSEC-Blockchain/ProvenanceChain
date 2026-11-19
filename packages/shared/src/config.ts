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
  SEPOLIA: {
    id: 11155111,
    name: 'Sepolia',
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    blockExplorer: 'https://sepolia.etherscan.io',
  },
} as const;

export const CONTRACT_ADDRESSES: Record<number, `0x${string}`> = {
  // Anvil local development address
  31337: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
  // Base Sepolia default placeholder
  84532: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
  // Ethereum Sepolia deployed address
  11155111: '0x2746f2f4a94dff0a0eda7deb38446d650a9fb1a8',
};

export function getContractAddress(chainId?: number): `0x${string}` {
  const envAddr = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_CONTRACT_ADDRESS : undefined;
  if (envAddr && typeof envAddr === 'string' && envAddr.startsWith('0x')) {
    return envAddr as `0x${string}`;
  }
  if (chainId && CONTRACT_ADDRESSES[chainId]) {
    return CONTRACT_ADDRESSES[chainId];
  }
  return CONTRACT_ADDRESSES[31337];
}

