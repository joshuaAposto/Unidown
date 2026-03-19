import { resolve } from "path";
import { existsSync, chmodSync, mkdirSync, createWriteStream, unlinkSync } from "fs";
import { platform, arch } from "os";
import https from "https";
import http from "http";
import { createRequire } from "module";

// In CJS builds (e.g. Render), import.meta.url is undefined — use __filename instead.
const _require = createRequire(
  typeof __filename !== "undefined" ? __filename : import.meta.url
);

// ffmpeg-static bundles a portable ffmpeg binary that works on any platform
export const FFMPEG_BIN: string = _require("ffmpeg-static");

// Prefer the committed binary in bin/yt-dlp — it's tracked in git and works on Linux x86_64.
// Fall back to downloading fresh only if the committed binary doesn't exist.
const COMMITTED_BIN = resolve(process.cwd(), "bin/yt-dlp");
const TMP_BIN = "/tmp/ytdlp-bin/yt-dlp";

function getYtdlpUrl(): string {
  const os = platform();
  const cpu = arch();

  if (os === "win32") return "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
  if (os === "darwin") {
    return "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos";
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
  // First choice: committed binary (present in git, deployed to all environments)
  if (existsSync(COMMITTED_BIN)) {
    try { chmodSync(COMMITTED_BIN, 0o755); } catch {}
    console.log(`[binaries] Using committed yt-dlp binary: ${COMMITTED_BIN}`);
    return COMMITTED_BIN;
  }

  // Second choice: previously downloaded binary in /tmp
  if (existsSync(TMP_BIN)) {
    try { chmodSync(TMP_BIN, 0o755); } catch {}
    console.log(`[binaries] Using cached yt-dlp binary: ${TMP_BIN}`);
    return TMP_BIN;
  }

  // Last resort: download from GitHub
  console.log("[binaries] yt-dlp binary not found — downloading from GitHub...");
  const dir = "/tmp/ytdlp-bin";
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const url = getYtdlpUrl();
  console.log(`[binaries] Downloading: ${url}`);

  try {
    await download(url, TMP_BIN);
    chmodSync(TMP_BIN, 0o755);
    console.log("[binaries] yt-dlp downloaded and ready.");
  } catch (err) {
    console.error("[binaries] Failed to download yt-dlp:", err);
    throw err;
  }

  return TMP_BIN;
}
