CREATE TABLE `pilot_student_profiles` (
  `school_id` text NOT NULL,
  `student_id` text NOT NULL,
  `avatar` text NOT NULL,
  `updated_at` integer NOT NULL,
  PRIMARY KEY(`school_id`, `student_id`),
  FOREIGN KEY (`school_id`,`student_id`) REFERENCES `pilot_memberships`(`school_id`,`user_id`) ON UPDATE no action ON DELETE no action,
  CONSTRAINT "pilot_student_avatar" CHECK(`avatar` in ('initials','sparkle','book','trophy','pencil'))
);
