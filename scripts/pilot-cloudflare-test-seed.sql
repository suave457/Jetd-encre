-- SYNTHETIC DATA ONLY. Manually apply only to the dedicated jetdencre-test-db.
-- Not a migration, not a production initializer, not an authentication mechanism.
-- Verify the six target tables are empty first. Plain INSERT deliberately rejects reruns.
-- No identities, sessions, passwords, assignments or automatic enrolment are created.
INSERT INTO pilot_schools (id, name) VALUES
  ('pilot-school-a', 'École Test A · fictive'),
  ('pilot-school-b', 'École Test B · fictive');

INSERT INTO pilot_classes (id, school_id, name) VALUES
  ('pilot-class-a', 'pilot-school-a', '5e AEP · classe Test A'),
  ('pilot-class-b', 'pilot-school-b', '5e AEP · classe Test B');

INSERT INTO pilot_users (id, display_name, created_at) VALUES
  ('pilot-a-teacher', 'Test A · Enseignante', unixepoch()),
  ('pilot-a-student', 'Test A · Élève 1', unixepoch()),
  ('pilot-a-other', 'Test A · Élève 2', unixepoch()),
  ('pilot-a-parent', 'Test A · Parent de l’élève 1', unixepoch()),
  ('pilot-b-teacher', 'Test B · Enseignant', unixepoch()),
  ('pilot-b-student', 'Test B · Élève', unixepoch()),
  ('pilot-b-parent', 'Test B · Parent', unixepoch());

INSERT INTO pilot_memberships (school_id, user_id, role) VALUES
  ('pilot-school-a', 'pilot-a-teacher', 'enseignant'),
  ('pilot-school-a', 'pilot-a-student', 'eleve'),
  ('pilot-school-a', 'pilot-a-other', 'eleve'),
  ('pilot-school-a', 'pilot-a-parent', 'parent'),
  ('pilot-school-b', 'pilot-b-teacher', 'enseignant'),
  ('pilot-school-b', 'pilot-b-student', 'eleve'),
  ('pilot-school-b', 'pilot-b-parent', 'parent');

INSERT INTO pilot_class_members (school_id, class_id, user_id) VALUES
  ('pilot-school-a', 'pilot-class-a', 'pilot-a-teacher'),
  ('pilot-school-a', 'pilot-class-a', 'pilot-a-student'),
  ('pilot-school-a', 'pilot-class-a', 'pilot-a-other'),
  ('pilot-school-b', 'pilot-class-b', 'pilot-b-teacher'),
  ('pilot-school-b', 'pilot-class-b', 'pilot-b-student');

INSERT INTO pilot_family_links (school_id, parent_id, student_id) VALUES
  ('pilot-school-a', 'pilot-a-parent', 'pilot-a-student'),
  ('pilot-school-b', 'pilot-b-parent', 'pilot-b-student');
