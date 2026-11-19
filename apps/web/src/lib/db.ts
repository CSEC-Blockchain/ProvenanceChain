import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath =
    process.env.DATABASE_PATH ||
    path.join(process.cwd(), 'provenance_relayer.db');

  dbInstance = new Database(dbPath);
  dbInstance.pragma('journal_mode = WAL');

  // Initialize tables
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS unit_proofs (
      batch_id INTEGER NOT NULL,
      serial INTEGER NOT NULL,
      proof TEXT NOT NULL,
      secret_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (batch_id, serial)
    );

    CREATE TABLE IF NOT EXISTS scan_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      serial INTEGER NOT NULL,
      ip_hash TEXT NOT NULL,
      country TEXT NOT NULL,
      scanned_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_scan_batch_serial ON scan_analytics (batch_id, serial);
  `);

  return dbInstance;
}

export interface StoredUnitProof {
  batchId: number;
  serial: number;
  proof: string[];
  secretHash: string;
}

export function saveUnitProofs(
  batchId: number,
  units: Array<{ serial: number; proof: string[]; secretHash: string }>
) {
  const db = getDatabase();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO unit_proofs (batch_id, serial, proof, secret_hash, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  const insertMany = db.transaction((items) => {
    for (const u of items) {
      insert.run(batchId, u.serial, JSON.stringify(u.proof), u.secretHash, now);
    }
  });

  insertMany(units);
}

export function getUnitProof(
  batchId: number,
  serial: number
): { proof: `0x${string}`[]; secretHash: `0x${string}` } | null {
  const db = getDatabase();
  const row = db
    .prepare(`
      SELECT proof, secret_hash FROM unit_proofs
      WHERE batch_id = ? AND serial = ?
    `)
    .get(batchId, serial) as { proof: string; secret_hash: string } | undefined;

  if (!row) return null;

  try {
    return {
      proof: JSON.parse(row.proof),
      secretHash: row.secret_hash as `0x${string}`,
    };
  } catch {
    return null;
  }
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
  const db = getDatabase();
  const hashedIp = hashIp(ip || '127.0.0.1');
  const now = Date.now();

  db.prepare(`
    INSERT INTO scan_analytics (batch_id, serial, ip_hash, country, scanned_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(batchId, serial, hashedIp, country, now);

  return getScanStats(batchId, serial);
}

export function getScanStats(
  batchId: number,
  serial: number
): { totalScans: number; uniqueCountries: number; caution: boolean } {
  const db = getDatabase();

  const totalRow = db
    .prepare(`
      SELECT COUNT(*) as count FROM scan_analytics
      WHERE batch_id = ? AND serial = ?
    `)
    .get(batchId, serial) as { count: number };

  const countryRow = db
    .prepare(`
      SELECT COUNT(DISTINCT country) as count FROM scan_analytics
      WHERE batch_id = ? AND serial = ? AND country != 'Unknown'
    `)
    .get(batchId, serial) as { count: number };

  const totalScans = totalRow?.count || 0;
  const uniqueCountries = countryRow?.count || 0;

  // Requirement: If more than 20 scans or scans from 3+ countries, show CAUTION
  const caution = totalScans > 20 || uniqueCountries >= 3;

  return { totalScans, uniqueCountries, caution };
}
