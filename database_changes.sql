-- Database Changes Log
-- Store all database changes here, date-wise.

-- Date: 2026-02-13
-- ---------------------------------------------------------
-- Initial cleanup or setup for Feedback Questions if needed.

DROP TABLE IF EXISTS `feedback_question_options`;
DROP TABLE IF EXISTS `feedback_question_answer`;
DROP TABLE IF EXISTS `feedback_questions`;
DROP TABLE IF EXISTS `feedback_forms`;
DROP TABLE IF EXISTS `feedback_categories`;

CREATE TABLE `feedback_categories` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `feedback_forms` (
  `id` varchar(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `type_of_course` varchar(50) NOT NULL,
  `status` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `feedback_questions` (
  `id` char(36) NOT NULL,
  `category_id` char(36) NOT NULL,
  `question` text NOT NULL,
  `type` varchar(50) NOT NULL DEFAULT 'rating',
  `status` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `feedback_form_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `feedback_questions_category_id_foreign` (`category_id`),
  KEY `feedback_form_id` (`feedback_form_id`),
  CONSTRAINT `feedback_questions_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `feedback_categories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `feedback_questions_ibfk_1` FOREIGN KEY (`feedback_form_id`) REFERENCES `feedback_forms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `feedback_question_options` (
  `id` varchar(36) NOT NULL,
  `feedback_question_id` varchar(36) NOT NULL,
  `option_text` text NOT NULL,
  `status` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `feedback_question_id` (`feedback_question_id`),
  CONSTRAINT `feedback_question_options_ibfk_1` FOREIGN KEY (`feedback_question_id`) REFERENCES `feedback_questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `feedback_question_answer` (
  `id` char(36) NOT NULL,
  `candidate_id` char(36) NOT NULL,
  `active_course_id` char(36) NOT NULL,
  `feedback_question_id` char(36) NOT NULL,
  `feedback_category_id` char(36) DEFAULT NULL,
  `feedback_id` char(36) DEFAULT NULL,
  `feedback_question_option_id` char(36) DEFAULT NULL,
  `feedback_question_option_text` text,
  `answer` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `feedback_question_answer_candidate_id_index` (`candidate_id`),
  KEY `feedback_question_answer_active_course_id_index` (`active_course_id`),
  KEY `feedback_question_answer_feedback_question_id_foreign` (`feedback_question_id`),
  CONSTRAINT `feedback_question_answer_feedback_question_id_foreign` FOREIGN KEY (`feedback_question_id`) REFERENCES `feedback_questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `master_course` (
    `id` char(36) NOT NULL,
    `topic` varchar(255) NOT NULL,
    `master_course_name` varchar(255) NOT NULL,
    `certificate_type` varchar(255) DEFAULT NULL,
    `expiry_date` date DEFAULT NULL,
    `description` text,
    `remarks` text,
    `status` tinyint(1) NOT NULL DEFAULT '1',
    `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `master_course` MODIFY `expiry_date` VARCHAR(50);

INSERT INTO `master_course` (`id`, `topic`, `master_course_name`, `certificate_type`, `expiry_date`, `description`, `remarks`, `status`, `created_at`, `updated_at`) VALUES
('11111111-1111-1111-1111-111111111111', 'Navigation', 'Advanced Navigation', 'DNV-ST008', '5', '<p>Comprehensive navigation course.</p>', 'Required for all captains.', 1, NOW(), NOW()),
('22222222-2222-2222-2222-222222222222', 'Engineering', 'Marine Engineering', 'DNV-ST0029', '3', '<p>Basics of marine engineering.</p>', 'Good for beginners.', 1, NOW(), NOW()),
('33333333-3333-3333-3333-333333333333', 'Safety', 'Fire Safety', 'SIGTTO / LNG', '2', '<p>Essential safety protocols.</p>', 'Mandatory.', 1, NOW(), NOW());

CREATE TABLE IF NOT EXISTS `courses` (
    `id` char(36) NOT NULL,
    `course_id` varchar(255) NOT NULL,
    `master_course_id` char(36) NOT NULL,
    `master_course_name` varchar(255) NOT NULL,
    `topic` varchar(255) NOT NULL,
    `course_name` varchar(255) NOT NULL,
    `description` text,
    `start_date` datetime NOT NULL,
    `end_date` datetime NOT NULL,
    `type_of_location` varchar(255) DEFAULT NULL,
    `location_id` char(36) DEFAULT NULL,
    `other_location` varchar(255) DEFAULT NULL,
    `course_type` varchar(255) DEFAULT NULL,
    `remarks` text,
    `status` varchar(50) DEFAULT 'Initiated',
    `course_level` varchar(50) DEFAULT NULL,
    `primary_trainer_id` char(36) DEFAULT NULL,
    `secondary_trainer_ids` text,
    `whatsapp_link` varchar(255) DEFAULT NULL,
    `zoom_link` varchar(255) DEFAULT NULL,
    `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Fix for missing topic column in courses table
-- Check if column exists is not standard in simple SQL script, so we use ADD COLUMN and rely on user to run if needed or ignore if specific error.
-- Better: Run this if you get "Unknown column 'topic'" error.
ALTER TABLE `courses` ADD COLUMN `topic` VARCHAR(255) NOT NULL AFTER `master_course_name`;

-- Date: 2026-02-16
-- ---------------------------------------------------------
-- Added material_link column to master_course table
ALTER TABLE `master_course` ADD COLUMN `material_link` TEXT DEFAULT NULL AFTER `remarks`;

-- Create missing courses_enrollment table
CREATE TABLE IF NOT EXISTS `courses_enrollment` (
  `id` char(36) NOT NULL,
  `course_id` char(36) NOT NULL,
  `candidate_id` char(36) NOT NULL,
  `status` varchar(50) DEFAULT 'Active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `courses_enrollment_course_id` (`course_id`),
  KEY `courses_enrollment_candidate_id` (`candidate_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Create missing course_attendance table
CREATE TABLE IF NOT EXISTS `course_attendance` (
  `id` char(36) NOT NULL,
  `course_id` char(36) NOT NULL,
  `candidate_id` char(36) NOT NULL,
  `attendance_date` date DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Present',
  `absent_reasons` text DEFAULT NULL,
  `certificate_issue_date` date DEFAULT NULL,
  `certificate_expiry_date` date DEFAULT NULL,
  `mark_as_read` tinyint(1) DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `course_attendance_course_id` (`course_id`),
  KEY `course_attendance_candidate_id` (`candidate_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Date: 2026-02-17
-- ---------------------------------------------------------
-- Added question_bank table
CREATE TABLE IF NOT EXISTS `question_bank` (
  `id` varchar(36) NOT NULL,
  `master_course_id` varchar(36) DEFAULT NULL,
  `question` text DEFAULT NULL,
  `type_of_test` varchar(255) DEFAULT NULL COMMENT '1=Pre, 2=Post, 3=Daily',
  `option_a` text DEFAULT NULL,
  `option_b` text DEFAULT NULL,
  `option_c` text DEFAULT NULL,
  `option_d` text DEFAULT NULL,
  `correct_option` varchar(255) DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL,
  `opt_img_a` varchar(255) DEFAULT NULL,
  `opt_img_b` varchar(255) DEFAULT NULL,
  `opt_img_c` varchar(255) DEFAULT NULL,
  `opt_img_d` varchar(255) DEFAULT NULL,
  `status` int(11) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Date: 2026-02-17
-- ---------------------------------------------------------
-- Create assessment_results table for storing submitted assessments
CREATE TABLE IF NOT EXISTS `assessment_results` (
  `id` char(36) NOT NULL,
  `assessment_id` char(36) NOT NULL,
  `candidate_id` char(36) NOT NULL,
  `course_id` char(36) NOT NULL,
  `score` decimal(5,2) DEFAULT 0.00,
  `total_questions` int(11) DEFAULT 0,
  `correct_answers` int(11) DEFAULT 0,
  `status` varchar(50) DEFAULT 'Completed',
  `attempt_number` int(11) DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `assessment_results_assessment_id` (`assessment_id`),
  KEY `assessment_results_candidate_id` (`candidate_id`),
  KEY `assessment_results_course_id` (`course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Create assessment_answers table for storing individual question answers
CREATE TABLE IF NOT EXISTS `assessment_answers` (
  `id` char(36) NOT NULL,
  `assessment_result_id` char(36) NOT NULL,
  `question_id` char(36) NOT NULL,
  `selected_option` varchar(50) DEFAULT NULL,
  `is_correct` tinyint(1) DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `assessment_answers_result_id` (`assessment_result_id`),
  KEY `assessment_answers_question_id` (`question_id`),
  CONSTRAINT `assessment_answers_result_fk` FOREIGN KEY (`assessment_result_id`) REFERENCES `assessment_results` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Date: 2026-02-17
-- ---------------------------------------------------------
-- Added start_time, end_time, zoom_username, zoom_password to courses table
ALTER TABLE `courses`
  ADD COLUMN `start_time` TIME DEFAULT NULL AFTER `end_date`,
  ADD COLUMN `end_time` TIME DEFAULT NULL AFTER `start_time`,
  ADD COLUMN `zoom_username` VARCHAR(255) DEFAULT NULL AFTER `zoom_link`,
  ADD COLUMN `zoom_password` VARCHAR(255) DEFAULT NULL AFTER `zoom_username`;

-- Date: 2026-02-19
-- ---------------------------------------------------------
-- Create nominators table
CREATE TABLE IF NOT EXISTS `nominators` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Date: 2026-02-19
-- ---------------------------------------------------------
-- Add missing columns to courses table to match old PHP flow
ALTER TABLE `courses`
  ADD COLUMN `no_of_days` INT DEFAULT NULL,
  ADD COLUMN `cancelation_reason` TEXT DEFAULT NULL,
  ADD COLUMN `completion_reason` TEXT DEFAULT NULL;

-- Add missing columns to courses_enrollment table to match old PHP flow
ALTER TABLE `courses_enrollment`
  ADD COLUMN `trainer_id` char(36) DEFAULT NULL,
  ADD COLUMN `status_pool` varchar(50) DEFAULT NULL,
  ADD COLUMN `candidate_email_status` tinyint(1) DEFAULT 0,
  ADD COLUMN `email_type` varchar(50) DEFAULT NULL;

-- Date: 2026-02-19 (Venue Updates)
-- ---------------------------------------------------------
ALTER TABLE `courses_enrollment`
  ADD COLUMN `venue_name` VARCHAR(255) DEFAULT NULL,
  ADD COLUMN `venue_address` TEXT DEFAULT NULL,
  ADD COLUMN `venue_contact` VARCHAR(255) DEFAULT NULL,
  ADD COLUMN `venue_map_link` TEXT DEFAULT NULL,
  ADD COLUMN `venue_email` VARCHAR(255) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS `hotel_files` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ce_id` char(36) NOT NULL,
  `candidate_id` char(36) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_type` varchar(50) DEFAULT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` tinyint(1) DEFAULT 1,
  KEY `hotel_files_ce_id` (`ce_id`),
  KEY `hotel_files_candidate_id` (`candidate_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Date: 2026-02-19 (Soft Delete)
-- ---------------------------------------------------------
ALTER TABLE `courses_enrollment`
  ADD COLUMN `delete_remark` TEXT DEFAULT NULL;

-- Date: 2026-02-19 (Course Tabs: Attendance + Certificates)
-- ---------------------------------------------------------
ALTER TABLE `courses_enrollment`
  ADD COLUMN `is_present` TEXT DEFAULT NULL,
  ADD COLUMN `holidays` TEXT DEFAULT NULL,
  ADD COLUMN `absent_reasons` TEXT DEFAULT NULL,
  ADD COLUMN `certficate_generated` VARCHAR(36) DEFAULT NULL,
  ADD COLUMN `generated_date` DATE DEFAULT NULL,
  ADD COLUMN `active` TINYINT(1) DEFAULT 0;

-- Date: 2026-02-20
-- ---------------------------------------------------------
-- Create certificates table
CREATE TABLE IF NOT EXISTS `certificates` (
  `id` CHAR(36) NOT NULL,
  `certificate_no` VARCHAR(255) UNIQUE NOT NULL,
  `type` VARCHAR(100) NOT NULL, -- 'Others', 'DNV-ST0029', 'DNV-ST008', 'SIGTTO / LNG'
  `topic` VARCHAR(255) NOT NULL,
  `course_level` VARCHAR(100) DEFAULT 'Operational',
  `course_id` CHAR(36) NOT NULL, -- Master Course ID
  `active_course_id` CHAR(36) NOT NULL,
  `candidate_id` CHAR(36) NOT NULL,
  `trainer_id` CHAR(36) NOT NULL,
  `location` VARCHAR(255) DEFAULT NULL,
  `course_conduct` VARCHAR(50) DEFAULT NULL, -- 'ONL', 'ONS'
  `status` TINYINT(1) DEFAULT 0, -- 0: Valid, 1: Invalid
  `from_date` DATE DEFAULT NULL,
  `to_date` DATE DEFAULT NULL,
  `days` INT DEFAULT 0,
  `issue_date` DATE DEFAULT NULL,
  `added_date` DATE DEFAULT NULL,
  `show_logo` TINYINT(1) DEFAULT 1,
  `is_manual` TINYINT(1) DEFAULT 0,
  `description1` TEXT,
  `remarks` TEXT,
  `subid` INT DEFAULT 0, -- For numeric increment in certificate number
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`course_id`) REFERENCES `master_course` (`id`),
  FOREIGN KEY (`active_course_id`) REFERENCES `courses` (`id`),
  FOREIGN KEY (`candidate_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Date: 2026-02-24
-- ---------------------------------------------------------
-- Add is_hidden column to certificates table
ALTER TABLE `certificates` ADD COLUMN `is_hidden` TINYINT(1) DEFAULT 0 AFTER `status`;


-- Date: 2026-02-27 - Start System Manual Module
CREATE TABLE system_manuals (
  id varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  title varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  document_type enum('file','url') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'file',
  file_name varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  file_original_name varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  url_link varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  status tinyint(1) NOT NULL DEFAULT '1',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Date: 2026-03-02 - Admin Roles Module
CREATE TABLE IF NOT EXISTS admin_roles (
  id CHAR(36) NOT NULL,
  role_name VARCHAR(255) NOT NULL,
  description TEXT,
  status TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Date: 2026-03-02 - Add admin_role_id to users table for Admin Role assignment
ALTER TABLE users ADD COLUMN admin_role_id CHAR(36) NULL DEFAULT NULL AFTER role_id;

-- Date: 2026-03-02 - Drop role_id FK from role_permissions to allow admin_roles UUIDs
-- The role_permissions.role_id FK previously pointed only to the `roles` table.
-- Since admin_roles are now also stored in role_permissions, remove the FK constraint.
ALTER TABLE role_permissions DROP FOREIGN KEY role_permissions_ibfk_1;

-- Date: 2026-03-03 - Pre-Active Course Module
-- Add is_pre_active flag to courses table
ALTER TABLE courses ADD COLUMN is_pre_active TINYINT(1) DEFAULT 0 AFTER status;

-- Add approval workflow columns to courses_enrollment table
ALTER TABLE courses_enrollment 
  ADD COLUMN nominator_id CHAR(36) NULL DEFAULT NULL AFTER candidate_email_status,
  ADD COLUMN candidate_approval_status VARCHAR(50) DEFAULT 'Pending' AFTER nominator_id,
  ADD COLUMN candidate_remark TEXT NULL DEFAULT NULL AFTER candidate_approval_status,
  ADD COLUMN admin_approval_status VARCHAR(50) DEFAULT 'Pending' AFTER candidate_remark,
  ADD COLUMN admin_remark TEXT NULL DEFAULT NULL AFTER admin_approval_status,
  ADD COLUMN admin_action_date DATETIME NULL DEFAULT NULL AFTER admin_remark;

-- Create course_tokens table for public nominator and candidate URLs
CREATE TABLE IF NOT EXISTS course_tokens (
  id CHAR(36) NOT NULL,
  course_id CHAR(36) NOT NULL,
  entity_id CHAR(36) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- 'Nominator' or 'Candidate'
  token VARCHAR(100) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  status TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY course_tokens_course_id (course_id),
  KEY course_tokens_entity_id (entity_id),
  KEY course_tokens_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

