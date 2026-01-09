import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { Capability, Device, DeviceState, GoveeProvider, RGB } from './types.js';

const CapabilitySchema = z.object({
  type: z.string(),
  instance: z.string(),
  parameters: z.unknown().optional()
});

const DeviceItemSchema = z.object({
  device: z.string().optional(),
  deviceId: z.string().optional(),
  sku: z.string().optional(),
  model: z.string().optional(),
  deviceName: z.string().optional(),
  name: z.string().optional(),
  capabilities: z.array(CapabilitySchema).optional(),
  controllable: z.union([z.array(z.string()), z.boolean()]).optional(),
  online: z.boolean().optional()
});

const DevicesResponseSchema = z.object({
  code: z.number().optional(),
  message: z.string().optional(),
  data: z.array(DeviceItemSchema).optional(),
  devices: z.array(DeviceItemSchema).optional()
});

const ApiResponseSchema = z.object({
  code: z.number(),
  message: z.string().optional(),
  msg: z.string().optional()
});

const SceneOptionsSchema = z.object({
  name: z.string().optional(),
  value: z.unknown()
});

const SceneCapabilitySchema = z.object({
  type: z.string(),
  instance: z.string(),
  parameters: z
    .object({
      options: z.array(SceneOptionsSchema).optional()
    })
    .optional()
});

const SceneResponseSchema = z.object({
  code: z.number(),
  msg: z.string().optional(),
  payload: z
    .object({
      capabilities: z.array(SceneCapabilitySchema).optional()
    })
    .optional()
});

const StateCapabilitySchema = z.object({
  type: z.string(),
  instance: z.string(),
  state: z
    .object({
      value: z.unknown().optional()
    })
    .optional()
});

const StateResponseSchema = z.object({
  code: z.number().optional(),
  msg: z.string().optional(),
  message: z.string().optional(),
  payload: z
    .object({
      capabilities: z.array(StateCapabilitySchema).optional()
    })
    .optional()
});

export type GoveeCloudOptions = {
  apiKey: string;
  baseUrl?: string;
  retryCount?: number;
};

export class GoveeCloudError extends Error {
  status?: number;
  code?: number;

  constructor(message: string, options?: { status?: number; code?: number }) {
    super(message);
    this.name = 'GoveeCloudError';
    this.status = options?.status;
    this.code = options?.code;
  }
}

const DEFAULT_BASE_URL = 'https://openapi.api.govee.com';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetry = (status?: number) => {
  if (!status) return true;
  if (status >= 500) return true;
  return status === 429 || status === 408;
};

export class GoveeCloudProvider implements GoveeProvider {
  private apiKey: string;
  private baseUrl: string;
  private retryCount: number;
  private deviceModelMap: Map<string, string>;
  private deviceSkuMap: Map<string, string>;
  private deviceCapabilitiesMap: Map<string, Capability[]>;

  constructor(options: GoveeCloudOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.retryCount = options.retryCount ?? 3;
    this.deviceModelMap = new Map();
    this.deviceSkuMap = new Map();
    this.deviceCapabilitiesMap = new Map();
  }

  async listDevices(): Promise<Device[]> {
    const isOpenApi = this.baseUrl.includes('openapi.api.govee.com');
    const path = isOpenApi ? '/router/api/v1/user/devices' : '/v1/devices';
    const payload = await this.request(`${this.baseUrl}${path}`, {
      method: 'GET'
    });
    const parsed = DevicesResponseSchema.parse(payload);
    const deviceList = parsed.data ?? parsed.devices ?? [];
    const devices = deviceList
      .map((device) => ({
        id: device.deviceId ?? device.device ?? 'unknown',
        name: device.deviceName ?? device.name ?? device.sku ?? 'Unnamed',
        model: device.model ?? device.sku ?? 'unknown',
        sku: device.sku,
        capabilities: device.capabilities?.map((cap) => ({
          type: cap.type,
          instance: cap.instance
        })),
        supportedCommands:
          typeof device.controllable === 'boolean'
            ? []
            : device.capabilities?.map((cap) => cap.type) ?? device.controllable ?? [],
        online: device.online
      }))
      .filter((device) => device.id !== 'unknown');
    deviceList.forEach((device) => {
      const id = device.deviceId ?? device.device ?? 'unknown';
      if (id === 'unknown') return;
      if (device.model) {
        this.deviceModelMap.set(id, device.model);
      }
      if (device.sku) {
        this.deviceSkuMap.set(id, device.sku);
      }
      if (device.capabilities) {
        this.deviceCapabilitiesMap.set(id, device.capabilities);
      }
    });
    return devices;
  }

