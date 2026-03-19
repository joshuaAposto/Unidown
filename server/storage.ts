import { Pool } from "pg";
import { randomUUID } from "crypto";
import type { User, InsertUser, Download, InsertDownload } from "@shared/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ip TEXT NOT NULL,
      device_id TEXT NOT NULL UNIQUE,
      first_visit TEXT NOT NULL,
      download_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS downloads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      platform TEXT NOT NULL,
      file_type TEXT,
      thumbnail TEXT,
      quality_key TEXT,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT
    );
  `);
}

initDb().catch((err) => console.error("DB init error:", err));

// ─── Storage Interface ────────────────────────────────────────────────────────

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByDeviceId(deviceId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  incrementUserDownloadCount(userId: string): Promise<void>;

  getDownload(id: string): Promise<Download | undefined>;
  getRecentDownloads(limit?: number): Promise<Download[]>;
  getUserDownloads(userId: string): Promise<Download[]>;
  createDownload(download: InsertDownload): Promise<Download>;
  updateDownloadStatus(id: string, status: Download["status"], errorMessage?: string): Promise<void>;
  deleteUserDownload(id: string, userId: string): Promise<boolean>;
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    ip: row.ip,
    deviceId: row.device_id,
    firstVisit: row.first_visit,
    downloadCount: row.download_count,
  };
}

function rowToDownload(row: any): Download {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    url: row.url,
    title: row.title,
    platform: row.platform,
    fileType: row.file_type ?? undefined,
    thumbnail: row.thumbnail ?? undefined,
    qualityKey: row.quality_key ?? undefined,
    timestamp: row.timestamp,
    status: row.status as Download["status"],
    errorMessage: row.error_message ?? undefined,
  };
}

// ─── PostgreSQL Storage ───────────────────────────────────────────────────────

class PgStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return rows[0] ? rowToUser(rows[0]) : undefined;
  }

  async getUserByDeviceId(deviceId: string): Promise<User | undefined> {
    const { rows } = await pool.query("SELECT * FROM users WHERE device_id = $1", [deviceId]);
    return rows[0] ? rowToUser(rows[0]) : undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const firstVisit = new Date().toISOString();
    const { rows } = await pool.query(
      `INSERT INTO users (id, name, ip, device_id, first_visit, download_count)
       VALUES ($1, $2, $3, $4, $5, 0)
       RETURNING *`,
      [id, insertUser.name, insertUser.ip, insertUser.deviceId, firstVisit]
    );
    return rowToUser(rows[0]);
  }

  async incrementUserDownloadCount(userId: string): Promise<void> {
    await pool.query(
      "UPDATE users SET download_count = download_count + 1 WHERE id = $1",
      [userId]
    );
  }

  async getDownload(id: string): Promise<Download | undefined> {
    const { rows } = await pool.query("SELECT * FROM downloads WHERE id = $1", [id]);
    return rows[0] ? rowToDownload(rows[0]) : undefined;
  }

  async getRecentDownloads(limit = 20): Promise<Download[]> {
    const { rows } = await pool.query(
      "SELECT * FROM downloads WHERE status = 'completed' ORDER BY timestamp DESC LIMIT $1",
      [limit]
    );
    return rows.map(rowToDownload);
  }

  async getUserDownloads(userId: string): Promise<Download[]> {
    const { rows } = await pool.query(
      "SELECT * FROM downloads WHERE user_id = $1 ORDER BY timestamp DESC",
      [userId]
    );
    return rows.map(rowToDownload);
  }

  async createDownload(insertDownload: InsertDownload): Promise<Download> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const { rows } = await pool.query(
      `INSERT INTO downloads (id, user_id, user_name, url, title, platform, file_type, thumbnail, quality_key, timestamp, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
       RETURNING *`,
      [
        id,
        insertDownload.userId,
        insertDownload.userName,
        insertDownload.url,
        insertDownload.title,
        insertDownload.platform,
        insertDownload.fileType ?? null,
        insertDownload.thumbnail ?? null,
        insertDownload.qualityKey ?? null,
        timestamp,
      ]
    );
    return rowToDownload(rows[0]);
  }

  async updateDownloadStatus(id: string, status: Download["status"], errorMessage?: string): Promise<void> {
    await pool.query(
      "UPDATE downloads SET status = $1, error_message = $2 WHERE id = $3",
      [status, errorMessage ?? null, id]
    );
  }

  async deleteUserDownload(id: string, userId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      "DELETE FROM downloads WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    return (rowCount ?? 0) > 0;
  }
}

export const storage = new PgStorage();
