create table if not exists pitch_deck_handoff_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  pitch_deck_handoff_id uuid not null references project_pitch_deck_handoffs(id) on delete cascade,
  campaign_blueprint_id uuid references project_campaign_blueprints(id) on delete set null,
  final_selection_id uuid references final_campaign_truths(id) on delete set null,
  developed_route_id uuid references routes(id) on delete set null,
  idea_card_id uuid references project_idea_cards(id) on delete set null,
  evaluation_id uuid references project_idea_evaluations(id) on delete set null,
  dossier_id uuid references project_dossiers(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  review_mode text not null default 'Standard client-readiness review',
  overall_readiness_verdict text not null,
  readiness_score integer not null,
  client_readiness_status text not null,
  narrative_strength_assessment text not null,
  slide_logic_assessment text not null,
  proof_claim_risk_assessment text not null,
  unsupported_claims text[] not null default '{}',
  proof_gaps text[] not null default '{}',
  assumptions text[] not null default '{}',
  missing_context text[] not null default '{}',
  internal_only_risks text[] not null default '{}',
  visual_asset_gaps text[] not null default '{}',
  design_handoff_clarity_assessment text not null,
  recommended_fixes text[] not null default '{}',
  do_not_present_yet_warnings text[] not null default '{}',
  copy_paste_improvement_notes text not null,
  source_grounding_summary text not null,
  model_provider text,
  model_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pitch_deck_handoff_reviews
  drop constraint if exists pitch_deck_handoff_reviews_mode_check,
  drop constraint if exists pitch_deck_handoff_reviews_score_check,
  drop constraint if exists pitch_deck_handoff_reviews_status_check;

alter table pitch_deck_handoff_reviews
  add constraint pitch_deck_handoff_reviews_mode_check
  check (review_mode in ('Quick readiness scan', 'Standard client-readiness review', 'Deep red-team review', 'Founder review')),
  add constraint pitch_deck_handoff_reviews_score_check
  check (readiness_score >= 0 and readiness_score <= 100),
  add constraint pitch_deck_handoff_reviews_status_check
  check (client_readiness_status in ('Ready for PPT build', 'Needs proof before PPT build', 'Needs client input before PPT build', 'Needs visual assets before PPT build', 'Needs strategic revision', 'Internal review only', 'Do not move ahead yet'));

create table if not exists pitch_deck_handoff_slide_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  review_id uuid not null references pitch_deck_handoff_reviews(id) on delete cascade,
  pitch_deck_handoff_id uuid not null references project_pitch_deck_handoffs(id) on delete cascade,
  slide_number integer not null,
  slide_title text not null,
  original_readiness_status text,
  reviewer_readiness_status text not null,
  slide_job_clarity text not null,
  key_message_clarity text not null,
  narrative_fit text not null,
  proof_status text not null,
  claim_risk text not null,
  visual_asset_requirement text not null,
  client_input_requirement text not null,
  internal_only_concern text not null,
  genericness_risk text not null,
  recommended_fix text not null,
  presenter_risk_watchout text not null,
  final_recommendation text not null,
  created_at timestamptz not null default now()
);

alter table pitch_deck_handoff_slide_reviews
  drop constraint if exists pitch_deck_handoff_slide_reviews_recommendation_check;

alter table pitch_deck_handoff_slide_reviews
  add constraint pitch_deck_handoff_slide_reviews_recommendation_check
  check (final_recommendation in ('Keep as is', 'Keep with minor edits', 'Needs proof', 'Needs client input', 'Needs stronger visual direction', 'Merge with another slide', 'Move earlier', 'Move later', 'Convert to internal-only', 'Do not present yet', 'Remove from deck structure'));

create table if not exists pitch_deck_handoff_review_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  review_id uuid not null references pitch_deck_handoff_reviews(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

create trigger touch_pitch_deck_handoff_reviews_updated_at
before update on pitch_deck_handoff_reviews
for each row execute function touch_updated_at();

alter table pitch_deck_handoff_reviews enable row level security;
alter table pitch_deck_handoff_slide_reviews enable row level security;
alter table pitch_deck_handoff_review_notes enable row level security;

drop policy if exists "users can read own handoff reviews" on pitch_deck_handoff_reviews;
create policy "users can read own handoff reviews"
on pitch_deck_handoff_reviews for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = pitch_deck_handoff_reviews.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can manage own handoff reviews" on pitch_deck_handoff_reviews;
create policy "users can manage own handoff reviews"
on pitch_deck_handoff_reviews for all
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = pitch_deck_handoff_reviews.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from projects
    where projects.id = pitch_deck_handoff_reviews.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can read own handoff slide reviews" on pitch_deck_handoff_slide_reviews;
create policy "users can read own handoff slide reviews"
on pitch_deck_handoff_slide_reviews for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = pitch_deck_handoff_slide_reviews.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can manage own handoff slide reviews" on pitch_deck_handoff_slide_reviews;
create policy "users can manage own handoff slide reviews"
on pitch_deck_handoff_slide_reviews for all
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = pitch_deck_handoff_slide_reviews.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from projects
    where projects.id = pitch_deck_handoff_slide_reviews.project_id
      and projects.user_id = auth.uid()
  )
  and exists (
    select 1 from pitch_deck_handoff_reviews
    where pitch_deck_handoff_reviews.id = pitch_deck_handoff_slide_reviews.review_id
      and pitch_deck_handoff_reviews.project_id = pitch_deck_handoff_slide_reviews.project_id
  )
);

drop policy if exists "users can read own handoff review notes" on pitch_deck_handoff_review_notes;
create policy "users can read own handoff review notes"
on pitch_deck_handoff_review_notes for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = pitch_deck_handoff_review_notes.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can manage own handoff review notes" on pitch_deck_handoff_review_notes;
create policy "users can manage own handoff review notes"
on pitch_deck_handoff_review_notes for all
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = pitch_deck_handoff_review_notes.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from projects
    where projects.id = pitch_deck_handoff_review_notes.project_id
      and projects.user_id = auth.uid()
  )
  and exists (
    select 1 from pitch_deck_handoff_reviews
    where pitch_deck_handoff_reviews.id = pitch_deck_handoff_review_notes.review_id
      and pitch_deck_handoff_reviews.project_id = pitch_deck_handoff_review_notes.project_id
  )
);

create index if not exists pitch_deck_handoff_reviews_project_created_idx
  on pitch_deck_handoff_reviews(project_id, created_at desc);

create index if not exists pitch_deck_handoff_reviews_handoff_idx
  on pitch_deck_handoff_reviews(pitch_deck_handoff_id, created_at desc);

create index if not exists pitch_deck_handoff_slide_reviews_review_idx
  on pitch_deck_handoff_slide_reviews(review_id, slide_number);

create index if not exists pitch_deck_handoff_review_notes_project_created_idx
  on pitch_deck_handoff_review_notes(project_id, created_at desc);
