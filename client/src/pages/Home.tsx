import { useState, useEffect, useRef, useCallback } from "react";
import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Link2, Sun, Moon, Globe, Clock, User, Zap,
  CheckCircle, XCircle, Loader2, FileVideo, FileImage,
  File, AlertCircle, History, Wifi, ArrowDown, Music,
  Film, Image, Archive, FileText, RefreshCw, Search,
  Info, Play, Volume2, Trash2
} from "lucide-react";
import { SiYoutube, SiX, SiInstagram, SiTiktok, SiVimeo, SiSoundcloud, SiFacebook, SiReddit } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ThemeContext } from "@/App";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { User as UserType, Download as DownloadType, UrlInfo, QualityOption } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

// ─── Theme Toggle ─────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { theme, setTheme } = useContext(ThemeContext);
  return (
    <button
      data-testid="button-theme-toggle"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex items-center justify-center w-10 h-10 rounded-full border border-border hover:bg-secondary transition-all duration-200"
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait">
        {theme === "dark" ? (
          <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
            <Sun className="w-4 h-4 text-amber-400" />
          </motion.div>
        ) : (
          <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
            <Moon className="w-4 h-4 text-primary" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

// ─── Platform config ──────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  "YouTube":      { icon: <SiYoutube className="w-3.5 h-3.5" />,   color: "text-red-500",     bg: "bg-red-500/10 dark:bg-red-500/15" },
  "Twitter/X":    { icon: <SiX className="w-3.5 h-3.5" />,         color: "text-slate-500",   bg: "bg-slate-200/80 dark:bg-slate-700/40" },
  "Instagram":    { icon: <SiInstagram className="w-3.5 h-3.5" />, color: "text-pink-500",    bg: "bg-pink-500/10 dark:bg-pink-500/15" },
  "TikTok":       { icon: <SiTiktok className="w-3.5 h-3.5" />,    color: "text-foreground",  bg: "bg-foreground/10 dark:bg-foreground/15" },
  "Vimeo":        { icon: <SiVimeo className="w-3.5 h-3.5" />,     color: "text-teal-500",    bg: "bg-teal-500/10 dark:bg-teal-500/15" },
  "SoundCloud":   { icon: <SiSoundcloud className="w-3.5 h-3.5" />,color: "text-orange-500",  bg: "bg-orange-500/10 dark:bg-orange-500/15" },
  "Facebook":     { icon: <SiFacebook className="w-3.5 h-3.5" />,  color: "text-blue-500",    bg: "bg-blue-500/10 dark:bg-blue-500/15" },
  "Reddit":       { icon: <SiReddit className="w-3.5 h-3.5" />,    color: "text-orange-500",  bg: "bg-orange-500/10 dark:bg-orange-500/15" },
  "Direct Video": { icon: <Film className="w-3.5 h-3.5" />,        color: "text-primary",     bg: "bg-primary/10 dark:bg-primary/15" },
  "Direct Audio": { icon: <Music className="w-3.5 h-3.5" />,       color: "text-violet-500",  bg: "bg-violet-500/10 dark:bg-violet-500/15" },
  "Direct Link":  { icon: <Link2 className="w-3.5 h-3.5" />,       color: "text-primary",     bg: "bg-primary/10 dark:bg-primary/15" },
  "Image":        { icon: <Image className="w-3.5 h-3.5" />,       color: "text-emerald-500", bg: "bg-emerald-500/10 dark:bg-emerald-500/15" },
  "Document":     { icon: <FileText className="w-3.5 h-3.5" />,    color: "text-amber-500",   bg: "bg-amber-500/10 dark:bg-amber-500/15" },
  "Archive":      { icon: <Archive className="w-3.5 h-3.5" />,     color: "text-lime-600",    bg: "bg-lime-500/10 dark:bg-lime-500/15" },
};

function PlatformBadge({ platform }: { platform: string }) {
  const cfg = PLATFORM_CONFIG[platform] ?? { icon: <Globe className="w-3.5 h-3.5" />, color: "text-muted-foreground", bg: "bg-muted" };
  return (
    <span className={`platform-badge ${cfg.bg} ${cfg.color}`}>
      {cfg.icon}
      <span>{platform}</span>
    </span>
  );
}

// ─── Quality button config ────────────────────────────────────────────────────

const QUALITY_STYLES: Record<string, { icon: React.ReactNode; color: string; border: string; bg: string; hoverBg: string }> = {
  hd:    { icon: <Film className="w-4 h-4" />,   color: "text-primary", border: "border-primary/30", bg: "bg-primary/8 dark:bg-primary/12", hoverBg: "hover:bg-primary/15 dark:hover:bg-primary/20" },
  sd:    { icon: <Play className="w-4 h-4" />,   color: "text-blue-400", border: "border-blue-400/30", bg: "bg-blue-400/8 dark:bg-blue-400/12", hoverBg: "hover:bg-blue-400/15 dark:hover:bg-blue-400/20" },
  audio: { icon: <Volume2 className="w-4 h-4" />, color: "text-violet-500", border: "border-violet-500/30", bg: "bg-violet-500/8 dark:bg-violet-500/12", hoverBg: "hover:bg-violet-500/15 dark:hover:bg-violet-500/20" },
  best:  { icon: <Download className="w-4 h-4" />, color: "text-emerald-500", border: "border-emerald-500/30", bg: "bg-emerald-500/8 dark:bg-emerald-500/12", hoverBg: "hover:bg-emerald-500/15 dark:hover:bg-emerald-500/20" },
};

// ─── Welcome Modal ────────────────────────────────────────────────────────────

function WelcomeModal({ onRegister }: { onRegister: (user: UserType) => void }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError("Please enter your name"); return; }
    setLoading(true); setError("");
    try {
      const deviceId = localStorage.getItem("deviceId") || crypto.randomUUID();
      localStorage.setItem("deviceId", deviceId);
      const res = await apiRequest("POST", "/api/users/register", { name: trimmed, deviceId });
      const data = await res.json();
      if (data.success && data.user) {
        onRegister(data.user);
        toast({ title: `Welcome, ${data.user.name}!`, description: "Ready to download anything." });
      }
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-sm border-border [&>button]:hidden" data-testid="modal-welcome">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse-glow" />
              <div className="relative w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center">
                <Download className="w-8 h-8 text-primary" />
              </div>
            </div>
          </div>
          <DialogTitle className="text-center text-xl font-bold">Welcome to FluxDown</DialogTitle>
          <DialogDescription className="text-center">
            Download videos, audio, and files from YouTube, Facebook, TikTok, Instagram, and more.
            <br /><br />
            <span className="font-medium text-foreground">What's your name?</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <Input
            data-testid="input-name"
            placeholder="Enter your name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="text-center h-11 text-base"
            maxLength={32}
          />
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <Button data-testid="button-continue" type="submit" className="w-full h-11 font-semibold" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            Get Started
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Duration formatter ───────────────────────────────────────────────────────

function formatDuration(seconds?: number) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Analysis Result Card ─────────────────────────────────────────────────────

function AnalysisCard({
  info,
  url,
  user,
  onDownloadComplete,
}: {
  info: UrlInfo;
  url: string;
  user: UserType | null;
  onDownloadComplete: (qualityKey: string, label: string) => void;
}) {
  const [activeDownload, setActiveDownload] = useState<string | null>(null);
  const { toast } = useToast();
  const duration = formatDuration(info.duration);

  const handleQualityDownload = async (q: QualityOption) => {
    if (!user) {
      toast({ title: "Please enter your name first", variant: "destructive" });
      return;
    }
    setActiveDownload(q.key);

    try {
      // Create download record with the chosen quality; formatStr cached server-side
      const res = await apiRequest("POST", "/api/downloads", {
        userId: user.id,
        userName: user.name,
        url,
        title: info.title,
        platform: info.platform,
        fileType: info.fileType,
        thumbnail: info.thumbnail,
        qualityKey: q.key,
        formatStr: q.formatStr,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      const downloadId = json.download.id;
      const fileUrl = `/api/download/${downloadId}/file`;

      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      onDownloadComplete(q.key, q.label);
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setTimeout(() => setActiveDownload(null), 3000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="border-primary/20 shadow-lg overflow-hidden" data-testid="card-analysis-result">
        {/* Thumbnail */}
        {info.thumbnail && (
          <div className="relative w-full aspect-video overflow-hidden bg-muted">
            <img
              src={info.thumbnail}
              alt={info.title}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <PlatformBadge platform={info.platform} />
              {duration && (
                <span className="platform-badge bg-black/50 text-white text-[10px]">
                  <Clock className="w-2.5 h-2.5" />{duration}
                </span>
              )}
            </div>
          </div>
        )}

        <CardContent className="p-4 space-y-4">
          {/* Title row */}
          <div>
            {!info.thumbnail && <div className="mb-1.5"><PlatformBadge platform={info.platform} /></div>}
            <p className="font-semibold text-sm leading-snug line-clamp-2" data-testid="text-download-title">
              {info.title}
            </p>
            {info.uploader && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <User className="w-3 h-3" />{info.uploader}
              </p>
            )}
          </div>

          {/* Quality Buttons */}
          {info.qualities && info.qualities.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Choose Quality</p>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(info.qualities.length, 3)}, 1fr)` }}>
                {info.qualities.map((q) => {
                  const style = QUALITY_STYLES[q.key] ?? QUALITY_STYLES.best;
                  const isDownloading = activeDownload === q.key;
                  return (
                    <button
                      key={q.key}
                      data-testid={`button-quality-${q.key}`}
                      onClick={() => handleQualityDownload(q)}
                      disabled={isDownloading}
                      className={`
                        relative flex flex-col items-center justify-center gap-1 p-3 rounded-xl border
                        transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                        ${style.border} ${style.bg} ${style.hoverBg}
                        active:scale-95
                      `}
                    >
                      <div className={`${style.color} transition-transform`}>
                        {isDownloading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          style.icon
                        )}
                      </div>
                      <span className={`font-bold text-xs ${style.color}`}>{q.label}</span>
                      <span className="text-[10px] text-muted-foreground leading-none">{q.sublabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!user && (
            <p className="text-xs text-amber-500 text-center flex items-center justify-center gap-1 bg-amber-500/10 rounded-lg py-2">
              <Info className="w-3 h-3" /> Enter your name to start downloading
            </p>
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            Download starts automatically in your browser
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Download history card ────────────────────────────────────────────────────

const QUALITY_LABELS: Record<string, { label: string; color: string }> = {
  hd:    { label: "HD", color: "text-primary bg-primary/10" },
  sd:    { label: "SD", color: "text-blue-400 bg-blue-400/10" },
  audio: { label: "MP3", color: "text-violet-500 bg-violet-500/10" },
  best:  { label: "DL", color: "text-emerald-500 bg-emerald-500/10" },
};

function DownloadCard({ download, showUser = false, onDelete }: { download: DownloadType; showUser?: boolean; onDelete?: (id: string) => void }) {
  const timeAgo = formatDistanceToNow(new Date(download.timestamp), { addSuffix: true });
  const cfg = PLATFORM_CONFIG[download.platform] ?? { icon: <Globe className="w-4 h-4" />, color: "text-muted-foreground", bg: "bg-muted" };
  const qual = download.qualityKey ? QUALITY_LABELS[download.qualityKey] : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-card border border-card-border hover:border-primary/25 hover:shadow-sm transition-all duration-200"
      data-testid={`card-download-${download.id}`}
    >
      {/* Platform icon */}
      <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${cfg.bg} ${cfg.color}`}>
        {cfg.icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium leading-tight line-clamp-1 text-foreground" data-testid={`text-download-title-${download.id}`}>
            {download.title}
          </p>
          {qual && (
            <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${qual.color}`}>
              {qual.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {showUser && (
            <>
              <span className="flex items-center gap-1"><User className="w-3 h-3" />{download.userName}</span>
              <span>·</span>
            </>
          )}
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo}</span>
        </div>
      </div>

      {/* Status icon + delete */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        {download.status === "completed" ? (
          <CheckCircle className="w-4 h-4 text-emerald-500" />
        ) : download.status === "error" ? (
          <XCircle className="w-4 h-4 text-destructive" />
        ) : (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        )}
        {onDelete && (
          <button
            data-testid={`button-delete-${download.id}`}
            onClick={() => onDelete(download.id)}
            className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded"
            aria-label="Delete download"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="font-medium text-sm text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">{subtitle}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [user, setUser] = useState<UserType | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [url, setUrl] = useState("");
  const [urlInfo, setUrlInfo] = useState<UrlInfo | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  // Restore user from NeonDB via deviceId
  useEffect(() => {
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    const deviceId = localStorage.getItem("deviceId");
    if (!deviceId) {
      setShowWelcome(true);
      return;
    }
    fetch(`/api/users/by-device/${deviceId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u && u.id) {
          setUser(u);
        } else {
          setShowWelcome(true);
        }
      })
      .catch(() => setShowWelcome(true));
  }, []);

  // Recent downloads (global feed)
  const { data: recentDownloads = [], isLoading: recentLoading } = useQuery<DownloadType[]>({
    queryKey: ["/api/downloads/recent"],
    refetchInterval: 8000,
  });

  // User download history
  const { data: userDownloads = [], isLoading: userLoading } = useQuery<DownloadType[]>({
    queryKey: ["/api/downloads/user", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetch(`/api/downloads/user/${user!.id}`).then((r) => r.json()),
    refetchInterval: 10000,
  });

  // Analyze URL
  const analyzeMutation = useMutation({
    mutationFn: async (targetUrl: string) => {
      const res = await apiRequest("POST", "/api/analyze", { url: targetUrl });
      if (!res.ok) throw new Error("Analysis failed");
      return res.json() as Promise<UrlInfo>;
    },
    onSuccess: async (data) => {
      setUrlInfo(data);
      setAnalyzeError("");
    },
    onError: () => {
      setAnalyzeError("Could not analyze this URL. Make sure it's a public link and try again.");
    },
    onSettled: () => setAnalyzing(false),
  });

  const handleAnalyze = () => {
    const trimmed = url.trim();
    if (!trimmed) { inputRef.current?.focus(); return; }
    try { new URL(trimmed); } catch {
      setAnalyzeError("Please enter a valid URL (include https://)");
      return;
    }
    setAnalyzeError("");
    setUrlInfo(null);
    setAnalyzing(true);
    analyzeMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAnalyze();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text");
    try {
      new URL(pasted.trim());
      setTimeout(() => handleAnalyze(), 50);
    } catch {}
  };

  const handleDownloadComplete = useCallback((qualityKey: string, qualityLabel: string) => {
    qc.invalidateQueries({ queryKey: ["/api/downloads/recent"] });
    qc.invalidateQueries({ queryKey: ["/api/downloads/user", user?.id] });
    toast({
      title: `Downloading ${qualityLabel}…`,
      description: `"${urlInfo?.title ?? "file"}" — check your browser downloads`,
    });
  }, [qc, user, urlInfo, toast]);

  const handleClearUrl = () => {
    setUrl(""); setUrlInfo(null); setAnalyzeError("");
    inputRef.current?.focus();
  };

  const deleteDownloadMutation = useMutation({
    mutationFn: async (downloadId: string) => {
      const res = await apiRequest("DELETE", `/api/downloads/${downloadId}`, { userId: user?.id });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/downloads/user", user?.id] });
    },
    onError: () => {
      toast({ title: "Could not delete download", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      {showWelcome && (
        <WelcomeModal onRegister={(u) => { setUser(u); setShowWelcome(false); }} />
      )}

      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm">
              <Download className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base tracking-tight">FluxDown</span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-medium hidden sm:flex">BETA</Badge>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-primary" />
                </div>
                <span data-testid="text-username" className="font-medium">{user.name}</span>
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-gradient absolute inset-0 pointer-events-none" />
        <div className="absolute top-16 left-1/4 w-72 h-72 bg-primary/6 dark:bg-primary/10 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
        <div className="absolute top-28 right-1/4 w-56 h-56 bg-accent/6 dark:bg-accent/10 rounded-full blur-3xl pointer-events-none animate-pulse-glow" style={{ animationDelay: "1.5s" }} />

        <div className="relative max-w-5xl mx-auto px-4 pt-14 pb-10 text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-xs text-primary font-medium mb-5">
              <Wifi className="w-3 h-3" />
              YouTube · Facebook · TikTok · Instagram · and more
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-3 leading-tight">
              <span className="text-foreground">The </span>
              <span className="shimmer-text">Universal</span>
              <br />
              <span className="text-foreground">Downloader</span>
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
              Paste any link and choose your format — MP4 HD, MP4 SD, or MP3. Works with YouTube, Facebook, TikTok, Instagram, Vimeo, and hundreds more.
            </p>
          </motion.div>

          {/* URL input */}
          <motion.div
            initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl mx-auto"
          >
            <Card className="border-border shadow-lg glass-card">
              <CardContent className="p-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      ref={inputRef}
                      data-testid="input-url"
                      type="url"
                      placeholder="Paste a URL..."
                      value={url}
                      onChange={(e) => { setUrl(e.target.value); setAnalyzeError(""); setUrlInfo(null); }}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      className="pl-9 pr-9 h-11 border-border focus-visible:ring-primary text-sm"
                    />
                    {url && (
                      <button onClick={handleClearUrl} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <Button
                    data-testid="button-analyze"
                    onClick={handleAnalyze}
                    disabled={analyzing || !url.trim()}
                    className="h-11 px-5 font-semibold gap-2 flex-shrink-0"
                  >
                    {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span className="hidden sm:inline">{analyzing ? "Analyzing…" : "Analyze"}</span>
                  </Button>
                </div>
                {analyzeError && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex items-center gap-1.5 text-xs text-destructive mt-2 px-1"
                    data-testid="text-analyze-error"
                  >
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{analyzeError}
                  </motion.p>
                )}
              </CardContent>
            </Card>

            {/* Platform badges */}
            <div className="flex flex-wrap justify-center gap-1.5 mt-3">
              {(["YouTube", "Facebook", "TikTok", "Instagram", "Vimeo", "Twitter/X"] as const).map((p) => (
                <span key={p} className={`platform-badge text-[11px] ${PLATFORM_CONFIG[p]?.bg} ${PLATFORM_CONFIG[p]?.color}`}>
                  {PLATFORM_CONFIG[p]?.icon}{p}
                </span>
              ))}
              <span className="platform-badge text-[11px] bg-muted text-muted-foreground">
                <Globe className="w-3 h-3" />+ many more
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Analysis result */}
      <div className="max-w-5xl mx-auto px-4">
        <AnimatePresence mode="wait">
          {analyzing && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-8 max-w-md mx-auto">
              <Card className="border-primary/20">
                <CardContent className="p-6 flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-primary/20 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sm">Analyzing URL…</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Fetching quality options and metadata</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
          {urlInfo && !analyzing && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-10 max-w-md mx-auto">
              <AnalysisCard info={urlInfo} url={url} user={user} onDownloadComplete={handleDownloadComplete} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Global feed + My downloads */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Global Recent Downloads */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-semibold text-base">Global Feed</h2>
                {recentDownloads.length > 0 && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-recent-count">{recentDownloads.length}</Badge>
                )}
              </div>
              <button
                onClick={() => qc.invalidateQueries({ queryKey: ["/api/downloads/recent"] })}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Refresh feed"
                data-testid="button-refresh-recent"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
              {recentLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                ))
              ) : recentDownloads.length === 0 ? (
                <Card className="border-dashed"><CardContent className="p-0">
                  <EmptyState icon={Globe} title="No downloads yet" subtitle="Be the first to download something!" />
                </CardContent></Card>
              ) : (
                <AnimatePresence>
                  {recentDownloads.map((d) => <DownloadCard key={d.id} download={d} showUser />)}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* My Downloads */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
                  <History className="w-4 h-4 text-accent" />
                </div>
                <h2 className="font-semibold text-base">My Downloads</h2>
                {userDownloads.length > 0 && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-user-count">{userDownloads.length}</Badge>
                )}
              </div>
              {user && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3" /><span data-testid="text-user-info">{user.name}</span>
                </span>
              )}
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
              {!user ? (
                <Card className="border-dashed"><CardContent className="p-0">
                  <EmptyState icon={User} title="Sign in to see history" subtitle="Enter your name above to start downloading." />
                </CardContent></Card>
              ) : userLoading ? (
                Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)
              ) : userDownloads.length === 0 ? (
                <Card className="border-dashed"><CardContent className="p-0">
                  <EmptyState icon={Download} title="No downloads yet" subtitle="Paste a URL above and choose your quality." />
                </CardContent></Card>
              ) : (
                <AnimatePresence>
                  {userDownloads.map((d) => (
                    <DownloadCard
                      key={d.id}
                      download={d}
                      showUser={false}
                      onDelete={(id) => deleteDownloadMutation.mutate(id)}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-primary rounded flex items-center justify-center">
              <Download className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-foreground">FluxDown</span>
            <span>· Made by Joshua Apostol</span>
          </div>
          <Link href="/terms-&-privacy">
            <span className="hover:text-foreground transition-colors cursor-pointer">Terms & Privacy</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
