export const SCENE_KEYS = {
  World: 'WorldScene',
  Platform: 'PlatformScene',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
