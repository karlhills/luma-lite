import { useEffect, useMemo, useState } from 'react';
import {
  MonitorSmartphone,
  SlidersHorizontal,
  Sparkles,
  Star,
  Home,
  RefreshCw,
  LayoutGrid,
  HelpCircle
} from 'lucide-react';
import logoUrl from '../../assets/lumelite_icon_nav.png';
import { useAppStore } from './store';
import { Card, Button, Toast, ErrorBoundary } from './components';
import { DevicesView } from './views/DevicesView';
import { ScenesView } from './views/ScenesView';
import { SettingsView } from './views/SettingsView';
import { FavoritesView } from './views/FavoritesView';
import { RoomsView } from './views/RoomsView';
import { ControlDeckView } from './views/ControlDeckView';
import { HelpView } from './views/HelpView';

const navItems = [
  { id: 'deck', label: 'Control Deck', icon: LayoutGrid },
  { id: 'favorites', label: 'Favorites', icon: Star },
  { id: 'scenes', label: 'Scenes', icon: Sparkles },
  { id: 'rooms', label: 'Rooms', icon: Home },
  { id: 'devices', label: 'Devices', icon: MonitorSmartphone }
] as const;

const settingsItem = { id: 'settings', label: 'Settings', icon: SlidersHorizontal } as const;

