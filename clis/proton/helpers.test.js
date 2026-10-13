import { describe, expect, it } from 'vitest';
import { ConfigError } from '@jackwener/opencli/errors';
import {
  classifyPage,
  extractEmailFromTitle,
  pickCode,
  pickMailClickText,
  redactSecrets,
  resolveCredentials,
} from './helpers.js';

describe('resolveCredentials', () => {
  it('reads email and password from kwargs', () => {
    expect(
      resolveCredentials(
        { email: 'a@proton.me', password: 'secret-pass' },
        {},
      ),
    ).toEqual({ email: 'a@proton.me', password: 'secret-pass' });
  });

  it('falls back to PROTON_EMAIL and PROTON_PASSWORD', () => {
    expect(
      resolveCredentials(
        {},
        { PROTON_EMAIL: 'env@proton.me', PROTON_PASSWORD: 'env-pass' },
      ),
    ).toEqual({ email: 'env@proton.me', password: 'env-pass' });
  });

  it('lets kwargs override env', () => {
    expect(
      resolveCredentials(
        { email: 'flag@proton.me', password: 'flag-pass' },
        { PROTON_EMAIL: 'env@proton.me', PROTON_PASSWORD: 'env-pass' },
      ),
    ).toEqual({ email: 'flag@proton.me', password: 'flag-pass' });
  });

  it('throws ConfigError without leaking the password when email is missing', () => {
    expect(() => resolveCredentials({ password: 'super-secret-xyz' }, {})).toThrow(ConfigError);
    try {
      resolveCredentials({ password: 'super-secret-xyz' }, {});
    } catch (err) {
      expect(String(err)).not.toContain('super-secret-xyz');
    }
  });

  it('throws ConfigError when password is missing', () => {
    expect(() => resolveCredentials({ email: 'a@proton.me' }, {})).toThrow(ConfigError);
    try {
      resolveCredentials({ email: 'a@proton.me' }, {});
    } catch (err) {
      expect(err.hint).toMatch(/PROTON_PASSWORD|--password/);
    }
  });
});

describe('classifyPage', () => {
  it('detects the loading splash', () => {
    expect(
      classifyPage({
        url: 'https://account.proton.me/login?language=en',
        title: 'Proton Account: Sign-in',
        bodyHead: 'Loading Proton Account...',
        hasUsername: false,
        hasPassword: false,
      }),
    ).toBe('splash');
  });

  it('detects the sign-in form', () => {
    expect(
      classifyPage({
        url: 'https://account.proton.me/login?language=en',
        title: 'Proton Account: Sign-in',
        bodyHead: 'Sign in Enter your Proton Account details.',
        hasUsername: true,
        hasPassword: true,
      }),
    ).toBe('login');
  });

  it('detects the apps picker after auth', () => {
    expect(
      classifyPage({
        url: 'https://account.proton.me/apps',
        title: 'Proton Account: Sign-in',
        bodyHead: 'Welcome Privacy and security starts here Mail Encrypted email',
        buttons: ['Mail\nEncrypted email', 'Settings'],
      }),
    ).toBe('apps');
  });

  it('detects the mailbox', () => {
    expect(
      classifyPage({
        url: 'https://mail.proton.me/u/1/inbox#category=primary',
        title: 'Inbox | a@proton.me | Proton Mail',
        bodyHead: 'Proton Mail New message Inbox',
      }),
    ).toBe('mailbox');
  });

  it('treats mail.proton.me as splash while the SPA is still loading', () => {
    expect(
      classifyPage({
        url: 'https://mail.proton.me/u/2/',
        title: 'Proton Mail',
        bodyHead: 'Loading Proton Mail Loading',
      }),
    ).toBe('splash');
  });

  it('detects human verification', () => {
    expect(
      classifyPage({
        url: 'https://account.proton.me/login',
        title: 'Human verification',
        bodyHead: 'Verify you are human captcha',
      }),
    ).toBe('blocked');
  });
});

describe('pickMailClickText', () => {
  it('matches the Mail tile whose label includes Encrypted email', () => {
    expect(
      pickMailClickText([
        'Alexandra961566\nAlexandra961566@proton.me\nA',
        'Mail\nEncrypted email',
        'Calendar\nPrivate scheduling',
        'Settings',
      ]),
    ).toBe('Mail\nEncrypted email');
  });
});

describe('extractEmailFromTitle', () => {
  it('reads the address from a Proton Mail inbox title', () => {
    expect(extractEmailFromTitle('Inbox | a@proton.me | Proton Mail')).toBe('a@proton.me');
  });

  it('returns empty when the title has no address', () => {
    expect(extractEmailFromTitle('Proton Account: Sign-in')).toBe('');
  });
});

describe('pickCode', () => {
  it('prefers the last 6-digit code and skips 4-digit years', () => {
    expect(pickCode('iFood 2026 code 511161')).toBe('511161');
  });

  it('skips digits that appear in the exclude list', () => {
    expect(pickCode('Inbox a961566@proton.me iFood 511161 2026', { exclude: ['961566'] })).toBe('511161');
  });

  it('falls back to the last remaining 4-8 digit match', () => {
    expect(pickCode('pin 8341')).toBe('8341');
  });

  it('returns empty when only a year matches', () => {
    expect(pickCode('written in 2026')).toBe('');
  });
});

describe('redactSecrets', () => {
  it('strips known secrets from error text', () => {
    expect(redactSecrets('failed with password super-secret-xyz', ['super-secret-xyz'])).toBe(
      'failed with password ***',
    );
  });
});
