import { useEffect, useMemo, useState } from 'react';
import { Plus, Sparkles, Wand2, Trash2, Copy, Play, Target, X } from 'lucide-react';
import { useAppStore } from '../store';
import {
  Button,
  Card,
  Input,
  SearchInput,
  SegmentedControl,
  Slider,
  ToggleSwitch,
  Toast
} from '../components';
import type {
  DeviceSceneOption,
  MyScene,
  SceneAction,
  SceneSchedule,
  SceneTarget
} from '../../shared/ipc';

const tabs = [
  { id: 'my', label: 'My Scenes' },
  { id: 'device', label: 'Device Scenes' }
] as const;

type SceneDraft = {
  id: string;
  name: string;
  targets: SceneTarget[];
  actionMode: 'global' | 'perDevice';
  powerEnabled: boolean;
  powerOn: boolean;
  brightnessEnabled: boolean;
  brightness: number;
  colorEnabled: boolean;
  color: string;
  tempEnabled: boolean;
  temp: number;
  perDevice: Record<string, DeviceActionDraft>;
  schedules: SceneSchedule[];
};

type DeviceActionDraft = {
  powerEnabled: boolean;
  powerOn: boolean;
  brightnessEnabled: boolean;
  brightness: number;
  colorEnabled: boolean;
  color: string;
  tempEnabled: boolean;
  temp: number;
  scene?: DeviceSceneOption | null;
};

const createDeviceDraft = (overrides?: Partial<DeviceActionDraft>): DeviceActionDraft => ({
  powerEnabled: true,
  powerOn: true,
  brightnessEnabled: false,
  brightness: 80,
  colorEnabled: false,
  color: '#7ac8d6',
  tempEnabled: false,
  temp: 4000,
  scene: null,
  ...overrides
});

const toActions = (draft: SceneDraft): SceneAction[] => {
  const actions: SceneAction[] = [];
  if (draft.powerEnabled) {
    actions.push({
      kind: 'capability',
      capabilityInstance: 'powerSwitch',
      value: draft.powerOn ? 1 : 0
    });
  }
  if (draft.brightnessEnabled) {
    actions.push({ kind: 'capability', capabilityInstance: 'brightness', value: draft.brightness });
  }
  if (draft.colorEnabled) {
    const r = parseInt(draft.color.slice(1, 3), 16);
    const g = parseInt(draft.color.slice(3, 5), 16);
    const b = parseInt(draft.color.slice(5, 7), 16);
    actions.push({ kind: 'capability', capabilityInstance: 'colorRgb', value: { r, g, b } });
  }
  if (draft.tempEnabled) {
    actions.push({
      kind: 'capability',
      capabilityInstance: 'colorTemperatureK',
      value: draft.temp
    });
  }
  return actions;
};

const actionsToDeviceDraft = (actions: SceneAction[]): DeviceActionDraft => {
  const draft = createDeviceDraft();
  actions.forEach((action) => {
    if ('kind' in action && action.kind === 'deviceScene') {
      draft.scene = {
        name: 'Device Scene',
        value: action.capability.value,
        type: action.capability.type,
        instance: action.capability.instance
      };
      return;
    }
    if (!('capabilityInstance' in action)) return;
    const capabilityInstance = action.capabilityInstance;
    if (capabilityInstance === 'powerSwitch') {
      draft.powerEnabled = true;
      draft.powerOn = action.value === 1 || action.value === true;
    }
    if (capabilityInstance === 'brightness' && typeof action.value === 'number') {
      draft.brightnessEnabled = true;
      draft.brightness = action.value;
    }
    if (capabilityInstance === 'colorRgb' && typeof action.value === 'object') {
      const value = action.value as { r: number; g: number; b: number };
      draft.colorEnabled = true;
      draft.color = `#${((value.r << 16) + (value.g << 8) + value.b).toString(16).padStart(6, '0')}`;
    }
    if (capabilityInstance === 'colorTemperatureK' && typeof action.value === 'number') {
      draft.tempEnabled = true;
      draft.temp = action.value;
    }
  });
  return draft;
};

