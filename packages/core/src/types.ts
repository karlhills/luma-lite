export type RGB = {
  r: number;
  g: number;
  b: number;
};

export type Device = {
  id: string;
  name: string;
  model: string;
  sku?: string;
  lanIp?: string;
  lanPort?: number;
  source?: 'cloud' | 'lan' | 'hybrid';
  supportedCommands: string[];
  capabilities?: Capability[];
  online?: boolean;
};

export type Capability = {
  type: string;
  instance: string;
  parameters?: unknown;
};

export type DeviceState = {
  online?: boolean;
  power?: boolean;
  brightness?: number;
  colorRgb?: RGB;
  colorTemperatureK?: number;
};

export type SceneCommand =
  | { type: 'power'; on: boolean }
  | { type: 'brightness'; level: number }
  | { type: 'color'; color: RGB };

export type Scene = {
  id: string;
  name: string;
  commands: SceneCommand[];
};

export type ProviderHealth = {
  ok: boolean;
  lastCheckedAt: number;
  message?: string;
};

export type GoveeProvider = {
  listDevices(): Promise<Device[]>;
  setPower(deviceId: string, on: boolean): Promise<void>;
  setBrightness(deviceId: string, level: number): Promise<void>;
  setColor(deviceId: string, color: RGB): Promise<void>;
};
