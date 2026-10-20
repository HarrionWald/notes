# Notes

A personal study workspace for notes, lecture documents, recordings, handwriting, and PDF annotations. It runs in the browser and can synchronize through the free tiers of Supabase and Vercel. It does not call a paid AI API, and it does not require a custom domain or a credit card.

Without Supabase keys the app still works on one device. Notes, drawings, and extracted text stay in IndexedDB. Sign-in and cross-device sync turn on only after you add the free project keys.

## What it does

- Organize work by class, notebook, section, folder, and tag.
- Write formatted notes with TipTap: headings, lists, checklists, links, quotes, code, and tables.
- Autosave locally. When you are signed in, changes upload to your Supabase project.
- Import PDF, DOCX, PPTX, TXT, Markdown, PNG, and JPEG. Extract text in the browser. OCR scanned images and PDF pages with Tesseract.js on your device.
- Turn extracted text into editable study notes with fixed templates: structured lecture notes, Cornell, outline, study guide, flashcards, and reading notes. Templates only rearrange text that is already there.
- Record audio with the browser MediaRecorder API, or import an audio file. Transcribe with the Web Speech API when the browser supports it, or type and paste a transcript.
- Draw with pen, highlighter, eraser, shapes, and text on lined, dotted, grid, or blank pages. Stylus pressure is used when the browser reports it.
- Read PDFs with PDF.js, highlight extractable text, attach notes, and draw on pages. The original file is left unchanged.
- Search notes and extracted document text. Filter and sort lists.
- Keep a trash bin, favorites, Markdown and text export, and a JSON backup of structured data.
- Edit cached notes offline and sync later. If the same note changed in two places, you choose which copy to keep.

## What it does not do

These were left out because they need a paid service, a paid API, or a guarantee this app cannot make:

- AI summaries, AI study notes, or an AI chat.
- Paid transcription such as Whisper, and paid cloud OCR.
- Handwriting-to-text. Ink stays as ink. Use a text box or a normal note when you want typed text.
- Social login.
- A custom email provider. Password reset uses Supabase’s built-in mailer, which is heavily limited. See the auth section below.
- A custom domain. Deploy on the free `*.vercel.app` address.
- Realtime collaboration, native Apple Pencil palm rejection, or a promise that every file is available offline.
- Background workers, paid analytics, or paid monitoring.

Web Speech may send audio to the browser vendor (for example Apple, Google, or Microsoft) because that is how the browser feature works. Document text for OCR and extraction stays in the browser.

## Free-tier limits

These figures match the public Supabase Free plan as checked in October 2026. Supabase can change them. This app will not upgrade the plan or add a payment method.

| Limit | Practical effect |
| --- | --- |
| About 500 MB database | Notes, transcripts, drawings, and annotations live in Postgres. A drawing larger than 4 MB of JSON stays on the device and is not uploaded. |
| About 1 GB file storage | Audio, video, and documents share one private bucket. Settings shows an estimate and warns around 80% and at the cap. |
| 50 MB maximum file | The app defaults to a 25 MB upload limit and never allows more than 50 MB. |
| About 5 GB egress | Downloading the same large recording many times can exhaust egress. The app does not retry failed uploads automatically. |
| Project pauses after about a week with no activity | Open the Supabase dashboard to restore it. Local notes remain in the browser. |
| Two active free projects | One project is enough for this app. |
| Built-in auth email: about 2 per hour, and only to addresses on your Supabase organization | Use the same email as your Supabase account, or turn off email confirmation for this personal project. |

If storage or the database is full, the app keeps the local copy and explains the failure. Delete old recordings and documents, then use **Sync now**. Do not enable billing.

Vercel Hobby is enough for this app. File uploads go from the browser straight to Supabase, so they are not proxied through a Vercel function body.

## Requirements

