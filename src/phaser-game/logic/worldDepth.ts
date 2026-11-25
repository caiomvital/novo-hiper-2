/** Ordena personagens e volumes pelos pés, mantendo os letreiros (2) e HUD (20) acima. */
export const worldDepthAt = (feetY: number) => 1 + feetY / 10_000;
