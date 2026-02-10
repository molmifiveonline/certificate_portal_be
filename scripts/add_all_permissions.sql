-- Add all module permissions for comprehensive access control
-- Run this script to add all missing permissions

-- Clear existing permissions and re-seed with complete list
-- (Optional: Only run DELETE if you want to reset)
-- DELETE FROM role_permissions;
-- DELETE FROM permissions;

-- Insert all module permissions
INSERT IGNORE INTO permissions (name, slug, group_name, description) VALUES 

-- Dashboard
('View Dashboard', 'view_dashboard', 'Dashboard', 'Access to main dashboard'),

-- Candidates Management
('View Candidates', 'view_candidates', 'Candidates', 'View candidate list'),
('Create Candidates', 'create_candidate', 'Candidates', 'Add new candidates'),
('Edit Candidates', 'edit_candidate', 'Candidates', 'Edit candidate details'),
('Delete Candidates', 'delete_candidate', 'Candidates', 'Remove candidates'),

-- Trainers Management
('View Trainers', 'view_trainers', 'Trainers', 'View trainer list'),
('Create Trainers', 'create_trainer', 'Trainers', 'Add new trainers'),
('Edit Trainers', 'edit_trainer', 'Trainers', 'Edit trainer details'),
('Delete Trainers', 'delete_trainer', 'Trainers', 'Remove trainers'),

-- Course Management
('View Courses', 'view_courses', 'Courses', 'View course list'),
('Create Courses', 'create_course', 'Courses', 'Add new courses'),
('Edit Courses', 'edit_course', 'Courses', 'Edit course details'),
('Delete Courses', 'delete_course', 'Courses', 'Remove courses'),

-- Hotel Details
('View Hotel Details', 'view_hotel_details', 'Hotel', 'View hotel information'),
('Manage Hotel Details', 'manage_hotel_details', 'Hotel', 'Add/edit hotel details'),

-- Location
('View Location', 'view_location', 'Location', 'View locations'),
('Manage Location', 'manage_location', 'Location', 'Add/edit locations'),

-- Assessment Management
('View Assessments', 'view_assessments', 'Assessments', 'View assessment list'),
('Create Assessments', 'create_assessment', 'Assessments', 'Create new assessments'),
('Edit Assessments', 'edit_assessment', 'Assessments', 'Edit assessments'),
('Delete Assessments', 'delete_assessment', 'Assessments', 'Remove assessments'),
('Take Assessments', 'take_assessment', 'Assessments', 'Attempt assessments (for candidates)'),

-- Feedback
('View Feedback', 'view_feedback', 'Feedback', 'View all feedback'),
('Submit Feedback', 'submit_feedback', 'Feedback', 'Submit feedback (for candidates)'),
('Manage Feedback', 'manage_feedback', 'Feedback', 'Manage all feedback'),

-- Certificates
('View Certificates', 'view_certificates', 'Certificates', 'View certificate list'),
('Generate Certificates', 'generate_certificate', 'Certificates', 'Generate new certificates'),
('Download Certificates', 'download_certificate', 'Certificates', 'Download own certificates'),

-- Reports
('View Reports', 'view_reports', 'Reports', 'View system reports'),
('Generate Reports', 'generate_report', 'Reports', 'Generate new reports'),

-- System/Admin
('Manage Permissions', 'manage_permissions', 'System', 'Assign role permissions'),
('Manage Users', 'manage_users', 'System', 'Full user management');

-- Assign ALL permissions to Admin (role_id = 1)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions;

-- Show what permissions now exist
SELECT group_name, name, slug FROM permissions ORDER BY group_name, name;