- Node.js 20 or newer (developed on Node 24)
- npm
- A free [Supabase](https://supabase.com) project, only if you want accounts and sync
- A free [Vercel](https://vercel.com) account, only if you want it on the public internet

## Local setup

1. Install dependencies:

```bash
npm install
```

`postinstall` copies the PDF.js worker into `public/pdf.worker.min.mjs`. If PDF rendering fails after an install, run `node scripts/copy-pdf-worker.mjs`.

2. Start the app:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000).

You can create notebooks and notes immediately. A banner says the browser is in local-only mode until Supabase is configured. Those notes stay in this browser profile.

## Supabase setup

Do this once. Do not add a payment method, and do not copy the service-role key anywhere in this project.

1. Create a free account at [supabase.com](https://supabase.com) and create a project. Pick a region close to you. Save the database password somewhere private; the app does not need it.
2. In **Project Settings → API**, copy:
   - Project URL
   - `anon` public key
3. In this folder, copy `.env.example` to `.env.local` and fill in only those two values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

4. In the Supabase dashboard, open **SQL Editor**, paste the full contents of `supabase/migrations/0001_init.sql`, and run it.

   That file creates the tables, indexes, the private `files` storage bucket (50 MB per object), Row Level Security policies, and a trigger that creates a profile when someone signs up. Running it again is safe for the policies. Tables use `IF NOT EXISTS`, so a second run will not wipe data, but it also will not alter tables that already exist.

5. Restart `npm run dev`. The local-only banner should disappear and **Sign in** should appear.

There is no service-role key in the app. The browser uses the anon key, and Postgres policies restrict every row to `auth.uid()`.

### Authentication email

Supabase’s built-in mailer sends about two messages an hour, and only to email addresses that belong to your Supabase organization (the address you used to create the Supabase account, plus invited team members).

For a single personal account:

1. Open **Authentication → Providers → Email** and leave Email enabled.
2. Either turn **Confirm email** off, or sign up with the same address as your Supabase account so the confirmation message can arrive.
3. Leave **Sign ups** enabled until you have created your account, then you can disable new signups if you want the project to stay personal.
4. Do not add custom SMTP. That is a separate email service and is outside the $0 rule for this app.

Password recovery uses the same built-in mailer. If the message never arrives, reset the password from the Supabase dashboard under **Authentication → Users** instead. The reset page in the app is `/auth/reset`.

In **Authentication → URL configuration**, set the site URL to `http://localhost:3000` while developing. After you deploy, add `https://YOUR-APP.vercel.app` as a redirect URL. The app’s auth callback is `/auth/callback`.

## Vercel deployment

1. Push this folder to a Git host you already use, or import it with the Vercel dashboard. Stay on the Hobby plan. Do not add a custom domain.
2. In the Vercel project, set the same two environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. The build command is `npm run build`. The PDF worker is copied during `npm install`.
4. Copy the `https://something.vercel.app` address.
5. In Supabase, set the site URL and add that address plus `https://something.vercel.app/auth/callback` to the redirect allow list.
6. Sign up once from the deployed site. If confirmation email cannot be delivered, use the dashboard workaround above.

The service worker is registered only in production. It caches same-origin GET responses with a network-first strategy so the shell can load again. It does not cache other people’s data, and it does not make every uploaded file available offline.

## Everyday use

- **Home, All notes, Notebooks, Classes, Documents, Recordings, Handwriting, Favorites, Trash, Settings** are in the sidebar. Below 1024px the sidebar becomes a drawer.
- **New note** creates a note and opens the editor. The status says Saved only after IndexedDB has the change (local mode) or Supabase has accepted it (signed in). Offline or failed cloud saves say they are waiting.
- Assign a notebook, class, and tags from the note. Favorite, duplicate, and delete are in the note menu. Deleted items sit in Trash until you restore or remove them.
- **Documents**: choose a file. The app checks the type and size before upload. Text extraction runs in the browser. For a scanned PDF, OCR a page range instead of the whole file if it is slow. Pick a study template, preview it, then save it as an editable note. The original file stays in storage.
- **Recordings**: the microphone is requested only after you press record. Pause and resume depend on the browser. You can name the recording and attach it to a class or notebook. If live transcription is missing, type or import a transcript and copy it into a note.
- **Handwriting**: pen, highlighter, eraser, colors, width, undo, redo, shapes, text, and images. Pinch or controls zoom and pan. Add pages. Export PNG or PDF from the page. Turn on **Stylus-only drawing** in Settings so a finger pans instead of drawing. This is not the same palm rejection as a native iPad app.
- **Search** is in the top bar (`Ctrl` or `Cmd` + `K`). It searches cached notes and extracted text on this device. Signed-in search also queries Postgres full-text search.
- **Settings** holds theme, autosave delay, sync, upload limit, storage estimate, and JSON import/export. The JSON file does not contain audio or document bytes.

### Keyboard shortcuts

- `Ctrl` or `Cmd` + `N` — new note
- `Ctrl` or `Cmd` + `K` — search
- `Ctrl` or `Cmd` + `S` — save the open note
- `Ctrl` or `Cmd` + `\` — collapse the sidebar
- `Ctrl` or `Cmd` + `B`, `I`, `U` — bold, italic, underline
- `Ctrl` or `Cmd` + `Z` — undo

## Offline behavior

IndexedDB is the working copy. The remote database is updated from an outbox.

1. Sign in once on a network so notes can download.
2. Open a note so it is cached.
3. Turn the network off, or in Chrome DevTools choose **Offline**.
4. Edit the note. The status should say the change is waiting, not that it was saved to the cloud.
5. Turn the network back on and choose **Sync now** in Settings, or wait for the next online pass. Failed items are not retried in a loop. Use **Sync now** to try again.
6. If the note also changed on the server, a banner offers **Keep mine**, **Keep theirs**, and **Keep both**. Nothing is discarded until you choose.

Large uploaded audio and documents are removed from the local cache after a successful upload unless **Keep local copies** is on, and even then only files at or under 2 MB are kept. A recording you have not opened on this device may be unavailable offline.

Local-only notes (created before you signed in) are claimed by your account on the first successful sign-in and then become eligible to sync.

## Browser limitations

| Browser | What to expect |
| --- | --- |
| Chrome or Edge on desktop | Best support for recording, Web Speech, PDF, and drawing. |
| Firefox | Recording and PDF work. Web Speech recognition is often unavailable; type the transcript. |
| Safari on Mac | Recording works with the formats Safari allows. Web Speech support varies. |
| iPad Safari | Pointer Events and pressure are used when WebKit exposes them. A finger can draw unless stylus-only mode is on. Palm rejection is incomplete. Service worker caches can be evicted. Test drawing on the device; it was not verified on a physical iPad in this project. |
| Any browser | OCR downloads Tesseract language data from jsDelivr the first time. The document itself is not uploaded for OCR. Recognition of a long scan is slow; use a page range or paste the text. |

MediaRecorder format follows what the browser offers (`audio/webm` or `audio/mp4`). Playback of a recording made in another browser can fail if that browser cannot decode the codec.

## Tests

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

`npm test` runs Vitest. The suite checks sync decisions, save-status wording, file rules, study templates (they must not invent facts), PPTX text extraction, Markdown conversion, search, layout breakpoints, storage warnings, recording and speech error messages, drawing restore, PDF annotation data, backup merge, and that the SQL policies and client do not reference a service-role key.

Automated tests do not drive a real Supabase project, a microphone, Tesseract on a scanned page, or a phone. Those need the manual checks above.

## Project map

- `src/app` — pages for the workspace, auth, and the auth callback
- `src/components` — shell, editor, recorder, drawing board, PDF reader
- `src/lib` — types, limits, extraction, templates, sync, and Supabase clients
- `src/proxy.ts` — refreshes the Supabase session on each request
- `supabase/migrations/0001_init.sql` — schema, RLS, and storage policies
- `public/sw.js` — production-only network-first cache

## Troubleshooting

**The app says local only.** `.env.local` is missing a value, the names are wrong, or the dev server was not restarted after you edited the file. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are read.

**Sign up does nothing or email never arrives.** The built-in mailer is rate limited and will not send to an address outside your Supabase organization. Turn off Confirm email, or create the user in the dashboard.

**Rows fail with a permission error.** Run `0001_init.sql` in the SQL editor. Policies compare `user_id` to `auth.uid()`.

**Upload fails immediately.** The file is over your Settings limit, over 50 MB, or its type is not supported. The message should name which check failed.

**Upload fails after a long wait.** Storage is full, the project is paused, or you are offline. The local record remains. Free space in Supabase or restore the project, then Sync now. Do not turn on billing from inside this app.

**A note looks old after sync.** Open the conflict banner and pick a version. The app will not overwrite the newer side by itself.

**PDF pages are blank.** Run `node scripts/copy-pdf-worker.mjs` and reload. The worker file must be at `public/pdf.worker.min.mjs`.

**OCR is stuck.** It is running on the CPU. Cancel and OCR fewer pages, or paste the text yourself.

**Drawing vanished after switching devices.** Drawings over 4 MB of JSON are not uploaded. Export PNG or PDF from the original device, or simplify the page.

**`npm install` fails with an SSL error on Windows.** Retry with `NODE_OPTIONS=--use-system-ca` if your machine intercepts TLS with a local certificate.

## License of dependencies

Application code in this repository is yours to use for this personal app. Third-party packages keep their own licenses (MIT for most of the libraries here, including TipTap, pdf.js, Mammoth, JSZip, pdf-lib, and tesseract.js). Do not add a commercial SDK.
