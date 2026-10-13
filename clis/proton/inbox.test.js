import { describe, expect, it, vi } from 'vitest';
import { AuthRequiredError, EmptyResultError } from '@jackwener/opencli/errors';
import { getRegistry } from '@jackwener/opencli/registry';
import './inbox.js';

function createPage(result) {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(result),
    wait: vi.fn().mockResolvedValue(undefined),
  };
}

describe('proton inbox adapter', () => {
  const cmd = getRegistry().get('proton/inbox');

  it('registers proton inbox as a persistent read command', () => {
    expect(cmd?.name).toBe('inbox');
    expect(cmd?.access).toBe('read');
    expect(cmd?.func).toBeTypeOf('function');
  });

  it('returns the scraped sender hit and code', async () => {
    const page = createPage({
      url: 'https://mail.proton.me/u/2/inbox',
      title: 'Inbox | a@proton.me | Proton Mail',
      logged_in: true,
      sender: 'ifood',
      sender_hit: true,
      code: '511161',
      rows: 'iFood 511161',
      body_head: 'Your code is 511161',
    });
    const rows = await cmd.func(page, { from: 'ifood' });
    expect(rows).toEqual([
      {
        url: 'https://mail.proton.me/u/2/inbox',
        title: 'Inbox | a@proton.me | Proton Mail',
        logged_in: true,
        sender: 'ifood',
        sender_hit: true,
        code: '511161',
        rows: 'iFood 511161',
        body_head: 'Your code is 511161',
      },
    ]);
  });

  it('throws AuthRequiredError when the mailbox is not signed in', async () => {
    const page = createPage({
      url: 'https://account.proton.me/login',
      title: 'Proton Account: Sign-in',
      logged_in: false,
      sender: 'ifood',
      sender_hit: false,
      code: '',
      rows: '',
      body_head: 'Sign in',
    });
    await expect(cmd.func(page, { from: 'ifood' })).rejects.toBeInstanceOf(AuthRequiredError);
  });

  it('throws EmptyResultError when --from matches no sender', async () => {
    const page = createPage({
      url: 'https://mail.proton.me/u/2/inbox',
      title: 'Inbox | a@proton.me | Proton Mail',
      logged_in: true,
      sender: 'ifood',
      sender_hit: false,
      code: '',
      rows: 'Unrelated newsletter',
      body_head: 'Inbox',
    });
    await expect(cmd.func(page, { from: 'ifood' })).rejects.toBeInstanceOf(EmptyResultError);
  });
});
