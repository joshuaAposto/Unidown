import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";
import type { QualityOption } from "@shared/schema";
import axios from "axios";
import { resolve } from "path";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import { createReadStream, unlink, existsSync } from "fs";
import { randomUUID } from "crypto";
import { ensureYtdlp, FFMPEG_BIN } from "./binaries";

const execFileAsync = promisify(execFile);
let YTDLP_BIN = resolve(process.cwd(), "bin/yt-dlp");
const AXIOS_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const IG_MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram/314.0.0.0.0";

// In-memory cache: downloadId → { formatStr, qualityKey }
const downloadFormatCache = new Map<string, { formatStr: string; qualityKey: string }>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function detectPlatform(url: string): string {
  if (/youtube\.com|youtu\.be/i.test(url)) return "YouTube";
  if (/tiktok\.com|vm\.tiktok\.com/i.test(url)) return "TikTok";
  if (/facebook\.com|fb\.watch|fb\.com/i.test(url)) return "Facebook";
  if (/instagram\.com/i.test(url)) return "Instagram";
  if (/twitter\.com|x\.com/i.test(url)) return "Twitter/X";
  if (/vimeo\.com/i.test(url)) return "Vimeo";
  if (/soundcloud\.com/i.test(url)) return "SoundCloud";
  if (/reddit\.com/i.test(url)) return "Reddit";
  if (/dailymotion\.com/i.test(url)) return "Dailymotion";
  if (/twitch\.tv/i.test(url)) return "Twitch";
  if (/bilibili\.com/i.test(url)) return "Bilibili";
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext && ["mp4", "avi", "mkv", "mov", "webm"].includes(ext)) return "Direct Video";
  if (ext && ["mp3", "wav", "flac", "aac", "ogg"].includes(ext)) return "Direct Audio";
  if (ext && ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "Image";
  if (ext && ["pdf", "doc", "docx"].includes(ext)) return "Document";
  if (ext && ["zip", "tar", "gz", "rar"].includes(ext)) return "Archive";
  return "Direct Link";
}

// ─── TikTok via tikwm.com API ─────────────────────────────────────────────────

async function tikwmFetch(url: string): Promise<any> {
  const apiUrl = `https://tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
  const res = await axios.get(apiUrl, {
    timeout: 12000,
    headers: { "User-Agent": AXIOS_UA },
  });
  const body = res.data;
  if (!body || body.code !== 0 || !body.data) {
    throw new Error(body?.msg || "TikTok API failed");
  }
  return body.data;
}

async function analyzeTikTok(url: string, platform: string): Promise<any> {
  const data = await tikwmFetch(url);
  const qualities: QualityOption[] = [];

  if (data.hdplay) {
    qualities.push({ key: "hd", label: "HD MP4", sublabel: "No watermark", ext: "mp4", formatStr: "tiktok_hd" });
  }
  if (data.play) {
    qualities.push({ key: "sd", label: "SD MP4", sublabel: "No watermark", ext: "mp4", formatStr: "tiktok_sd" });
  }
  if (data.music) {
    qualities.push({ key: "audio", label: "MP3", sublabel: "Background audio", ext: "mp3", formatStr: "tiktok_audio" });
  }

  return {
    title: data.title || "TikTok Video",
    platform,
    thumbnail: data.cover,
    downloadable: true,
    duration: data.duration,
    uploader: data.author?.nickname || data.author?.unique_id,
    qualities,
  };
}

// ─── Instagram via page scraping (facebookexternalhit UA exposes og:video) ────

async function analyzeInstagram(url: string, platform: string): Promise<any> {
  const FB_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
  const res = await axios.get(url, {
    timeout: 15000,
    headers: { "User-Agent": FB_UA, "Accept-Language": "en-US,en;q=0.9" },
    validateStatus: () => true,
  });
  const html: string = res.data || "";

  const decodeHtmlEntities = (s: string) =>
    s.replace(/&amp;/g, "&")
     .replace(/&#x2F;/g, "/")
     .replace(/&#x3A;/g, ":")
     .replace(/&#x3D;/g, "=")
     .replace(/&#x2B;/g, "+")
     .replace(/&lt;/g, "<")
     .replace(/&gt;/g, ">")
     .replace(/&quot;/g, '"');

  const getContent = (prop: string): string => {
    const match = html.match(new RegExp(`property="${prop}"[^>]*content="([^"]*)"`, "i"))
      || html.match(new RegExp(`name="${prop}"[^>]*content="([^"]*)"`, "i"));
    return match ? decodeHtmlEntities(match[1]) : "";
  };

  const videoUrl = getContent("og:video:secure_url") || getContent("og:video");
  const thumbnail = getContent("og:image");
  const rawTitle = getContent("og:title");
  const title = rawTitle
    ? rawTitle.replace(/&#xae;/gi, "®").replace(/&#x2019;/gi, "'").replace(/&quot;/gi, '"').replace(/&amp;/gi, "&").trim()
    : "Instagram Video";

  if (!videoUrl) throw new Error("No video found on this Instagram page");

  const qualities: QualityOption[] = [
    {
      key: "hd",
      label: "HD MP4",
      sublabel: "Best quality",
      ext: "mp4",
      formatStr: `instagram_direct:${videoUrl}`,
    },
    {
      key: "audio",
      label: "MP3",
      sublabel: "Audio only",
      ext: "mp3",
      formatStr: `instagram_audio:${videoUrl}`,
    },
  ];

  return { title, platform, thumbnail, downloadable: true, qualities };
}

