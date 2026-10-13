import {
  CliError,
  CommandExecutionError,
  TimeoutError,
} from '@jackwener/opencli/errors';
import { log } from '@jackwener/opencli/logger';
import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  ACCOUNT_DOMAIN,
  LOGIN_URL,
  MAIL_URL,
  classifyPage,
  clickMailInPage,
  clickSubmitInPage,
  extractEmailFromTitle,
  fillCredentialsInPage,
  inspectPageInPage,
  redactSecrets,
  requirePositiveInt,
  resolveCredentials,
} from './helpers.js';

async function inspectPage(page) {
  return page.evaluate(inspectPageInPage);
}

async function waitForKind(page, wanted, timeoutSec) {
  const start = Date.now();
  let snapshot = await inspectPage(page);
  let kind = classifyPage(snapshot);
  while (Date.now() - start < timeoutSec * 1000) {
    if (wanted.includes(kind) || kind === 'blocked') {
      return { kind, inspect: snapshot };
    }
    log.verbose(`[proton] waiting for ${wanted.join('|')} (have ${kind}) ${snapshot.url}`);
    await page.wait(1);
    snapshot = await inspectPage(page);
    kind = classifyPage(snapshot);
  }
  return { kind, inspect: snapshot };
}

function identity(inspect, email) {
  return email || extractEmailFromTitle(inspect.title) || '';
}

function throwIfBlocked(kind) {
  if (kind !== 'blocked') return;
  throw new CommandExecutionError(
    'Proton login blocked (human verification / captcha)',
    'Solve it in the connected Chrome window, then retry `opencli proton login`.',
  );
}

async function openMailbox(page, timeoutSec) {
  const clicked = await page.evaluate(clickMailInPage);
  if (!clicked?.clicked) {
    await page.goto(MAIL_URL, { settleMs: 4000 });
  } else {
    await page.wait(4);
  }
  return waitForKind(page, ['mailbox'], timeoutSec);
}

function wrapSecretError(err, password) {
  if (err instanceof CliError) {
    const message = redactSecrets(err.message, [password]);
    if (message !== err.message) err.message = message;
    return err;
  }
  return new CommandExecutionError(
    redactSecrets(err instanceof Error ? err.message : String(err), [password]),
    'Solve human verification in Chrome if shown, then retry `opencli proton login`.',
  );
}

cli({
  site: 'proton',
  name: 'login',
  access: 'write',
  description: 'Sign in to Proton Mail via the connected Chrome session (web UI)',
  example: 'opencli proton login --email you@proton.me',
  domain: ACCOUNT_DOMAIN,
  strategy: Strategy.UI,
  browser: true,
  siteSession: 'persistent',
  navigateBefore: false,
  args: [
    { name: 'email', type: 'str', help: 'Proton address or username (or set PROTON_EMAIL)' },
    { name: 'password', type: 'str', help: 'Password; prefer PROTON_PASSWORD over this flag' },
    { name: 'timeout', type: 'int', default: 120, help: 'Max seconds for splash, submit, and mailbox (1..900)' },
  ],
  columns: ['logged_in', 'already_logged_in', 'email', 'url', 'title'],
  func: async (page, kwargs) => {
    const timeout = requirePositiveInt(kwargs.timeout, 120, 900, '--timeout');
    let password = '';
    try {
      await page.goto(LOGIN_URL, { settleMs: 2500 });
      let { kind, inspect } = await waitForKind(page, ['login', 'apps', 'mailbox'], Math.min(20, timeout));
      throwIfBlocked(kind);

      if (kind === 'mailbox') {
        return [{
          logged_in: true,
          already_logged_in: true,
          email: identity(inspect, kwargs.email),
          url: inspect.url,
          title: inspect.title,
        }];
      }

      if (kind === 'apps') {
        ({ kind, inspect } = await openMailbox(page, timeout));
        throwIfBlocked(kind);
        if (kind !== 'mailbox') {
          throw new CommandExecutionError(
            `Signed in but mailbox did not open: ${inspect.url}`,
            'Open Mail in Chrome, then retry `opencli proton whoami`.',
          );
        }
        return [{
          logged_in: true,
          already_logged_in: true,
          email: identity(inspect, kwargs.email),
          url: inspect.url,
          title: inspect.title,
        }];
      }

      if (kind !== 'login') {
        throw new TimeoutError(
          'Proton login form',
          timeout,
          `Last page: ${inspect.url} (${inspect.title}).`,
        );
      }

      const creds = resolveCredentials(kwargs);
      password = creds.password;
      const fill1 = await page.evaluate(fillCredentialsInPage, creds.email, creds.password);
      log.verbose(`[proton] fill userFound=${fill1.userFound} passFound=${fill1.passFound}`);
      const click1 = await page.evaluate(clickSubmitInPage);
      log.verbose(`[proton] submit ${click1.clicked ? click1.text : 'no button'}`);

      ({ kind, inspect } = await waitForKind(page, ['apps', 'mailbox', 'login'], Math.min(20, timeout)));
      throwIfBlocked(kind);
      if (kind === 'login') {
        await page.evaluate(fillCredentialsInPage, creds.email, creds.password);
        await page.evaluate(clickSubmitInPage);
        ({ kind, inspect } = await waitForKind(page, ['apps', 'mailbox'], Math.min(40, timeout)));
        throwIfBlocked(kind);
      }

      if (kind === 'apps') {
        ({ kind, inspect } = await openMailbox(page, timeout));
        throwIfBlocked(kind);
      }
      if (kind !== 'mailbox') {
        throw new CommandExecutionError(
          `Proton login did not reach inbox: ${inspect.url} (${inspect.title})`,
          'Finish any extra Proton prompt in Chrome, then retry `opencli proton whoami`.',
        );
      }
      return [{
        logged_in: true,
        already_logged_in: false,
        email: creds.email,
        url: inspect.url,
        title: inspect.title,
      }];
    } catch (err) {
      throw wrapSecretError(err, password);
    }
  },
});
