const http = require("http");

const makeRequest = (path, method, data, token = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 8000,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (token) {
      options.headers["Authorization"] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body: body });
        }
      });
    });

    req.on("error", (e) => reject(e));

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

const runTests = async () => {
  try {
    console.log("Starting Verification Tests on localhost:8000...");

    // 1. Register Candidate (MOLMI Employee)
    const timestamp = Date.now();
    const candidateEmail = `candidate${timestamp}@test.com`;
    console.log(`\nTest 1: Register Candidate (${candidateEmail})`);
    const regRes = await makeRequest("/api/auth/register/candidate", "POST", {
      first_name: "John",
      last_name: "Doe",
      middle_name: "K",
      prefix: "Mr",
      gender: "Male",
      dob: "1990-01-01",
      nationality: "India",
      passport_no: "A1234567",
      employee_id: "EMP001",
      manager: "MOLMI",
      other_manager: "",
      rank: "Captain",
      other_rank: "",
      whatsapp_number: "9876543210",
      alternate_mobile: "9876543211",
      indos_number: "IN123456",
      registration_type: "MOLMI Employee",
      email: candidateEmail,
      password: "password123",
      mobile: "1234567890",
    });
    console.log(`Status: ${regRes.status}`, regRes.body);

    // 2. Login Candidate
    console.log(`\nTest 2: Login Candidate`);
    const loginRes = await makeRequest("/api/auth/login", "POST", {
      email: candidateEmail,
      password: "password123",
    });
    console.log(
      `Status: ${loginRes.status}`,
      loginRes.body.token ? "Token Received" : "No Token",
    );

    // 3. Login Admin
    console.log(`\nTest 3: Login Admin`);
    const adminLoginRes = await makeRequest("/api/auth/login", "POST", {
      email: "admin@molmi.com",
      password: "admin123",
    });
    console.log(
      `Status: ${adminLoginRes.status}`,
      adminLoginRes.body.token ? "Token Received" : "No Token",
    );
    const adminToken = adminLoginRes.body.token;

    if (adminToken) {
      // 4. Create Trainer (As Admin)
      const trainerEmail = `trainer${timestamp}@test.com`;
      console.log(`\nTest 4: Create Trainer (As Admin)`);
      const trainRes = await makeRequest(
        "/api/trainer/create",
        "POST",
        {
          first_name: "Master",
          last_name: "Trainer",
          email: trainerEmail,
          password: "password123",
          mobile: "1122334455",
          rank: "Captain",
          specialization: "Navigation",
        },
        adminToken,
      );
      console.log(`Status: ${trainRes.status}`, trainRes.body);
    }

    // 5. Create Trainer (As Candidate - Fail)
    if (loginRes.body.token) {
      console.log(`\nTest 5: Create Trainer (As Candidate - Should Fail)`);
      const failRes = await makeRequest(
        "/api/trainer/create",
        "POST",
        {
          first_name: "Hacker",
          last_name: "Trainer",
          email: "hacker@test.com",
          password: "password123",
          mobile: "0000000000",
          rank: "Captain",
          specialization: "Hacking",
        },
        loginRes.body.token,
      );
      console.log(`Status: ${failRes.status} (Expected 403)`, failRes.body);
    }
  } catch (error) {
    console.error("Test execution failed:", error);
  }
};

runTests();
