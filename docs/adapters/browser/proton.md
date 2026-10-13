# Proton Mail

**Mode**: 🔐 Browser · **Domain**: `account.proton.me` / `mail.proton.me`

Sign in through the Proton Account web UI on the connected Chrome session, then scrape the mailbox. This adapter does not use Proton's unofficial SRP `/auth` API.

## Commands

| Command | Description |
|---------|-------------|
| `opencli proton login` | Fill the Proton Account sign-in form, or report `already_logged_in` |
| `opencli proton whoami` | Show the mailbox identity on the current Chrome session |
| `opencli proton inbox` | Search the inbox and extract a one-time code |

## Usage Examples

```bash
# Credentials from flags or PROTON_EMAIL / PROTON_PASSWORD
export PROTON_EMAIL=you@proton.me
export PROTON_PASSWORD='your-password'
opencli proton login -f json

opencli proton whoami -f json

# Sender filter is a case-insensitive substring of the from/body text
opencli proton inbox --from ifood -f json
opencli proton inbox --from ifood --limit 10 -f json
```

`login` reuses an existing mailbox tab when Chrome is already signed in, so `--password` is only required when the sign-in form is shown.

## Prerequisites

- Chrome running with [Browser Bridge extension](/guide/browser-bridge) installed, or `OPENCLI_CDP_ENDPOINT` pointing at an inspectable Chrome
- The same Chrome profile must be able to reach `account.proton.me` / `mail.proton.me`

## Notes

- Human verification / captcha is not solved automatically. Complete it in Chrome, then retry.
- `inbox` prefers a 6-digit code, skips 4-digit years (`2026`), and skips digits that appear in the account address in the tab title.
- Prefer `PROTON_PASSWORD` over `--password` so the secret stays out of process listings.
