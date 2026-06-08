alter table final_campaign_truths
  add column if not exists developed_route_id uuid references routes(id) on delete restrict,
  add column if not exists idea_card_id uuid references project_idea_cards(id) on delete set null,
  add column if not exists evaluation_id uuid references project_idea_evaluations(id) on delete set null,
  add column if not exists dossier_id uuid references project_dossiers(id) on delete set null,
  add column if not exists selected_by uuid references users(id) on delete set null,
  add column if not exists selection_rationale text,
  add column if not exists why_this_route_won text,
  add column if not exists rejected_or_deprioritised_notes text,
  add column if not exists proof_required text,
  add column if not exists risks_watchouts text,
  add column if not exists assumptions text,
  add column if not exists missing_context text,
  add column if not exists status text not null default 'active',
  add column if not exists superseded_by uuid references final_campaign_truths(id) on delete set null,
  add column if not exists selected_at timestamptz not null default now();

update final_campaign_truths
set developed_route_id = route_id
where developed_route_id is null
  and route_id is not null;

update final_campaign_truths
set status = case when is_active then 'active' else 'superseded' end
where status is null;

alter table final_campaign_truths
  drop constraint if exists final_campaign_truths_status_check;

alter table final_campaign_truths
  add constraint final_campaign_truths_status_check
  check (status in ('active', 'superseded', 'inactive'));

alter table final_campaign_truths enable row level security;

create unique index if not exists final_campaign_truths_one_active_status_idx
  on final_campaign_truths(project_id)
  where status = 'active';

create index if not exists final_campaign_truths_project_selected_idx
  on final_campaign_truths(project_id, selected_at desc);

create index if not exists final_campaign_truths_developed_route_idx
  on final_campaign_truths(developed_route_id);
