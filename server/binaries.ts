import { resolve } from "path";
import { existsSync, chmodSync, mkdirSync, createWriteStream, unlinkSync } from "fs";
import { platform, arch } from "os";
import https from "https";
import http from "http";
import { createRequire } from "module";

const _require = createRequire(import.meta.url);

// ffmpeg-static bundles a portable ffmpeg binary that works on any platform
export const FFMPEG_BIN: string = _require("ffmpeg-static");

const BIN_DIR = resolve(process.cwd(), "bin");
const YTDLP_PATH = resolve(BIN_DIR, "yt-dlp");

function getYtdlpUrl(): string {
  const os = platform();
  const cpu = arch();

  if (os === "win32") return "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
  if (os === "darwin") {
    return cpu === "arm64"
      ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
      : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos";
  }
  // Linux (x86_64 or arm64)
  if (cpu === "arm64" || cpu === "aarch64") {
    return "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64";
  }
  return "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
}

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (u: string, redirects = 0) => {
      if (redirects > 10) return reject(new Error("Too many redirects"));
      const client = u.startsWith("https") ? https : http;
      client.get(u, { headers: { "User-Agent": "fluxdown-app/1.0" } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} downloading yt-dlp`));
        }
        const file = createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
        file.on("error", (e) => { try { unlinkSync(dest); } catch {} reject(e); });
      }).on("error", reject);
    };
    follow(url);
  });
}

export async function ensureYtdlp(): Promise<string> {
  if (existsSync(YTDLP_PATH)) {
    try { chmodSync(YTDLP_PATH, 0o755); } catch {}
    return YTDLP_PATH;
  }

  console.log("[binaries] yt-dlp binary not found — downloading from GitHub...");
  if (!existsSync(BIN_DIR)) mkdirSync(BIN_DIR, { recursive: true });

  const url = getYtdlpUrl();
  console.log(`[binaries] Downloading: ${url}`);

  try {
    await download(url, YTDLP_PATH);
    chmodSync(YTDLP_PATH, 0o755);
    console.log("[binaries] yt-dlp downloaded and ready.");
  } catch (err) {
    console.error("[binaries] Failed to download yt-dlp:", err);
    throw err;
  }

  return YTDLP_PATH;
}
