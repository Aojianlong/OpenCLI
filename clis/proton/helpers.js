import { ArgumentError, ConfigError } from '@jackwener/opencli/errors';

export const LOGIN_URL = 'https://account.proton.me/login?language=en';
export const MAIL_URL = 'https://mail.proton.me/';
export const ACCOUNT_DOMAIN = 'account.proton.me';
export const MAIL_DOMAIN = 'mail.proton.me';

export function requirePositiveInt(value, fallback, max, label) {
  const parsed = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ArgumentError(`${label} must be a positive integer`);
  }
  if (parsed > max) {
    throw new ArgumentError(`${label} must be <= ${max}`);
  }
  return parsed;
}

export function resolveCredentials(
  kwargs,
  env = process.env,
) {
  const email = String(kwargs.email ?? env.PROTON_EMAIL ?? '').trim();
  const password = String(kwargs.password ?? env.PROTON_PASSWORD ?? '');
  if (!email) {
    throw new ConfigError(
      'Proton email is required',
      'Pass --email or set PROTON_EMAIL.',
    );
  }
  if (!password) {
    throw new ConfigError(
      'Proton password is required',
      'Pass --password or set PROTON_PASSWORD.',
    );
  }
  return { email, password };
}

export function redactSecrets(text, secrets) {
  let out = text;
  for (const secret of secrets) {
    if (!secret) continue;
    out = out.split(secret).join('***');
  }
  return out;
}

export function extractEmailFromTitle(title) {
  const match = String(title || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : '';
}

export function classifyPage(page) {
  const url = page.url || '';
  const title = page.title || '';
  const body = page.bodyHead || '';
  const hay = `${url} ${title} ${body}`.toLowerCase();

  if (
    /human verification|verify you are human|unusual activity|too many recent/.test(hay)
    || (/captcha/.test(hay) && !/inbox|proton mail/.test(hay))
  ) {
    return 'blocked';
  }
  if (/loading proton (account|mail)/i.test(body)) {
    return 'splash';
  }
  if (/mail\.proton\.me/i.test(url) && !/\/login/i.test(url)) {
    return 'mailbox';
  }
  if (
    /account\.proton\.me\/apps/i.test(url)
    || (/\bwelcome\b/i.test(body) && /\bmail\b/i.test(body) && /encrypted email/i.test(body))
  ) {
    return 'apps';
  }
  if (page.hasUsername || page.hasPassword) {
    return 'login';
  }
  if (/loading proton account/i.test(body) || (/\/login/i.test(url) && !page.hasUsername && !page.hasPassword)) {
    return 'splash';
  }
  return 'unknown';
}

export function pickMailClickText(buttons) {
  if (!buttons?.length) return null;
  const hit = buttons.find((text) => /^mail\b/i.test((text || '').trim().split('\n')[0] || ''));
  return hit ?? null;
}

export function pickCode(text, { exclude = [] } = {}) {
  const blocked = new Set(
    exclude.flatMap((value) => String(value || '').match(/\d{4,8}/g) || []),
  );
  const matches = [...String(text || '').matchAll(/\d{4,8}/g)]
    .map((m) => m[0])
    .filter((code) => !/^20\d{2}$/.test(code) && !blocked.has(code));
  const six = matches.filter((code) => code.length === 6);
  if (six.length) return six[six.length - 1];
  return matches.length ? matches[matches.length - 1] : '';
}

export function inspectPageInPage() {
  const vis = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  };
  const inputs = Array.from(document.querySelectorAll('input')).filter(vis);
  const buttons = Array.from(document.querySelectorAll('button, [role="button"], a, [role="link"]'))
    .filter(vis)
    .map((b) => (b.innerText || b.value || b.getAttribute('aria-label') || '').trim())
    .filter(Boolean)
    .slice(0, 20);
  const body = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
  return {
    url: location.href,
    title: document.title,
    hasPassword: inputs.some((i) => i.type === 'password'),
    hasUsername: inputs.some((i) => i.type !== 'password' && i.type !== 'hidden' && i.type !== 'checkbox' && i.type !== 'submit'),
    buttons,
    bodyHead: body.slice(0, 900),
  };
}

