import type { Device, DeviceState, Scene } from '@lumalite/core';
import { GoveeCloudProvider, GoveeLanProvider } from '@lumalite/core';
import type { ConfigStore } from './config.js';

export type Diagnostics = {
  lastError?: string;
  lastErrorAt?: number;
  providerStatus: 'cloud' | 'missing-key' | 'error' | 'lan' | 'hybrid';
};

export class DeviceService {
  private configStore: ConfigStore;
  private devices: Device[] = [];
  private powerState: Map<string, boolean> = new Map();
  private diagnostics: Diagnostics = { providerStatus: 'missing-key' };
  private baseUrl?: string;
  private provider?: GoveeCloudProvider;
  private providerKey?: string;
  private providerBaseUrl?: string;
  private lanProvider: GoveeLanProvider;
  // Timestamp of the last successful device state pull (used for freshness UX).
  private lastStateUpdateAt?: number;

  constructor(configStore: ConfigStore, baseUrl?: string) {
    this.configStore = configStore;
    this.baseUrl = baseUrl;
    this.lanProvider = new GoveeLanProvider();
  }

  getDiagnostics(): Diagnostics {
    return this.diagnostics;
  }

  getDeviceCount(): number {
    return this.devices.length;
  }

  getLastStateUpdateAt(): number | undefined {
    return this.lastStateUpdateAt;
  }

  async listDevices(): Promise<Device[]> {
    if (this.devices.length === 0) {
      return this.refreshDevices();
    }
    return this.devices;
  }

  async refreshDevices(): Promise<Device[]> {
    const config = await this.configStore.loadConfig();
    const lanEnabled = config.lanEnabled ?? true;
    let lanDevices: Device[] = [];
    if (lanEnabled) {
      try {
        lanDevices = await this.lanProvider.listDevices();
      } catch (error) {
        if (process.env.GOVEE_DEBUG === '1') {
          console.log('[govee] lan discovery failed', error);
        }
      }
    }

    if (!config.apiKey) {
      this.devices = lanDevices;
      this.diagnostics = {
        providerStatus: lanDevices.length > 0 ? 'lan' : 'missing-key'
      };
      return this.devices;
    }

    try {
      const provider = this.getProvider(config.apiKey);
      const cloudDevices = await provider.listDevices();
      const lanMap = new Map(lanDevices.map((device) => [normalizeId(device.id), device]));
      const merged = cloudDevices.map((device) => {
        const lanMatch = lanMap.get(normalizeId(device.id));
        if (!lanMatch) {
          return { ...device, source: 'cloud' };
        }
        return {
          ...device,
          lanIp: lanMatch.lanIp,
          lanPort: lanMatch.lanPort,
          source: 'hybrid'
        };
      });
      const cloudIds = new Set(cloudDevices.map((device) => normalizeId(device.id)));
      lanDevices.forEach((lanDevice) => {
        if (!cloudIds.has(normalizeId(lanDevice.id))) {
          merged.push(lanDevice);
        }
      });
      this.devices = merged;
      this.devices.forEach((device) => {
        if (!this.powerState.has(device.id)) {
          this.powerState.set(device.id, true);
        }
      });
      this.diagnostics = {
        providerStatus: lanDevices.length > 0 ? 'hybrid' : 'cloud'
      };
      return this.devices;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.diagnostics = {
        providerStatus: lanDevices.length > 0 ? 'lan' : 'error',
        lastError: message,
        lastErrorAt: Date.now()
      };
      this.devices = lanDevices;
      return this.devices;
    }
  }

  async setPower(deviceId: string, on: boolean): Promise<void> {
    const config = await this.configStore.loadConfig();
    const lanEnabled = config.lanEnabled ?? true;
    const target = this.devices.find((device) => device.id === deviceId);
    if (lanEnabled && target?.lanIp) {
      try {
        await this.lanProvider.setPower(deviceId, on);
        this.powerState.set(deviceId, on);
        return;
      } catch (error) {
        if (!config.apiKey) {
          throw error;
        }
        if (process.env.GOVEE_DEBUG === '1') {
          console.log('[govee] lan power failed, falling back to cloud', error);
        }
      }
    }
    await this.controlByInstance(
      deviceId,
      'devices.capabilities.on_off',
      'powerSwitch',
      on ? 1 : 0
    );
    this.powerState.set(deviceId, on);
  }