const toDraft = (scene?: MyScene): SceneDraft => {
  if (!scene) {
    return {
      id: window.crypto.randomUUID(),
      name: '',
      targets: [],
      actionMode: 'global',
      powerEnabled: true,
      powerOn: true,
      brightnessEnabled: false,
      brightness: 80,
      colorEnabled: false,
      color: '#7ac8d6',
      tempEnabled: false,
      temp: 4000,
      perDevice: {},
      schedules: []
    };
  }
  const power = scene.actions.find(
    (action): action is Extract<SceneAction, { capabilityInstance: string }> =>
      'capabilityInstance' in action && action.capabilityInstance === 'powerSwitch'
  );
  const brightness = scene.actions.find(
    (action): action is Extract<SceneAction, { capabilityInstance: string }> =>
      'capabilityInstance' in action && action.capabilityInstance === 'brightness'
  );
  const color = scene.actions.find(
    (action): action is Extract<SceneAction, { capabilityInstance: string }> =>
      'capabilityInstance' in action && action.capabilityInstance === 'colorRgb'
  );
  const temp = scene.actions.find(
    (action): action is Extract<SceneAction, { capabilityInstance: string }> =>
      'capabilityInstance' in action && action.capabilityInstance === 'colorTemperatureK'
  );
  const colorValue =
    typeof color?.value === 'object'
      ? `#${
          ((color.value.r << 16) + (color.value.g << 8) + color.value.b)
            .toString(16)
            .padStart(6, '0')
        }`
      : '#7ac8d6';
  const perDevice: Record<string, DeviceActionDraft> = {};
  if (scene.actionMode === 'perDevice' && scene.perDeviceActions) {
    Object.entries(scene.perDeviceActions).forEach(([deviceId, actions]) => {
      perDevice[deviceId] = actionsToDeviceDraft(actions);
    });
  }
  return {
    id: scene.id,
    name: scene.name,
    targets: scene.targets,
    actionMode: scene.actionMode ?? 'global',
    powerEnabled: Boolean(power),
    powerOn: power?.value === 1,
    brightnessEnabled: Boolean(brightness),
    brightness: typeof brightness?.value === 'number' ? brightness.value : 80,
    colorEnabled: Boolean(color),
    color: colorValue,
    tempEnabled: Boolean(temp),
    temp: typeof temp?.value === 'number' ? temp.value : 4000,
    perDevice,
    schedules: scene.schedules ?? []
  };
};

const weekdayOptions = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
] as const;

const supportsInstance = (device: { capabilities?: { instance: string }[] }, instance: string) =>
  device.capabilities?.some((cap) => cap.instance === instance) ?? true;

const sceneKey = (scene: DeviceSceneOption) =>
  `${scene.type}|${scene.instance}|${JSON.stringify(scene.value)}`;

