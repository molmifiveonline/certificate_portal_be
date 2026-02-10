const menuItems = [
  {
    title: "Dashboard",
    link: "/dashboard", // Frontend route
    icon: "LayoutDashboard", // Icon name (Lucide/Feather)
    permission: "view_dashboard",
  },
  {
    title: "User Management",
    icon: "Users",
    permission: "view_users",
    subItems: [
      // Optional: Supports nested menus if needed
      { title: "All Users", link: "/users", permission: "view_users" },
      { title: "Add User", link: "/users/add", permission: "create_user" },
    ],
  },
  {
    title: "Course Management",
    icon: "BookOpen",
    permission: "view_courses",
    subItems: [
      { title: "All Courses", link: "/courses", permission: "view_courses" },
      {
        title: "Add Course",
        link: "/courses/add",
        permission: "create_course",
      },
    ],
  },
  {
    title: "Settings",
    icon: "Settings",
    permission: "manage_permissions",
    subItems: [
      {
        title: "Role Permissions",
        link: "/settings/permissions",
        permission: "manage_permissions",
      },
    ],
  },
];

module.exports = menuItems;
