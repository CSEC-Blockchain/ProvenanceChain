import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Universal Zero-Native Persistent Database for ProvenanceChain
 *
 * Implements the SQLite relational schema without requiring native C++ compilation (node-gyp),
 * ensuring 100% compatibility across Vercel Serverless (Node 20/22/26), Docker, and local development.
 *
 * Persists tables:
 *  - unit_proofs (batchId, serial, proof, secretHash, createdAt)
 *  - scan_analytics (batchId, serial, ipHash, country, scannedAt)
 */

export interface StoredUnitProof {
  batchId: number;
  serial: number;
  proof: string[];
  secretHash: string;
  createdAt: number;
}

export interface StoredScan {
  batchId: number;
  serial: number;
  ipHash: string;
  country: string;
  scannedAt: number;
}

interface DatabaseSchema {
  unit_proofs: Record<string, StoredUnitProof>; // key: `${batchId}:${serial}`
  scan_analytics: StoredScan[];
}

let inMemoryDb: DatabaseSchema | null = null;

function getDbFilePath(): string {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  // On Vercel / AWS Lambda, /tmp is the only writable directory
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (isServerless) {
    return path.join('/tmp', 'provenance_relayer.db.json');
  }
  return path.join(process.cwd(), 'provenance_relayer.db.json');
}

function loadDatabase(): DatabaseSchema {
  if (inMemoryDb) return inMemoryDb;

  const dbPath = getDbFilePath();
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf8');
      inMemoryDb = JSON.parse(raw);
      if (!inMemoryDb?.unit_proofs) inMemoryDb = { unit_proofs: {}, scan_analytics: [] };
      return inMemoryDb!;
    }
  } catch (err) {
    console.warn('Could not read existing database file, initializing fresh:', err);
  }

  inMemoryDb = {
    unit_proofs: {},
    scan_analytics: [],
  };
  return inMemoryDb;
}

function persistDatabase(): void {
  if (!inMemoryDb) return;
  const dbPath = getDbFilePath();
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dbPath, JSON.stringify(inMemoryDb, null, 2), 'utf8');
  } catch (err) {
    // In restricted serverless environments, write failures shouldn't crash the request
    console.warn('Failed to persist database file to disk:', err);
  }
}

export function saveUnitProofs(
  batchId: number,
  units: Array<{ serial: number; proof: string[]; secretHash: string }>
) {
  const db = loadDatabase();
  const now = Date.now();

  for (const u of units) {
    const key = `${batchId}:${u.serial}`;
    db.unit_proofs[key] = {
      batchId,
      serial: u.serial,
      proof: u.proof,
      secretHash: u.secretHash,
      createdAt: now,
    };
  }

  persistDatabase();
}

export function getUnitProof(
  batchId: number,
  serial: number
): { proof: `0x${string}`[]; secretHash: `0x${string}` } | null {
  const db = loadDatabase();
  const key = `${batchId}:${serial}`;
  const row = db.unit_proofs[key];

  if (!row) return null;

  return {
    proof: row.proof as `0x${string}`[],
    secretHash: row.secretHash as `0x${string}`,
  };
}

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT || 'provenance_salt_2026';
  return crypto.createHmac('sha256', salt).update(ip).digest('hex').slice(0, 16);
}

export function recordScan(
  batchId: number,
  serial: number,
  ip: string,
  country = 'Unknown'
): { totalScans: number; uniqueCountries: number; caution: boolean } {
  const db = loadDatabase();
  const hashedIp = hashIp(ip || '127.0.0.1');
  const now = Date.now();

  db.scan_analytics.push({
    batchId,
    serial,
    ipHash: hashedIp,
    country,
    scannedAt: now,
  });

  persistDatabase();

  return getScanStats(batchId, serial);
}

export function getScanStats(
  batchId: number,
  serial: number
): { totalScans: number; uniqueCountries: number; caution: boolean } {
  const db = loadDatabase();

  const matchingScans = db.scan_analytics.filter(
    (s) => s.batchId === batchId && s.serial === serial
  );

  const totalScans = matchingScans.length;

  const distinctCountries = new Set(
    matchingScans
      .map((s) => s.country)
      .filter((c) => c && c !== 'Unknown')
  );
  const uniqueCountries = distinctCountries.size;

  // Requirement: If more than 20 scans or scans from 3+ countries, show CAUTION
  const caution = totalScans > 20 || uniqueCountries >= 3;

  return { totalScans, uniqueCountries, caution };
}
