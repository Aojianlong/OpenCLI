import { AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  MAIL_DOMAIN,
  MAIL_URL,
  classifyPage,
  extractEmailFromTitle,
  inspectPageInPage,
  requirePositiveInt,
} from './helpers.js';

cli({
  site: 'proton',
  name: 'whoami',
  access: 'read',
  description: 'Show the Proton Mail account signed in on the connected Chrome session',
  example: 'opencli proton whoami -f json',
  domain: MAIL_DOMAIN,
  strategy: Strategy.UI,
  browser: true,
  siteSession: 'persistent',
  navigateBefore: false,
  args: [
    { name: 'timeout', type: 'int', default: 30, help: 'Max seconds to wait past the Proton splash (1..900)' },
  ],
  columns: ['logged_in', 'site', 'email', 'url', 'title'],
  authStatus: {
    quickCheck: async (page) => {
      const snapshot = await page.evaluate(inspectPageInPage);
      const kind = classifyPage(snapshot);
      return { logged_in: kind === 'mailbox' || kind === 'apps' };
    },
  },
  func: async (page, kwargs) => {
    const timeout = requirePositiveInt(kwargs.timeout, 30, 900, '--timeout');
    await page.goto(MAIL_URL, { settleMs: 2500 });
    const start = Date.now();
    let snapshot = await page.evaluate(inspectPageInPage);
    let kind = classifyPage(snapshot);
    while (Date.now() - start < timeout * 1000) {
      if (kind !== 'splash' && kind !== 'unknown') break;
      await page.wait(1);
      snapshot = await page.evaluate(inspectPageInPage);
      kind = classifyPage(snapshot);
    }
    if (kind === 'blocked') {
      throw new CommandExecutionError(
        'Proton human verification is blocking the session',
        'Solve it in Chrome, then retry `opencli proton whoami`.',
      );
    }
    if (kind !== 'mailbox' && kind !== 'apps') {
      throw new AuthRequiredError(
        MAIL_DOMAIN,
        'Not logged in to Proton Mail',
        'Run `opencli proton login`, then retry `opencli proton whoami`.',
      );
    }
    return {
      logged_in: true,
      site: 'proton',
      email: extractEmailFromTitle(snapshot.title),
      url: snapshot.url,
      title: snapshot.title,
    };
  },
});
