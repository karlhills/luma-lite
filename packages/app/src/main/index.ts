import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, promises as fs } from 'node:fs';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { Agent, setGlobalDispatcher } from 'undici';
import { DeviceService } from './deviceService.js';
import { createTray } from './tray.js';
import { createConfigStore } from './config.js';
import {
  IPC_CHANNELS,
  type PreferenceName,
  type Config,
  type MyScene,
  type SceneAction,
  type SceneSchedule
} from '../shared/ipc.js';

dotenv.config({ path: join(process.cwd(), '.env') });
dotenv.config({ path: join(process.cwd(), 'packages/app/.env') });
const applyDebugFlag = (enabled?: boolean) => {
  process.env.GOVEE_DEBUG = enabled ? '1' : '0';
  if (enabled) {
    console.log('[govee] debug enabled');
  }
};
const toPem = (buffer: Buffer) => {
  const base64 = buffer.toString('base64');
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`;
};

const applyTlsConfig = async (proxyCaPath?: string) => {
  if (proxyCaPath) {
    try {
      const raw = await fs.readFile(proxyCaPath);
      const text = raw.toString('utf-8');
      const ca = text.includes('BEGIN CERTIFICATE') ? raw : Buffer.from(toPem(raw));
      setGlobalDispatcher(
        new Agent({
          connect: {
            ca,
            rejectUnauthorized: true
          }
        })
      );
      console.log('[govee] TLS CA loaded from', proxyCaPath);
      return;
    } catch (error) {
      console.log('[govee] Failed to load proxy CA', error);
    }
  }

  if (process.env.GOVEE_ALLOW_INSECURE_TLS === '1') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    setGlobalDispatcher(
      new Agent({
        connect: {
          rejectUnauthorized: false
        }
      })
    );
    app.commandLine.appendSwitch('ignore-certificate-errors');
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toRgbInt = (value: number | { r: number; g: number; b: number }) => {
  if (typeof value === 'number') return value;
  return (value.r << 16) + (value.g << 8) + value.b;
};

const actionToCapability = (action: SceneAction) => {
  if ('kind' in action && action.kind === 'deviceScene') {
    return action.capability;
  }
  if (!('capabilityInstance' in action)) {
    return {
      type: 'devices.capabilities.on_off',
      instance: 'powerSwitch',
      value: 1
    };
  }
  const capabilityInstance = action.capabilityInstance;
  const value = action.value;
  if (capabilityInstance === 'powerSwitch') {
    return {
      type: 'devices.capabilities.on_off',
      instance: 'powerSwitch',
      value: value === 1 || value === true ? 1 : value === 0 ? 0 : 1
    };
  }
  if (capabilityInstance === 'brightness') {
    return {
      type: 'devices.capabilities.range',
      instance: 'brightness',
      value: typeof value === 'number' ? value : 100
    };
  }
  if (capabilityInstance === 'colorRgb') {
    return {
      type: 'devices.capabilities.color_setting',
      instance: 'colorRgb',
      value: toRgbInt(value as number | { r: number; g: number; b: number })
    };
  }
  if (capabilityInstance === 'colorTemperatureK') {
    return {
      type: 'devices.capabilities.color_setting',
      instance: 'colorTemperatureK',
      value: typeof value === 'number' ? value : 4000
    };
  }
  return {
    type: 'devices.capabilities.on_off',
    instance: 'powerSwitch',
    value: 1
  };
};

const isRateLimitError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const message = (error as Error).message ?? '';
  return message.includes('429') || message.toLowerCase().includes('rate');
};

const parseTime = (time: string) => {
  const [hours, minutes] = time.split(':').map((value) => Number(value));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return { hours, minutes };
};

const getNextRun = (schedule: SceneSchedule, now = new Date()) => {
  const parsed = parseTime(schedule.time);
  if (!parsed) return null;
  const { hours, minutes } = parsed;
  const current = new Date(now);
  const target = new Date(now);
  if (schedule.type === 'once') {
    if (!schedule.date) return null;
    const [year, month, day] = schedule.date.split('-').map((value) => Number(value));
    if (!year || !month || !day) return null;
    target.setFullYear(year, month - 1, day);
    target.setHours(hours, minutes, 0, 0);
    if (target <= current) return null;
    return target;
  }
  if (schedule.type === 'daily') {
    target.setHours(hours, minutes, 0, 0);
    if (target <= current) {
      target.setDate(target.getDate() + 1);
    }
    return target;
  }
  if (schedule.type === 'weekly') {
    const dayOfWeek = schedule.dayOfWeek ?? 0;
    const currentDay = target.getDay();
    const delta = (dayOfWeek - currentDay + 7) % 7;
    target.setDate(target.getDate() + delta);
    target.setHours(hours, minutes, 0, 0);
    if (target <= current) {
      target.setDate(target.getDate() + 7);
    }
    return target;
  }
  return null;
};

const applyMySceneById = async (
  sceneId: string,
  deviceService: DeviceService,
  configStore: ReturnType<typeof createConfigStore>
) => {
  const config = await configStore.loadConfig();
  const scene = (config.myScenes ?? []).find((item) => item.id === sceneId);
  if (!scene) {
    return { appliedDevices: 0, skippedActions: 0 };
  }

  const devices = await deviceService.listDevices();
  const favorites = new Set(config.favorites ?? []);
  const rooms = config.rooms ?? {};
  const targets = new Set<string>();

  scene.targets.forEach((target) => {
    if (target.kind === 'device' && target.id) {
      targets.add(target.id);
    }
    if (target.kind === 'room' && target.id) {
      devices
        .filter((device) => rooms[device.id] === target.id)
        .forEach((device) => targets.add(device.id));
    }
    if (target.kind === 'favorites') {
      favorites.forEach((id) => targets.add(id));
    }
  });

  let skippedActions = 0;
  let appliedDevices = 0;

  for (const device of devices) {
    if (!targets.has(device.id)) continue;
    const actions =
      scene.actionMode === 'perDevice'
        ? scene.perDeviceActions?.[device.id] ?? []
        : scene.actions;
    if (actions.length === 0) continue;
    appliedDevices += 1;
    for (const action of actions) {
      const capability = actionToCapability(action);
      const supported =
        device.capabilities?.some((cap) => cap.instance === capability.instance) ?? true;
      if (!supported) {
        skippedActions += 1;
        continue;
      }
      let attempts = 0;
      while (attempts < 2) {
        try {
          await deviceService.controlCapability(device.id, capability, { propagateError: true });
          break;
        } catch (error) {
          attempts += 1;
          if (isRateLimitError(error) && attempts < 2) {
            await sleep(800);
            continue;
          }
          throw error;
        }
      }
      await sleep(120);
    }
  }

  return { appliedDevices, skippedActions };
};

const createScheduler = (
  deviceService: DeviceService,
  configStore: ReturnType<typeof createConfigStore>
) => {
  const timers = new Map<string, NodeJS.Timeout>();

  const clearTimers = () => {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
  };

  const scheduleOne = (sceneId: string, schedule: SceneSchedule) => {
    const nextRun = getNextRun(schedule);
    if (!nextRun) return;
    const delay = Math.max(0, nextRun.getTime() - Date.now());
    const timer = setTimeout(async () => {
      try {
        await applyMySceneById(sceneId, deviceService, configStore);
      } catch (error) {
        console.log('[govee] schedule apply failed', error);
      }
      if (schedule.type === 'once') {
        const config = await configStore.loadConfig();
        const scenes = (config.myScenes ?? []).map((scene) => {
          if (scene.id !== sceneId) return scene;
          return {
            ...scene,
            schedules: (scene.schedules ?? []).filter((item) => item.id !== schedule.id)
          };
        });
        await configStore.saveConfig({ myScenes: scenes });
      }
      scheduleAll();
    }, delay);
    timers.set(schedule.id, timer);
  };

  const scheduleAll = async () => {
    clearTimers();
    const config = await configStore.loadConfig();
    const scenes = config.myScenes ?? [];
    scenes.forEach((scene) => {
      (scene.schedules ?? []).forEach((schedule) => {
        scheduleOne(scene.id, schedule);
      });
    });
  };

  return { scheduleAll };
};

const currentDir = dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let logFilePath = '';

const setupLogFile = async () => {
  const logDir = app.getPath('userData');
  logFilePath = join(logDir, 'lumalite.log');
  try {
    await fs.mkdir(logDir, { recursive: true });
  } catch {
    return;
  }
  const append = async (level: string, message: string) => {
    const line = `${new Date().toISOString()} [${level}] ${message}\n`;
    try {
      await fs.appendFile(logFilePath, line, 'utf-8');
    } catch {
      // Ignore logging failures.
    }
  };
  const original = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  };
  console.log = (...args: unknown[]) => {
    original.log(...args);
    void append('info', args.map(String).join(' '));
  };
  console.warn = (...args: unknown[]) => {
    original.warn(...args);
    void append('warn', args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    original.error(...args);
    void append('error', args.map(String).join(' '));
  };
};

const resolvePreloadPath = () => {
  const localMjs = join(currentDir, '../preload/index.mjs');
  const localJs = join(currentDir, '../preload/index.js');
  if (existsSync(localMjs)) return localMjs;
  if (existsSync(localJs)) return localJs;
  const appMjs = join(app.getAppPath(), 'dist/preload/index.mjs');
  if (existsSync(appMjs)) return appMjs;
  return join(app.getAppPath(), 'dist/preload/index.js');
};

const createMainWindow = () => {
  const isMac = process.platform === 'darwin';
  const iconPath = join(currentDir, '../../assets/lumalite_icon_large.png');
  const fallbackIcon = join(currentDir, '../../assets/lumalite_icon_large.png');
  mainWindow = new BrowserWindow({
    width: isMac ? 920 : 1100,
    height: isMac ? 640 : 720,
    minWidth: 860,
    minHeight: 560,
    show: false,
    backgroundColor: '#0b0d10',
    titleBarStyle: 'hiddenInset',
    icon: existsSync(iconPath) ? iconPath : fallbackIcon,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(currentDir, '../renderer/index.html'));
  }

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents
      .executeJavaScript('Boolean(window.govee)')
      .then((hasBridge) => {
        console.log(`[govee] preload bridge loaded: ${hasBridge}`);
        console.log(`[govee] renderer url: ${mainWindow?.webContents.getURL()}`);
      })
      .catch((error) => {
        console.log('[govee] preload bridge check failed', error);
      });
  });

  mainWindow.once('ready-to-show', () => {
    if (!isMac) {
      mainWindow?.show();
    }
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  return mainWindow;
};

const applyDockPreference = (dockHidden: unknown) => {
  if (process.platform !== 'darwin') return;
  if (Boolean(dockHidden)) {
    app.dock.hide();
  } else {
    app.dock.show();
  }
};

const setupIpc = (
  deviceService: DeviceService,
  configStore: ReturnType<typeof createConfigStore>,
  trayController: ReturnType<typeof createTray>,
  mainWindow: BrowserWindow,
  scheduler: ReturnType<typeof createScheduler>
) => {
  ipcMain.handle(IPC_CHANNELS.configGet, async () => configStore.loadConfig());
  ipcMain.handle(IPC_CHANNELS.preferencesGet, async () => {
    const config = await configStore.loadConfig();
    return {
      favorites: config.favorites ?? [],
      rooms: config.rooms ?? {},
      roomNames: config.roomNames ?? []
    };
  });
  ipcMain.handle(IPC_CHANNELS.apiKeySet, async (_event, apiKey: string) =>
    configStore.saveConfig({ apiKey: apiKey.trim() || undefined })
  );
  ipcMain.handle(
    IPC_CHANNELS.preferenceSet,
    async (_event, name: PreferenceName, value: unknown) => {
      if (name === 'dockHidden') {
        applyDockPreference(value);
      }
      const update: Partial<Config> = { [name]: value } as Partial<Config>;
      const nextConfig = await configStore.saveConfig(update);
      if (name === 'proxyCaPath') {
        await applyTlsConfig(nextConfig.proxyCaPath);
      }
      if (name === 'debugLogging') {
        applyDebugFlag(Boolean(nextConfig.debugLogging));
      }
      return nextConfig;
    }
  );
  ipcMain.handle(IPC_CHANNELS.favoriteSet, async (_event, deviceId: string, isFavorite: boolean) => {
    const config = await configStore.loadConfig();
    const favorites = new Set(config.favorites ?? []);
    if (isFavorite) {
      favorites.add(deviceId);
    } else {
      favorites.delete(deviceId);
    }
    const nextConfig = await configStore.saveConfig({ favorites: Array.from(favorites) });
    await trayController.update();
    return nextConfig;
  });
  ipcMain.handle(IPC_CHANNELS.roomListSet, async (_event, rooms: string[]) => {
    const unique = Array.from(new Set(rooms.map((room) => room.trim()).filter(Boolean))).sort();
    const config = await configStore.loadConfig();
    const filteredRooms = { ...(config.rooms ?? {}) };
    Object.entries(filteredRooms).forEach(([deviceId, room]) => {
      if (!unique.includes(room)) {
        delete filteredRooms[deviceId];
      }
    });
    const nextConfig = await configStore.saveConfig({ roomNames: unique, rooms: filteredRooms });
    await trayController.update();
    return nextConfig;
  });
  ipcMain.handle(IPC_CHANNELS.roomRename, async (_event, from: string, to: string) => {
    const next = to.trim();
    if (!next) return configStore.loadConfig();
    const config = await configStore.loadConfig();
    const roomNames = new Set(config.roomNames ?? []);
    roomNames.delete(from);
    roomNames.add(next);
    const rooms = { ...(config.rooms ?? {}) };
    Object.entries(rooms).forEach(([deviceId, room]) => {
      if (room === from) {
        rooms[deviceId] = next;
      }
    });
    const nextConfig = await configStore.saveConfig({
      roomNames: Array.from(roomNames).sort(),
      rooms
    });
    await trayController.update();
    return nextConfig;
  });
  ipcMain.handle(IPC_CHANNELS.roomDelete, async (_event, roomName: string) => {
    const config = await configStore.loadConfig();
    const roomNames = (config.roomNames ?? []).filter((name) => name !== roomName);
    const rooms = { ...(config.rooms ?? {}) };
    Object.entries(rooms).forEach(([deviceId, room]) => {
      if (room === roomName) {
        delete rooms[deviceId];
      }
    });
    const nextConfig = await configStore.saveConfig({ roomNames, rooms });
    await trayController.update();
    return nextConfig;
  });
  ipcMain.handle(IPC_CHANNELS.scenesList, async () => {
    const config = await configStore.loadConfig();
    return (config.myScenes ?? []) as MyScene[];
  });
  ipcMain.handle(IPC_CHANNELS.scenesSave, async (_event, scene: MyScene) => {
    const config = await configStore.loadConfig();
    const scenes = config.myScenes ?? [];
    const index = scenes.findIndex((item) => item.id === scene.id);
    if (index >= 0) {
      scenes[index] = scene;
    } else {
      scenes.push(scene);
    }
    const nextConfig = await configStore.saveConfig({ myScenes: scenes });
    await trayController.update();
    await scheduler.scheduleAll();
    return (nextConfig.myScenes ?? []) as MyScene[];
  });
  ipcMain.handle(IPC_CHANNELS.scenesDelete, async (_event, sceneId: string) => {
    const config = await configStore.loadConfig();
    const scenes = (config.myScenes ?? []).filter((scene) => scene.id !== sceneId);
    const nextConfig = await configStore.saveConfig({ myScenes: scenes });
    await trayController.update();
    await scheduler.scheduleAll();
    return (nextConfig.myScenes ?? []) as MyScene[];
  });
  ipcMain.handle(IPC_CHANNELS.scenesDuplicate, async (_event, sceneId: string) => {
    const config = await configStore.loadConfig();
    const scenes = config.myScenes ?? [];
    const source = scenes.find((scene) => scene.id === sceneId);
    if (!source) return scenes as MyScene[];
    const copy: MyScene = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} Copy`
    };
    const nextConfig = await configStore.saveConfig({ myScenes: [...scenes, copy] });
    await trayController.update();
    await scheduler.scheduleAll();
    return (nextConfig.myScenes ?? []) as MyScene[];
  });
  ipcMain.handle(IPC_CHANNELS.scenesApply, async (_event, sceneId: string) => {
    return applyMySceneById(sceneId, deviceService, configStore);
  });
  ipcMain.handle(IPC_CHANNELS.deviceScenesGet, async (_event, deviceId: string) => {
    const config = await configStore.loadConfig();
    return (config.deviceScenesCache ?? {})[deviceId];
  });
  ipcMain.handle(IPC_CHANNELS.deviceScenesFetch, async (_event, deviceId: string) => {
    const config = await configStore.loadConfig();
    const devices = await deviceService.listDevices();
    const device = devices.find((item) => item.id === deviceId);
    if (!device?.sku) {
      throw new Error('Device SKU missing');
    }
    const [dynamic, diy] = await Promise.all([
      deviceService.getDynamicScenes(deviceId, device.sku),
      deviceService.getDiyScenes(deviceId, device.sku)
    ]);
    const cache = {
      ...(config.deviceScenesCache ?? {}),
      [deviceId]: {
        dynamic,
        diy,
        fetchedAt: Date.now()
      }
    };
    const nextConfig = await configStore.saveConfig({ deviceScenesCache: cache });
    return nextConfig.deviceScenesCache?.[deviceId];
  });
  ipcMain.handle(
    IPC_CHANNELS.deviceScenesApplyDynamic,
    async (_event, deviceId: string, scene: { type: string; instance: string; value: unknown }) => {
      await deviceService.controlCapability(deviceId, scene, { propagateError: true });
    }
  );
  ipcMain.handle(
    IPC_CHANNELS.deviceScenesApplyDiy,
    async (_event, deviceId: string, scene: { type: string; instance: string; value: unknown }) => {
      await deviceService.controlCapability(deviceId, scene, { propagateError: true });
    }
  );
  ipcMain.handle(IPC_CHANNELS.roomSet, async (_event, deviceId: string, roomName: string) => {
    const config = await configStore.loadConfig();
    const rooms = { ...(config.rooms ?? {}) };
    if (roomName.trim()) {
      rooms[deviceId] = roomName.trim();
    } else {
      delete rooms[deviceId];
    }
    const nextConfig = await configStore.saveConfig({ rooms });
    await trayController.update();
    return nextConfig;
  });

  ipcMain.handle(IPC_CHANNELS.devicesList, async () => deviceService.listDevices());
  ipcMain.handle(IPC_CHANNELS.devicesRefresh, async () => {
    const devices = await deviceService.refreshDevices();
    await configStore.saveConfig({ lastRefreshAt: Date.now() });
    await trayController.update();
    return devices;
  });
  ipcMain.handle(IPC_CHANNELS.deviceStateGet, async (_event, deviceId: string) =>
    deviceService.getDeviceState(deviceId)
  );
  ipcMain.handle(IPC_CHANNELS.devicesPower, async (_event, deviceId, on) => {
    await deviceService.setPower(deviceId, on);
  });
  ipcMain.handle(IPC_CHANNELS.devicesBrightness, async (_event, deviceId, level) => {
    await deviceService.setBrightness(deviceId, level);
  });
  ipcMain.handle(IPC_CHANNELS.devicesColor, async (_event, deviceId, color) => {
    await deviceService.setColor(deviceId, color);
  });
  ipcMain.handle(IPC_CHANNELS.diagnosticsGet, async () => {
    // Combine device provider diagnostics with app/runtime info for support.
    const base = deviceService.getDiagnostics();
    const lastStateUpdateAt = deviceService.getLastStateUpdateAt();
    const lastStateAgeSec = lastStateUpdateAt
      ? Math.max(0, Math.floor((Date.now() - lastStateUpdateAt) / 1000))
      : undefined;
    return {
      appName: app.getName(),
      appVersion: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      buildMode: app.isPackaged ? 'production' : 'development',
      providerStatus: base.providerStatus,
      lastError: base.lastError,
      lastErrorAt: base.lastErrorAt,
      devicesCount: deviceService.getDeviceCount(),
      lastStateUpdateAt,
      lastStateAgeSec
    };
  });
  ipcMain.handle(IPC_CHANNELS.logsDownload, async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save LumaLite Logs',
      defaultPath: join(app.getPath('downloads'), 'lumalite.log')
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    if (logFilePath) {
      await fs.copyFile(logFilePath, result.filePath);
    }
    return { canceled: false, path: result.filePath };
  });
  ipcMain.handle(IPC_CHANNELS.logsOpenFolder, async () => {
    // Open the local userData folder (logs live here) in the OS file manager.
    const error = await shell.openPath(app.getPath('userData'));
    if (error) {
      return { ok: false, error };
    }
    return { ok: true };
  });
  ipcMain.handle(IPC_CHANNELS.openExternal, async (_event, url: string) => {
    // Centralize external link handling so renderer never uses raw <a href>.
    if (typeof url !== 'string' || url.trim().length === 0) {
      return;
    }
    await shell.openExternal(url);
  });
  ipcMain.handle(IPC_CHANNELS.deckGet, async () => {
    const config = await configStore.loadConfig();
    return config.deck ?? {
      gridPreset: '4x4',
      tileSize: 'md',
      sceneActiveThreshold: 0.8,
      tiles: []
    };
  });
  ipcMain.handle(IPC_CHANNELS.deckSave, async (_event, deck) => {
    const nextConfig = await configStore.saveConfig({ deck });
    return nextConfig.deck ?? deck;
  });
};

app.on('before-quit', () => {
  isQuitting = true;
});

app.whenReady().then(async () => {
  await setupLogFile();
  const configPath = join(app.getPath('userData'), 'config.json');
  const configStore = createConfigStore(configPath);
  const envApiKey = process.env.GOVEE_API_KEY;
  if (envApiKey) {
    const existing = await configStore.loadConfig();
    if (!existing.apiKey) {
      await configStore.saveConfig({ apiKey: envApiKey });
    }
  }

  const config = await configStore.loadConfig();
  applyDockPreference(config.dockHidden ?? false);
  await applyTlsConfig(config.proxyCaPath);
  applyDebugFlag(config.debugLogging ?? false);

  const baseUrl = process.env.GOVEE_API_BASE_URL;
  const deviceService = new DeviceService(configStore, baseUrl);
  const window = createMainWindow();
  const trayController = createTray(window, deviceService, configStore, () => app.quit());
  const scheduler = createScheduler(deviceService, configStore);

  setupIpc(deviceService, configStore, trayController, window, scheduler);

  await deviceService.refreshDevices();
  await configStore.saveConfig({ lastRefreshAt: Date.now() });
  await trayController.update();
  await scheduler.scheduleAll();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      window.show();
      window.center();
      window.focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
