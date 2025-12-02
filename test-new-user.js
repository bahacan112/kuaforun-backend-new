// Test new user registration with UUID-based JWT
import axios from "axios";

const API_URL = "http://localhost:4000";
const TENANT_ID = "kuaforun";

async function testNewUserRegistration() {
  console.log("🧪 Testing new user registration with UUID-based JWT...\n");

  try {
    // Generate unique email for testing
    const timestamp = Date.now();
    const testEmail = `testuser_${timestamp}@example.com`;

    console.log(`1. Registering new user: ${testEmail}`);

    const registerData = {
      name: "New Test User",
      email: testEmail,
      password: "password123",
    };

    const registerResponse = await axios.post(
      `${API_URL}/auth/register`,
      registerData,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": TENANT_ID,
        },
      }
    );

    console.log('✅ Registration successful:', {
      status: registerResponse.status,
      userId: registerResponse.data?.data?.id,
      authUserId: registerResponse.data?.data?.authUserId,
      hasAccessToken: !!registerResponse.data?.data?.accessToken,
      hasRefreshToken: !!registerResponse.data?.data?.refreshToken
    });
    
    const token = registerResponse.data?.data?.accessToken;

    if (token) {
      // Decode JWT to check the payload
      const tokenParts = token.split(".");
      const payload = JSON.parse(atob(tokenParts[1]));

      console.log("\n2. JWT Token Analysis:");
      console.log("Token payload:", JSON.stringify(payload, null, 2));
      console.log("✅ Subject (sub) field format:", payload.sub);
      console.log(
        "✅ Is UUID format:",
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          payload.sub
        )
      );

      // Test /auth/me with the new token
      console.log("\n3. Testing /auth/me with new user token...");
      const meResponse = await axios.get(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-Id": TENANT_ID,
        },
      });

      console.log("✅ /auth/me response:", {
        status: meResponse.status,
        user: {
          id: meResponse.data?.data?.id,
          email: meResponse.data?.data?.email,
          name: meResponse.data?.data?.name,
        },
      });
    }
  } catch (error) {
    console.log("❌ Error occurred:");
    if (error.response) {
      console.log("Status:", error.response.status);
      console.log("Data:", error.response.data);
    } else {
      console.log("Error:", error.message);
    }
  }
}

// Run the test
testNewUserRegistration();