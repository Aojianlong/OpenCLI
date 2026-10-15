import { afterEach, describe, expect, it, vi } from 'vitest';
import { Page } from './page.js';
import { sendCommand } from './daemon-client.js';
import { log } from '../logger.js';

vi.mock('./daemon-client.js', () => ({ sendCommand: vi.fn(), sendCommandFull: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe('owned-tab cleanup opt-in', () => {
  it('preserves the existing reusable-container request by default', async () => {
    vi.stubEnv('OPENCLI_CLOSE_OWNED_TAB', '');
    vi.mocked(sendCommand).mockResolvedValue({ closed: true });
    await new Page('default').closeWindow();
    expect(sendCommand).toHaveBeenCalledExactlyOnceWith('close-window', expect.not.objectContaining({ closeOwnedTab: true }));
  });

  it('requests and verifies owned-tab removal when enabled', async () => {
    vi.stubEnv('OPENCLI_CLOSE_OWNED_TAB', '1');
    vi.mocked(sendCommand).mockResolvedValue({ closed: true, tabCleanup: 'closed-owned-tab' });
    const page = new Page('cleanup');
    page.setActivePage('target-1');
    await page.closeWindow();
    expect(sendCommand).toHaveBeenCalledWith('close-window', expect.objectContaining({ session: 'cleanup', closeOwnedTab: true }));
    expect(page.getActivePage()).toBeUndefined();
  });

  it.each([
    { closed: true }, // An older extension must not silently ignore the opt-in.
    new Error('Chrome refused cleanup'),
  ])('keeps the page identity and warns when cleanup is not confirmed', async (result) => {
    vi.stubEnv('OPENCLI_CLOSE_OWNED_TAB', '1');
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => {});
    if (result instanceof Error) vi.mocked(sendCommand).mockRejectedValue(result);
    else vi.mocked(sendCommand).mockResolvedValue(result);
    const page = new Page('retry');
    page.setActivePage('target-1');
    await expect(page.closeWindow()).rejects.toThrow();
    expect(page.getActivePage()).toBe('target-1');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Retry cleanup separately'));
  });
});
