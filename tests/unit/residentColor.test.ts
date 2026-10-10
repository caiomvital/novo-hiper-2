import { describe, expect, it } from 'vitest';
import { colorForResident, colorForResidentHex } from '../../src/shared/residentColor';
import { ROSTER } from '../../src/shared/roster';

describe('colorForResident', () => {
  it('é determinística: o mesmo id sempre dá a mesma cor', () => {
    for (const r of ROSTER) expect(colorForResident(r.id)).toBe(colorForResident(r.id));
  });

  it('ids diferentes do roster tendem a ter cores diferentes (paleta de 8 cores, 8 moradores)', () => {
    const colors = new Set(ROSTER.map((r) => colorForResident(r.id)));
    expect(colors.size).toBeGreaterThan(1);
  });

  it('sem id (legado/desconhecido): cor padrão estável', () => {
    expect(colorForResident(null)).toBe(colorForResident(undefined));
    expect(colorForResident('')).toBe(colorForResident(null));
  });

  it('colorForResidentHex é o mesmo valor em hex numérico', () => {
    const css = colorForResident(ROSTER[0].id);
    expect(colorForResidentHex(ROSTER[0].id)).toBe(parseInt(css.slice(1), 16));
  });
});
