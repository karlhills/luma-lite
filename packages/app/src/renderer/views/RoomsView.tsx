import { useMemo, useState } from 'react';
import { Home, Plus, Power, Droplet, Pencil, Trash2, Check, X } from 'lucide-react';
import { useAppStore } from '../store';
import { Button, Card, IconButton, Input, Slider, ToggleSwitch } from '../components';

export const RoomsView = () => {
  const {
    roomNames,
    rooms,
    devices,
    devicePower,
    setRoomList,
    setDeviceRoom,
    renameRoom,
    deleteRoom,
    setRoomPower,
    setRoomBrightness,
    setRoomColor
  } = useAppStore();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [roomPickerOpen, setRoomPickerOpen] = useState<string | null>(null);
  const [deviceSearch, setDeviceSearch] = useState<Record<string, string>>({});

  const roomCounts = roomNames.map((room) => ({
    name: room,
    count: Object.values(rooms).filter((value) => value === room).length
  }));

  const filteredDevices = useMemo(() => {
    const query = (deviceSearch[roomPickerOpen ?? ''] ?? '').trim().toLowerCase();
    if (!query) return devices;
    return devices.filter((device) =>
      [device.name, device.model, device.sku].filter(Boolean).join(' ').toLowerCase().includes(query)
    );
  }, [devices, deviceSearch, roomPickerOpen]);

  const handleAdd = async () => {
    const value = draft.trim();
    if (!value) return;
    if (!roomNames.includes(value)) {
      await setRoomList([...roomNames, value]);
    }
    setDraft('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-mist-400">
          <Home size={16} /> Rooms
        </div>
        <Button variant="secondary" onClick={() => setShowAddModal(true)}>
          <Plus size={14} />
          Add Room
        </Button>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {roomCounts.map((room) => {
          const roomDevices = devices.filter((device) => rooms[device.id] === room.name);
          const anyOff = roomDevices.some((device) => !(devicePower[device.id] ?? true));
          const supportsBrightness = roomDevices.some((device) =>
            device.supportedCommands.some((command) =>
              command.includes('range') || command.includes('brightness')
            )
          );
          const supportsColor = roomDevices.some((device) =>
            device.supportedCommands.some((command) => command.includes('color'))
          );
          return (
            <Card key={room.name} className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {editing === room.name ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editValue}
                        onChange={(event) => setEditValue(event.currentTarget.value)}
                      />
                      <IconButton
                        onClick={async () => {
                          const value = editValue.trim();
                          if (!value) return;
                          await renameRoom(room.name, value);
                          setEditing(null);
                          setEditValue('');
                        }}
                      >
                        <Check size={14} />
                      </IconButton>
                      <IconButton
                        onClick={() => {
                          setEditing(null);
                          setEditValue('');
                        }}
                      >
                        <X size={14} />
                      </IconButton>
                    </div>
                  ) : (
                    <>
                      <p className="text-base font-semibold">{room.name}</p>
                      <p className="text-xs text-mist-500">{room.count} device(s)</p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <IconButton
                    onClick={() => {
                      setEditing(room.name);
                      setEditValue(room.name);
                    }}
                  >
                    <Pencil size={14} />
                  </IconButton>
                  <IconButton onClick={() => void deleteRoom(room.name)}>
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              </div>
              <div className="relative">
                <Button
                  variant="secondary"
                  onClick={() =>
                    setRoomPickerOpen((prev) => (prev === room.name ? null : room.name))
                  }
                >
                  Add Devices
                </Button>
                {roomPickerOpen === room.name && (
                  <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/10 bg-charcoal-800/95 p-2 shadow-softGlow">
                    <Input
                      placeholder="Search devices..."
                      value={deviceSearch[room.name] ?? ''}
                      onChange={(event) =>
                        setDeviceSearch((prev) => ({
                          ...prev,
                          [room.name]: event.currentTarget.value
                        }))
                      }
                    />
                    <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                      {filteredDevices
                        .filter((device) => rooms[device.id] !== room.name)
                        .map((device) => (
                          <button
                            key={device.id}
                            className="w-full rounded-lg px-2 py-2 text-left text-xs text-white hover:bg-charcoal-700/70"
                            onClick={() => {
                              void setDeviceRoom(device.id, room.name);
                            }}
                            type="button"
                          >
                            {device.name} {device.model ? `• ${device.model}` : ''}
                          </button>
                        ))}
                      {filteredDevices.filter((device) => rooms[device.id] !== room.name).length ===
                        0 && (
                        <p className="px-2 py-1 text-xs text-mist-500">
                          No devices available.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-charcoal-700/60 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-mist-400">
                  <Power size={14} /> Power
                </div>
                <ToggleSwitch
                  checked={!anyOff}
                  onClick={() => void setRoomPower(room.name, anyOff)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-mist-400">
                  <span className="inline-flex items-center gap-2">
                    <Power size={14} /> Brightness
                  </span>
                  <span>0 - 100</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  defaultValue={80}
                  onChange={(event) =>
                    void setRoomBrightness(room.name, Number(event.currentTarget.value))
                  }
                  disabled={!supportsBrightness}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-mist-400 inline-flex items-center gap-2">
                  <Droplet size={14} /> Color
                </div>
                <input
                  type="color"
                  className="h-8 w-16 cursor-pointer rounded-xl border border-white/10 bg-charcoal-700/70"
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    const r = parseInt(value.slice(1, 3), 16);
                    const g = parseInt(value.slice(3, 5), 16);
                    const b = parseInt(value.slice(5, 7), 16);
                    void setRoomColor(room.name, { r, g, b });
                  }}
                  disabled={!supportsColor}
                />
              </div>
            </Card>
          );
        })}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur">
          <Card className="w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold">New Room</p>
              <Button variant="ghost" onClick={() => setShowAddModal(false)}>
                <X size={16} />
              </Button>
            </div>
            <Input
              placeholder="Room name"
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handleAdd()}>
                <Plus size={14} /> Add Room
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
