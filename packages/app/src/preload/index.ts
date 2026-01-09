import { contextBridge, ipcRenderer } from 'electron';
import type { GoveeApi, PreferenceName } from '../shared/ipc.js';
import { IPC_CHANNELS } from '../shared/ipc.js';

const api: GoveeApi = {
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.configGet),
  getPreferences: () => ipcRenderer.invoke(IPC_CHANNELS.preferencesGet),
  setApiKey: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.apiKeySet, key),
  setPreference: (name: PreferenceName, value: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.preferenceSet, name, value),
  setFavorite: (deviceId: string, isFavorite: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.favoriteSet, deviceId, isFavorite),
  setDeviceRoom: (deviceId: string, roomName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.roomSet, deviceId, roomName),
  setRoomList: (rooms: string[]) => ipcRenderer.invoke(IPC_CHANNELS.roomListSet, rooms),
  renameRoom: (from: string, to: string) => ipcRenderer.invoke(IPC_CHANNELS.roomRename, from, to),
  deleteRoom: (roomName: string) => ipcRenderer.invoke(IPC_CHANNELS.roomDelete, roomName),
  onNavigate: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, view: string) => handler(view);
    ipcRenderer.on(IPC_CHANNELS.appNavigate, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.appNavigate, listener);
  },
  listScenes: () => ipcRenderer.invoke(IPC_CHANNELS.scenesList),
  saveScene: (scene) => ipcRenderer.invoke(IPC_CHANNELS.scenesSave, scene),
  deleteScene: (sceneId) => ipcRenderer.invoke(IPC_CHANNELS.scenesDelete, sceneId),
  duplicateScene: (sceneId) => ipcRenderer.invoke(IPC_CHANNELS.scenesDuplicate, sceneId),
  applyScene: (sceneId) => ipcRenderer.invoke(IPC_CHANNELS.scenesApply, sceneId),
  getDeviceScenes: (deviceId) => ipcRenderer.invoke(IPC_CHANNELS.deviceScenesGet, deviceId),
  fetchDeviceScenes: (deviceId) => ipcRenderer.invoke(IPC_CHANNELS.deviceScenesFetch, deviceId),
  applyDynamicScene: (deviceId, scene) =>
    ipcRenderer.invoke(IPC_CHANNELS.deviceScenesApplyDynamic, deviceId, scene),
  applyDiyScene: (deviceId, scene) =>
    ipcRenderer.invoke(IPC_CHANNELS.deviceScenesApplyDiy, deviceId, scene),
  listDevices: () => ipcRenderer.invoke(IPC_CHANNELS.devicesList),
  refreshDevices: () => ipcRenderer.invoke(IPC_CHANNELS.devicesRefresh),
  getDeviceState: (deviceId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.deviceStateGet, deviceId),
  setPower: (deviceId: string, on: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.devicesPower, deviceId, on),
  setBrightness: (deviceId: string, level: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.devicesBrightness, deviceId, level),
  setColor: (deviceId: string, color) =>
    ipcRenderer.invoke(IPC_CHANNELS.devicesColor, deviceId, color),
  getDiagnostics: () => ipcRenderer.invoke(IPC_CHANNELS.diagnosticsGet),
  downloadLogs: () => ipcRenderer.invoke(IPC_CHANNELS.logsDownload),
  openLogsFolder: () => ipcRenderer.invoke(IPC_CHANNELS.logsOpenFolder),
  openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.openExternal, url),
  getDeck: () => ipcRenderer.invoke(IPC_CHANNELS.deckGet),
  saveDeck: (deck) => ipcRenderer.invoke(IPC_CHANNELS.deckSave, deck)
};

contextBridge.exposeInMainWorld('govee', api);
console.log('[govee] preload initialized');
