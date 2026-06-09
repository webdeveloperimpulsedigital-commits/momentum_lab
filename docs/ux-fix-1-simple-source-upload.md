# UX Fix 1: Simple Source Upload and Knowledge Vault Experience

UX Fix 1 simplifies source handling without changing backend processing, retrieval, embedding, context pack, mandatory rule, or inspiration/proof logic.

## What Changed

- Global Knowledge Vault now opens with a simple source manager.
- Project Sources now use the same simple source manager.
- File upload is the default path.
- Users can drag and drop one or more files.
- Users can also click Upload files.
- Uploaded sources appear in a clean list with scope, type, role, upload date, processing status, extraction status, and indexing status.
- Advanced metadata is hidden behind Edit details.
- Pasted text is available through Add text manually.
- URL metadata sources are available through Add URL.
- Delete now shows a confirmation before archiving a source.

## Automatic Defaults

Uploaded file defaults are applied in the client before the existing upload API is called:

- Title is inferred from the file name.
- Source type is inferred from file extension or MIME type.
- Source role defaults to `context`.
- Tags default to an empty list.
- Description defaults to empty.
- URL defaults to empty for file uploads.
- Source status defaults to `active`.

The backend metadata model remains unchanged.

## Advanced Metadata

Edit details allows users to edit:

- title
- tags
- source role
- source type
- status
- URL
- description
- pasted text content

Source role editing is intentionally preserved. High-impact roles such as `mandatory_rule` can still be applied after upload through Edit details.

## Source Roles

Existing role behavior is preserved:

- `context` remains the safe default.
- `mandatory_rule` remains available for hard constraints.
- `inspiration` remains available for stimulus and is not converted into proof.
- `strategy` and `evaluation` remain available for downstream retrieval controls.

No source role, context pack, mandatory rule, or inspiration/proof separation logic was changed.

## Delete Behavior

The existing API archives sources by setting `source_status` to `archived`. It does not hard-delete metadata, source content, chunks, embeddings, or storage objects.

Archived sources are removed from active retrieval because existing search and context-pack queries filter to active sources. The UI labels this as Delete and confirms that the source will be removed from future retrieval.

## Security Notes

- Global source API permissions remain admin-only.
- Project source API permissions continue to require project ownership.
- RLS and server-side permission checks were not weakened.
- Service role key remains server-side only.
- OpenAI key remains server-side only.
- Private storage paths are not exposed in the UI.
- Download continues to use the existing signed URL endpoint.

## Known Limitations

- File upload still uses the existing single-file API; the UI supports multiple files by uploading them one at a time.
- Processing and indexing are still manually triggered by existing Process and Index actions.
- Retry is available for processing and indexing by reusing the existing process/embed endpoints.
- URL scraping is still not implemented.
- OCR is still not implemented.
- Delete archives sources rather than performing a hard cascade delete.

## Test Results

- Typecheck: passed.
- Build: passed.
- Smoke suite: split into `smoke:core`, `smoke:llm`, `smoke:full`, and `regression:llm-variants`.
- Smoke progress logging: added per-step start/done logs, elapsed timing, endpoint labels, and LLM mode/variant labels.
- Smoke request timeout handling: added a smoke-script fetch timeout so network stalls fail clearly. This does not change production LLM logic or production timeout settings.
- LLM timeout classification: the failed pitch deck handoff was caused by an oversized single LLM request hitting the app's 45-second OpenAI abort path, not by the smoke-script timeout or an HTTP gateway timeout. The handoff path was sending full stored blueprint/route/final-selection objects plus up to 18 chunks/12000 context characters, then asking for a multi-slide structured JSON handoff.
- LLM reliability fix: pitch deck handoff generation now uses curated blueprint, route, final-selection, and context summaries, caps the handoff-specific context pack at 12 chunks/8000 characters/4 chunks per section, and logs safe metadata around the handoff LLM call. Mandatory rules, source roles, inspiration/proof separation, RLS, and user isolation were not changed.
- Safe diagnostics: LLM logs include purpose, mode/type, deck depth, audience type, prompt size estimate, context size, max output setting, elapsed time, and failure source. Logs do not include secrets, full source text, prompt text, or private client content.
- `smoke:core`: passed. Verified health, auth, project creation, global/project source upload, processing, extraction, embedding, retrieval, context pack generation, non-admin global source blocking, and cross-user project source/search/content blocking.
- `smoke:llm`: passed. The exact prior failing case, `PPT design team handoff / Standard deck / Marketing team`, returned 201 in about 30 seconds.
- `smoke:full`: passed. The same handoff case returned 201 in about 35 seconds inside the integrated suite.
- Heavy repeated LLM variant coverage remains separated from required smoke in `regression:llm-variants`.
- Targeted pitch deck handoff review: passed against a smoke-created handoff.
- Targeted source-role/delete verification: passed. Defaults were `context` and `text`; processing was `processed`; embedding was `embedded`; semantic retrieval found both uploaded global and project sources; `mandatory_rule` populated mandatory context pack rules; `inspiration` populated inspiration material without setting mandatory rules; archived sources were removed from retrieval.
- Targeted permission verification: passed. Non-admin global source create/upload returned 403. Cross-user project sources, source search, and source content returned 404.
- Local server check: Vite returned 200 for `/knowledge-vault`; the API returned 200 for `/health`.
- Browser UX check: not completed in this working session because the in-app browser connector was unavailable after resume.
