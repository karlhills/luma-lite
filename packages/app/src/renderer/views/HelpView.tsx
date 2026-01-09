import { useMemo, useState } from 'react';
import {
  BookOpen,
  Wand2,
  Grid3X3,
  Home,
  Wrench,
  FileText,
  Link2,
  HeartHandshake,
  Info
} from 'lucide-react';
import { Card, Button } from '../components';
import { useAppStore } from '../store';
import { LINKS } from '../links';

const formatAge = (seconds?: number) => {
  if (seconds === undefined) return '—';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

export const HelpView = () => {
  const { diagnostics, devices, lastStateUpdateAt } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  const lastStateAgeSec = useMemo(() => {
    if (diagnostics?.lastStateAgeSec !== undefined) return diagnostics.lastStateAgeSec;
    if (!lastStateUpdateAt) return undefined;
    return Math.max(0, Math.floor((Date.now() - lastStateUpdateAt) / 1000));
  }, [diagnostics?.lastStateAgeSec, lastStateUpdateAt]);

  const lastUpdatedLabel = formatAge(lastStateAgeSec);
  const deviceCount = diagnostics?.devicesCount ?? devices.length;
  const providerStatus = diagnostics?.providerStatus ?? 'missing-key';
  const appName = diagnostics?.appName ?? 'LumaLite';
  const appVersion = diagnostics?.appVersion ?? 'Unknown';
  const platform = diagnostics?.platform ?? 'unknown';
  const arch = diagnostics?.arch ?? 'unknown';
  const buildMode = diagnostics?.buildMode ?? 'development';
  const lastError = diagnostics?.lastError ?? 'None';
  const lastErrorAt = diagnostics?.lastErrorAt
    ? new Date(diagnostics.lastErrorAt).toLocaleString()
    : '—';
  const lastStateUpdatedAt = diagnostics?.lastStateUpdateAt ?? lastStateUpdateAt;

  const handleCopyDiagnostics = async () => {
    // Provide a compact, support-friendly block for bug reports.
    const lines = [
      `App: ${appName} ${appVersion}`,
      `Platform: ${platform} (${arch})`,
      `Build: ${buildMode}`,
      `Provider: ${providerStatus}`,
      `Devices: ${deviceCount}`,
      `State Updated: ${
        lastStateUpdatedAt ? new Date(lastStateUpdatedAt).toISOString() : 'Not yet'
      } (${lastUpdatedLabel})`,
      `Last Error: ${lastError}`,
      `Last Error At: ${lastErrorAt}`
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setCopyError(null);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      setCopyError(error instanceof Error ? error.message : 'Failed to copy');
      setCopied(false);
    }
  };

  const handleOpenExternal = (url: string) => {
    if (window.govee?.openExternal) {
      void window.govee.openExternal(url);
      return;
    }
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownloadLogs = () => {
    void window.govee?.downloadLogs();
  };

  const handleOpenLogsFolder = () => {
    if (!window.govee?.openLogsFolder) return;
    void (async () => {
      const result = await window.govee.openLogsFolder();
      if (!result?.ok) {
        setLogError(result?.error ?? 'Unable to open logs folder');
        window.setTimeout(() => setLogError(null), 2500);
      }
    })();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-mist-400">
          <Info size={14} /> How LumaLite works
        </div>
        <ul className="space-y-1 text-sm text-mist-300">
          <li>Scenes = your daily controls across many devices.</li>
          <li>Devices = per-device tweaks and setup.</li>
          <li>Rooms & Favorites = reduce scrolling for large setups.</li>
          <li>Control Deck = fast, stream-deck style actions.</li>
        </ul>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-mist-400">
          <BookOpen size={14} /> Using LumaLite
        </div>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Grid3X3 size={14} className="mt-1 text-mist-500" />
            <div>
              <p className="text-sm font-semibold text-white">Control Deck</p>
              <p className="text-sm text-mist-300">
                Build a grid of tiles for fast actions across rooms, devices, or scenes.
              </p>
              <p className="text-xs text-mist-500">Tip: Focus Mode is great for a dashboard view.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Wand2 size={14} className="mt-1 text-mist-500" />
            <div>
              <p className="text-sm font-semibold text-white">Scenes</p>
              <p className="text-sm text-mist-300">
                Create My Scenes to apply power, brightness, and color across devices.
              </p>
              <p className="text-xs text-mist-500">
                Device Scenes can be fetched per device for dynamic/DIY options.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Home size={14} className="mt-1 text-mist-500" />
            <div>
              <p className="text-sm font-semibold text-white">Rooms & Favorites</p>
              <p className="text-sm text-mist-300">
                Group devices by room and star favorites to reduce scrolling.
              </p>
              <p className="text-xs text-mist-500">
                Add devices to rooms directly from the Rooms page.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-mist-400">
          <BookOpen size={14} /> Status & freshness
        </div>
        <ul className="space-y-1 text-sm text-mist-300">
          <li>Device state is polled periodically and may take a moment to reconcile.</li>
          <li>If a device shows offline, the last state may be historical.</li>
          <li>Rate limits (429) can happen. LumaLite backs off—try again shortly.</li>
          <li>
            If something looks out of sync, use Refresh Devices. Last updated {lastUpdatedLabel}.
          </li>
        </ul>
      </Card>

      <details className="rounded-2xl border border-white/10 bg-charcoal-800/60 p-4 shadow-softGlow">
        <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-white">
          <span className="flex items-center gap-2">
            <Wrench size={14} className="text-mist-500" />
            Support & troubleshooting
          </span>
          <span className="text-xs text-mist-500">Logs, diagnostics, and links for reporting issues.</span>
        </summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-mist-400">
              <Link2 size={14} /> Links
            </div>
            <p className="text-sm text-mist-300">
              Find the source or report issues with a short, clear description.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => handleOpenExternal(LINKS.githubRepo)}>
                GitHub Repo
              </Button>
              <Button variant="secondary" onClick={() => handleOpenExternal(LINKS.githubIssues)}>
                Report a bug / request a feature
              </Button>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-mist-400">
              <FileText size={14} /> Diagnostics
            </div>
            <div className="grid gap-2 text-xs text-mist-400">
              <div className="flex items-center justify-between">
                <span>App</span>
                <span className="text-mist-200">
                  {appName} {appVersion}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Platform</span>
                <span className="text-mist-200">
                  {platform} ({arch})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Build</span>
                <span className="text-mist-200">{buildMode}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Provider</span>
                <span className="text-mist-200">{providerStatus}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Devices</span>
                <span className="text-mist-200">{deviceCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>State freshness</span>
                <span className="text-mist-200">{lastUpdatedLabel}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={handleCopyDiagnostics}>
                {copied ? 'Copied' : 'Copy diagnostics'}
              </Button>
              <Button variant="ghost" onClick={handleOpenLogsFolder}>
                Open logs folder
              </Button>
              {copyError ? (
                <span className="text-[10px] text-amberlite-500">{copyError}</span>
              ) : null}
              {logError ? (
                <span className="text-[10px] text-amberlite-500">{logError}</span>
              ) : null}
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-mist-400">
              <FileText size={14} /> Logs
            </div>
            <p className="text-sm text-mist-300">
              Download logs for troubleshooting. Enable Govee debug logging only when
              investigating an issue.
            </p>
            <p className="text-xs text-mist-500">
              Logs are stored locally in the app’s userData directory. Your API key and settings
              are stored locally in `config.json` and are never uploaded automatically.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={handleDownloadLogs}>
                Download logs
              </Button>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-mist-400">
              <Wrench size={14} /> Troubleshooting
            </div>
            <ul className="space-y-1 text-sm text-mist-300">
              <li>Verify your API key and refresh devices if they don’t respond.</li>
              <li>Some actions are skipped if a device doesn’t support the capability.</li>
              <li>Rate limits (429) can happen. LumaLite backs off—try again shortly.</li>
            </ul>
          </Card>
        </div>
      </details>

      <Card className="space-y-3 border border-white/5 bg-charcoal-800/40 text-mist-400">
        <div className="flex items-center gap-2 text-xs text-mist-500">
          <HeartHandshake size={12} /> Support
        </div>
        <p className="text-sm text-mist-300">
          LumaLite is free and open source. If it’s useful to you, you can support
          development with a coffee ☕
        </p>
        <Button variant="secondary" onClick={() => handleOpenExternal(LINKS.coffee)}>
          Buy me a coffee
        </Button>
      </Card>
    </div>
  );
};
