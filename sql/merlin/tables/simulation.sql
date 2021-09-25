create table if not exists simulation (
  id integer generated always as identity,
  revision integer not null default 0,

  plan_id integer not null,
  arguments merlin_argument_set not null,

  constraint simulation_synthetic_key
    primary key (id),
  constraint simulation_owned_by_plan
    foreign key (plan_id)
    references plan
    on update cascade
    on delete cascade
);


comment on table simulation is e''
  'A specification for simulating an activity plan.';

comment on column simulation.id is e''
  'The synthetic identifier for this simulation.';
comment on column simulation.revision is e''
  'A monotonic clock that ticks for every change to this simulation.';
comment on column simulation.plan_id is e''
  'The plan whose contents drive this simulation.';
comment on column simulation.arguments is e''
  'The set of arguments to this simulation, corresponding to the parameters of the associated mission model.';


create or replace function merlin.increment_revision_for_update_simulation()
returns trigger
security definer
language plpgsql as $$begin
  update merlin.simulation
  set revision = revision + 1
  where id = new.id
    or id = old.id;

  return new;
end$$;

do $$ begin
  create trigger increment_revision_for_update_simulation_trigger
  after update on simulation
  for each row
  when (pg_trigger_depth() < 1)
  execute function merlin.increment_revision_for_update_simulation();
exception
  when duplicate_object then null;
end $$;
