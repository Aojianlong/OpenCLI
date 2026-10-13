import { describe, expect, it, vi } from 'vitest';
import { ConfigError } from '@jackwener/opencli/errors';
import { getRegistry } from '@jackwener/opencli/registry';
import './login.js';

function createPage(evaluates) {
  const evaluate = vi.fn();
  for (const value of evaluates) {
    evaluate.mockResolvedValueOnce(value);
  }
  evaluate.mockResolvedValue(evaluates[evaluates.length - 1]);
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    evaluate,
    wait: vi.fn().mockResolvedValue(undefined),
  };
}

const mailboxInspect = {
  url: 'https://mail.proton.me/u/1/inbox#category=primary',
  title: 'Inbox | a@proton.me | Proton Mail',
  bodyHead: 'Proton Mail Inbox',
  hasUsername: false,
  hasPassword: false,
  buttons: [],
};

describe('proton login adapter', () => {
  const cmd = getRegistry().get('proton/login');

  it('registers proton login as a persistent UI write command', () => {
    expect(cmd?.name).toBe('login');
    expect(cmd?.site).toBe('proton');
    expect(cmd?.access).toBe('write');
    expect(cmd?.strategy).toBe('ui');
    expect(cmd?.siteSession).toBe('persistent');
    expect(cmd?.func).toBeTypeOf('function');
  });

  it('returns already_logged_in without a password when the session is in the mailbox', async () => {
    const page = createPage([mailboxInspect]);
    const rows = await cmd.func(page, {});
    expect(rows).toEqual([
      {
        logged_in: true,
        already_logged_in: true,
        email: 'a@proton.me',
        url: mailboxInspect.url,
        title: mailboxInspect.title,
      },
    ]);
    expect(page.evaluate).toHaveBeenCalledTimes(1);
  });

  it('fills the form then opens Mail from the apps picker', async () => {
    const page = createPage([
      {
        url: 'https://account.proton.me/login?language=en',
        title: 'Proton Account: Sign-in',
        bodyHead: 'Sign in',
        hasUsername: true,
        hasPassword: true,
        buttons: ['Sign in'],
      },
      { userFound: true, passFound: true, userLen: 10, passLen: 8 },
      { clicked: true, text: 'Sign in' },
      {
        url: 'https://account.proton.me/apps',
        title: 'Proton Account: Sign-in',
        bodyHead: 'Welcome Privacy and security starts here Mail Encrypted email',
        buttons: ['Mail\nEncrypted email'],
      },
      { clicked: true, text: 'Mail\nEncrypted email' },
      mailboxInspect,
    ]);
    const rows = await cmd.func(page, { email: 'a@proton.me', password: 'secret' });
    expect(rows).toEqual([
      {
        logged_in: true,
        already_logged_in: false,
        email: 'a@proton.me',
        url: mailboxInspect.url,
        title: mailboxInspect.title,
      },
    ]);
  });

  it('requires credentials before filling the sign-in form', async () => {
    const page = createPage([
      {
        url: 'https://account.proton.me/login?language=en',
        title: 'Proton Account: Sign-in',
        bodyHead: 'Sign in',
        hasUsername: true,
        hasPassword: true,
        buttons: ['Sign in'],
      },
    ]);
    await expect(cmd.func(page, {})).rejects.toBeInstanceOf(ConfigError);
  });
});
