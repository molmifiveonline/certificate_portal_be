const menuItems = require("../config/menuConfig");
const permissionDao = require("../dao/permissionDao");
const { ok, error } = require("../utils/responseHandler");

const getSidebarMenu = async (req, res) => {
  try {
    const roleId = req.user.role; // Assuming authMiddleware attaches { id, email, role (which is role_id) }

    // Fetch permissions for the user's role
    const userPermissions = await permissionDao.getPermissionsByRoleId(roleId);

    // Filter menu items
    const filteredMenu = menuItems.reduce((acc, item) => {
      // Check if main item is allowed
      if (item.permission && !userPermissions.includes(item.permission)) {
        return acc;
      }

      // Check sub-items if they exist
      if (item.subItems) {
        const filteredSubItems = item.subItems.filter(
          (sub) => !sub.permission || userPermissions.includes(sub.permission),
        );

        // If sub-items exist but all get filtered out, decide whether to show parent.
        // Usually, if parent has its own permission, show it (maybe it links to a page).
        // If parent is just a container, maybe hide it?
        // For now, if parent passes permission check, we include it, with filtered subitems.
        if (filteredSubItems.length > 0) {
          acc.push({ ...item, subItems: filteredSubItems });
        } else if (!item.subItems.length || (item.link && item.link !== "#")) {
          // Keep if it has no subitems initially OR if it has a direct link
          // If it was a folder only and supports no children, maybe hide.
          // Let's keep it simple: Just attach filtered subitems.
          acc.push({ ...item, subItems: [] });
        }
      } else {
        acc.push(item);
      }

      return acc;
    }, []);

    return ok(res, "Menu fetched successfully", filteredMenu);
  } catch (err) {
    console.error("Get Menu Error:", err);
    return error(res, 500, "Internal server error");
  }
};

module.exports = {
  getSidebarMenu,
};
