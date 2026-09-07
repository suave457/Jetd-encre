-- Additive: existing crossword progress/rewards are deliberately untouched.
CREATE TABLE pilot_quiz_attempts (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  game_id TEXT NOT NULL CHECK(game_id IN ('culture-generale','defi-du-jour')),
  content_version TEXT NOT NULL,
  daily_key TEXT,
  question_ids_json TEXT NOT NULL CHECK(json_valid(question_ids_json) AND json_type(question_ids_json)='array'),
  state_json TEXT NOT NULL CHECK(json_valid(state_json) AND json_type(state_json)='object'),
  revision INTEGER NOT NULL CHECK(revision>=1),
  start_request_id TEXT NOT NULL,
  start_request_hash TEXT NOT NULL,
  last_request_id TEXT NOT NULL,
  last_request_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY(school_id,student_id) REFERENCES pilot_memberships(school_id,user_id),
  UNIQUE(school_id,student_id,game_id,start_request_id),
  CHECK((game_id='defi-du-jour' AND daily_key IS NOT NULL) OR (game_id='culture-generale' AND daily_key IS NULL))
);
CREATE UNIQUE INDEX pilot_quiz_daily_once ON pilot_quiz_attempts(school_id,student_id,game_id,daily_key) WHERE daily_key IS NOT NULL;
CREATE INDEX pilot_quiz_owner_time ON pilot_quiz_attempts(school_id,student_id,game_id,created_at);
CREATE TABLE pilot_quiz_awards (
  school_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  reward_key TEXT NOT NULL,
  attempt_id TEXT NOT NULL REFERENCES pilot_quiz_attempts(id),
  xp INTEGER NOT NULL CHECK(xp IN (10,20)),
  awarded_at INTEGER NOT NULL,
  PRIMARY KEY(school_id,student_id,game_id,reward_key),
  FOREIGN KEY(school_id,student_id) REFERENCES pilot_memberships(school_id,user_id)
);
