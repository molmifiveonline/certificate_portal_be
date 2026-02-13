-- Database Changes Log
-- Store all database changes here, date-wise.

-- Date: 2026-02-13
-- ---------------------------------------------------------
-- Initial cleanup or setup for Feedback Questions if needed.

DROP TABLE IF EXISTS `feedback_question_answer`;
DROP TABLE IF EXISTS `feedback_questions`;
DROP TABLE IF EXISTS `feedback_categories`;

CREATE TABLE `feedback_categories` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `status` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `feedback_questions` (
  `id` char(36) NOT NULL,
  `category_id` char(36) NOT NULL,
  `question` text NOT NULL,
  `type` varchar(50) NOT NULL DEFAULT 'rating',
  `status` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `feedback_questions_category_id_foreign` (`category_id`),
  CONSTRAINT `feedback_questions_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `feedback_categories` (`id`) ON DELETE CASCADE
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
