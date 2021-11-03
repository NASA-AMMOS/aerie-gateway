create table if not exists mission_model (
  id integer generated always as identity,
  revision integer not null default 0,

  mission text not null,
  name text not null,
  version text not null,

  owner text,
  jar_id integer not null,

  constraint mission_model_synthetic_key
    primary key (id),
  constraint mission_model_natural_key
    unique (mission, name, version),
  constraint mission_model_references_jar
    foreign key (jar_id)
    references uploaded_file
    on update cascade
    on delete restrict
);

comment on table mission_model is e''
  'A Merlin simulation model for a mission.';

comment on column mission_model.id is e''
  'The synthetic identifier for this mission model.';
comment on column mission_model.revision is e''
  'A monotonic clock that ticks for every change to this mission model.';
comment on column mission_model.mission is e''
  'A human-meaningful identifier for the mission described by this model.';
comment on column mission_model.name is e''
  'A human-meaningful model name.';
comment on column mission_model.version is e''
  'A human-meaningful version qualifier.';
comment on column mission_model.owner is e''
  'A human-meaningful identifier for the user responsible for this model.';
comment on column mission_model.jar_id is e''
  'An uploaded JAR file defining the mission model.';


create or replace function increment_revision_on_update_mission_model()
returns trigger
security definer
language plpgsql as $$begin
  update mission_model
  set revision = revision + 1
  where id = new.id;

  return new;
end$$;

do $$ begin
  create trigger increment_revision_on_update_mission_model_trigger
  after insert on mission_model
  for each row
  execute function increment_revision_on_update_mission_model();
exception
  when duplicate_object then null;
end $$;

create or replace function increment_revision_on_update_mission_model_jar()
returns trigger
security definer
language plpgsql as $$begin
  update mission_model
  set revision = revision + 1
  where jar_id = new.id
    or jar_id = old.id;

  return new;
end$$;
