#!/usr/bin/env node

/**
 * Test script to check player registration validation
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:5000';
const API_URL = `${SERVER_URL}/api`;

async function testRegistration() {
  console.log('🧪 Testing: Player Registration Validation\n');

  try {
    // Test 1: Valid registration
    console.log('1. Testing valid registration...');
    const validPlayerData = {
      name: 'TestPlayer',
      age: 25,
      specialistSubject: 'Testing',
      deviceId: `test_${Date.now()}`
    };

    try {
      const response = await axios.post(`${API_URL}/players`, validPlayerData);
      console.log('✅ Valid registration successful');
      console.log('   Player ID:', response.data.id);
      console.log('   Player name:', response.data.name);
    } catch (error) {
      console.log('❌ Valid registration failed');
      console.log('   Error:', error.response?.data?.error || error.message);
      console.log('   Status:', error.response?.status);
      console.log('   Full response:', JSON.stringify(error.response?.data, null, 2));
    }
    console.log('');

    // Test 2: Missing name
    console.log('2. Testing registration with missing name...');
    const missingNameData = {
      age: 25,
      specialistSubject: 'Testing',
      deviceId: `test_missing_name_${Date.now()}`
    };

    try {
      const response = await axios.post(`${API_URL}/players`, missingNameData);
      console.log('⚠️  Registration with missing name succeeded (unexpected)');
    } catch (error) {
      console.log('✅ Registration with missing name failed (expected)');
      console.log('   Error:', error.response?.data?.error || error.message);
      console.log('   Validation details:', JSON.stringify(error.response?.data, null, 2));
    }
    console.log('');

    // Test 3: Invalid age
    console.log('3. Testing registration with invalid age...');
    const invalidAgeData = {
      name: 'TestPlayer2',
      age: 150, // Too old
      specialistSubject: 'Testing',
      deviceId: `test_invalid_age_${Date.now()}`
    };

    try {
      const response = await axios.post(`${API_URL}/players`, invalidAgeData);
      console.log('⚠️  Registration with invalid age succeeded (unexpected)');
    } catch (error) {
      console.log('✅ Registration with invalid age failed (expected)');
      console.log('   Error:', error.response?.data?.error || error.message);
      console.log('   Validation details:', JSON.stringify(error.response?.data, null, 2));
    }
    console.log('');

    // Test 4: Missing specialist subject
    console.log('4. Testing registration with missing specialist subject...');
    const missingSubjectData = {
      name: 'TestPlayer3',
      age: 25,
      deviceId: `test_missing_subject_${Date.now()}`
    };

    try {
      const response = await axios.post(`${API_URL}/players`, missingSubjectData);
      console.log('⚠️  Registration with missing subject succeeded (unexpected)');
    } catch (error) {
      console.log('✅ Registration with missing subject failed (expected)');
      console.log('   Error:', error.response?.data?.error || error.message);
      console.log('   Validation details:', JSON.stringify(error.response?.data, null, 2));
    }
    console.log('');

    // Test 5: Empty strings
    console.log('5. Testing registration with empty strings...');
    const emptyStringsData = {
      name: '',
      age: 25,
      specialistSubject: '',
      deviceId: `test_empty_${Date.now()}`
    };

    try {
      const response = await axios.post(`${API_URL}/players`, emptyStringsData);
      console.log('⚠️  Registration with empty strings succeeded (unexpected)');
    } catch (error) {
      console.log('✅ Registration with empty strings failed (expected)');
      console.log('   Error:', error.response?.data?.error || error.message);
      console.log('   Validation details:', JSON.stringify(error.response?.data, null, 2));
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
testRegistration()
  .then(() => {
    console.log('\n🎉 Registration validation test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  });
