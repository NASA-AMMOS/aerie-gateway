create table if not exists ui.view (
  id text not null primary key,
  view jsonb not null
);
