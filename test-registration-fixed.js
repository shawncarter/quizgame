#!/usr/bin/env node

/**
 * Test script to verify registration works after ID fixes
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:5000';
const API_URL = `${SERVER_URL}/api`;

async function testRegistrationFixed() {
  console.log('🧪 Testing: Registration After ID Fixes\n');

  try {
    // Test 1: Valid registration with all required fields
    console.log('1. Testing valid registration...');
    const validPlayerData = {
      name: 'FixedTestPlayer',
      age: 25,
      specialistSubject: 'Testing',
      avatar: 'default-avatar',
      buzzerSound: 'default-buzzer',
      deviceId: `fixed_test_${Date.now()}`
    };

    try {
      const response = await axios.post(`${API_URL}/players`, validPlayerData);
      console.log('✅ Registration successful!');
      console.log('   Player ID:', response.data.id);
      console.log('   Player name:', response.data.name);
      console.log('   Device ID:', response.data.deviceId);
      console.log('   Full response:', JSON.stringify(response.data, null, 2));
      
      // Verify the player object structure
      if (response.data.id && typeof response.data.id === 'number') {
        console.log('✅ Player uses correct "id" field');
      } else {
        console.log('❌ Player ID field issue');
      }
      
    } catch (error) {
      console.log('❌ Registration failed');
      console.log('   Error status:', error.response?.status);
      console.log('   Error message:', error.response?.data?.message || error.message);
      console.log('   Full error response:', JSON.stringify(error.response?.data, null, 2));
    }
    console.log('');

    // Test 2: Registration with missing fields (should fail)
    console.log('2. Testing registration with missing name (should fail)...');
    const missingNameData = {
      age: 25,
      specialistSubject: 'Testing',
      deviceId: `missing_name_${Date.now()}`
    };

    try {
      const response = await axios.post(`${API_URL}/players`, missingNameData);
      console.log('⚠️  Registration with missing name succeeded (unexpected)');
    } catch (error) {
      console.log('✅ Registration with missing name failed (expected)');
      console.log('   Error:', error.response?.data?.message || error.message);
    }
    console.log('');

    // Test 3: Registration with empty name (should fail)
    console.log('3. Testing registration with empty name (should fail)...');
    const emptyNameData = {
      name: '',
      age: 25,
      specialistSubject: 'Testing',
      deviceId: `empty_name_${Date.now()}`
    };

    try {
      const response = await axios.post(`${API_URL}/players`, emptyNameData);
      console.log('⚠️  Registration with empty name succeeded (unexpected)');
    } catch (error) {
      console.log('✅ Registration with empty name failed (expected)');
      console.log('   Error:', error.response?.data?.message || error.message);
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the test
testRegistrationFixed()
  .then(() => {
    console.log('\n🎉 Registration test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  });