  async setPower(deviceId: string, on: boolean): Promise<void> {
    const capability = this.resolveCapability(deviceId, 'devices.capabilities.on_off', 'powerSwitch');
    await this.control(deviceId, {
      ...capability,
      value: on ? 1 : 0
    });
  }

  async setBrightness(deviceId: string, level: number): Promise<void> {
    const capability = this.resolveCapability(deviceId, 'devices.capabilities.range', 'brightness');
    await this.control(deviceId, {
      ...capability,
      value: Math.max(0, Math.min(100, level))
    });
  }

  async setColor(deviceId: string, color: RGB): Promise<void> {
    const rgbInt = (color.r << 16) + (color.g << 8) + color.b;
    const capability = this.resolveCapability(
      deviceId,
      'devices.capabilities.color_setting',
      'colorRgb'
    );
    await this.control(deviceId, {
      ...capability,
      value: rgbInt
    });
  }

  async controlCapability(
    deviceId: string,
    capability: { type: string; instance: string; value: unknown }
  ): Promise<void> {
    await this.control(deviceId, capability);
  }

  async getDynamicScenes(deviceId: string, sku: string) {
    return this.getSceneOptions('/router/api/v1/device/scenes', deviceId, sku);
  }

  async getDiyScenes(deviceId: string, sku: string) {
    return this.getSceneOptions('/router/api/v1/device/diy-scenes', deviceId, sku);
  }

  async getDeviceState(deviceId: string, sku: string): Promise<DeviceState> {
    const payload = await this.request(`${this.baseUrl}/router/api/v1/device/state`, {
      method: 'POST',
      body: JSON.stringify({
        requestId: randomUUID(),
        payload: {
          sku,
          device: deviceId
        }
      })
    });
    const parsed = StateResponseSchema.parse(payload);
    const capabilities = parsed.payload?.capabilities ?? [];
    const state: DeviceState = {};
    capabilities.forEach((cap) => {
      const value = cap.state?.value;
      if (cap.type === 'devices.capabilities.online' && typeof value === 'boolean') {
        state.online = value;
      }
      if (cap.type === 'devices.capabilities.on_off' && typeof value === 'number') {
        state.power = value === 1;
      }
      if (cap.type === 'devices.capabilities.range' && cap.instance === 'brightness') {
        if (typeof value === 'number') {
          state.brightness = value;
        }
      }
      if (cap.type === 'devices.capabilities.color_setting' && cap.instance === 'colorRgb') {
        if (typeof value === 'number') {
          state.colorRgb = {
            r: (value >> 16) & 0xff,
            g: (value >> 8) & 0xff,
            b: value & 0xff
          };
        }
      }
      if (
        cap.type === 'devices.capabilities.color_setting' &&
        cap.instance === 'colorTemperatureK'
      ) {
        if (typeof value === 'number') {
          state.colorTemperatureK = value;
        }
      }
    });
    return state;
  }

  private async control(
    deviceId: string,
    capability: { type: string; instance: string; value: unknown }
  ) {
    const isOpenApi = this.baseUrl.includes('openapi.api.govee.com');
    if (isOpenApi) {
      const sku = this.deviceSkuMap.get(deviceId);
      if (!sku) {
        throw new GoveeCloudError('Device SKU missing. Refresh devices first.');
      }
      if (process.env.GOVEE_DEBUG === '1') {
        console.log('[govee] control payload', {
          sku,
          device: deviceId,
          capability
        });
        console.log('[govee] control baseUrl', this.baseUrl);
      }
      await this.request(`${this.baseUrl}/router/api/v1/device/control`, {
        method: 'POST',
        body: JSON.stringify({
          requestId: randomUUID(),
          payload: {
            sku,
            device: deviceId,
            capability
          }
        })
      });
      return;
    }

    const model = this.deviceModelMap.get(deviceId) ?? '';
    const legacy = this.toLegacyCommand(capability);
    await this.request(`${this.baseUrl}/v1/devices/control`, {
      method: 'PUT',
      body: JSON.stringify({
        device: deviceId,
        model,
        cmd: {
          name: legacy.name,
          value: legacy.value
        }
      })
    });
  }

