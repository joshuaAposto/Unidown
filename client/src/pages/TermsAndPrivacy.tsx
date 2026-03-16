import { useContext } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Download, Sun, Moon, ArrowLeft, Shield, FileText, Eye, Lock, AlertTriangle, Users, Globe } from "lucide-react";
import { ThemeContext } from "@/App";
import { AnimatePresence } from "framer-motion";

function ThemeToggle() {
  const { theme, setTheme } = useContext(ThemeContext);
  return (
    <button
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

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function Section({ icon, title, children }: SectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
          {icon}
        </div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
      </div>
      <div className="pl-10 space-y-2 text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </motion.section>
  );
}

export default function TermsAndPrivacy() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <button className="flex items-center justify-center w-8 h-8 rounded-full border border-border hover:bg-secondary transition-all duration-200" aria-label="Go back">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                <Download className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-base tracking-tight">FluxDown</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-border bg-muted/30">
        <div className="max-w-3xl mx-auto px-4 py-10 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex justify-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Terms & Privacy Policy</h1>
            <p className="text-muted-foreground text-sm">Last updated: March 2026 · Made by Joshua Apostol</p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-10">

        {/* Terms of Service */}
        <div className="space-y-8">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Terms of Service</h2>
          </div>
          <div className="h-px bg-border" />

          <Section icon={<Globe className="w-4 h-4" />} title="Acceptance of Terms">
            <p>
              By accessing and using FluxDown, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
            </p>
            <p>
              FluxDown is a free media downloading tool intended for personal, non-commercial use only.
            </p>
          </Section>

          <Section icon={<AlertTriangle className="w-4 h-4" />} title="Permitted Use">
            <p>You may only use FluxDown to download content that you have the legal right to download, including:</p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li>Content you own or have created yourself</li>
              <li>Content that is in the public domain</li>
              <li>Content with an open license (e.g., Creative Commons)</li>
              <li>Content you have explicit permission from the copyright holder to download</li>
            </ul>
          </Section>

          <Section icon={<AlertTriangle className="w-4 h-4" />} title="Prohibited Use">
            <p>You must not use FluxDown to:</p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li>Download, copy, or distribute copyrighted content without authorization</li>
              <li>Violate the terms of service of any platform (YouTube, TikTok, Instagram, etc.)</li>
              <li>Download content for commercial redistribution or resale</li>
              <li>Engage in any activity that violates local, national, or international laws</li>
              <li>Attempt to reverse-engineer, disrupt, or abuse the service</li>
            </ul>
          </Section>

          <Section icon={<FileText className="w-4 h-4" />} title="Disclaimer of Liability">
            <p>
              FluxDown is provided "as is" without warranties of any kind. We are not responsible for how you use downloaded content. You assume full responsibility for ensuring your use complies with applicable laws and platform terms of service.
            </p>
            <p>
              We do not host, store, or distribute any downloaded media. All files are streamed directly from the original source to your device.
            </p>
          </Section>

          <Section icon={<Users className="w-4 h-4" />} title="User Accounts">
            <p>
              FluxDown uses a simple name-based registration to personalize your experience. No email address or password is required. Your account is tied to your device using a randomly generated device ID.
            </p>
            <p>
              You can clear your browser data at any time to reset your local session. Your download history stored in our database is linked to your device ID.
            </p>
          </Section>
        </div>

        <div className="h-px bg-border" />

        {/* Privacy Policy */}
        <div className="space-y-8">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Privacy Policy</h2>
          </div>
          <div className="h-px bg-border" />

          <Section icon={<Eye className="w-4 h-4" />} title="Information We Collect">
            <p>When you use FluxDown, we collect and store the following information:</p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li><span className="text-foreground font-medium">Display name</span> — the name you enter when you first visit</li>
              <li><span className="text-foreground font-medium">Device ID</span> — a randomly generated identifier stored in your browser</li>
              <li><span className="text-foreground font-medium">IP address</span> — recorded at registration for abuse prevention</li>
              <li><span className="text-foreground font-medium">Download history</span> — the URLs, titles, platforms, and timestamps of your downloads</li>
            </ul>
          </Section>

          <Section icon={<Lock className="w-4 h-4" />} title="How We Use Your Information">
            <p>We use the information we collect solely to:</p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li>Show you your personal download history</li>
              <li>Display a global feed of recent activity across the platform</li>
              <li>Track download counts per user</li>
              <li>Prevent abuse and ensure fair usage of the service</li>
            </ul>
            <p>We do not sell, rent, or share your personal data with any third parties.</p>
          </Section>

          <Section icon={<Shield className="w-4 h-4" />} title="Data Storage">
            <p>
              All data is stored securely in a cloud-hosted PostgreSQL database (Neon). Your data is retained as long as your device ID exists in your browser's local storage.
            </p>
            <p>
              We do not store the actual downloaded media files — only metadata (title, platform, URL, timestamp) about the downloads.
            </p>
          </Section>

          <Section icon={<Eye className="w-4 h-4" />} title="Cookies & Local Storage">
            <p>
              FluxDown uses your browser's local storage to store your device ID and theme preference. We do not use advertising cookies or third-party trackers.
            </p>
          </Section>

          <Section icon={<Users className="w-4 h-4" />} title="Your Rights">
            <p>You have the right to:</p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li>Delete individual entries from your personal download history at any time</li>
              <li>Clear your browser's local storage to remove your device association</li>
              <li>Request deletion of your account data by contacting us</li>
            </ul>
          </Section>

          <Section icon={<AlertTriangle className="w-4 h-4" />} title="Changes to This Policy">
            <p>
              We may update these Terms and Privacy Policy from time to time. Changes will be reflected on this page with an updated date. Continued use of the service after changes constitutes your acceptance of the new terms.
            </p>
          </Section>
        </div>

        {/* Contact */}
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-center space-y-2">
          <p className="font-semibold text-foreground">Questions or Concerns?</p>
          <p className="text-sm text-muted-foreground">
            If you have any questions about these terms or our privacy practices, feel free to reach out to the developer.
          </p>
          <p className="text-sm font-medium text-primary">Made by Joshua Apostol</p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="max-w-3xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-primary rounded flex items-center justify-center">
              <Download className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-foreground">FluxDown</span>
            <span>· Made by Joshua Apostol</span>
          </div>
          <Link href="/">
            <span className="hover:text-foreground transition-colors cursor-pointer">← Back to Home</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
