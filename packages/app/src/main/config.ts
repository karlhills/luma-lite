import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import type { Config } from '../shared/ipc.js';

const ConfigSchema = z.object({
  apiKey: z.string().optional(),
  lastRefreshAt: z.number().optional(),
  dockHidden: z.boolean().optional(),
  proxyCaPath: z.string().optional(),
  debugLogging: z.boolean().optional(),
  onboardingComplete: z.boolean().optional(),
  lanEnabled: z.boolean().optional(),
  favorites: z.array(z.string()).optional(),
  rooms: z.record(z.string()).optional(),
  roomNames: z.array(z.string()).optional(),
  myScenes: z.array(z.unknown()).optional(),
  deviceScenesCache: z.record(z.unknown()).optional(),
  deck: z.record(z.unknown()).optional()
});

const defaults: Config = {
  apiKey: undefined,
  lastRefreshAt: undefined,
  dockHidden: false,
  proxyCaPath: undefined,
  debugLogging: false,
  onboardingComplete: false,
  lanEnabled: true,
  favorites: [],
  rooms: {},
  roomNames: [],
  myScenes: [],
  deviceScenesCache: {},
  deck: {
    gridPreset: '4x4',
    tileSize: 'md',
    sceneActiveThreshold: 0.8,
    tiles: []
  }
};

export type ConfigStore = {
  loadConfig: () => Promise<Config>;
  saveConfig: (partial: Partial<Config>) => Promise<Config>;
};

export const createConfigStore = (filePath: string): ConfigStore => {
  const loadConfig = async (): Promise<Config> => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = ConfigSchema.parse(JSON.parse(content));
      return { ...defaults, ...parsed };
    } catch {
      return { ...defaults };
    }
  };

  const saveConfig = async (partial: Partial<Config>): Promise<Config> => {
    const current = await loadConfig();
    const merged = ConfigSchema.parse({ ...current, ...partial });
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  };

  return { loadConfig, saveConfig };
};