  private async getSceneOptions(path: string, deviceId: string, sku: string) {
    const payload = await this.request(`${this.baseUrl}${path}`, {
      method: 'POST',
      body: JSON.stringify({
        requestId: randomUUID(),
        payload: {
          sku,
          device: deviceId
        }
      })
    });
    const parsed = SceneResponseSchema.parse(payload);
    const capabilities = parsed.payload?.capabilities ?? [];
    return capabilities.flatMap((capability) => {
      const options = capability.parameters?.options ?? [];
      return options.map((option) => ({
        name: option.name ?? 'Scene',
        value: option.value,
        type: capability.type,
        instance: capability.instance
      }));
    });
  }

  private resolveCapability(deviceId: string, type: string, preferredInstance: string) {
    const capabilities = this.deviceCapabilitiesMap.get(deviceId) ?? [];
    const match =
      capabilities.find((cap) => cap.type === type && cap.instance === preferredInstance) ??
      capabilities.find((cap) => cap.type === type) ??
      capabilities.find((cap) => cap.instance === preferredInstance);
    if (match) {
      return { type: match.type, instance: match.instance };
    }
    return { type, instance: preferredInstance };
  }

  private toLegacyCommand(capability: { type: string; instance: string; value: unknown }) {
    if (capability.type === 'devices.capabilities.on_off') {
      return { name: 'turn', value: capability.value === 1 ? 'on' : 'off' };
    }
    if (capability.type === 'devices.capabilities.range') {
      return { name: 'brightness', value: capability.value };
    }
    if (capability.type === 'devices.capabilities.color_setting') {
      if (typeof capability.value === 'number') {
        const r = (capability.value >> 16) & 0xff;
        const g = (capability.value >> 8) & 0xff;
        const b = capability.value & 0xff;
        return { name: 'color', value: { r, g, b } };
      }
      return { name: 'color', value: capability.value };
    }
    return { name: capability.type, value: capability.value };
  }

  private async request(url: string, init: RequestInit): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retryCount; attempt += 1) {
      try {
        const response = await fetch(url, {
          ...init,
          headers: {
            'Govee-API-Key': this.apiKey,
            'Content-Type': 'application/json',
            ...(init.headers ?? {})
          }
        });
        const status = response.status;
        let json: unknown = {};
        if (process.env.GOVEE_DEBUG === '1' && url.includes('/device/control')) {
          const text = await response.text();
          console.log('[govee] control status', response.status);
          console.log('[govee] control response raw', text || '<empty>');
          try {
            json = text ? JSON.parse(text) : {};
          } catch {
            json = {};
          }
        } else {
          json = await response.json().catch(() => ({}));
        }
        if (!response.ok) {
          const responseMessage =
            typeof (json as { message?: unknown }).message === 'string'
              ? (json as { message?: string }).message ?? `Govee API error (${status})`
              : `Govee API error (${status})`;
          if (shouldRetry(status) && attempt < this.retryCount) {
            await sleep(300 * Math.pow(2, attempt));
            continue;
          }
          throw new GoveeCloudError(responseMessage, { status });
        }
        const base = ApiResponseSchema.safeParse(json);
        if (base.success && base.data.code !== 200) {
          if (shouldRetry(base.data.code) && attempt < this.retryCount) {
            await sleep(300 * Math.pow(2, attempt));
            continue;
          }
          const apiMessage = base.data.message ?? base.data.msg ?? 'Govee API error';
          throw new GoveeCloudError(apiMessage, { code: base.data.code });
        }
        return json;
      } catch (error) {
        if (error instanceof Error) {
          const cause = (error as { cause?: { message?: string } }).cause?.message;
          if (cause) {
            lastError = new GoveeCloudError(`${error.message} (${cause})`);
          } else {
            lastError = error;
          }
        } else {
          lastError = error;
        }
        if (attempt < this.retryCount) {
          await sleep(300 * Math.pow(2, attempt));
          continue;
        }
      }
    }
    if (lastError instanceof Error) {
      throw lastError;
    }
    throw new GoveeCloudError('Unknown Govee API error');
  }
}
