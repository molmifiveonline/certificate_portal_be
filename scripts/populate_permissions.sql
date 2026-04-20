-- Permission Seeding Script
-- Harmonizing all modules to granular permission control

INSERT INTO `permissions` (`id`, `name`, `slug`, `group_name`, `description`, `created_at`)
VALUES
-- Active Course Module
(UUID(), 'View Active Courses', 'view_active_courses', 'Active Courses', 'Access to the list of active courses', NOW()),
(UUID(), 'Create Active Course', 'create_active_course', 'Active Courses', 'Ability to initiate a new active course', NOW()),
(UUID(), 'Edit Active Course', 'edit_active_course', 'Active Courses', 'Ability to modify course details', NOW()),
(UUID(), 'Delete Active Course', 'delete_active_course', 'Active Courses', 'Ability to remove an active course', NOW()),
(UUID(), 'Manage Course Enrollment', 'manage_active_course_enrollment', 'Active Courses', 'Enroll or remove candidates from a course', NOW()),
(UUID(), 'Manage Course Attendance', 'manage_active_course_attendance', 'Active Courses', 'Mark or view attendance records', NOW()),
(UUID(), 'Manage Course Assessment', 'manage_active_course_assessment', 'Active Courses', 'View scores and send assessment invitations', NOW()),
(UUID(), 'Manage Course Feedback', 'manage_active_course_feedback', 'Active Courses', 'View feedback and send feedback invitations', NOW()),
(UUID(), 'Manage Course Certificates', 'manage_active_course_certificates', 'Active Courses', 'Generate and manage certificates', NOW()),

-- Question Bank Module
(UUID(), 'View Question Bank', 'view_questions', 'Question Bank', 'View questions in the bank', NOW()),
(UUID(), 'Create Question', 'create_question', 'Question Bank', 'Add new questions', NOW()),
(UUID(), 'Edit Question', 'edit_question', 'Question Bank', 'Modify existing questions', NOW()),
(UUID(), 'Delete Question', 'delete_question', 'Question Bank', 'Remove questions', NOW()),

-- System Manuals
(UUID(), 'View System Manuals', 'view_system_manuals', 'System Manuals', 'Access to system manuals', NOW()),
(UUID(), 'Manage System Manuals', 'manage_system_manuals', 'System Manuals', 'Create, update or delete manuals', NOW()),

-- Logs & Audit
(UUID(), 'View Activity Logs', 'view_activity_logs', 'System Audit', 'Access to system activity logs', NOW()),

-- Locations
(UUID(), 'View Locations', 'view_locations', 'Masters', 'View predefined locations', NOW()),
(UUID(), 'Manage Locations', 'manage_locations', 'Masters', 'Add or edit locations', NOW()),

-- Reports
(UUID(), 'View Reports', 'view_reports', 'Reports', 'Access to report generation module', NOW()),
(UUID(), 'Export Reports', 'export_reports', 'Reports', 'Ability to export data as CSV/Excel', NOW()),

-- Admin Roles Management
(UUID(), 'View Admin Roles', 'view_admin_roles', 'Administration', 'View defined roles and permissions', NOW()),
(UUID(), 'Create Admin Role', 'create_admin_role', 'Administration', 'Create new admin roles', NOW()),
(UUID(), 'Edit Admin Role', 'edit_admin_role', 'Administration', 'Modify existing roles', NOW()),
(UUID(), 'Delete Admin Role', 'delete_admin_role', 'Administration', 'Remove roles', NOW()),

-- Reimbursements (Admin side)
(UUID(), 'View Reimbursements', 'view_reimbursements', 'Reimbursements', 'View all reimbursement claims', NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();
