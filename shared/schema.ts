import { z } from "zod";

// ─── User ───────────────────────────────────────────────────────────────────

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  ip: z.string(),
  deviceId: z.string(),
  firstVisit: z.string(),
  downloadCount: z.number().default(0),
});

export const insertUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  ip: z.string(),
  deviceId: z.string(),
});

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

// ─── Download ────────────────────────────────────────────────────────────────

export const downloadSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  url: z.string(),
  title: z.string(),
  platform: z.string(),
  fileType: z.string().optional(),
  thumbnail: z.string().optional(),
  qualityKey: z.string().optional(),
  timestamp: z.string(),
  status: z.enum(["pending", "completed", "error"]),
  errorMessage: z.string().optional(),
});

export const insertDownloadSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  url: z.string().url("Please enter a valid URL"),
  title: z.string(),
  platform: z.string(),
  fileType: z.string().optional(),
  thumbnail: z.string().optional(),
  qualityKey: z.string().optional(),
});

export type Download = z.infer<typeof downloadSchema>;
export type InsertDownload = z.infer<typeof insertDownloadSchema>;

// ─── Database Shape ───────────────────────────────────────────────────────────

export interface Database {
  users: User[];
  downloads: Download[];
}

// ─── Quality Options ──────────────────────────────────────────────────────────

export interface QualityOption {
  key: string;
  label: string;
  sublabel: string;
  ext: string;
  formatStr: string;
}

// ─── URL Info ─────────────────────────────────────────────────────────────────

export interface UrlInfo {
  title: string;
  platform: string;
  thumbnail?: string;
  fileType?: string;
  downloadable: boolean;
  duration?: number;
  uploader?: string;
  qualities: QualityOption[];
  isDirectFile?: boolean;
}

// ─── Request types ────────────────────────────────────────────────────────────

export interface RegisterUserRequest {
  name: string;
  deviceId: string;
}

export interface AnalyzeUrlRequest {
  url: string;
}
