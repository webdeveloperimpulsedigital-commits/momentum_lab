# Build 4: Secure File Upload Foundation

Date: 2026-06-05

## What Was Built

Build 4 adds secure server-mediated file uploads for Momentum Lab knowledge sources.

Admins can upload files into the Global Knowledge Vault. Project users can upload files into source libraries for projects they own.

This build does not add document parsing, scraping, embeddings, vector search, model routing, or AI generation.

## Storage Buckets Used

- `global-sources`
- `project-sources`

Both buckets are private.

## Storage Path Structure

Global source files:

```text
global-sources/{sourceId}/{safeFileName}
```

Project source files:

```text
project-sources/{userId}/{projectId}/{sourceId}/{safeFileName}
```

File names are sanitized server-side. User-supplied paths are not accepted.

## Allowed File Types

- `.txt`
- `.md`
- `.pdf`
- `.docx`
- `.png`
- `.jpg`
- `.jpeg`
- `.webp`

MIME types are also checked server-side.

## Blocked File Types

Executable, script, archive, HTML, and unknown binary uploads are blocked by the allow-list approach. Examples include:

- `.exe`
- `.sh`
- `.bat`
- `.cmd`
- `.js`
- `.mjs`
- `.ts`
- `.tsx`
- `.html`
- `.php`
- `.py`
- `.zip`
- `.rar`
- `.7z`

## File Size Limit

The current upload limit is 25 MB per file.

## Database Fields Added

Migration: `supabase/migrations/005_secure_file_upload_foundation.sql`

Added file metadata fields to source records:

- `file_size`
- `mime_type`
- `storage_bucket`
- `storage_path`
- `uploaded_at`
- `uploaded_by`

## API Routes Added

- `POST /api/global-sources/upload`
- `GET /api/global-sources/:sourceId/download`
- `POST /api/projects/:id/sources/upload`
- `GET /api/projects/:id/sources/:sourceId/download`

Download routes return short-lived signed URLs after server-side permission checks.

## UI Screens And Sections Added

- Global Knowledge Vault source form now supports file selection and upload.
- Project Workspace Project Sources section now supports file selection and upload.
- Uploaded source lists show file name, MIME type, and file size.
- File-linked sources can request a signed download URL through the API.

## Permission, RLS, And Storage Access Summary

- The service role key stays server-side.
- The frontend never receives the service role key.
- Global source upload and download are admin-only.
- Project source upload and download require project ownership.
- Project source metadata remains protected by project ownership RLS.
- Storage buckets are private.
- Storage policies are aligned with the bucket/path structure for future direct authenticated access.

## Delete / Archive Behaviour

Source delete routes archive metadata by setting `source_status` to `archived`.

Storage files are retained for auditability. Physical file deletion is not implemented in this build.

## Tests Run

- `npm run typecheck`
- `npm run build`
- `npm run smoke:test`
- Direct API upload verification
- Invalid file type rejection verification
- Oversized file rejection verification
- Signed URL generation verification
- Project source file access isolation verification
- Global source admin-only upload verification
- Secret scan excluding `.env`, build output, dependencies, and lockfile
- Built frontend bundle scan for privileged secrets

## Known Limitations

- No file parsing or text extraction.
- No upload progress UI.
- No physical storage deletion when a source is archived.
- No antivirus or malware scanning.
- No direct browser-to-storage upload flow.

## What Is Not Yet Implemented

- Embeddings
- Vector search
- AI generation
- File parsing
- URL scraping
- Source promotion from project to global

## Next Recommended Build Step

Add lightweight source preview and processing status fields, then prepare a safe extraction pipeline for text-like files without introducing AI generation yet.
