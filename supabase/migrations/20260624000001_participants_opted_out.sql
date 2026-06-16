-- participants.opted_out: boolean flag per 04-Data-Architecture §3.5 (missing on some remote dev DBs).

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS opted_out BOOLEAN NOT NULL DEFAULT FALSE;