export function fillCredentialsInPage(email, password) {
  const setNative = (el, value) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    el.focus();
    desc.set.call(el, value);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const vis = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  };
  const inputs = Array.from(document.querySelectorAll('input')).filter(vis);
  const user = inputs.find((i) => /email|user|login/i.test((i.id || '') + (i.name || '') + (i.autocomplete || '') + (i.placeholder || '') + (i.getAttribute('aria-label') || '')) || i.type === 'email' || i.type === 'text')
    || inputs.find((i) => i.type !== 'password' && i.type !== 'hidden' && i.type !== 'checkbox' && i.type !== 'submit');
  const pass = inputs.find((i) => i.type === 'password');
  if (user) setNative(user, email);
  if (pass) setNative(pass, password);
  return {
    userFound: !!user,
    passFound: !!pass,
    userLen: user ? (user.value || '').length : 0,
    passLen: pass ? (pass.value || '').length : 0,
  };
}

export function clickSubmitInPage() {
  const vis = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  };
  const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]')).filter(vis);
  const label = (b) => (b.innerText || b.value || b.getAttribute('aria-label') || '').trim();
  const want = /^(continue|sign in|log in|next|submit)$/i;
  const btn = buttons.find((b) => want.test(label(b)))
    || buttons.find((b) => /continue|sign in|log in/i.test(label(b)));
  if (!btn) return { clicked: false, texts: buttons.map(label).slice(0, 12) };
  btn.click();
  return { clicked: true, text: label(btn) };
}

export function clickMailInPage() {
  const vis = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  };
  const els = Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"]')).filter(vis);
  const label = (el) => (el.innerText || el.getAttribute('aria-label') || '').trim();
  const mail = els.find((el) => /^mail\b/i.test(label(el).split('\n')[0] || ''));
  if (!mail) return { clicked: false, texts: els.map(label).filter(Boolean).slice(0, 12) };
  mail.click();
  return { clicked: true, text: label(mail) };
}

export async function scrapeInboxInPage(sender, limit) {
  const needle = String(sender || '').toLowerCase();
  const maxRows = Number(limit) || 20;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pageText = () => (document.body?.innerText || '').replace(/\s+/g, ' ').trim();

  const searchEl = document.querySelector('input[type="search"], input[placeholder*="Search" i], input[placeholder*="搜索"]');
  if (searchEl && needle) {
    const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    desc.set.call(searchEl, needle);
    searchEl.dispatchEvent(new Event('input', { bubbles: true }));
    searchEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    searchEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    await sleep(2500);
  }

  const nodes = Array.from(document.querySelectorAll(
    '[data-testid*="item"], [data-element-id], .item-container, [role="row"], [class*="item-wrapper"]',
  ));
  const rows = [];
  const seen = new Set();
  for (const n of nodes) {
    const t = (n.innerText || '').replace(/\s+/g, ' ').trim();
    if (t.length < 8 || t.length > 400) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    rows.push(t);
    if (rows.length >= maxRows) break;
  }

  const hit = needle
    ? nodes.find((n) => (n.innerText || '').toLowerCase().includes(needle))
    : null;
  let opened = '';
  if (hit) {
    hit.click();
    await sleep(2000);
    opened = pageText().slice(0, 2500);
  }

  const body = pageText();
  const senderRows = needle ? rows.filter((r) => r.toLowerCase().includes(needle)) : rows;
  const senderHit = Boolean(
    (needle && (body.toLowerCase().includes(needle) || rows.some((r) => r.toLowerCase().includes(needle))))
    || (!needle && rows.length > 0),
  );
  return {
    url: location.href,
    title: document.title,
    logged_in: /mail\.proton\.me/i.test(location.href) && !/login/i.test(location.href),
    sender: needle,
    sender_hit: senderHit,
    rows: (needle ? senderRows : rows).slice(0, maxRows).join(' || '),
    opened,
    body_head: (opened || body).slice(0, 1500),
  };
}