// ─── yt-dlp for other platforms ───────────────────────────────────────────────

async function resolveRedirect(url: string): Promise<string> {
  try {
    const res = await axios.head(url, {
      timeout: 8000,
      maxRedirects: 10,
      headers: { "User-Agent": AXIOS_UA },
      validateStatus: () => true,
    });
    const finalUrl: string = (res.request as any)?.res?.responseUrl || (res.config as any)?.url || url;
    return finalUrl;
  } catch {
    try {
      const res2 = await axios.get(url, {
        timeout: 8000,
        maxRedirects: 10,
        headers: { "User-Agent": AXIOS_UA },
        responseType: "stream",
        validateStatus: () => true,
      });
      const finalUrl: string = (res2.request as any)?.res?.responseUrl || (res2.config as any)?.url || url;
      res2.data.destroy();
      return finalUrl;
    } catch {
      return url;
    }
  }
}

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function ytdlpGetInfo(url: string): Promise<any> {
  const { stdout } = await execFileAsync(
    YTDLP_BIN,
    [
      "--dump-json",
      "--no-playlist",
      "--no-warnings",
      "--user-agent", AXIOS_UA,
      url,
    ],
    { timeout: 45000, maxBuffer: 10 * 1024 * 1024 }
  );
  return JSON.parse(stdout.trim());
}

function buildQualitiesFromYtdlp(info: any): QualityOption[] {
  const formats: any[] = info.formats || [];

  // Detect image-only content (e.g. Twitter image tweets)
  const imageExts = new Set(["jpg", "jpeg", "png", "gif", "webp"]);
  const videoFormats = formats.filter((f: any) => f.height && f.height > 0);
  const imageFormats = formats.filter((f: any) => f.ext && imageExts.has(f.ext.toLowerCase()) && f.url);

  if (imageFormats.length > 0 && videoFormats.length === 0) {
    return imageFormats.map((f: any, idx: number) => ({
      key: idx === 0 ? "image" : `image_${idx}`,
      label: imageFormats.length > 1 ? `Image ${idx + 1}` : "Download Image",
      sublabel: (f.ext || "image").toUpperCase(),
      ext: f.ext || "jpg",
      formatStr: `direct_image:${f.url}`,
    }));
  }

  const isAudioOnly = formats.every((f: any) => !f.height || f.height === 0);
  const qualities: QualityOption[] = [];

  const hasHD  = formats.some((f: any) => f.height && f.height >= 720);
  const hasSD  = formats.some((f: any) => f.height && f.height >= 240 && f.height <= 480);
  const hasAud = formats.some((f: any) => f.acodec && f.acodec !== "none");

  if (!isAudioOnly) {
    if (hasHD) {
      qualities.push({
        key: "hd", label: "HD MP4", sublabel: "720p–1080p", ext: "mp4",
        formatStr: "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
      });
    }
    if (hasSD) {
      qualities.push({
        key: "sd", label: "SD MP4", sublabel: "360p–480p", ext: "mp4",
        formatStr: "bestvideo[ext=mp4][height<=480]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]/worst",
      });
    }
    if (!hasHD && !hasSD) {
      qualities.push({
        key: "best", label: "Best MP4", sublabel: "Best available", ext: "mp4",
        formatStr: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      });
    }
  }

  if (hasAud) {
    qualities.push({
      key: "audio", label: "MP3", sublabel: "Audio only", ext: "mp3",
      formatStr: "bestaudio/best",
    });
  }

  return qualities;
}

