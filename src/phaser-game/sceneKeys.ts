export const SCENE_KEYS = {
  World: 'WorldScene',
  Platform: 'PlatformScene',
  Interior: 'NovoHiperInteriorScene',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
