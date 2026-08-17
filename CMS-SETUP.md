# KDH Advocates CMS Setup

This repository uses a Git-backed CMS on Vercel. Public text/structured content is committed to GitHub, public images are stored in a public Vercel Blob store, and sensitive enquiries/analytics are stored in a separate private Vercel Blob store.

## Admin login

The CMS supports two gateways:

1. **GitHub OAuth** — open `/admin/` and choose **Continue with GitHub**.
2. **Secure URL keyword** — use a private URL in this form:

   `https://www.kdhadvocates.com/admin/#access=YOUR_LONG_SECRET_KEY`

The `#access=...` value is exchanged for the same encrypted HttpOnly CMS session and is then removed from the visible address bar. The secret is never committed to this repository.

Use a long, unique access value rather than a normal word. Rotate it immediately if the private URL is shared accidentally.

## Required Vercel environment variables

Configure these in the Vercel project for Production (and Preview where desired):

| Variable | Purpose |
| --- | --- |
| `CMS_SESSION_SECRET` | Encrypts/signs CMS sessions. Must be at least 32 characters. |
| `GITHUB_CLIENT_ID` | Existing GitHub OAuth App client ID. |
| `GITHUB_CLIENT_SECRET` | Existing GitHub OAuth App client secret. |
| `GITHUB_TOKEN` | Repository token used by keyword sessions, public Git-backed reads, and access-role lookup. Give it Contents read/write access to this repository. |
| `CMS_PUBLIC_ORIGIN` | `https://www.kdhadvocates.com` |
| `CMS_GITHUB_REPO` | `adnankhan-alt/kdh-law` (optional because this is the default). |
| `CMS_GITHUB_BRANCH` | `main` (optional because this is the default). |
| `CMS_ALLOWED_GITHUB_USER` | Compatibility fallback for the original GitHub administrator, normally `adnankhan-alt`. |
| `ADMIN_ACCESS_KEY` | Long secret used by the `/admin/#access=...` gateway. Minimum 12 characters; 24+ random characters is recommended. |
| `ADMIN_ACCESS_ROLE` | Role granted to keyword sessions: `viewer`, `editor`, or `admin`. Normally `admin`. |
| `ADMIN_ACCESS_LABEL` | Optional label displayed for keyword sessions. |
| `BLOB_READ_WRITE_TOKEN` | Existing **public** Vercel Blob store token for website images. |
| `PRIVATE_BLOB_READ_WRITE_TOKEN` | **Separate private** Vercel Blob store token for enquiries and first-party analytics. |

The Gemini key intentionally remains in the administrator's browser `localStorage`; it is entered in **CMS → Settings**.

## Vercel Blob stores

Use two Blob stores:

- **Public media store** → `BLOB_READ_WRITE_TOKEN`
- **Private CMS data store** → `PRIVATE_BLOB_READ_WRITE_TOKEN`

The private store is used only for `kdh/enquiries/*` and `kdh/analytics/*`.

The current server-upload image path accepts images up to 3 MB. This keeps base64 JSON uploads below Vercel Function request-body limits. Larger media should use a Vercel Blob client-upload flow rather than increasing this limit.

## GitHub OAuth App

The OAuth callback expected by the code is:

`https://www.kdhadvocates.com/api/cms/callback`

The GitHub OAuth route requests repository access because authenticated editors can commit CMS content back to `main`.

## CMS roles

GitHub users are managed from **CMS → Access & Roles** and persisted in:

`content/admins.json`

Roles:

- **Viewer** — can read CMS dashboards/content.
- **Editor** — can edit content, articles, media, enquiries, SEO, attorneys and practice areas.
- **Admin** — editor permissions plus management of GitHub CMS users/roles.

Keep at least one enabled `admin` account.

## Content map

- `content/page.json` — visual homepage edits.
- `content/site.json` — structured site content, SEO, attorneys, practice areas and analytics configuration.
- `content/posts/*.json` — article drafts, published posts and scheduled posts.
- `content/admins.json` — GitHub CMS access roles.
- Vercel Blob `kdh/media/*` — public uploaded images.
- Private Blob `kdh/enquiries/*` — consultation requests.
- Private Blob `kdh/analytics/*` — consent-based aggregate page-view events.

## Publishing behavior

CMS text changes commit to GitHub `main`. Vercel detects the push and redeploys the static site. A scheduled article is stored immediately but the public `/api/posts` endpoint does not expose it until its `scheduledAt` timestamp has passed.

## First deployment checklist

1. Add/update the Vercel environment variables above.
2. Confirm the existing public Blob store is connected as `BLOB_READ_WRITE_TOKEN`.
3. Create a separate **Private** Blob store and configure its token as `PRIVATE_BLOB_READ_WRITE_TOKEN`.
4. Confirm the GitHub OAuth callback URL.
5. Deploy `main`.
6. Open a private/incognito window and test both `/admin/` GitHub login and the `#access=...` URL.
7. Test Save Homepage, create a draft article, schedule an article, upload an image, edit an attorney and practice area, submit a consultation request, and verify it appears under Enquiries.
8. Accept analytics on the public cookie notice, visit several pages, then verify the Analytics dashboard.