// ─── Direct file fallback ─────────────────────────────────────────────────────

async function analyzeDirectFile(url: string, platform: string): Promise<any> {
  const headRes = await axios.head(url, {
    timeout: 6000,
    headers: { "User-Agent": AXIOS_UA },
  }).catch(() => null);

  const ct = headRes?.headers?.["content-type"] || "";
  const cd = headRes?.headers?.["content-disposition"] || "";

  let fileType = "file";
  if (ct.includes("video")) fileType = "video";
  else if (ct.includes("audio")) fileType = "audio";
  else if (ct.includes("image")) fileType = "image";
  else if (ct.includes("pdf")) fileType = "pdf";
  else if (ct.includes("zip") || ct.includes("octet-stream")) fileType = "archive";

  let title = "Unknown File";
  const dispMatch = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  if (dispMatch) title = dispMatch[1].replace(/['"]/g, "");
  else {
    try { title = decodeURIComponent(new URL(url).pathname.split("/").pop() || "file") || "Unknown File"; } catch {}
  }

  return {
    title,
    platform,
    fileType,
    downloadable: headRes !== null,
    isDirectFile: true,
    qualities: [
      {
        key: "best",
        label: "Download",
        sublabel: fileType.toUpperCase(),
        ext: fileType === "audio" ? "mp3" : fileType === "image" ? "jpg" : "file",
        formatStr: "direct",
      },
    ],
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Ensure yt-dlp binary is present (downloads from GitHub if not found, e.g. on Render)
  YTDLP_BIN = await ensureYtdlp();
  console.log(`[routes] yt-dlp: ${YTDLP_BIN}`);
  console.log(`[routes] ffmpeg: ${FFMPEG_BIN}`);

  // Register / retrieve user
  app.post("/api/users/register", async (req: Request, res: Response) => {
    try {
      const body = insertUserSchema.parse({
        name: req.body.name,
        ip: getClientIp(req),
        deviceId: req.body.deviceId,
      });
      let user = await storage.getUserByDeviceId(body.deviceId);
      if (!user) user = await storage.createUser(body);
      res.json({ success: true, user });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get("/api/users/by-device/:deviceId", async (req: Request, res: Response) => {
    const user = await storage.getUserByDeviceId(req.params.deviceId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  });

  app.get("/api/users/:id", async (req: Request, res: Response) => {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  });

  // ─── Analyze URL ────────────────────────────────────────────────────────────

  app.post("/api/analyze", async (req: Request, res: Response) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });
    try { new URL(url); } catch { return res.status(400).json({ error: "Invalid URL" }); }

    const platform = detectPlatform(url);

    // 1️⃣ TikTok → tikwm.com API
    if (platform === "TikTok") {
      try {
        const info = await analyzeTikTok(url, platform);
        return res.json(info);
      } catch (e: any) {
        console.error("TikTok API error:", e.message);
        return res.status(400).json({ error: "Could not fetch TikTok video. Make sure it's a public video URL." });
      }
    }

    // 1b️⃣ Instagram → page scraping (facebookexternalhit UA)
    if (platform === "Instagram") {
      try {
        const info = await analyzeInstagram(url, platform);
        return res.json(info);
      } catch (e: any) {
        console.error("Instagram scrape error:", e.message);
        return res.status(400).json({ error: "Could not fetch Instagram video. Make sure it's a public post URL." });
      }
    }

    // 2️⃣ Other media platforms → yt-dlp
    const directExtensions = /\.(mp4|mp3|wav|flac|aac|ogg|avi|mkv|mov|webm|jpg|jpeg|png|gif|webp|pdf|zip|tar|gz|rar|doc|docx)(\?|$)/i;
    if (!directExtensions.test(url)) {
      try {
        // Resolve short/redirect links before passing to yt-dlp
        let resolvedUrl = url;
        const isShortLink = /on\.soundcloud\.com|bit\.ly|tinyurl|t\.co|fb\.watch|vm\.tiktok/i.test(url);
        if (isShortLink) {
          resolvedUrl = await resolveRedirect(url);
        }
        const info = await ytdlpGetInfo(resolvedUrl);
        const qualities = buildQualitiesFromYtdlp(info);
        return res.json({
          title: info.title || info.fulltitle || "Untitled",
          platform: detectPlatform(resolvedUrl) || platform,
          thumbnail: info.thumbnail,
          downloadable: true,
          duration: info.duration,
          uploader: info.uploader || info.channel || info.creator,
          qualities: qualities.length > 0 ? qualities : [
            { key: "best", label: "Download", sublabel: "Best available", ext: "mp4", formatStr: "best" },
          ],
          resolvedUrl: resolvedUrl !== url ? resolvedUrl : undefined,
        });
      } catch (e: any) {
        // yt-dlp failed — for YouTube/known video platforms still use yt-dlp for download
        const isYouTubeUrl = /youtube\.com|youtu\.be/i.test(url);
        if (isYouTubeUrl) {
          console.error("yt-dlp info failed for YouTube, using default qualities:", e.message);
          const ytId = extractYouTubeId(url);
          const thumbnail = ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : undefined;
          return res.json({
            title: "YouTube Video",
            platform: "YouTube",
            thumbnail,
            downloadable: true,
            qualities: [
              {
                key: "hd",
                label: "HD MP4",
                sublabel: "720p–1080p",
                ext: "mp4",
                formatStr: "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
              },
              {
                key: "sd",
                label: "SD MP4",
                sublabel: "360p–480p",
                ext: "mp4",
                formatStr: "bestvideo[ext=mp4][height<=480]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]/worst",
              },
              {
                key: "audio",
                label: "MP3",
                sublabel: "Audio only",
                ext: "mp3",
                formatStr: "bestaudio/best",
              },
            ],
          });
        }
        // yt-dlp failed — try direct file fallback
      }
    }

    // 3️⃣ Direct file / unknown link
    const directInfo = await analyzeDirectFile(url, platform);
    return res.json(directInfo);
  });

  // ─── Record download ────────────────────────────────────────────────────────

  app.post("/api/downloads", async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const download = await storage.createDownload({
        userId: body.userId,
        userName: body.userName,
        url: body.url,
        title: body.title,
        platform: body.platform,
        fileType: body.fileType,
        thumbnail: body.thumbnail,
        qualityKey: body.qualityKey,
      });
      // Cache the formatStr so the download endpoint doesn't need it in the URL
      if (body.formatStr) {
        downloadFormatCache.set(download.id, { formatStr: body.formatStr, qualityKey: body.qualityKey || "best" });
        // Expire cache entry after 30 minutes
        setTimeout(() => downloadFormatCache.delete(download.id), 30 * 60 * 1000);
      }
      await storage.updateDownloadStatus(download.id, "completed");
      await storage.incrementUserDownloadCount(body.userId);
      res.json({ success: true, download });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ─── Serve / stream the file ────────────────────────────────────────────────

  app.get("/api/download/:id/file", async (req: Request, res: Response) => {
    const download = await storage.getDownload(req.params.id);
    if (!download) return res.status(404).json({ error: "Download not found" });

    const { url } = download;
    // Prefer cached formatStr (avoids long URLs); fall back to query param for legacy requests
    const cached = downloadFormatCache.get(req.params.id);
    const formatStr = cached?.formatStr || (req.query.format as string) || "best";
    const qualityKey = cached?.qualityKey || (req.query.quality as string) || download.qualityKey || "best";
    const isAudio = qualityKey === "audio";
    const safeTitle = (download.title || "download")
      .replace(/[\r\n\t]/g, " ")                  // strip newlines
      .replace(/[^\x20-\x7E]/g, "")               // strip non-ASCII (®, curly quotes, etc.)
      .replace(/["\\]/g, "")                       // strip chars unsafe in quoted header strings
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 80) || "download";
    const ext = isAudio ? "mp3" : "mp4";
    const filename = `${safeTitle}.${ext}`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", isAudio ? "audio/mpeg" : "video/mp4");

    // ─── TikTok: re-fetch from tikwm.com and proxy ──────────────────────────
    if (formatStr.startsWith("tiktok_")) {
      try {
        const data = await tikwmFetch(url);
        let videoUrl: string;
        if (formatStr === "tiktok_hd") videoUrl = data.hdplay || data.play;
        else if (formatStr === "tiktok_sd") videoUrl = data.play || data.hdplay;
        else videoUrl = data.music; // tiktok_audio

        if (!videoUrl) return res.status(404).json({ error: "Video URL not found" });

        const ext2 = formatStr === "tiktok_audio" ? "mp3" : "mp4";
        const ct2  = formatStr === "tiktok_audio" ? "audio/mpeg" : "video/mp4";
        res.setHeader("Content-Type", ct2);
        res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.${ext2}"`);

        const fileRes = await axios.get(videoUrl, {
          responseType: "stream",
          timeout: 60000,
          headers: { "User-Agent": AXIOS_UA, "Referer": "https://www.tiktok.com/" },
        });
        if (fileRes.headers["content-length"]) res.setHeader("Content-Length", fileRes.headers["content-length"]);
        res.on("error", () => {});
        fileRes.data.pipe(res);
      } catch (err: any) {
        console.error("TikTok download error:", err.message);
        if (!res.headersSent) res.status(500).json({ error: "TikTok download failed: " + err.message });
      }
      return;
    }

    // ─── Instagram direct proxy ──────────────────────────────────────────────
    if (formatStr.startsWith("instagram_direct:") || formatStr.startsWith("instagram_audio:")) {
      const igVideoUrl = formatStr.slice(formatStr.indexOf(":") + 1);
      const isIgAudio = formatStr.startsWith("instagram_audio:");

      if (isIgAudio) {
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.mp3"`);

        try {
          // Fetch the MP4 from Instagram CDN, pipe into ffmpeg to extract MP3
          const videoRes = await axios.get(igVideoUrl, {
            responseType: "stream",
            timeout: 120000,
            headers: {
              "User-Agent": IG_MOBILE_UA,
              "Referer": "https://www.instagram.com/",
              "Accept": "video/mp4,video/*,*/*",
            },
          });
          const ffProc = spawn(FFMPEG_BIN, [
            "-i", "pipe:0", "-f", "mp3", "-b:a", "192k", "-vn", "-write_xing", "0", "pipe:1",
          ], { stdio: ["pipe", "pipe", "pipe"] });
          videoRes.data.pipe(ffProc.stdin);
          res.on("error", () => {});
          ffProc.stdout.pipe(res);
          ffProc.stderr.on("data", () => {});
          ffProc.on("error", (e) => { console.error("ig ffmpeg audio:", e.message); if (!res.headersSent) res.status(500).end(); });
          req.on("close", () => { ffProc.kill("SIGTERM"); });
        } catch (err: any) {
          if (!res.headersSent) res.status(500).json({ error: "Instagram audio failed: " + err.message });
        }
      } else {
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.mp4"`);
        try {
          const fileRes = await axios.get(igVideoUrl, {
            responseType: "stream",
            timeout: 90000,
            headers: {
              "User-Agent": IG_MOBILE_UA,
              "Referer": "https://www.instagram.com/",
              "Accept": "video/mp4,video/*,*/*",
              "Accept-Language": "en-US,en;q=0.9",
            },
          });
          if (fileRes.headers["content-length"]) res.setHeader("Content-Length", fileRes.headers["content-length"]);
          res.on("error", () => {});
          fileRes.data.pipe(res);
        } catch (err: any) {
          if (!res.headersSent) res.status(500).json({ error: "Instagram download failed: " + err.message });
        }
      }
      return;
    }

    // ─── Direct image proxy (Twitter/X images, etc.) ────────────────────────
    if (formatStr.startsWith("direct_image:")) {
      const imageUrl = formatStr.slice("direct_image:".length);
      const imgExt = imageUrl.split("?")[0].split(".").pop()?.toLowerCase() || "jpg";
      const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
      const mime = mimeMap[imgExt] || "image/jpeg";
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.${imgExt}"`);
      try {
        const imgRes = await axios.get(imageUrl, {
          responseType: "stream",
          timeout: 30000,
          headers: { "User-Agent": AXIOS_UA },
        });
        if (imgRes.headers["content-length"]) res.setHeader("Content-Length", imgRes.headers["content-length"]);
        res.on("error", () => {});
        imgRes.data.pipe(res);
      } catch (err: any) {
        if (!res.headersSent) res.status(500).json({ error: "Image download failed: " + err.message });
      }
      return;
    }

    // ─── Direct file proxy ──────────────────────────────────────────────────
    if (formatStr === "direct") {
      // YouTube URLs can't be directly proxied — use yt-dlp with temp file (merging requires it)
      if (/youtube\.com|youtu\.be/i.test(url)) {
        const tmpFile = resolve(tmpdir(), `ytdl-${randomUUID()}.mp4`);
        const ytArgs = [
          url, "--no-playlist", "--no-warnings",
          "--user-agent", AXIOS_UA,
          "-f", "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
          "--merge-output-format", "mp4",
          "--ffmpeg-location", FFMPEG_BIN,
          "-o", tmpFile,
        ];
        const ytProc = spawn(YTDLP_BIN, ytArgs, { stdio: ["ignore", "pipe", "pipe"] });
        let stderrBuf = "";
        ytProc.stderr.on("data", (c: Buffer) => { stderrBuf += c.toString(); });
        ytProc.on("error", (err) => { console.error("yt-dlp spawn error:", err); if (!res.headersSent) res.status(500).json({ error: "Spawn failed" }); });
        ytProc.on("close", (code) => {
          if (code !== 0) {
            console.error("yt-dlp exit", code, stderrBuf.slice(-500));
            if (!res.headersSent) res.status(500).json({ error: "Download failed — video may be restricted or unavailable." });
            return;
          }
          if (!existsSync(tmpFile)) { if (!res.headersSent) res.status(500).json({ error: "Output file not found" }); return; }
          const stream = createReadStream(tmpFile);
          res.on("error", () => {});
          stream.on("error", (e) => { console.error("Stream error:", e); });
          stream.pipe(res);
          res.on("finish", () => { unlink(tmpFile, () => {}); });
          res.on("close", () => { unlink(tmpFile, () => {}); });
        });
        req.on("close", () => { ytProc.kill("SIGTERM"); unlink(tmpFile, () => {}); });
        return;
      }
      try {
        const fileRes = await axios.get(url, {
          responseType: "stream",
          timeout: 60000,
          headers: { "User-Agent": AXIOS_UA },
        });
        const ct = fileRes.headers["content-type"] || "application/octet-stream";
        const cl = fileRes.headers["content-length"];
        res.setHeader("Content-Type", ct);
        if (cl) res.setHeader("Content-Length", cl);
        res.on("error", () => {});
        fileRes.data.pipe(res);
      } catch (err: any) {
        if (!res.headersSent) res.status(500).json({ error: "Download failed: " + err.message });
      }
      return;
    }

    // ─── yt-dlp stream ──────────────────────────────────────────────────────
    // Resolve short/redirect links before passing to yt-dlp
    let streamUrl = url;
    const isShortStreamLink = /on\.soundcloud\.com|bit\.ly|tinyurl|t\.co|fb\.watch|vm\.tiktok/i.test(url);
    if (isShortStreamLink) {
      streamUrl = await resolveRedirect(url);
    }

    const isYouTubeStream = /youtube\.com|youtu\.be/i.test(streamUrl);

    if (isAudio) {
      // Audio: single stream → pipe directly to stdout through ffmpeg
      const args: string[] = [
        streamUrl, "--no-playlist", "--no-warnings",
        "--user-agent", AXIOS_UA,
        "-f", "bestaudio/best",
        "-o", "-",
      ];
      const ytProc = spawn(YTDLP_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
      const ffProc = spawn(FFMPEG_BIN, [
        "-i", "pipe:0",
        "-f", "mp3",
        "-ab", "192k",
        "-vn",
        "-write_xing", "0",
        "pipe:1",
      ], { stdio: ["pipe", "pipe", "pipe"] });

      ytProc.stdout.pipe(ffProc.stdin);
      res.on("error", () => {});
      ffProc.stdout.pipe(res);

      let ytStderr = "", ffStderr = "";
      ytProc.stderr.on("data", (c: Buffer) => { ytStderr += c.toString(); });
      ffProc.stderr.on("data", (c: Buffer) => { ffStderr += c.toString(); });

      ytProc.on("error", (err) => { console.error("yt-dlp error:", err.message); });
      ffProc.on("error", (err) => {
        console.error("ffmpeg error:", err.message);
        if (!res.headersSent) res.status(500).json({ error: "Audio conversion failed" });
      });
      ytProc.on("close", (code) => {
        if (code !== 0) {
          console.error("yt-dlp audio exit", code, ytStderr.slice(-500));
          ffProc.stdin.end();
        }
      });
      ffProc.on("close", (code) => {
        if (code !== 0) console.error("ffmpeg exit", code, ffStderr.slice(-300));
      });
      req.on("close", () => { ytProc.kill("SIGTERM"); ffProc.kill("SIGTERM"); });
    } else if (isYouTubeStream) {
      // YouTube video: must download to temp file first (merging video+audio can't pipe to stdout)
      const tmpFile = resolve(tmpdir(), `ytdl-${randomUUID()}.mp4`);
      const args: string[] = [
        streamUrl, "--no-playlist", "--no-warnings",
        "--user-agent", AXIOS_UA,
        "-f", formatStr,
        "--merge-output-format", "mp4",
        "--ffmpeg-location", FFMPEG_BIN,
        "-o", tmpFile,
      ];
      const proc = spawn(YTDLP_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stderrBuf = "";
      proc.stderr.on("data", (c: Buffer) => { stderrBuf += c.toString(); });
      proc.on("error", (err) => {
        console.error("yt-dlp spawn error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Spawn failed" });
      });
      proc.on("close", (code) => {
        if (code !== 0) {
          console.error("yt-dlp exit", code, stderrBuf.slice(-500));
          if (!res.headersSent) res.status(500).json({ error: "Download failed — video may be restricted or unavailable." });
          return;
        }
        if (!existsSync(tmpFile)) {
          if (!res.headersSent) res.status(500).json({ error: "Output file not found after download" });
          return;
        }
        const stream = createReadStream(tmpFile);
        res.on("error", () => {});
        stream.on("error", (err) => { console.error("Stream error:", err); });
        stream.pipe(res);
        res.on("finish", () => { unlink(tmpFile, () => {}); });
        res.on("close", () => { unlink(tmpFile, () => {}); });
      });
      req.on("close", () => { proc.kill("SIGTERM"); unlink(tmpFile, () => {}); });
    } else {
      // Other platforms: pipe directly to stdout
      const args: string[] = [
        streamUrl, "--no-playlist", "--no-warnings",
        "--user-agent", AXIOS_UA,
        "-f", formatStr,
        "--merge-output-format", "mp4",
        "--ffmpeg-location", FFMPEG_BIN,
        "-o", "-",
      ];
      const proc = spawn(YTDLP_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
      res.on("error", () => {});
      proc.stdout.pipe(res);

      let stderrBuf = "";
      proc.stderr.on("data", (chunk: Buffer) => { stderrBuf += chunk.toString(); });
      proc.on("error", (err) => {
        console.error("yt-dlp spawn error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Spawn failed" });
      });
      proc.on("close", (code) => {
        if (code !== 0) console.error("yt-dlp exit", code, stderrBuf.slice(-300));
      });
      req.on("close", () => proc.kill("SIGTERM"));
    }
  });

  // ─── Recent + user downloads ────────────────────────────────────────────────

  app.get("/api/downloads/recent", async (_req, res) => {
    res.json(await storage.getRecentDownloads(20));
  });

  app.get("/api/downloads/user/:userId", async (req, res) => {
    res.json(await storage.getUserDownloads(req.params.userId));
  });

  app.delete("/api/downloads/:id", async (req: Request, res: Response) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const deleted = await storage.deleteUserDownload(req.params.id, userId);
    if (!deleted) return res.status(404).json({ error: "Download not found or not yours" });
    res.json({ success: true });
  });

  return httpServer;
}
