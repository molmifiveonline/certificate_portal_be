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