export const ScenesView = () => {
  const {
    devices,
    favorites,
    rooms,
    roomNames,
    myScenes,
    deviceScenesCache,
    loadScenes,
    saveScene,
    deleteScene,
    duplicateScene,
    applyMyScene,
    fetchDeviceScenes,
    getDeviceScenes,
    applyDynamicScene,
    applyDiyScene
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'my' | 'device'>('my');
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<SceneDraft>(() => toDraft());
  const [toast, setToast] = useState<{ message: string; tone?: 'error' | 'info' } | null>(null);
  const [targetKind, setTargetKind] = useState<'device' | 'room' | 'favorites'>('device');
  const [targetValue, setTargetValue] = useState('');
  const [deviceTargetSearch, setDeviceTargetSearch] = useState('');
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);

  const [deviceSearch, setDeviceSearch] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  useEffect(() => {
    void loadScenes();
  }, [loadScenes]);

  const filteredDevices = useMemo(() => {
    const query = deviceSearch.trim().toLowerCase();
    if (!query) return devices;
    return devices.filter((device) =>
      [device.name, device.model, device.sku].filter(Boolean).join(' ').toLowerCase().includes(query)
    );
  }, [devices, deviceSearch]);

  const filteredTargetDevices = useMemo(() => {
    const query = deviceTargetSearch.trim().toLowerCase();
    if (!query) return devices;
    return devices.filter((device) =>
      [device.name, device.model, device.sku].filter(Boolean).join(' ').toLowerCase().includes(query)
    );
  }, [devices, deviceTargetSearch]);

  const selectedDevice = devices.find((device) => device.id === selectedDeviceId);
  const cacheEntry = selectedDeviceId ? deviceScenesCache[selectedDeviceId] : undefined;
  useEffect(() => {
    if (!selectedDeviceId) return;
    if (deviceScenesCache[selectedDeviceId]?.fetchedAt) return;
    void fetchDeviceScenes(selectedDeviceId);
  }, [selectedDeviceId, deviceScenesCache, fetchDeviceScenes]);

  const targetDeviceIds = useMemo(() => {
    const targetIds = new Set<string>();
    draft.targets.forEach((target) => {
      if (target.kind === 'device' && target.id) {
        targetIds.add(target.id);
      }
      if (target.kind === 'room' && target.id) {
        devices
          .filter((device) => rooms[device.id] === target.id)
          .forEach((device) => targetIds.add(device.id));
      }
      if (target.kind === 'favorites') {
        favorites.forEach((id) => targetIds.add(id));
      }
    });
    return Array.from(targetIds);
  }, [draft.targets, devices, rooms, favorites]);

  useEffect(() => {
    if (draft.actionMode !== 'perDevice') return;
    setDraft((prev) => {
      const nextPerDevice = { ...prev.perDevice };
      targetDeviceIds.forEach((deviceId) => {
        if (!nextPerDevice[deviceId]) {
          nextPerDevice[deviceId] = createDeviceDraft();
        }
      });
      Object.keys(nextPerDevice).forEach((deviceId) => {
        if (!targetDeviceIds.includes(deviceId)) {
          delete nextPerDevice[deviceId];
        }
      });
      return { ...prev, perDevice: nextPerDevice };
    });
  }, [draft.actionMode, targetDeviceIds]);

  const supportsTemp = targetDeviceIds.some((id) => {
    const device = devices.find((item) => item.id === id);
    return device ? supportsInstance(device, 'colorTemperatureK') : false;
  });

  const updateDeviceDraft = (deviceId: string, update: Partial<DeviceActionDraft>) => {
    setDraft((prev) => ({
      ...prev,
      perDevice: {
        ...prev.perDevice,
        [deviceId]: {
          ...(prev.perDevice[deviceId] ?? createDeviceDraft()),
          ...update
        }
      }
    }));
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      setToast({ message: 'Name your scene before saving.', tone: 'error' });
      return;
    }
    const perDeviceActions: Record<string, SceneAction[]> = {};
    if (draft.actionMode === 'perDevice') {
      targetDeviceIds.forEach((deviceId) => {
        const deviceDraft = draft.perDevice[deviceId] ?? createDeviceDraft();
        const actions: SceneAction[] = [];
        if (deviceDraft.powerEnabled) {
          actions.push({
            kind: 'capability',
            capabilityInstance: 'powerSwitch',
            value: deviceDraft.powerOn ? 1 : 0
          });
        }
        if (deviceDraft.brightnessEnabled) {
          actions.push({
            kind: 'capability',
            capabilityInstance: 'brightness',
            value: deviceDraft.brightness
          });
        }
        if (deviceDraft.colorEnabled) {
          const r = parseInt(deviceDraft.color.slice(1, 3), 16);
          const g = parseInt(deviceDraft.color.slice(3, 5), 16);
          const b = parseInt(deviceDraft.color.slice(5, 7), 16);
          actions.push({
            kind: 'capability',
            capabilityInstance: 'colorRgb',
            value: { r, g, b }
          });
        }
        if (deviceDraft.tempEnabled) {
          actions.push({
            kind: 'capability',
            capabilityInstance: 'colorTemperatureK',
            value: deviceDraft.temp
          });
        }
        if (deviceDraft.scene) {
          actions.push({
            kind: 'deviceScene',
            capability: {
              type: deviceDraft.scene.type,
              instance: deviceDraft.scene.instance,
              value: deviceDraft.scene.value
            }
          });
        }
        if (actions.length > 0) {
          perDeviceActions[deviceId] = actions;
        }
      });
    }
    const scene: MyScene = {
      id: draft.id,
      name: draft.name.trim(),
      targets: draft.targets,
      actions: draft.actionMode === 'global' ? toActions(draft) : [],
      actionMode: draft.actionMode,
      perDeviceActions: draft.actionMode === 'perDevice' ? perDeviceActions : undefined,
      schedules: draft.schedules
    };
    await saveScene(scene);
    setEditorOpen(false);
    setToast({ message: 'Scene saved.' });
  };

  const handleApply = async (sceneId: string) => {
    try {
      const result = await applyMyScene(sceneId);
      const skipNote = result.skippedActions ? ` (Skipped ${result.skippedActions})` : '';
      setToast({ message: `Applied scene to ${result.appliedDevices} devices${skipNote}.` });
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : 'Failed to apply scene.',
        tone: 'error'
      });
    }
  };

  const startEditor = (scene?: MyScene) => {
    setDraft(toDraft(scene));
    setEditorOpen(true);
    setTargetKind('device');
    setTargetValue('');
    setDeviceTargetSearch('');
    setDevicePickerOpen(false);
  };

  const addTarget = (target: SceneTarget) => {
    if (target.kind === 'favorites' && draft.targets.some((item) => item.kind === 'favorites')) {
      return;
    }
    if (target.kind !== 'favorites' && target.id) {
      if (draft.targets.some((item) => item.kind === target.kind && item.id === target.id)) {
        return;
      }
    }
    setDraft((prev) => ({ ...prev, targets: [...prev.targets, target] }));
  };

  const removeTarget = (index: number) => {
    setDraft((prev) => ({ ...prev, targets: prev.targets.filter((_, i) => i !== index) }));
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <SegmentedControl
          value={activeTab}
          options={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
          onChange={(id) => setActiveTab(id as 'my' | 'device')}
        />
      </Card>

      {activeTab === 'my' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <Button onClick={() => startEditor()}>
              <Plus size={16} /> New Scene
            </Button>
          </div>
          {myScenes.length === 0 ? (
            <div />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {myScenes.map((scene) => (
                <Card key={scene.id} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold">{scene.name}</p>
                      <p className="text-xs text-mist-500">
                        {scene.targets.length} targets •{' '}
                        {scene.actionMode === 'perDevice'
                          ? 'Per-device actions'
                          : `${scene.actions.length} actions`}
                      </p>
                    </div>
                    <Sparkles size={18} className="text-accent-400" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => void handleApply(scene.id)}>
                      <Play size={14} /> Apply
                    </Button>
                    <Button variant="secondary" onClick={() => startEditor(scene)}>
                      Edit
                    </Button>
                    <Button variant="secondary" onClick={() => void duplicateScene(scene.id)}>
                      <Copy size={14} /> Duplicate
                    </Button>
                    <Button variant="secondary" onClick={() => void deleteScene(scene.id)}>
                      <Trash2 size={14} /> Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'device' && (
        <div className="space-y-4">
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <SearchInput
                placeholder="Search devices..."
                value={deviceSearch}
                onChange={(event) => setDeviceSearch(event.currentTarget.value)}
              />
              <select
                className="transition-soft rounded-xl border border-white/10 bg-charcoal-700/70 px-3 py-2 text-xs text-white"
                value={selectedDeviceId}
                onChange={(event) => setSelectedDeviceId(event.currentTarget.value)}
              >
                <option value="">Select a device</option>
                {filteredDevices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name} {device.sku ? `• ${device.sku}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-mist-500">
              {cacheEntry?.fetchedAt
                ? `Last fetched ${new Date(cacheEntry.fetchedAt).toLocaleTimeString()}`
                : 'Select a device to view its built-in scenes.'}
            </p>
          </Card>

          {!selectedDevice && (
            <Card>
              <p className="text-sm text-mist-400">Select a device to view its built-in scenes.</p>
            </Card>
          )}

          {selectedDevice && (
            <div className="space-y-4">
              <Card className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-mist-400">
                  <Wand2 size={16} /> Dynamic Scenes
                </div>
                {cacheEntry?.dynamic?.length ? (
                  <div className="space-y-2">
                    {cacheEntry.dynamic.map((scene) => (
                      <div
                        key={`${scene.name}-${String(scene.value)}`}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-charcoal-700/60 px-4 py-3 text-sm"
                      >
                        <p>{scene.name}</p>
                        <Button
                          variant="secondary"
                          onClick={() => void applyDynamicScene(selectedDevice.id, scene)}
                        >
                          Apply
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-mist-500">No dynamic scenes available.</p>
                )}
              </Card>
              <Card className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-mist-400">
                  <Target size={16} /> DIY Scenes
                </div>
                {cacheEntry?.diy?.length ? (
                  <div className="space-y-2">
                    {cacheEntry.diy.map((scene) => (
                      <div
                        key={`${scene.name}-${String(scene.value)}`}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-charcoal-700/60 px-4 py-3 text-sm"
                      >
                        <p>{scene.name}</p>
                        <Button
                          variant="secondary"
                          onClick={() => void applyDiyScene(selectedDevice.id, scene)}
                        >
                          Apply
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-mist-500">No DIY scenes available.</p>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur">
          <Card className="w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold">Scene Editor</p>
              <Button variant="ghost" onClick={() => setEditorOpen(false)}>
                <X size={16} />
              </Button>
            </div>
            <Input
              placeholder="Scene name"
              value={draft.name}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setDraft((prev) => ({ ...prev, name: value }));
              }}
            />

            <div className="space-y-3">
              <p className="text-sm text-mist-400">Targets</p>
              <div className="flex flex-wrap gap-2">
                {draft.targets.map((target, index) => (
                  <span
                    key={`${target.kind}-${target.id ?? index}`}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-charcoal-700/60 px-3 py-1 text-xs"
                  >
                    {target.kind === 'favorites'
                      ? 'Favorites'
                      : target.kind === 'device'
                        ? devices.find((device) => device.id === target.id)?.name ?? target.id
                        : target.id}
                    <button onClick={() => removeTarget(index)}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="grid gap-2 lg:grid-cols-[1fr,1fr,auto]">
                <select
                  className="transition-soft rounded-xl border border-white/10 bg-charcoal-700/70 px-3 py-2 text-xs text-white"
                  value={targetKind}
                  onChange={(event) => {
                    const value = event.currentTarget.value as 'device' | 'room' | 'favorites';
                    setTargetKind(value);
                    setTargetValue('');
                    setDevicePickerOpen(false);
                  }}
                >
                  <option value="device">Device</option>
                  <option value="room">Room</option>
                  <option value="favorites">Favorites</option>
                </select>
                {targetKind === 'room' ? (
                  <select
                    className="transition-soft rounded-xl border border-white/10 bg-charcoal-700/70 px-3 py-2 text-xs text-white"
                    value={targetValue}
                    onChange={(event) => setTargetValue(event.currentTarget.value)}
                  >
                    <option value="">Select room</option>
                    {roomNames.map((room) => (
                      <option key={room} value={room}>
                        {room}
                      </option>
                    ))}
                  </select>
                ) : targetKind === 'favorites' ? (
                  <div className="rounded-xl border border-white/10 bg-charcoal-700/70 px-3 py-2 text-xs text-mist-500">
                    Favorites
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      className="transition-soft w-full rounded-xl border border-white/10 bg-charcoal-700/70 px-3 py-2 text-left text-xs text-white"
                      onClick={() => setDevicePickerOpen((prev) => !prev)}
                      type="button"
                    >
                      {targetValue
                        ? devices.find((device) => device.id === targetValue)?.name ?? 'Select device'
                        : 'Select device'}
                    </button>
                    {devicePickerOpen && (
                      <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/10 bg-charcoal-800/95 p-2 shadow-softGlow">
                        <Input
                          placeholder="Search devices..."
                          value={deviceTargetSearch}
                          onChange={(event) => setDeviceTargetSearch(event.currentTarget.value)}
                        />
                        <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                          {filteredTargetDevices.length === 0 && (
                            <p className="px-2 py-1 text-xs text-mist-500">No devices found.</p>
                          )}
                          {filteredTargetDevices.map((device) => (
                            <button
                              key={device.id}
                              className="w-full rounded-lg px-2 py-2 text-left text-xs text-white hover:bg-charcoal-700/70"
                              onClick={() => {
                                setTargetValue(device.id);
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
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (targetKind === 'favorites') {
                      addTarget({ kind: 'favorites' });
                      return;
                    }
                    if (!targetValue) return;
                    addTarget({ kind: targetKind, id: targetValue });
                    setTargetValue('');
                  }}
                >
                  Add target
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-mist-400">Actions</p>
                <div className="flex items-center gap-2 text-xs text-mist-400">
                  <span>Per-device</span>
                  <ToggleSwitch
                    checked={draft.actionMode === 'perDevice'}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        actionMode: prev.actionMode === 'perDevice' ? 'global' : 'perDevice'
                      }))
                    }
                  />
                </div>
              </div>
              {draft.actionMode === 'global' ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  <Card className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm">Power</p>
                      <ToggleSwitch
                        checked={draft.powerEnabled}
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, powerEnabled: !prev.powerEnabled }))
                        }
                      />
                    </div>
                    {draft.powerEnabled && (
                      <div className="flex items-center gap-3 text-xs text-mist-400">
                        <ToggleSwitch
                          checked={draft.powerOn}
                          onClick={() => setDraft((prev) => ({ ...prev, powerOn: !prev.powerOn }))}
                        />
                        {draft.powerOn ? 'On' : 'Off'}
                      </div>
                    )}
                  </Card>
                  <Card className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm">Brightness</p>
                      <ToggleSwitch
                        checked={draft.brightnessEnabled}
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            brightnessEnabled: !prev.brightnessEnabled
                          }))
                        }
                      />
                    </div>
                    {draft.brightnessEnabled && (
                      <Slider
                        min={0}
                        max={100}
                        value={draft.brightness}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            brightness: Number(event.currentTarget.value)
                          }))
                        }
                      />
                    )}
                  </Card>
                  <Card className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm">Color</p>
                      <ToggleSwitch
                        checked={draft.colorEnabled}
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, colorEnabled: !prev.colorEnabled }))
                        }
                      />
                    </div>
                    {draft.colorEnabled && (
                      <input
                        type="color"
                        className="h-10 w-24 cursor-pointer rounded-xl border border-white/10 bg-charcoal-700/70"
                        value={draft.color}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, color: event.currentTarget.value }))
                        }
                      />
                    )}
                  </Card>
                  <Card className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm">Color Temp (K)</p>
                      <ToggleSwitch
                        checked={draft.tempEnabled}
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, tempEnabled: !prev.tempEnabled }))
                        }
                      />
                    </div>
                    {draft.tempEnabled && (
                      <Slider
                        min={2000}
                        max={9000}
                        value={draft.temp}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            temp: Number(event.currentTarget.value)
                          }))
                        }
                      />
                    )}
                    {!supportsTemp && draft.tempEnabled && (
                      <p className="text-xs text-amberlite-500">
                        Some targets may not support color temperature.
                      </p>
                    )}
                  </Card>
                </div>
              ) : (
                <div className="space-y-3">
                  {targetDeviceIds.length === 0 ? (
                    <Card>
                      <p className="text-xs text-mist-500">
                        Add device targets to configure per-device actions.
                      </p>
                    </Card>
                  ) : (
                    targetDeviceIds.map((deviceId) => {
                      const device = devices.find((item) => item.id === deviceId);
                      if (!device) return null;
                      const deviceDraft = draft.perDevice[deviceId] ?? createDeviceDraft();
                      const cache = deviceScenesCache[deviceId];
                      const dynamic = cache?.dynamic ?? [];
                      const diy = cache?.diy ?? [];
                      const allScenes = [...dynamic, ...diy];
                      const selectedSceneKey = deviceDraft.scene ? sceneKey(deviceDraft.scene) : '';
                      return (
                        <Card key={deviceId} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold">{device.name}</p>
                              <p className="text-xs text-mist-500">{device.model}</p>
                            </div>
                          </div>
                          <div className="grid gap-2 lg:grid-cols-[1fr,auto]">
                            <select
                              className="transition-soft rounded-xl border border-white/10 bg-charcoal-700/70 px-3 py-2 text-xs text-white"
                              value={selectedSceneKey}
                              onChange={(event) => {
                                const nextKey = event.currentTarget.value;
                                if (!nextKey) {
                                  updateDeviceDraft(deviceId, { scene: null });
                                  return;
                                }
                                const match = allScenes.find((scene) => sceneKey(scene) === nextKey);
                                updateDeviceDraft(deviceId, { scene: match ?? null });
                              }}
                              onClick={() => {
                                if (!cache?.fetchedAt) {
                                  void fetchDeviceScenes(deviceId);
                                }
                              }}
                            >
                              <option value="">No device scene</option>
                              {dynamic.length > 0 && (
                                <optgroup label="Dynamic">
                                  {dynamic.map((scene) => (
                                    <option key={sceneKey(scene)} value={sceneKey(scene)}>
                                      {scene.name}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {diy.length > 0 && (
                                <optgroup label="DIY">
                                  {diy.map((scene) => (
                                    <option key={sceneKey(scene)} value={sceneKey(scene)}>
                                      {scene.name}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                            <div />
                          </div>
                          <div className="grid gap-3 lg:grid-cols-2">
                            <Card className="space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm">Power</p>
                                <ToggleSwitch
                                  checked={deviceDraft.powerEnabled}
                                  onClick={() =>
                                    updateDeviceDraft(deviceId, {
                                      powerEnabled: !deviceDraft.powerEnabled
                                    })
                                  }
                                />
                              </div>
                              {deviceDraft.powerEnabled && (
                                <div className="flex items-center gap-3 text-xs text-mist-400">
                                  <ToggleSwitch
                                    checked={deviceDraft.powerOn}
                                    onClick={() =>
                                      updateDeviceDraft(deviceId, { powerOn: !deviceDraft.powerOn })
                                    }
                                  />
                                  {deviceDraft.powerOn ? 'On' : 'Off'}
                                </div>
                              )}
                            </Card>
                            <Card className="space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm">Brightness</p>
                                <ToggleSwitch
                                  checked={deviceDraft.brightnessEnabled}
                                  onClick={() =>
                                    updateDeviceDraft(deviceId, {
                                      brightnessEnabled: !deviceDraft.brightnessEnabled
                                    })
                                  }
                                />
                              </div>
                              {deviceDraft.brightnessEnabled && (
                                <Slider
                                  min={0}
                                  max={100}
                                  value={deviceDraft.brightness}
                                  onChange={(event) =>
                                    updateDeviceDraft(deviceId, {
                                      brightness: Number(event.currentTarget.value)
                                    })
                                  }
                                />
                              )}
                            </Card>
                            <Card className="space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm">Color</p>
                                <ToggleSwitch
                                  checked={deviceDraft.colorEnabled}
                                  onClick={() =>
                                    updateDeviceDraft(deviceId, {
                                      colorEnabled: !deviceDraft.colorEnabled
                                    })
                                  }
                                />
                              </div>
                              {deviceDraft.colorEnabled && (
                                <input
                                  type="color"
                                  className="h-10 w-24 cursor-pointer rounded-xl border border-white/10 bg-charcoal-700/70"
                                  value={deviceDraft.color}
                                  onChange={(event) =>
                                    updateDeviceDraft(deviceId, { color: event.currentTarget.value })
                                  }
                                />
                              )}
                            </Card>
                            <Card className="space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm">Color Temp (K)</p>
                                <ToggleSwitch
                                  checked={deviceDraft.tempEnabled}
                                  onClick={() =>
                                    updateDeviceDraft(deviceId, {
                                      tempEnabled: !deviceDraft.tempEnabled
                                    })
                                  }
                                />
                              </div>
                              {deviceDraft.tempEnabled && (
                                <Slider
                                  min={2000}
                                  max={9000}
                                  value={deviceDraft.temp}
                                  onChange={(event) =>
                                    updateDeviceDraft(deviceId, {
                                      temp: Number(event.currentTarget.value)
                                    })
                                  }
                                />
                              )}
                            </Card>
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-mist-400">Schedules</p>
                <Button
                  variant="secondary"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      schedules: [
                        ...prev.schedules,
                        {
                          id: window.crypto.randomUUID(),
                          type: 'daily',
                          time: '18:00'
                        }
                      ]
                    }))
                  }
                >
                  Add Schedule
                </Button>
              </div>
              {draft.schedules.length === 0 ? (
                <Card>
                  <p className="text-xs text-mist-500">
                    Add a schedule to run this scene automatically.
                  </p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {draft.schedules.map((schedule) => (
                    <Card key={schedule.id} className="space-y-2">
                      <div className="grid gap-2 lg:grid-cols-[1fr,1fr,auto]">
                        <select
                          className="transition-soft rounded-xl border border-white/10 bg-charcoal-700/70 px-3 py-2 text-xs text-white"
                          value={schedule.type}
                          onChange={(event) => {
                            const value = event.currentTarget.value as SceneSchedule['type'];
                            setDraft((prev) => ({
                              ...prev,
                              schedules: prev.schedules.map((item) =>
                                item.id === schedule.id
                                  ? {
                                      ...item,
                                      type: value,
                                      dayOfWeek: value === 'weekly' ? item.dayOfWeek ?? 1 : undefined,
                                      date: value === 'once' ? item.date ?? '' : undefined
                                    }
                                  : item
                              )
                            }));
                          }}
                        >
                          <option value="once">One-time</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                        </select>
                        {schedule.type === 'weekly' ? (
                          <select
                            className="transition-soft rounded-xl border border-white/10 bg-charcoal-700/70 px-3 py-2 text-xs text-white"
                            value={schedule.dayOfWeek ?? 1}
                            onChange={(event) => {
                              const value = Number(event.currentTarget.value);
                              setDraft((prev) => ({
                                ...prev,
                                schedules: prev.schedules.map((item) =>
                                  item.id === schedule.id
                                    ? { ...item, dayOfWeek: value }
                                    : item
                                )
                              }));
                            }}
                          >
                            {weekdayOptions.map((day) => (
                              <option key={day.value} value={day.value}>
                                {day.label}
                              </option>
                            ))}
                          </select>
                        ) : schedule.type === 'once' ? (
                          <Input
                            type="date"
                            value={schedule.date ?? ''}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              setDraft((prev) => ({
                                ...prev,
                                schedules: prev.schedules.map((item) =>
                                  item.id === schedule.id ? { ...item, date: value } : item
                                )
                              }));
                            }}
                          />
                        ) : (
                          <div />
                        )}
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              schedules: prev.schedules.filter((item) => item.id !== schedule.id)
                            }))
                          }
                        >
                          <X size={14} />
                        </Button>
                      </div>
                      <Input
                        type="time"
                        value={schedule.time}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setDraft((prev) => ({
                            ...prev,
                            schedules: prev.schedules.map((item) =>
                              item.id === schedule.id ? { ...item, time: value } : item
                            )
                          }));
                        }}
                      />
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handleSave()}>Save Scene</Button>
            </div>
          </Card>
        </div>
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
};