  async setBrightness(deviceId: string, level: number): Promise<void> {
    const value = Math.max(0, Math.min(100, level));
    const config = await this.configStore.loadConfig();
    const lanEnabled = config.lanEnabled ?? true;
    const target = this.devices.find((device) => device.id === deviceId);
    if (lanEnabled && target?.lanIp) {
      try {
        await this.lanProvider.setBrightness(deviceId, value);
        return;
      } catch (error) {
        if (!config.apiKey) {
          throw error;
        }
        if (process.env.GOVEE_DEBUG === '1') {
          console.log('[govee] lan brightness failed, falling back to cloud', error);
        }
      }
    }
    await this.controlByInstance(deviceId, 'devices.capabilities.range', 'brightness', value);
  }

  async setColor(deviceId: string, color: { r: number; g: number; b: number }): Promise<void> {
    const config = await this.configStore.loadConfig();
    const lanEnabled = config.lanEnabled ?? true;
    const target = this.devices.find((device) => device.id === deviceId);
    if (lanEnabled && target?.lanIp) {
      try {
        await this.lanProvider.setColor(deviceId, color);
        return;
      } catch (error) {
        if (!config.apiKey) {
          throw error;
        }
        if (process.env.GOVEE_DEBUG === '1') {
          console.log('[govee] lan color failed, falling back to cloud', error);
        }
      }
    }
    const rgbInt = (color.r << 16) + (color.g << 8) + color.b;
    await this.controlByInstance(
      deviceId,
      'devices.capabilities.color_setting',
      'colorRgb',
      rgbInt
    );
  }

  async controlCapability(
    deviceId: string,
    capability: { type: string; instance: string; value: unknown },
    options?: { propagateError?: boolean }
  ): Promise<void> {
    if (
      capability.type === 'devices.capabilities.on_off' &&
      capability.instance === 'powerSwitch'
    ) {
      await this.setPower(deviceId, Boolean(capability.value));
      return;
    }
    if (capability.type === 'devices.capabilities.range' && capability.instance === 'brightness') {
      await this.setBrightness(deviceId, Number(capability.value));
      return;
    }
    if (
      capability.type === 'devices.capabilities.color_setting' &&
      capability.instance === 'colorRgb' &&
      typeof capability.value === 'number'
    ) {
      const rgbInt = capability.value;
      const r = (rgbInt >> 16) & 0xff;
      const g = (rgbInt >> 8) & 0xff;
      const b = rgbInt & 0xff;
      await this.setColor(deviceId, { r, g, b });
      return;
    }
    if (
      capability.type === 'devices.capabilities.color_setting' &&
      capability.instance === 'colorTemperatureK' &&
      typeof capability.value === 'number'
    ) {
      const config = await this.configStore.loadConfig();
      const lanEnabled = config.lanEnabled ?? true;
      const target = this.devices.find((device) => device.id === deviceId);
      if (lanEnabled && target?.lanIp) {
        try {
          await this.lanProvider.setColorTemperatureK(deviceId, capability.value);
          return;
        } catch (error) {
          if (!config.apiKey) {
            throw error;
          }
          if (process.env.GOVEE_DEBUG === '1') {
            console.log('[govee] lan color temp failed, falling back to cloud', error);
          }
        }
      }
    }
    const resolved = this.resolveCapability(deviceId, capability.type, capability.instance);
    await this.runWithProvider(
      (provider) =>
        provider.controlCapability(deviceId, {
          type: resolved.type,
          instance: resolved.instance,
          value: capability.value
        }),
      options
    );
  }

  async getDynamicScenes(deviceId: string, sku: string): Promise<
    { name: string; value: unknown; type: string; instance: string }[]
  > {
    try {
      return await this.runWithProvider(
        (provider) => provider.getDynamicScenes(deviceId, sku),
        { propagateError: true }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.toLowerCase().includes('not support')) {
        return [];
      }
      throw error;
    }
  }

  async getDiyScenes(deviceId: string, sku: string): Promise<
    { name: string; value: unknown; type: string; instance: string }[]
  > {
    try {
      return await this.runWithProvider(
        (provider) => provider.getDiyScenes(deviceId, sku),
        { propagateError: true }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.toLowerCase().includes('not support')) {
        return [];
      }
      throw error;
    }
  }

