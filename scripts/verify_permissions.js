const API_URL = "http://localhost:8000/api";

const users = [
  {
    role: "admin",
    email: "admin@test.com",
    password: "password123",
    first_name: "Admin",
    last_name: "User",
    mobile: "1234567890",
    dob: "1990-01-01",
  },
  {
    role: "trainer",
    email: "trainer@test.com",
    password: "password123",
    first_name: "Trainer",
    last_name: "User",
    mobile: "1234567891",
    dob: "1990-01-01",
  },
  {
    role: "candidate",
    email: "candidate@test.com",
    password: "password123",
    first_name: "Candidate",
    last_name: "User",
    mobile: "1234567892",
    dob: "1990-01-01",
  },
];

async function apiRequest(endpoint, method = "GET", body = null, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API_URL}${endpoint}`, options);
  const data = await res.json();

  if (!res.ok) {
    // Return error object similar to axios response for cleaner handling logic
    return { ok: false, status: res.status, data };
  }
  return { ok: true, data };
}

async function run() {
  try {
    console.log("Starting Verification...");

    for (const user of users) {
      console.log(`\n--- Testing ${user.role} ---`);
      let token;

      // 1. Login or Register
      let loginRes = await apiRequest("/auth/login", "POST", {
        email: user.email,
        password: user.password,
      });

      if (!loginRes.ok && loginRes.status === 404) {
        console.log("User not found, registering...");
        await apiRequest("/auth/register", "POST", user);
        loginRes = await apiRequest("/auth/login", "POST", {
          email: user.email,
          password: user.password,
        });
        console.log("Registered and logged in.");
      } else if (!loginRes.ok) {
        console.error("Login failed:", loginRes.data);
        continue;
      } else {
        console.log("Logged in successfully.");
      }

      token = loginRes.data.data.tokens.accessToken;

      // 2. Fetch Menu
      const menuRes = await apiRequest("/menu", "GET", null, token);
      if (menuRes.ok) {
        console.log(
          "Menu Items:",
          menuRes.data.data.map((item) => item.title),
        );
      } else {
        console.error("Fetch Menu failed:", menuRes.data);
      }

      // 3. If Admin, try to fetch permissions
      if (user.role === "admin") {
        const permRes = await apiRequest(
          "/admin/permissions",
          "GET",
          null,
          token,
        );
        if (permRes.ok) {
          console.log(
            "Admin: Fetched Permissions count:",
            permRes.data.data.length,
          );
        } else {
          console.error("Fetch Permissions failed:", permRes.data);
        }
      }
    }
  } catch (error) {
    console.error("Verification failed:", error);
  }
}

run();
