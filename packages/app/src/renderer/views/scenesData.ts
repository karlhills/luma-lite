import type { Scene } from '@lumalite/core';

export const defaultScenes: Scene[] = [
  {
    id: 'work',
    name: 'Work',
    commands: [
      { type: 'power', on: true },
      { type: 'brightness', level: 80 },
      { type: 'color', color: { r: 210, g: 230, b: 255 } }
    ]
  },
  {
    id: 'gaming',
    name: 'Gaming',
    commands: [
      { type: 'power', on: true },
      { type: 'brightness', level: 90 },
      { type: 'color', color: { r: 120, g: 90, b: 255 } }
    ]
  },
  {
    id: 'night',
    name: 'Night',
    commands: [
      { type: 'power', on: true },
      { type: 'brightness', level: 25 },
      { type: 'color', color: { r: 255, g: 180, b: 120 } }
    ]
  }
];
