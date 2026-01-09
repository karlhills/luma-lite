import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Droplet, Power, Tag, Layers3 } from 'lucide-react';
import { useAppStore } from '../store';
import {
  Button,
  Card,
  FavoriteStarButton,
  SearchInput,
  SegmentedControl,
  Slider,
  ToggleSwitch
} from '../components';

export type DeviceExplorerMode = 'all' | 'favorites';

type GroupKey = 'all' | 'types' | 'favorites';

type GroupedDevices = {
  title: string;
  devices: ReturnType<typeof useAppStore.getState>['devices'];
};

const formatTime = (timestamp?: number) => {
  if (!timestamp) return 'Never';
  return new Date(timestamp).toLocaleTimeString();
};

const inferType = (model: string, commands: string[], name?: string, sku?: string) => {
  const modelUpper = model.toUpperCase();
  const nameUpper = (name ?? '').toUpperCase();
  const skuUpper = (sku ?? '').toUpperCase();
  const hasColor = commands.some((command) => command.includes('color'));
  const hasRange = commands.some(
    (command) => command.includes('range') || command.includes('brightness')
  );
  const hasOnOff = commands.some((command) => command.includes('on_off'));

  if (nameUpper.includes('GROUP') || modelUpper.includes('GROUP') || skuUpper.includes('GROUP')) {
    return 'Groups';
  }
  if (hasColor || hasRange) {
    return 'Lights';
  }
  if (modelUpper.startsWith('H50') || modelUpper.startsWith('H507')) {
    return 'Plugs';
  }
  if (modelUpper.startsWith('H7') || modelUpper.includes('SENSOR')) {
    return 'Sensors';
  }
  if (hasOnOff && !hasColor && !hasRange) {
    return 'Plugs';
  }
  return 'Other';
};

