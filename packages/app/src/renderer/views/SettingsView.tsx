import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Satellite } from 'lucide-react';
import { useAppStore } from '../store';
import { Button, Card, Input, Toast, ToggleSwitch } from '../components';

export const SettingsView = () => {
  const { config, setApiKey, setPreference } = useAppStore();
  const hasBridge = typeof window !== 'undefined' && Boolean(window.govee);
  const [apiKey, setApiKeyInput] = useState(config.apiKey ?? '');
  const [dockHidden, setDockHidden] = useState(config.dockHidden ?? false);
  const [proxyCaPath, setProxyCaPath] = useState(config.proxyCaPath ?? '');
  const [debugLogging, setDebugLogging] = useState(config.debugLogging ?? false);
  const [connectionOk, setConnectionOk] = useState(false);
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone?: 'error' | 'info' } | null>(null);
  const isMac = useMemo(() => navigator.platform.toLowerCase().includes('mac'), []);

  useEffect(() => {
    setApiKeyInput(config.apiKey ?? '');
    setDockHidden(config.dockHidden ?? false);
    setProxyCaPath(config.proxyCaPath ?? '');
    setDebugLogging(config.debugLogging ?? false);
    if (!config.apiKey) {
      setConnectionOk(false);
      setConnectionChecked(false);
      return;
    }
    if (!window.govee) return;
    void (async () => {
      try {
        await window.govee.listDevices();
        setConnectionOk(true);
      } catch {
        setConnectionOk(false);
      } finally {
        setConnectionChecked(true);
      }
    })();
  }, [config.apiKey, config.dockHidden, config.proxyCaPath, config.debugLogging]);

  const handleSave = async () => {
    await setApiKey(apiKey.trim());
  };

  const handleTest = async () => {
    try {
      if (!window.govee) {
        throw new Error('Govee bridge unavailable. Please run inside the Electron app.');
      }
      const devices = await window.govee.listDevices();
      setConnectionOk(true);
      setConnectionChecked(true);
      setToast({ message: `Connection OK. ${devices.length} device(s) detected.` });
    } catch (error) {
      setConnectionOk(false);
      setConnectionChecked(true);
      setToast({
        message: error instanceof Error ? error.message : 'Connection failed.',
        tone: 'error'
      });
    }
  };

  const handleDockToggle = async () => {
    const next = !dockHidden;
    setDockHidden(next);
    await setPreference('dockHidden', next);
  };


  const handleProxySave = async () => {
    await setPreference('proxyCaPath', proxyCaPath.trim() || undefined);
    setToast({ message: 'Proxy CA path saved.' });
  };

  const handleDebugToggle = async () => {
    const next = !debugLogging;
    setDebugLogging(next);
    await setPreference('debugLogging', next);
  };

  return (
    <div className="grid gap-4">
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <KeyRound size={18} className="text-accent-400" />
          <h3 className="text-lg font-semibold">Govee API Key</h3>
        </div>
        {!hasBridge && (
          <div className="rounded-xl border border-amberlite-500/30 bg-charcoal-700/60 px-4 py-3 text-sm text-amberlite-500">
            <p className="text-xs uppercase tracking-widest">Bridge Missing</p>
            <p className="mt-2">
              The Electron preload bridge is not available. Make sure you're running the app, not
              the browser.
            </p>
          </div>
        )}
        <Input
          placeholder="Paste your API key"
          value={apiKey}
          onChange={(event) => setApiKeyInput(event.currentTarget.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void handleSave()}>Save Settings</Button>
          <Button variant="secondary" onClick={() => void handleTest()}>
            <Satellite size={16} />
            Test Connection
          </Button>
          {config.apiKey && connectionChecked && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                connectionOk
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-amberlite-500/20 text-amberlite-300'
              }`}
            >
              {connectionOk ? 'Connected' : 'Not connected'}
            </span>
          )}
        </div>
        {isMac && (
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-charcoal-700/60 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Hide Dock icon</p>
              <p className="text-xs text-mist-500">
                Hides the Dock icon; you'll access the app from the menu bar.
              </p>
            </div>
            <ToggleSwitch checked={dockHidden} onClick={() => void handleDockToggle()} />
          </div>
        )}
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-charcoal-700/60 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Govee debug logging</p>
            <p className="text-xs text-mist-500">
              Log API payloads and responses to the local log file.
            </p>
          </div>
          <ToggleSwitch checked={debugLogging} onClick={() => void handleDebugToggle()} />
        </div>
        <details className="rounded-xl border border-white/10 bg-charcoal-700/60 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-white">
            Proxy CA certificate path
          </summary>
          <p className="mt-2 text-xs text-mist-500">
            If your network uses a self-signed proxy, point to the exported CA file (PEM).
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Input
              placeholder="/Users/you/Documents/proxy-ca.pem"
              value={proxyCaPath}
              onChange={(event) => setProxyCaPath(event.currentTarget.value)}
            />
            <Button variant="secondary" onClick={() => void handleProxySave()}>
              Save CA Path
            </Button>
          </div>
        </details>
        {toast && (
          <Toast
            message={toast.message}
            tone={toast.tone}
            onClose={() => setToast(null)}
          />
        )}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-charcoal-800/60 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">Walkthrough</p>
            <p className="text-xs text-mist-500">Restart the first-time tour.</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => void setPreference('onboardingComplete', false)}
          >
            Restart Tour
          </Button>
        </div>
      </Card>
    </div>
  );
};
