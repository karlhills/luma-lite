import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Settings,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Zap,
  Power,
  RefreshCw
} from 'lucide-react';
import { useAppStore } from '../store';
import { Button, Card, Input, SegmentedControl, Toast } from '../components';
import type { DeckConfig, DeckTile, MyScene } from '../../shared/ipc';

const gridOptions = [
  { id: '3x3', label: '3 x 3' },
  { id: '4x4', label: '4 x 4' },
  { id: '6x4', label: '6 x 4' }
] as const;

const tileSizeOptions = [
  { id: 'sm', label: 'Small' },
  { id: 'md', label: 'Medium' },
  { id: 'lg', label: 'Large' }
] as const;

const gridColumns: Record<DeckConfig['gridPreset'], string> = {
  '3x3': 'grid-cols-3',
  '4x4': 'grid-cols-4',
  '6x4': 'grid-cols-6'
};

const tileSizeClasses: Record<NonNullable<DeckConfig['tileSize']>, string> = {
  sm: 'min-h-20',
  md: 'min-h-24',
  lg: 'min-h-32'
};

const resolveSceneTargets = (
  scene: MyScene,
  devices: { id: string }[],
  rooms: Record<string, string>,
  favorites: string[]
) => {
  const targetIds = new Set<string>();
  const favoriteSet = new Set(favorites);
  scene.targets.forEach((target) => {
    if (target.kind === 'device' && target.id) {
      targetIds.add(target.id);
    }
    if (target.kind === 'room' && target.id) {
      devices
        .filter((device) => rooms[device.id] === target.id)
        .forEach((device) => targetIds.add(device.id));
    }
    if (target.kind === 'favorites') {
      favoriteSet.forEach((id) => targetIds.add(id));
    }
  });
  return Array.from(targetIds);
};

