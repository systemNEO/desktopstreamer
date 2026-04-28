import { describe, it, expect } from 'vitest';
import type { OBSStatus, InstallProgress } from '@shared/types';

describe('OBS types', () => {
  it('OBSStatus discriminated union narrows korrekt', () => {
    const s: OBSStatus = { state: 'ready', obsVersion: '30.1.0' };
    if (s.state === 'ready') {
      expect(s.obsVersion).toBe('30.1.0');
    }
  });

  it('InstallProgress hat 0..100 percent', () => {
    const p: InstallProgress = { step: 'downloading', percent: 42, message: 'msg' };
    expect(p.percent).toBeGreaterThanOrEqual(0);
    expect(p.percent).toBeLessThanOrEqual(100);
  });
});