export const DeviceExplorer = ({ mode }: { mode: DeviceExplorerMode }) => {
  const {
    devices,
    devicePower,
    deviceStates,
    favorites,
    rooms,
    roomNames,
    activeRoom,
    config,
    refreshDevices,
    setPowerForDevices,
    togglePower,
    setBrightness,
    setColor,
    setFavorite,
    setDeviceRoom,
    fetchDeviceState
  } = useAppStore();

  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<GroupKey>(mode === 'favorites' ? 'favorites' : 'all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [roomDraft, setRoomDraft] = useState<Record<string, string>>({});
  const [brightnessValues, setBrightnessValues] = useState<Record<string, number>>({});
  const brightnessTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [colorValues, setColorValues] = useState<Record<string, string>>({});
  const colorTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      Object.values(brightnessTimers.current).forEach((timer) => clearTimeout(timer));
      Object.values(colorTimers.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const metadata = useMemo(() => {
    return devices.map((device) => {
      const room = rooms[device.id];
      const type = inferType(
        device.model ?? '',
        device.supportedCommands,
        device.name,
        device.sku
      );
      return {
        device,
        room,
        type,
        isFavorite: favorites.includes(device.id)
      };
    });
  }, [devices, rooms, favorites]);

  const availableTypes = useMemo(() => {
    const set = new Set(metadata.map((item) => item.type));
    return Array.from(set).sort();
  }, [metadata]);

  useEffect(() => {
    if (groupBy !== 'types') {
      setTypeFilter(null);
    }
  }, [groupBy]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return metadata.filter(({ device, room, type, isFavorite }) => {
      if (mode === 'favorites' && !isFavorite) return false;
      if (activeRoom && room !== activeRoom) return false;
      if (groupBy === 'types' && typeFilter && type !== typeFilter) return false;
      if (!query) return true;
      const haystack = [
        device.name,
        device.model,
        device.sku,
        room,
        type,
        device.id
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [metadata, search, mode, activeRoom, groupBy, typeFilter]);

  const grouped = useMemo((): GroupedDevices[] => {
    if (groupBy === 'favorites') {
      return [
        {
          title: 'Favorites',
          devices: filtered.filter((entry) => entry.isFavorite).map((entry) => entry.device)
        }
      ];
    }
    if (groupBy === 'types') {
      const map = new Map<string, typeof filtered>();
      filtered.forEach((entry) => {
        const key = entry.type;
        const list = map.get(key) ?? [];
        list.push(entry);
        map.set(key, list);
      });
      return Array.from(map.entries()).map(([title, list]) => ({
        title,
        devices: list.map((entry) => entry.device)
      }));
    }
    return [{ title: 'All Devices', devices: filtered.map((entry) => entry.device) }];
  }, [filtered, groupBy]);

  const hasFavorites = favorites.length > 0;
  const lastRefreshAt = config.lastRefreshAt;

  const handleToggleExpand = (deviceId: string) => {
    setExpanded((prev) => {
      const next = !prev[deviceId];
      if (next && !deviceStates[deviceId]) {
        void fetchDeviceState(deviceId);
      }
      return { ...prev, [deviceId]: next };
    });
  };

  return (
    <div className="space-y-4">
      {mode === 'all' && (
        <Card className="sticky top-6 z-20 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-mist-500">
                {devices.length} devices • Last refresh {formatTime(lastRefreshAt)}
              </p>
              {activeRoom && (
                <p className="mt-1 text-xs text-accent-400">Room filter: {activeRoom}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  void setPowerForDevices(
                    filtered.map((item) => item.device.id),
                    true
                  )
                }
                disabled={!config.apiKey}
              >
                All On
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  void setPowerForDevices(
                    filtered.map((item) => item.device.id),
                    false
                  )
                }
                disabled={!config.apiKey}
              >
                All Off
              </Button>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1.2fr,1fr]">
            <SearchInput
              placeholder="Filter devices..."
              value={search}
              onChange={(event) => setSearch(event.currentTarget?.value ?? '')}
            />
            <SegmentedControl
              value={groupBy}
              options={[
                { id: 'all', label: 'All' },
                { id: 'types', label: 'Types' },
                { id: 'favorites', label: 'Favorites' }
              ]}
              onChange={(id) => setGroupBy(id as GroupKey)}
            />
          </div>
          {groupBy === 'types' && (
            <div className="flex flex-wrap gap-2">
              <button
                className={`transition-soft rounded-full px-3 py-1 text-xs ${
                  typeFilter === null
                    ? 'bg-accent-500/80 text-charcoal-900'
                    : 'bg-charcoal-700/70 text-mist-400 hover:text-white'
                }`}
                onClick={() => setTypeFilter(null)}
              >
                All Types
              </button>
              {availableTypes.map((type) => (
                <button
                  key={type}
                  className={`transition-soft rounded-full px-3 py-1 text-xs ${
                    typeFilter === type
                      ? 'bg-accent-500/80 text-charcoal-900'
                      : 'bg-charcoal-700/70 text-mist-400 hover:text-white'
                  }`}
                  onClick={() => setTypeFilter(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {mode === 'favorites' && (
        <Card className="space-y-3">
          <div>
            <p className="text-sm text-mist-400">Favorites</p>
            <p className="text-xs text-mist-500">
              {favorites.length} starred • Last refresh {formatTime(lastRefreshAt)}
            </p>
          </div>
          <SearchInput
            placeholder="Filter favorites..."
            value={search}
            onChange={(event) => setSearch(event.currentTarget?.value ?? '')}
          />
        </Card>
      )}

      {grouped.map((group) => (
        <div key={group.title} className="space-y-3">
          {groupBy !== 'all' && (
            <div className="flex items-center gap-2 text-sm text-mist-400">
              <Layers3 size={14} /> {group.title}
            </div>
          )}
          {group.devices.length === 0 ? (
            <Card>
              <p className="text-sm text-mist-400">
                {mode === 'favorites'
                  ? 'Star devices to see them here.'
                  : 'No devices match your filters.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {group.devices.map((device) => {
                const isFavorite = favorites.includes(device.id);
                const room = rooms[device.id] ?? '';
                const type = inferType(
                  device.model ?? '',
                  device.supportedCommands,
                  device.name,
                  device.sku
                );
                const isExpanded = Boolean(expanded[device.id]);
                const hasBrightness = device.supportedCommands.some((command) =>
                  command.includes('range') || command.includes('brightness')
                );
                const hasColor = device.supportedCommands.some((command) =>
                  command.includes('color')
                );
                const stateBrightness = deviceStates[device.id]?.brightness;
                const stateColor = deviceStates[device.id]?.colorRgb;
                const brightnessValue = brightnessValues[device.id] ?? stateBrightness ?? 70;
                const colorValue =
                  colorValues[device.id] ??
                  (stateColor
                    ? `#${((stateColor.r << 16) + (stateColor.g << 8) + stateColor.b)
                        .toString(16)
                        .padStart(6, '0')}`
                    : '#7ac8d6');
                const sourceLabel =
                  device.source === 'lan'
                    ? 'LAN'
                    : device.source === 'hybrid'
                      ? 'LAN + Cloud'
                      : 'Cloud';
                const sourceStyle =
                  device.source === 'lan'
                    ? 'bg-emerald-500/15 text-emerald-200'
                    : device.source === 'hybrid'
                      ? 'bg-amberlite-500/15 text-amberlite-200'
                      : 'bg-charcoal-700/60 text-mist-300';
                return (
                  <Card key={device.id} className="p-0">
                    <button
                      className="transition-soft flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                      onClick={() => handleToggleExpand(device.id)}
                    >
                      <div className="flex items-center gap-3">
                        <FavoriteStarButton
                          isFavorite={isFavorite}
                          onToggle={() => void setFavorite(device.id, !isFavorite)}
                        />
                        <div>
                          <p className="text-sm font-semibold">{device.name}</p>
                          <p className="text-xs text-mist-500">
                            {device.model && device.sku && device.model !== device.sku
                              ? `${device.model} • ${device.sku}`
                              : device.model ?? device.sku ?? ''}{' '}
                            {room ? `• ${room}` : ''} • {type}
                            <span
                              className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${sourceStyle}`}
                            >
                              {sourceLabel}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <ToggleSwitch
                          checked={devicePower[device.id] ?? true}
                          onClick={(event) => {
                            event.stopPropagation();
                            void togglePower(device.id);
                          }}
                          disabled={!config.apiKey}
                        />
                        <ChevronDown
                          size={16}
                          className={`transition-soft ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </button>

                    <div
                      className={`collapse-panel ${isExpanded ? 'is-open' : ''}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="border-t border-white/5 px-4 py-3">
                        <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-mist-400">
                              <span className="inline-flex items-center gap-2">
                                <Power size={14} /> Brightness
                              </span>
                              <span>0 - 100</span>
                            </div>
                            <Slider
                              min={0}
                              max={100}
                              value={brightnessValue}
                              onChange={(event) => {
                                const value = Number(event.currentTarget.value);
                                setBrightnessValues((prev) => ({
                                  ...prev,
                                  [device.id]: value
                                }));
                                const existing = brightnessTimers.current[device.id];
                                if (existing) {
                                  clearTimeout(existing);
                                }
                                brightnessTimers.current[device.id] = setTimeout(() => {
                                  void setBrightness(device.id, value);
                                }, 1000);
                              }}
                              disabled={!config.apiKey || !hasBrightness}
                            />
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-mist-400">
                              <span className="inline-flex items-center gap-2">
                                <Droplet size={14} /> Color
                              </span>
                              <span>RGB</span>
                            </div>
                            <input
                              type="color"
                              className="h-10 w-24 cursor-pointer rounded-xl border border-white/10 bg-charcoal-700/70"
                              value={colorValue}
                              onChange={(event) => {
                                const value = event.currentTarget.value;
                                setColorValues((prev) => ({ ...prev, [device.id]: value }));
                                const existing = colorTimers.current[device.id];
                                if (existing) {
                                  clearTimeout(existing);
                                }
                                colorTimers.current[device.id] = setTimeout(() => {
                                  const r = parseInt(value.slice(1, 3), 16);
                                  const g = parseInt(value.slice(3, 5), 16);
                                  const b = parseInt(value.slice(5, 7), 16);
                                  void setColor(device.id, { r, g, b });
                                }, 700);
                              }}
                              disabled={!config.apiKey || !hasColor}
                            />
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Tag size={14} className="text-mist-400" />
                          <select
                            className="transition-soft rounded-xl border border-white/10 bg-charcoal-700/70 px-3 py-2 text-xs text-white"
                            value={roomDraft[device.id] ?? room}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              setRoomDraft((prev) => ({ ...prev, [device.id]: value }));
                              void setDeviceRoom(device.id, value);
                            }}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <option value="">Unassigned</option>
                            {roomNames.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {mode === 'all' && !hasFavorites && groupBy === 'favorites' && (
        <Card>
          <p className="text-sm text-mist-400">
            Star devices to build a favorites group for quick access.
          </p>
        </Card>
      )}
    </div>
  );
};
