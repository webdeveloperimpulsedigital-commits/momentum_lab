create extension if not exists pg_trgm;

create index if not exists source_chunks_chunk_text_trgm_idx
  on source_chunks using gin (chunk_text gin_trgm_ops);

create index if not exists source_chunks_scope_project_created_idx
  on source_chunks(source_scope, project_id, created_at desc);

create index if not exists project_sources_search_filters_idx
  on project_sources(project_id, source_status, processing_status, source_role, source_type);

create index if not exists global_sources_search_filters_idx
  on global_sources(source_status, processing_status, source_role, source_type);
