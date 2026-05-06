import { MULTS, getFloor, getCharge } from '../constants';

describe('MULTS', () => {
  it('has 6 entries', () => {
    expect(MULTS).toHaveLength(6);
  });

  it('has multiplier values 0 through 5', () => {
    const values = MULTS.map((m) => m.v);
    expect(values).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('each entry has v, color, and label', () => {
    for (const m of MULTS) {
      expect(typeof m.v).toBe('number');
      expect(typeof m.color).toBe('string');
      expect(typeof m.label).toBe('string');
    }
  });
});

describe('getFloor', () => {
  it('returns 0 with 1 gem, 1 player', () => {
    expect(getFloor(1, 1)).toBe(0);
  });

  it('returns 0 with 2 gems, 1 player', () => {
    expect(getFloor(2, 1)).toBe(0);
  });

  it('returns 1 with 3 gems, 1 player', () => {
    expect(getFloor(3, 1)).toBe(1);
  });

  it('returns 1 with 5 gems, 1 player', () => {
    expect(getFloor(5, 1)).toBe(1);
  });

  it('returns 2 with 2 players', () => {
    expect(getFloor(1, 2)).toBe(2);
  });

  it('returns 2 with 5 gems, 2 players', () => {
    expect(getFloor(5, 2)).toBe(2);
  });

  it('returns 3 with 3 players', () => {
    expect(getFloor(1, 3)).toBe(3);
  });

  it('returns 3 with 5 players', () => {
    expect(getFloor(3, 5)).toBe(3);
  });
});

describe('getCharge', () => {
  it('returns intensity 0.18 for gems=1', () => {
    expect(getCharge(1).intensity).toBeCloseTo(0.18);
  });

  it('returns glow=true for gems=1', () => {
    expect(getCharge(1).glow).toBe(true);
  });

  it('returns vibrate=false for gems=1', () => {
    expect(getCharge(1).vibrate).toBe(false);
  });

  it('returns intensity 0.40 for gems=2', () => {
    expect(getCharge(2).intensity).toBeCloseTo(0.4);
  });

  it('returns intensity 0.62 for gems=3', () => {
    expect(getCharge(3).intensity).toBeCloseTo(0.62);
  });

  it('returns lightning=4 for gems=3', () => {
    expect(getCharge(3).lightning).toBe(4);
  });

  it('returns vibrate=true for gems=4', () => {
    expect(getCharge(4).vibrate).toBe(true);
  });

  it('returns intensity 0.82 for gems=4', () => {
    expect(getCharge(4).intensity).toBeCloseTo(0.82);
  });

  it('returns vibrate=true for gems=5', () => {
    expect(getCharge(5).vibrate).toBe(true);
  });

  it('returns intensity 1.0 for gems=5', () => {
    expect(getCharge(5).intensity).toBeCloseTo(1.0);
  });

  it('returns lightning=9 for gems=5', () => {
    expect(getCharge(5).lightning).toBe(9);
  });
});
