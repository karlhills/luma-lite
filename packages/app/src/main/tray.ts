import { Menu, nativeImage, Tray } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserWindow } from 'electron';
import type { DeviceService } from './deviceService.js';
import type { ConfigStore } from './config.js';
import type { MyScene, SceneAction } from '../shared/ipc.js';
import { IPC_CHANNELS } from '../shared/ipc.js';

export type TrayController = {
  tray: Tray;
  update: () => Promise<void>;
};

const formatTime = (timestamp?: number) => {
  if (!timestamp) return 'Never';
  return new Date(timestamp).toLocaleTimeString();
};

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
      value: value === 1 ? 1 : 0
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

export const createTray = (
  mainWindow: BrowserWindow,
  deviceService: DeviceService,
  configStore: ConfigStore,
  onQuit: () => void
): TrayController => {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const iconPath = join(currentDir, '../../assets/trayTemplate.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  if (process.platform === 'darwin') {
    trayIcon.setTemplateImage(true);
  }

  const tray = new Tray(trayIcon);
  tray.setToolTip('LumaLite');

  const applyMyScene = async (scene: MyScene) => {
    const config = await configStore.loadConfig();
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
    for (const device of devices) {
      if (!targets.has(device.id)) continue;
      const actions =
        scene.actionMode === 'perDevice'
          ? scene.perDeviceActions?.[device.id] ?? []
          : scene.actions;
      if (actions.length === 0) continue;
      for (const action of actions) {
        const capability = actionToCapability(action);
        const supported =
          device.capabilities?.some((cap) => cap.instance === capability.instance) ?? true;
        if (!supported) continue;
        await deviceService.controlCapability(device.id, capability);
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    }
  };

  const update = async () => {
    const devices = await deviceService.listDevices();
    const config = await configStore.loadConfig();
    const favorites = new Set(config.favorites ?? []);
    const myScenes = config.myScenes ?? [];
    const powerStates = deviceService.getPowerSnapshot();
    const anyOff = powerStates.some((state) => !state);
    const toggleLabel = anyOff ? 'Toggle All On' : 'Toggle All Off';
    const favoritesList = devices.filter((device) => favorites.has(device.id));

    const menu = Menu.buildFromTemplate([
      { label: 'LumaLite', enabled: false },
      { label: `Devices: ${devices.length}`, enabled: false },
      { label: `Last Refresh: ${formatTime(config.lastRefreshAt)}`, enabled: false },
      { type: 'separator' },
      {
        label: 'Refresh Devices',
        click: async () => {
          await deviceService.refreshDevices();
          await configStore.saveConfig({ lastRefreshAt: Date.now() });
          await update();
        }
      },
      { type: 'separator' },
      {
        label: 'Favorites',
        submenu:
          favoritesList.length > 0
            ? favoritesList.slice(0, 8).map((device) => ({
                label: device.name,
                click: async () => {
                  const index = devices.findIndex((item) => item.id === device.id);
                  const current = powerStates[index] ?? true;
                  await deviceService.setPower(device.id, !current);
                  await update();
                }
              }))
            : [{ label: 'No favorites yet', enabled: false }]
      },
      {
        label: 'My Scenes',
        submenu:
          myScenes.length > 0
            ? myScenes.slice(0, 6).map((scene) => ({
                label: scene.name,
                click: async () => {
                  await applyMyScene(scene);
                  await update();
                }
              }))
            : [{ label: 'No scenes yet', enabled: false }]
      },
      {
        label: toggleLabel,
        click: async () => {
          const nextState = anyOff;
          for (const device of devices) {
            await deviceService.setPower(device.id, nextState);
          }
          await update();
        }
      },
      {
        label: 'Open App',
        click: () => {
          mainWindow.show();
          mainWindow.center();
          mainWindow.focus();
        }
      },
      {
        label: 'Open Favorites',
        click: () => {
          mainWindow.show();
          mainWindow.center();
          mainWindow.focus();
          mainWindow.webContents.send(IPC_CHANNELS.appNavigate, 'favorites');
        }
      },
      {
        label: 'Open Scenes',
        click: () => {
          mainWindow.show();
          mainWindow.center();
          mainWindow.focus();
          mainWindow.webContents.send(IPC_CHANNELS.appNavigate, 'scenes');
        }
      },
      {
        label: 'Open Control Deck',
        click: () => {
          mainWindow.show();
          mainWindow.center();
          mainWindow.focus();
          mainWindow.webContents.send(IPC_CHANNELS.appNavigate, 'deck');
        }
      },
      {
        label: 'Quit',
        click: () => onQuit()
      }
    ]);

    tray.setContextMenu(menu);
  };

  tray.on('click', () => {
    tray.popUpContextMenu();
  });

  return { tray, update };
};