export const ControlDeckView = () => {
  const {
    devices,
    devicePower,
    favorites,
    rooms,
    roomNames,
    myScenes,
    deck,
    togglePower,
    setAllPower,
    setRoomPower,
    applyMyScene,
    saveDeck,
    setActiveView,
    deckFocus,
    setDeckFocus
  } = useAppStore();
  const [editMode, setEditMode] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone?: 'error' | 'info' } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tile: DeckTile } | null>(
    null
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);

  const [tileType, setTileType] = useState<DeckTile['kind']>('device');
  const [tileTarget, setTileTarget] = useState('');
  const [tileLabel, setTileLabel] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');

  useEffect(() => {
    if (!showAdd) return;
    setTileType('device');
    setTileTarget('');
    setTileLabel('');
    setDeviceSearch('');
    setDevicePickerOpen(false);
  }, [showAdd]);

  const filteredDevices = useMemo(() => {
    const query = deviceSearch.trim().toLowerCase();
    if (!query) return devices;
    return devices.filter((device) =>
      [device.name, device.model, device.sku]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [devices, deviceSearch]);

  const applyWithRefresh = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Action failed', tone: 'error' });
    }
  };

  const updateDeck = async (next: DeckConfig) => {
    await saveDeck(next);
  };

  const moveTile = async (index: number, delta: number) => {
    const nextTiles = [...deck.tiles];
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= nextTiles.length) return;
    const [tile] = nextTiles.splice(index, 1);
    nextTiles.splice(targetIndex, 0, tile);
    await updateDeck({ ...deck, tiles: nextTiles });
  };

  const removeTile = async (tileId: string) => {
    await updateDeck({ ...deck, tiles: deck.tiles.filter((tile) => tile.id !== tileId) });
  };

  const addTile = async () => {
    if (!tileTarget && tileType !== 'global') return;
    const id = window.crypto.randomUUID();
    let target: DeckTile['target'];
    if (tileType === 'global') {
      target = { action: tileTarget as 'all_on' | 'all_off' | 'refresh' };
    } else if (tileType === 'scene') {
      target = { sceneId: tileTarget };
    } else if (tileType === 'room') {
      target = { roomName: tileTarget };
    } else {
      const device = devices.find((item) => item.id === tileTarget);
      target = { deviceId: tileTarget, sku: device?.sku };
    }
    const label =
      tileLabel ||
      (tileType === 'global'
        ? tileTarget === 'all_on'
          ? 'All On'
          : tileTarget === 'all_off'
            ? 'All Off'
            : 'Refresh'
        : tileType === 'scene'
          ? myScenes.find((scene) => scene.id === tileTarget)?.name ?? 'Scene'
          : tileType === 'room'
            ? tileTarget
            : devices.find((device) => device.id === tileTarget)?.name ?? 'Device');
    const nextTile: DeckTile = {
      id,
      kind: tileType,
      label: label.trim() || 'Tile',
      target
    };
    await updateDeck({ ...deck, tiles: [...deck.tiles, nextTile] });
    setShowAdd(false);
  };

  const handleTileClick = (tile: DeckTile) => {
    if (tile.kind === 'global') {
      const action = tile.target.action;
      if (action === 'all_on') {
        void applyWithRefresh(() => setAllPower(true));
      } else if (action === 'all_off') {
        void applyWithRefresh(() => setAllPower(false));
      } else {
        void applyWithRefresh(() => refreshDeviceStates());
      }
      return;
    }
    if (tile.kind === 'scene') {
      void applyWithRefresh(() => applyMyScene(tile.target.sceneId));
      return;
    }
    if (tile.kind === 'room') {
      const roomDevices = devices.filter((device) => rooms[device.id] === tile.target.roomName);
      const anyOff = roomDevices.some((device) => !(devicePower[device.id] ?? true));
      void applyWithRefresh(() => setRoomPower(tile.target.roomName, anyOff));
      return;
    }
    if (tile.kind === 'device') {
      void applyWithRefresh(() => togglePower(tile.target.deviceId));
    }
  };

  const tileContent = (tile: DeckTile) => {
    if (tile.kind === 'global') {
      const icon =
        tile.target.action === 'refresh'
          ? RefreshCw
          : tile.target.action === 'all_on'
            ? Zap
            : Power;
      const Icon = icon;
      return (
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-mist-400">
            <span>Global</span>
            <Icon size={16} />
          </div>
          <p className="text-sm font-semibold">{tile.label}</p>
        </div>
      );
    }
    if (tile.kind === 'scene') {
      const scene = myScenes.find((item) => item.id === tile.target.sceneId);
      const targetIds = scene
        ? resolveSceneTargets(scene, devices, rooms, favorites)
        : [];
      return (
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-mist-400">
            <span>Scene</span>
            {!editMode && deck.gridPreset !== '6x4' && (
              <span className="text-mist-500">{targetIds.length} targets</span>
            )}
          </div>
          <p className="text-sm font-semibold">{scene?.name ?? tile.label}</p>
        </div>
      );
    }
    if (tile.kind === 'room') {
      const roomDevices = devices.filter((device) => rooms[device.id] === tile.target.roomName);
      const totalCount = roomDevices.length;
      return (
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-mist-400">
            <span>Room</span>
            {!editMode && deck.gridPreset !== '6x4' && <span>{totalCount} devices</span>}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{tile.label}</p>
          </div>
        </div>
      );
    }
    const device = devices.find((item) => item.id === tile.target.deviceId);
    return (
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-mist-400">
          <span>Device</span>
          <span className="text-mist-500">Quick toggle</span>
        </div>
        <div>
          <p className="text-sm font-semibold">{device?.name ?? tile.label}</p>
          <p className="text-xs text-mist-500">{device?.model}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setDeckFocus(!deckFocus)}
          >
            {deckFocus ? 'Exit Focus' : 'Focus Mode'}
          </Button>
          {!deckFocus && (
            <>
              <Button variant="secondary" onClick={() => setEditMode((prev) => !prev)}>
                <Pencil size={14} /> {editMode ? 'Done' : 'Edit Deck'}
              </Button>
              <div className="relative">
                <Button
                  variant="secondary"
                  onClick={() => setSettingsOpen((prev) => !prev)}
                >
                  <Settings size={14} />
                  Deck Settings
                </Button>
                {settingsOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setSettingsOpen(false)}
                    />
                    <div
                      className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-charcoal-800/95 p-3 shadow-softGlow z-30"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <p className="mb-2 text-xs text-mist-400">Grid size</p>
                      <select
                        className="transition-soft w-full rounded-xl border border-white/10 bg-charcoal-700/70 px-3 py-2 text-xs text-white"
                        value={deck.gridPreset}
                        onChange={(event) =>
                          void updateDeck({
                            ...deck,
                            gridPreset: event.currentTarget.value as DeckConfig['gridPreset']
                          })
                        }
                      >
                        {gridOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="mb-2 mt-3 text-xs text-mist-400">Tile size</p>
                      <select
                        className="transition-soft w-full rounded-xl border border-white/10 bg-charcoal-700/70 px-3 py-2 text-xs text-white"
                        value={deck.tileSize ?? 'md'}
                        onChange={(event) =>
                          void updateDeck({
                            ...deck,
                            tileSize: event.currentTarget.value as DeckConfig['tileSize']
                          })
                        }
                      >
                        {tileSizeOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {editMode && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add Tile
          </Button>
        )}
        {deck.tiles.length === 0 && !editMode && (
          <span className="text-xs text-mist-500">Build your deck for fast control</span>
        )}
      </div>

      <div className={`grid gap-4 ${gridColumns[deck.gridPreset]}`}>
        {deck.tiles.map((tile, index) => {
          const base =
            'relative overflow-hidden rounded-2xl border border-white/10 bg-charcoal-700/60 p-4 text-left shadow-softGlow transition-soft hover:shadow-soft hover:border-white/20';
          const sizeClass = tileSizeClasses[deck.tileSize ?? 'md'];
          const isOn =
            tile.kind === 'room'
              ? devices
                  .filter((device) => rooms[device.id] === tile.target.roomName)
                  .every((device) => devicePower[device.id] ?? true)
              : tile.kind === 'device'
                ? deviceStates[tile.target.deviceId]?.power ?? devicePower[tile.target.deviceId] ?? true
                : false;
          const glow = isOn ? 'ring-1 ring-emerald-400/40' : '';
          return (
            <button
              key={tile.id}
              className={`${base} ${sizeClass} ${glow}`}
              onClick={() => handleTileClick(tile)}
              onContextMenu={(event) => {
                event.preventDefault();
                setContextMenu({ x: event.clientX, y: event.clientY, tile });
              }}
            >
              {tileContent(tile)}
              {editMode && (
                <div className="absolute right-2 top-2 flex items-center gap-1">
                  <button
                    className="rounded-full bg-charcoal-800/70 p-1 text-mist-400 hover:text-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      setTileLabel(tile.label);
                      setTileType(tile.kind);
                      if (tile.kind === 'global') {
                        setTileTarget(tile.target.action);
                      } else if (tile.kind === 'scene') {
                        setTileTarget(tile.target.sceneId);
                      } else if (tile.kind === 'room') {
                        setTileTarget(tile.target.roomName);
                      } else {
                        setTileTarget(tile.target.deviceId);
                      }
                      setShowAdd(true);
                      void removeTile(tile.id);
                    }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="rounded-full bg-charcoal-800/70 p-1 text-mist-400 hover:text-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      void removeTile(tile.id);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
              {editMode && (
                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                  <button
                    className="rounded-full bg-charcoal-800/70 p-1 text-mist-400 hover:text-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      void moveTile(index, -1);
                    }}
                  >
                    <ArrowLeft size={12} />
                  </button>
                  <button
                    className="rounded-full bg-charcoal-800/70 p-1 text-mist-400 hover:text-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      void moveTile(index, 1);
                    }}
                  >
                    <ArrowRight size={12} />
                  </button>
                  <button
                    className="rounded-full bg-charcoal-800/70 p-1 text-mist-400 hover:text-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      const cols = deck.gridPreset === '6x4' ? 6 : deck.gridPreset === '4x4' ? 4 : 3;
                      void moveTile(index, -cols);
                    }}
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    className="rounded-full bg-charcoal-800/70 p-1 text-mist-400 hover:text-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      const cols = deck.gridPreset === '6x4' ? 6 : deck.gridPreset === '4x4' ? 4 : 3;
                      void moveTile(index, cols);
                    }}
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
          onContextMenu={(event) => {
            event.preventDefault();
            setContextMenu(null);
          }}
        >
          <div
            className="absolute rounded-xl border border-white/10 bg-charcoal-800/95 p-2 text-xs text-white shadow-softGlow"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-charcoal-700/80"
              onClick={() => {
                setContextMenu(null);
                setTileLabel(contextMenu.tile.label);
                setTileType(contextMenu.tile.kind);
                if (contextMenu.tile.kind === 'global') {
                  setTileTarget(contextMenu.tile.target.action);
                } else if (contextMenu.tile.kind === 'scene') {
                  setTileTarget(contextMenu.tile.target.sceneId);
                } else if (contextMenu.tile.kind === 'room') {
                  setTileTarget(contextMenu.tile.target.roomName);
                } else {
                  setTileTarget(contextMenu.tile.target.deviceId);
                }
                setShowAdd(true);
                void removeTile(contextMenu.tile.id);
              }}
            >
              <Pencil size={12} /> Edit tile
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-charcoal-700/80"
              onClick={() => {
                setContextMenu(null);
                void removeTile(contextMenu.tile.id);
              }}
            >
              <Trash2 size={12} /> Remove tile
            </button>
            {contextMenu.tile.kind === 'device' && (
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-charcoal-700/80"
                onClick={() => {
                  setContextMenu(null);
                  setActiveView('devices');
                }}
              >
                <Settings size={12} /> Open device details
              </button>
            )}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur">
          <Card className="w-full max-w-xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold">Add Tile</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <select
                className="transition-soft rounded-xl border border-white/10 bg-charcoal-700/70 px-3 py-2 text-xs text-white"
                value={tileType}
                onChange={(event) => {
                  const value = event.currentTarget.value as DeckTile['kind'];
                  setTileType(value);
                  setTileTarget('');
                  setDevicePickerOpen(false);
                }}
              >
                <option value="global">Global</option>
                <option value="scene">Scene</option>
                <option value="room">Room</option>
                <option value="device">Device</option>
              </select>
            </div>
            <div>
              {tileType === 'global' && (
                <select
                  className="transition-soft w-full rounded-xl border border-white/10 bg-charcoal-700/70 px-3 py-2 text-xs text-white"
                  value={tileTarget}
                  onChange={(event) => setTileTarget(event.currentTarget.value)}
                >
                  <option value="">Choose action</option>
                  <option value="all_on">All On</option>
                  <option value="all_off">All Off</option>
                  <option value="refresh">Refresh States</option>
                </select>
              )}
              {tileType === 'scene' && (
                <select
                  className="transition-soft w-full rounded-xl border border-white/10 bg-charcoal-700/70 px-3 py-2 text-xs text-white"
                  value={tileTarget}
                  onChange={(event) => setTileTarget(event.currentTarget.value)}
                >
                  <option value="">Select scene</option>
                  {myScenes.map((scene) => (
                    <option key={scene.id} value={scene.id}>
                      {scene.name}
                    </option>
                  ))}
                </select>
              )}
              {tileType === 'room' && (
                <select
                  className="transition-soft w-full rounded-xl border border-white/10 bg-charcoal-700/70 px-3 py-2 text-xs text-white"
                  value={tileTarget}
                  onChange={(event) => setTileTarget(event.currentTarget.value)}
                >
                  <option value="">Select room</option>
                  {roomNames.map((room) => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ))}
                </select>
              )}
              {tileType === 'device' && (
                <div className="relative">
                  <button
                    className="transition-soft w-full rounded-xl border border-white/10 bg-charcoal-700/70 px-3 py-2 text-left text-xs text-white"
                    onClick={() => setDevicePickerOpen((prev) => !prev)}
                    type="button"
                  >
                    {tileTarget
                      ? devices.find((device) => device.id === tileTarget)?.name ?? 'Select device'
                      : 'Select device'}
                  </button>
                  {devicePickerOpen && (
                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/10 bg-charcoal-800/95 p-2 shadow-softGlow">
                      <Input
                        placeholder="Search devices..."
                        value={deviceSearch}
                        onChange={(event) => setDeviceSearch(event.currentTarget.value)}
                      />
                      <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                        {filteredDevices.length === 0 && (
                          <p className="px-2 py-1 text-xs text-mist-500">No devices found.</p>
                        )}
                        {filteredDevices.map((device) => (
                          <button
                            key={device.id}
                            className="w-full rounded-lg px-2 py-2 text-left text-xs text-white hover:bg-charcoal-700/70"
                            onClick={() => {
                              setTileTarget(device.id);
                              setDevicePickerOpen(false);
                            }}
                            type="button"
                          >
                            {device.name} {device.model ? `• ${device.model}` : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <Input
              placeholder="Label (optional)"
              value={tileLabel}
              onChange={(event) => setTileLabel(event.currentTarget.value)}
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button onClick={() => void addTile()}>Save Tile</Button>
            </div>
          </Card>
        </div>
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
};
