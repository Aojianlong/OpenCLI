import { AuthRequiredError, EmptyResultError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  MAIL_DOMAIN,
  MAIL_URL,
  extractEmailFromTitle,
  pickCode,
  requirePositiveInt,
  scrapeInboxInPage,
} from './helpers.js';

cli({
  site: 'proton',
  name: 'inbox',
  access: 'read',
  description: 'Scrape Proton Mail inbox from the logged-in Chrome session',
  example: 'opencli proton inbox --from ifood -f json',
  domain: MAIL_DOMAIN,
  strategy: Strategy.UI,
  browser: true,
  siteSession: 'persistent',
  navigateBefore: false,
  args: [
    { name: 'from', type: 'str', help: 'Sender keyword (case-insensitive substring)' },
    { name: 'limit', type: 'int', default: 20, help: 'Max message rows (1..100)' },
    { name: 'timeout', type: 'int', default: 90, help: 'Max seconds to wait for the mailbox (1..900)' },
  ],
  columns: ['url', 'title', 'logged_in', 'sender', 'sender_hit', 'code', 'rows', 'body_head'],
  func: async (page, kwargs) => {
    requirePositiveInt(kwargs.timeout, 90, 900, '--timeout');
    const limit = requirePositiveInt(kwargs.limit, 20, 100, '--limit');
    const sender = String(kwargs.from ?? '').trim();
    await page.goto(MAIL_URL, { settleMs: 5000 });
    const raw = await page.evaluate(scrapeInboxInPage, sender, limit);
    if (!raw?.logged_in) {
      throw new AuthRequiredError(
        MAIL_DOMAIN,
        'Not logged in to Proton Mail',
        'Run `opencli proton login`, then retry `opencli proton inbox`.',
      );
    }
    if (sender && !raw.sender_hit) {
      throw new EmptyResultError(
        'proton inbox',
        `No message matched sender "${sender}".`,
      );
    }
    const exclude = [extractEmailFromTitle(raw.title)];
    const code = pickCode(`${raw.opened || ''}\n${raw.body_head || ''}\n${raw.rows || ''}`, { exclude })
      || raw.code
      || '';
    return [{
      url: raw.url,
      title: raw.title,
      logged_in: true,
      sender: raw.sender || sender.toLowerCase(),
      sender_hit: Boolean(raw.sender_hit),
      code,
      rows: raw.rows || '',
      body_head: raw.body_head || '',
    }];
  },
});
