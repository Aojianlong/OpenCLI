import { describe, expect, it, vi } from 'vitest';
import { AuthRequiredError } from '@jackwener/opencli/errors';
import { getRegistry } from '@jackwener/opencli/registry';
import './whoami.js';

function createPage(inspect) {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(inspect),
    wait: vi.fn().mockResolvedValue(undefined),
  };
}

describe('proton whoami adapter', () => {
  const cmd = getRegistry().get('proton/whoami');

  it('registers proton whoami as a persistent read command', () => {
    expect(cmd?.name).toBe('whoami');
    expect(cmd?.access).toBe('read');
    expect(cmd?.func).toBeTypeOf('function');
  });

  it('returns the mailbox identity', async () => {
    const page = createPage({
      url: 'https://mail.proton.me/u/2/inbox',
      title: 'Inbox | a@proton.me | Proton Mail',
      bodyHead: 'Proton Mail Inbox',
    });
    await expect(cmd.func(page, {})).resolves.toEqual({
      logged_in: true,
      site: 'proton',
      email: 'a@proton.me',
      url: 'https://mail.proton.me/u/2/inbox',
      title: 'Inbox | a@proton.me | Proton Mail',
    });
  });

  it('throws AuthRequiredError on the sign-in page', async () => {
    const page = createPage({
      url: 'https://account.proton.me/login',
      title: 'Proton Account: Sign-in',
      bodyHead: 'Sign in',
      hasUsername: true,
      hasPassword: true,
    });
    await expect(cmd.func(page, {})).rejects.toBeInstanceOf(AuthRequiredError);
  });
});