  async getDeviceState(deviceId: string): Promise<DeviceState> {
    const device = this.devices.find((item) => item.id === deviceId);
    if (!device?.sku) {
      throw new Error('Device SKU missing');
    }
    const config = await this.configStore.loadConfig();
    const lanEnabled = config.lanEnabled ?? true;
    if (lanEnabled && device.lanIp) {
      try {
        const data = await this.lanProvider.getDeviceState(deviceId);
        this.lastStateUpdateAt = Date.now();
        return {
          online: true,
          power: data.onOff === 1,
          brightness: typeof data.brightness === 'number' ? data.brightness : undefined,
          colorRgb: data.color
            ? { r: data.color.r, g: data.color.g, b: data.color.b }
            : undefined,
          colorTemperatureK:
            typeof data.colorTemInKelvin === 'number' ? data.colorTemInKelvin : undefined
        };
      } catch (error) {
        if (!config.apiKey) {
          throw error;
        }
        if (process.env.GOVEE_DEBUG === '1') {
          console.log('[govee] lan status failed, falling back to cloud', error);
        }
      }
    }
    try {
      const state = await this.runWithProvider(
        (provider) => provider.getDeviceState(deviceId, device.sku as string),
        { propagateError: true }
      );
      // Track a single freshness timestamp for UI diagnostics.
      this.lastStateUpdateAt = Date.now();
      return state;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.toLowerCase().includes('devices not exist')) {
        this.lastStateUpdateAt = Date.now();
        return {};
      }
      throw error;
    }
  }

  async applyScene(scene: Scene): Promise<void> {
    const devices = await this.listDevices();
    for (const device of devices) {
      for (const command of scene.commands) {
        if (command.type === 'power') {
          await this.controlByInstance(
            device.id,
            'devices.capabilities.on_off',
            'powerSwitch',
            command.on ? 1 : 0
          );
          this.powerState.set(device.id, command.on);
        }
        if (command.type === 'brightness') {
          await this.controlByInstance(
            device.id,
            'devices.capabilities.range',
            'brightness',
            command.level
          );
        }
        if (command.type === 'color') {
          const rgbInt =
            (command.color.r << 16) + (command.color.g << 8) + command.color.b;
          await this.controlByInstance(
            device.id,
            'devices.capabilities.color_setting',
            'colorRgb',
            rgbInt
          );
        }
      }
    }
  }

  getPowerSnapshot(): boolean[] {
    return this.devices.map((device) => this.powerState.get(device.id) ?? true);
  }

  private async controlByInstance(
    deviceId: string,
    type: string,
    instance: string,
    value: unknown
  ): Promise<void> {
    const resolved = this.resolveCapability(deviceId, type, instance);
    if (process.env.GOVEE_DEBUG === '1') {
      console.log('[govee] control', {
        deviceId,
        type: resolved.type,
        instance: resolved.instance,
        value
      });
      const device = this.devices.find((item) => item.id === deviceId);
      console.log('[govee] device capabilities', device?.capabilities ?? []);
    }
    await this.runWithProvider((provider) =>
      provider.controlCapability(deviceId, {
        type: resolved.type,
        instance: resolved.instance,
        value
      })
    );
  }

  private resolveCapability(deviceId: string, type: string, instance: string) {
    const device = this.devices.find((item) => item.id === deviceId);
    const caps = device?.capabilities ?? [];
    const match =
      caps.find((cap) => cap.type === type && cap.instance === instance) ??
      caps.find((cap) => cap.type === type) ??
      caps.find((cap) => cap.instance === instance);
    if (match) {
      return { type: match.type, instance: match.instance };
    }
    return { type, instance };
  }

  private async runWithProvider<T>(
    work: (provider: GoveeCloudProvider) => Promise<T>,
    options?: { propagateError?: boolean }
  ): Promise<T> {
    const config = await this.configStore.loadConfig();
    if (!config.apiKey) {
      this.diagnostics = { providerStatus: 'missing-key' };
      if (options?.propagateError) {
        throw new Error('Missing API key');
      }
      return undefined as T;
    }

    try {
      const provider = this.getProvider(config.apiKey);
      const result = await work(provider);
      this.diagnostics = { providerStatus: 'cloud' };
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (process.env.GOVEE_DEBUG === '1') {
        console.log('[govee] provider error', message);
      }
      this.diagnostics = {
        providerStatus: 'error',
        lastError: message,
        lastErrorAt: Date.now()
      };
      if (options?.propagateError) {
        throw error;
      }
      return undefined as T;
    }
  }

  private getProvider(apiKey: string) {
    if (
      !this.provider ||
      this.providerKey !== apiKey ||
      this.providerBaseUrl !== this.baseUrl
    ) {
      this.provider = new GoveeCloudProvider({
        apiKey,
        baseUrl: this.baseUrl
      });
      this.providerKey = apiKey;
      this.providerBaseUrl = this.baseUrl;
    }
    return this.provider;
  }
}

const normalizeId = (id: string) => id.toLowerCase().replace(/[^a-f0-9]/g, '');