export const App = () => {
  const {
    init,
    activeView,
    setActiveView,
    config,
    setPreference,
    refreshDevices,
    diagnostics,
    error,
    loading,
    clearError,
    deckFocus
  } = useAppStore();
  const [tourStep, setTourStep] = useState(0);
  const [tourOpen, setTourOpen] = useState(false);

  const tourSteps = useMemo(
    () => [
      {
        title: 'Welcome to LumaLite',
        body: 'First, grab a Govee API key and save it in Settings. This unlocks device control.',
        view: 'settings',
        actionLabel: 'Open API key page',
        actionUrl: 'https://developer.govee.com/'
      },
      {
        title: 'Settings',
        body: 'Paste your API key, optionally set a proxy CA, and toggle debug logging if asked.',
        view: 'settings'
      },
      {
        title: 'Devices',
        body: 'Fine-tune power, brightness, and color per device. Expand rows for details.',
        view: 'devices'
      },
      {
        title: 'Scenes',
        body: 'Create My Scenes to control many devices at once, or apply device scenes per light.',
        view: 'scenes'
      },
      {
        title: 'Control Deck',
        body: 'Build a grid of tiles for fast control across rooms, devices, and scenes.',
        view: 'deck'
      }
    ],
    []
  );

  const activeTour = tourSteps[tourStep];
  const tourTarget = tourOpen ? activeTour?.view : undefined;

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (!window.govee?.onNavigate) return;
    return window.govee.onNavigate((view) => {
      if (
        view === 'favorites' ||
        view === 'scenes' ||
        view === 'rooms' ||
        view === 'deck' ||
        view === 'devices' ||
        view === 'settings' ||
        view === 'help'
      ) {
        setActiveView(view);
      }
    });
  }, [setActiveView]);

  useEffect(() => {
    if (!config || config.onboardingComplete) return;
    setTourOpen(true);
    setTourStep(0);
  }, [config.onboardingComplete]);

  useEffect(() => {
    if (!tourOpen || !activeTour?.view) return;
    setActiveView(activeTour.view);
  }, [activeTour?.view, tourOpen, setActiveView]);

  const content = () => {
    if (activeView === 'devices') {
      return <DevicesView />;
    }
    if (activeView === 'scenes') {
      return <ScenesView />;
    }
    if (activeView === 'deck') {
      return <ControlDeckView />;
    }
    if (activeView === 'favorites') {
      return <FavoritesView />;
    }
    if (activeView === 'rooms') {
      return <RoomsView />;
    }
    if (activeView === 'help') {
      return <HelpView />;
    }
    return <SettingsView />;
  };

  const viewMeta =
    activeView === 'favorites'
      ? { label: 'Favorites', icon: Star }
      : activeView === 'scenes'
        ? { label: 'Scenes', icon: Sparkles }
      : activeView === 'rooms'
          ? { label: 'Rooms', icon: Home }
        : activeView === 'deck'
          ? { label: 'Control Deck', icon: LayoutGrid }
        : activeView === 'devices'
          ? { label: 'Devices', icon: MonitorSmartphone }
        : activeView === 'help'
          ? { label: 'Help', icon: HelpCircle }
          : { label: 'Settings', icon: SlidersHorizontal };
  const ViewIcon = viewMeta.icon;

  return (
    <div className="relative flex h-screen overflow-hidden text-white">
      <div className="noise absolute inset-0" />
      {!deckFocus && (
        <aside className="glass bg-surface soft-depth z-10 flex w-64 flex-shrink-0 flex-col gap-5 border-r border-white/5 p-5 shadow-softGlow">
        <div className="drag-region h-8 w-full" />
        <div className="-mt-8 flex flex-col items-center gap-3">
          <div className="group relative flex items-center justify-center">
            <img
              src={logoUrl}
              alt="LumaLite"
              className="h-10 w-auto object-contain"
            />
            <div className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <div className="whitespace-nowrap rounded-full border border-white/10 bg-charcoal-800/90 px-3 py-1 text-[10px] font-medium text-mist-100 shadow-softGlow backdrop-blur">
                Luma Lite
              </div>
            </div>
          </div>
          <div className="h-px w-full bg-white/10" />
        </div>
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            const isTourTarget = tourTarget === item.id;
            return (
              <button
                key={item.id}
                className={`transition-soft relative flex items-center gap-3 rounded-2xl px-3 py-2 font-medium ${
                  item.id === 'deck' ? 'text-[13px]' : 'text-xs'
                } ${isTourTarget ? 'ring-1 ring-accent-400/70 shadow-softGlow' : ''} ${
                  isActive
                    ? 'bg-charcoal-700/80 text-white shadow-insetSoft'
                    : 'text-mist-400 hover:bg-charcoal-700/40 hover:text-white'
                }`}
                onClick={() => setActiveView(item.id)}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <button
            className={`transition-soft flex items-center gap-3 rounded-2xl px-3 py-2 text-xs font-medium ${
              tourTarget === 'settings' ? 'ring-1 ring-accent-400/70 shadow-softGlow' : ''
            } ${
              activeView === settingsItem.id
                ? 'bg-charcoal-700/80 text-white shadow-insetSoft'
                : 'text-mist-400 hover:bg-charcoal-700/40 hover:text-white'
            }`}
            onClick={() => setActiveView(settingsItem.id)}
          >
            <SlidersHorizontal size={16} />
            {settingsItem.label}
          </button>
          <button
            className={`transition-soft flex items-center gap-3 rounded-2xl px-3 py-2 text-xs font-medium ${
              activeView === 'help'
                ? 'bg-charcoal-700/80 text-white shadow-insetSoft'
                : 'text-mist-400 hover:bg-charcoal-700/40 hover:text-white'
            }`}
            onClick={() => setActiveView('help')}
          >
            <HelpCircle size={16} />
            Help
          </button>
        </div>
      </aside>
      )}
      <main className="relative z-10 flex-1 overflow-y-auto p-6">
        <div className="drag-region flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-charcoal-800/70 p-2 text-mist-300">
              <ViewIcon size={16} />
            </span>
            <h2 className="-mt-1 font-display text-2xl font-semibold">{viewMeta.label}</h2>
          </div>
          <div className="no-drag flex items-center gap-2">
            {activeView === 'devices' && (
              <Button
                variant="secondary"
                className="gap-2"
                disabled={!config.apiKey || loading}
                onClick={() => void refreshDevices()}
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} />
                {loading ? 'Refreshing…' : 'Refresh Devices'}
              </Button>
            )}
          </div>
        </div>

        {!config.apiKey && (
          <Card className="mt-6 border border-amberlite-500/30">
            <p className="text-sm text-amberlite-500">
              Add a Govee API key to unlock device control. The UI is currently read-only.
            </p>
          </Card>
        )}

        <ErrorBoundary>
          <div className="mt-6">{content()}</div>
        </ErrorBoundary>

        {error && (
          <div className="mt-6">
            <Toast message={error} tone="error" onClose={clearError} />
          </div>
        )}
      </main>
      {tourOpen && activeTour ? (
        <div className="tour-overlay fixed inset-0 z-50 flex items-end justify-center p-6">
          <div className="glass soft-depth w-full max-w-lg rounded-2xl border border-white/10 p-5 shadow-softGlow">
            <p className="text-xs uppercase tracking-[0.2em] text-mist-500">Walkthrough</p>
            <h3 className="mt-2 text-lg font-semibold text-white">{activeTour.title}</h3>
            <p className="mt-2 text-sm text-mist-300">{activeTour.body}</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                className="text-xs font-semibold text-mist-400 hover:text-white"
                onClick={() => {
                  setTourOpen(false);
                  void setPreference('onboardingComplete', true);
                }}
              >
                Skip tour
              </button>
              <div className="flex flex-wrap gap-2">
                {activeTour.actionUrl ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (window.govee?.openExternal) {
                        void window.govee.openExternal(activeTour.actionUrl);
                      } else {
                        window.open(activeTour.actionUrl, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    {activeTour.actionLabel ?? 'Learn more'}
                  </Button>
                ) : null}
                {tourStep > 0 ? (
                  <Button
                    variant="secondary"
                    onClick={() => setTourStep((step) => Math.max(0, step - 1))}
                  >
                    Back
                  </Button>
                ) : null}
                <Button
                  onClick={() => {
                    if (tourStep >= tourSteps.length - 1) {
                      setTourOpen(false);
                      void setPreference('onboardingComplete', true);
                      return;
                    }
                    setTourStep((step) => Math.min(tourSteps.length - 1, step + 1));
                  }}
                >
                  {tourStep >= tourSteps.length - 1 ? 'Finish' : 'Next'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
