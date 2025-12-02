// Debug authentication script - Enhanced version
import axios from 'axios';

const API_URL = "http://localhost:4000";
const TENANT_ID = "kuaforun";

async function testAuth() {
  console.log('🧪 Testing authentication flow...\n');
  
  try {
    // 1. First, let's test the health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${API_URL}/auth/health`, {
      headers: {
        'X-Tenant-Id': TENANT_ID
      }
    });
    
    console.log('✅ Health check:', healthResponse.data);
    
    // 2. Try to register a test user
    console.log('\n2. Testing registration...');
    const registerData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password'
    };
    
    try {
      const registerResponse = await axios.post(`${API_URL}/auth/register`, registerData, {
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': TENANT_ID
        }
      });
      
      console.log('✅ Registration successful:', {
        status: registerResponse.status,
        hasToken: !!registerResponse.data?.data?.token
      });
      
      const token = registerResponse.data?.data?.token;
      
      if (token) {
        // Test auth/me with the new token
        console.log('\n3. Testing /auth/me with new token...');
        const meResponse = await axios.get(`${API_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-Id': TENANT_ID
          }
        });
        
        console.log('✅ /auth/me response:', {
          status: meResponse.status,
          user: meResponse.data?.data
        });
      }
      
    } catch (registerError) {
      if (registerError.response?.status === 409) {
        console.log('ℹ️  User already exists, trying login...');
        
        // Try login instead
        const loginData = {
          email: 'test@example.com',
          password: 'password'
        };
        
        const loginResponse = await axios.post(`${API_URL}/auth/login`, loginData, {
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': TENANT_ID
          }
        });
        
        console.log('✅ Login successful:', {
          status: loginResponse.status,
          fullResponse: loginResponse.data,
          hasToken: !!loginResponse.data?.data?.accessToken,
          tokenPreview: loginResponse.data?.data?.accessToken?.substring(0, 20) + '...'
        });
        
        const token = loginResponse.data?.data?.accessToken;
        
        if (token) {
          // Test auth/me with the token
          console.log('\n4. Testing /auth/me with Bearer token...');
          const meResponse = await axios.get(`${API_URL}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Tenant-Id': TENANT_ID
            }
          });
          
          console.log('✅ /auth/me response:', {
            status: meResponse.status,
            user: meResponse.data?.data
          });
          
          // Test token validation
          console.log('\n5. Testing token validation...');
          const validateResponse = await axios.post(`${API_URL}/auth/validate`, {
            token: token
          }, {
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-Id': TENANT_ID
            }
          });
          
          console.log('✅ Token validation response:', validateResponse.data);
        }
        
      } else {
        throw registerError;
      }
    }
    
  } catch (error) {
    console.log('❌ Error occurred:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
      console.log('Headers:', error.response.headers);
    } else if (error.request) {
      console.log('No response received:', error.request);
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Run the test
testAuth();
