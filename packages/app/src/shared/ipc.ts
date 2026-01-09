import type { Device, DeviceState, RGB, Scene } from '@lumalite/core';

// Shared IPC contract between main, preload, and renderer.

export type PreferenceName =
  | 'dockHidden'
  | 'proxyCaPath'
  | 'debugLogging'
  | 'onboardingComplete'
  | 'lanEnabled';

export type Config = {
  apiKey?: string;
  lastRefreshAt?: number;
  dockHidden?: boolean;
  proxyCaPath?: string;
  debugLogging?: boolean;
  onboardingComplete?: boolean;
  lanEnabled?: boolean;
  favorites?: string[];
  rooms?: Record<string, string>;
  roomNames?: string[];
  myScenes?: MyScene[];
  deviceScenesCache?: DeviceScenesCache;
  deck?: DeckConfig;
};

export type SceneTarget = {
  kind: 'device' | 'room' | 'favorites';
  id?: string;
};

export type SceneAction =
  | {
      capabilityInstance: 'powerSwitch' | 'brightness' | 'colorRgb' | 'colorTemperatureK';
      value: number | { r: number; g: number; b: number };
    }
  | {
      kind: 'capability';
      capabilityInstance: 'powerSwitch' | 'brightness' | 'colorRgb' | 'colorTemperatureK';
      value: number | { r: number; g: number; b: number };
    }
  | {
      kind: 'deviceScene';
      capability: { type: string; instance: string; value: unknown };
    };

export type SceneSchedule = {
  id: string;
  type: 'once' | 'daily' | 'weekly';
  time: string;
  date?: string;
  dayOfWeek?: number;
};

export type DeckTile = {
  id: string;
  kind: 'global' | 'scene' | 'room' | 'device';
  label: string;
  target:
    | { action: 'all_on' | 'all_off' | 'refresh' }
    | { sceneId: string }
    | { roomName: string }
    | { deviceId: string; sku?: string };
  appearance?: { icon?: string; accent?: string };
};

export type DeckConfig = {
  gridPreset: '3x3' | '4x4' | '6x4';
  tileSize?: 'sm' | 'md' | 'lg';
  sceneActiveThreshold: number;
  tiles: DeckTile[];
};

export type MyScene = {
  id: string;
  name: string;
  targets: SceneTarget[];
  actions: SceneAction[];
  actionMode?: 'global' | 'perDevice';
  perDeviceActions?: Record<string, SceneAction[]>;
  schedules?: SceneSchedule[];
};

export type DeviceSceneOption = {
  name: string;
  value: unknown;
  type: string;
  instance: string;
};

export type DeviceScenesCache = Record<
  string,
  {
    dynamic?: DeviceSceneOption[];
    diy?: DeviceSceneOption[];
    fetchedAt?: number;
  }
>;

export type Diagnostics = {
  appName?: string;
  appVersion?: string;
  platform?: string;
  arch?: string;
  buildMode?: 'development' | 'production';
  providerStatus: 'cloud' | 'missing-key' | 'error' | 'lan' | 'hybrid';
  devicesCount?: number;
  lastStateUpdateAt?: number;
  lastStateAgeSec?: number;
  lastError?: string;
  lastErrorAt?: number;
};

export const IPC_CHANNELS = {
  configGet: 'config:get',
  apiKeySet: 'config:setApiKey',
  preferenceSet: 'config:setPreference',
  preferencesGet: 'config:getPreferences',
  favoriteSet: 'config:setFavorite',
  roomSet: 'config:setDeviceRoom',
  roomListSet: 'config:setRoomList',
  roomRename: 'config:renameRoom',
  roomDelete: 'config:deleteRoom',
  appNavigate: 'app:navigate',
  scenesList: 'scenes:list',
  scenesSave: 'scenes:save',
  scenesDelete: 'scenes:delete',
  scenesDuplicate: 'scenes:duplicate',
  scenesApply: 'scenes:apply',
  deviceScenesGet: 'deviceScenes:get',
  deviceScenesFetch: 'deviceScenes:fetch',
  deviceScenesApplyDynamic: 'deviceScenes:applyDynamic',
  deviceScenesApplyDiy: 'deviceScenes:applyDiy',
  devicesList: 'devices:list',
  devicesRefresh: 'devices:refresh',
  deviceStateGet: 'deviceState:get',
  devicesPower: 'devices:power',
  devicesBrightness: 'devices:brightness',
  devicesColor: 'devices:color',
  logsDownload: 'logs:download',
  logsOpenFolder: 'logs:openFolder',
  openExternal: 'app:openExternal',
  deckGet: 'deck:get',
  deckSave: 'deck:save',
  diagnosticsGet: 'diagnostics:get'
} as const;

export type GoveeApi = {
  getConfig: () => Promise<Config>;
  getPreferences: () => Promise<Config>;
  setApiKey: (key: string) => Promise<Config>;
  setPreference: (name: PreferenceName, value: unknown) => Promise<Config>;
  setFavorite: (deviceId: string, isFavorite: boolean) => Promise<Config>;
  setDeviceRoom: (deviceId: string, roomName: string) => Promise<Config>;
  setRoomList: (rooms: string[]) => Promise<Config>;
  renameRoom: (from: string, to: string) => Promise<Config>;
  deleteRoom: (roomName: string) => Promise<Config>;
  onNavigate: (handler: (view: string) => void) => () => void;
  listScenes: () => Promise<MyScene[]>;
  saveScene: (scene: MyScene) => Promise<MyScene[]>;
  deleteScene: (sceneId: string) => Promise<MyScene[]>;
  duplicateScene: (sceneId: string) => Promise<MyScene[]>;
  applyScene: (sceneId: string) => Promise<{ appliedDevices: number; skippedActions: number }>;
  getDeviceScenes: (deviceId: string) => Promise<DeviceScenesCache[string] | undefined>;
  fetchDeviceScenes: (deviceId: string) => Promise<DeviceScenesCache[string] | undefined>;
  applyDynamicScene: (deviceId: string, scene: DeviceSceneOption) => Promise<void>;
  applyDiyScene: (deviceId: string, scene: DeviceSceneOption) => Promise<void>;
  refreshDevices: () => Promise<Device[]>;
  listDevices: () => Promise<Device[]>;
  getDeviceState: (deviceId: string) => Promise<DeviceState>;
  setPower: (id: string, on: boolean) => Promise<void>;
  setBrightness: (id: string, level: number) => Promise<void>;
  setColor: (id: string, rgb: RGB) => Promise<void>;
  getDiagnostics: () => Promise<Diagnostics>;
  downloadLogs: () => Promise<{ canceled: boolean; path?: string }>;
  openLogsFolder: () => Promise<{ ok: boolean; error?: string }>;
  openExternal: (url: string) => Promise<void>;
  getDeck: () => Promise<DeckConfig>;
  saveDeck: (deck: DeckConfig) => Promise<DeckConfig>;
};
