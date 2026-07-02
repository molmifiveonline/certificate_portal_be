const { v5: uuidv5 } = require("uuid");

const DEFAULT_UUID_NAMESPACE = "7dd9fb68-23dc-55d9-8b8a-9ae4a47d5551";

const TRAINER_ROLE_PERMISSIONS = [
  {
    name: "View Courses",
    slug: "view_courses",
    group_name: "Trainer",
    description: "Show trainer course menu and course pages",
  },
  {
    name: "View Feedback",
    slug: "view_feedback",
    group_name: "Trainer",
    description: "Show trainer feedback menu and pages",
  },
  {
    name: "View Certificates",
    slug: "view_certificates",
    group_name: "Trainer",
    description: "Show trainer certificate menu and pages",
  },
  {
    name: "View Active Courses",
    slug: "view_active_courses",
    group_name: "Active Courses",
    description: "Access to assigned active courses",
  },
  {
    name: "Manage Course Feedback",
    slug: "manage_active_course_feedback",
    group_name: "Active Courses",
    description: "View feedback and send feedback invitations",
  },
  {
    name: "Manage Course Certificates",
    slug: "manage_active_course_certificates",
    group_name: "Active Courses",
    description: "Generate and manage certificates",
  },
];

function stablePermissionId(slug, namespace = process.env.LEGACY_UUID_NAMESPACE) {
  return uuidv5(`permission:${slug}`, namespace || DEFAULT_UUID_NAMESPACE);
}

async function ensureTrainerRolePermissions(db, { dryRun = false } = {}) {
  const [roles] = await db.query(
    "SELECT id, name FROM roles WHERE LOWER(name) = 'trainer' LIMIT 1",
  );

  if (!roles[0]?.id) {
    return {
      trainerRoleId: null,
      ensuredPermissions: [],
      assignedPermissions: [],
      missingRole: true,
    };
  }

  const trainerRoleId = roles[0].id;
  const slugs = TRAINER_ROLE_PERMISSIONS.map((permission) => permission.slug);
  const ensuredPermissions = [];
  const assignedPermissions = [];

  for (const permission of TRAINER_ROLE_PERMISSIONS) {
    const permissionId = stablePermissionId(permission.slug);
    ensuredPermissions.push(permission.slug);

    if (!dryRun) {
      await db.execute(
        `INSERT INTO permissions
           (id, name, slug, group_name, description, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           group_name = VALUES(group_name),
           description = VALUES(description)`,
        [
          permissionId,
          permission.name,
          permission.slug,
          permission.group_name,
          permission.description,
        ],
      );
    }
  }

  if (!dryRun && slugs.length) {
    const [permissions] = await db.query(
      `SELECT id, slug FROM permissions WHERE slug IN (${slugs.map(() => "?").join(",")})`,
      slugs,
    );

    for (const permission of permissions) {
      await db.execute(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id)
         VALUES (?, ?)`,
        [trainerRoleId, permission.id],
      );
      assignedPermissions.push(permission.slug);
    }
  } else {
    assignedPermissions.push(...slugs);
  }

  return {
    trainerRoleId,
    ensuredPermissions,
    assignedPermissions,
    missingRole: false,
  };
}

module.exports = {
  TRAINER_ROLE_PERMISSIONS,
  ensureTrainerRolePermissions,
};
