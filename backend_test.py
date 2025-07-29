#!/usr/bin/env python3
"""
Backend API Testing for Sign Language Interview Tool
Tests all backend endpoints and WebSocket functionality
"""

import requests
import json
import asyncio
import websockets
import uuid
from datetime import datetime
import time
import sys
import os

# Get backend URL from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception as e:
        print(f"Error reading backend URL: {e}")
        return None

BACKEND_URL = get_backend_url()
if not BACKEND_URL:
    print("ERROR: Could not get backend URL from frontend/.env")
    sys.exit(1)

API_BASE = f"{BACKEND_URL}/api"
WS_BASE = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://')

print(f"Testing backend at: {API_BASE}")
print(f"WebSocket base: {WS_BASE}")

class BackendTester:
    def __init__(self):
        self.test_results = []
        self.created_users = []
        self.created_sessions = []
        
    def log_test(self, test_name, success, message="", details=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'details': details
        })
        
    def test_basic_api(self):
        """Test basic API endpoint"""
        try:
            response = requests.get(f"{API_BASE}/", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "Sign Language Interview Tool" in data.get("message", ""):
                    self.log_test("Basic API endpoint", True, "API is responding correctly")
                    return True
                else:
                    self.log_test("Basic API endpoint", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Basic API endpoint", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("Basic API endpoint", False, f"Connection error: {str(e)}")
            return False
    
    def test_user_management(self):
        """Test user creation and retrieval"""
        try:
            # Test creating a candidate user
            candidate_data = {
                "name": "Sarah Johnson",
                "role": "candidate"
            }
            
            response = requests.post(f"{API_BASE}/users", json=candidate_data, timeout=10)
            if response.status_code != 200:
                self.log_test("Create candidate user", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            candidate = response.json()
            self.created_users.append(candidate['user_id'])
            
            # Validate candidate response
            if not all(key in candidate for key in ['user_id', 'name', 'role']):
                self.log_test("Create candidate user", False, "Missing required fields in response")
                return False
                
            if candidate['role'] != 'candidate' or candidate['name'] != 'Sarah Johnson':
                self.log_test("Create candidate user", False, "Incorrect user data returned")
                return False
                
            self.log_test("Create candidate user", True, f"Created user: {candidate['user_id']}")
            
            # Test creating an HR user
            hr_data = {
                "name": "Michael Chen",
                "role": "hr"
            }
            
            response = requests.post(f"{API_BASE}/users", json=hr_data, timeout=10)
            if response.status_code != 200:
                self.log_test("Create HR user", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            hr_user = response.json()
            self.created_users.append(hr_user['user_id'])
            
            if hr_user['role'] != 'hr' or hr_user['name'] != 'Michael Chen':
                self.log_test("Create HR user", False, "Incorrect HR user data returned")
                return False
                
            self.log_test("Create HR user", True, f"Created HR user: {hr_user['user_id']}")
            
            # Test retrieving users
            for user_id in [candidate['user_id'], hr_user['user_id']]:
                response = requests.get(f"{API_BASE}/users/{user_id}", timeout=10)
                if response.status_code != 200:
                    self.log_test("Get user details", False, f"HTTP {response.status_code} for user {user_id}")
                    return False
                    
                user_data = response.json()
                if user_data['user_id'] != user_id:
                    self.log_test("Get user details", False, f"User ID mismatch for {user_id}")
                    return False
                    
            self.log_test("Get user details", True, "Successfully retrieved all created users")
            
            # Test getting non-existent user
            fake_id = str(uuid.uuid4())
            response = requests.get(f"{API_BASE}/users/{fake_id}", timeout=10)
            if response.status_code != 404:
                self.log_test("Get non-existent user", False, f"Expected 404, got {response.status_code}")
                return False
                
            self.log_test("Get non-existent user", True, "Correctly returned 404 for non-existent user")
            return True
            
        except Exception as e:
            self.log_test("User management", False, f"Exception: {str(e)}")
            return False
    
    def test_session_management(self):
        """Test session creation, joining, and messaging"""
        try:
            # Create a session
            session_data = {
                "sign_language": "ASL"
            }
            
            response = requests.post(f"{API_BASE}/sessions", json=session_data, timeout=10)
            if response.status_code != 200:
                self.log_test("Create session", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            session = response.json()
            self.created_sessions.append(session['session_id'])
            
            # Validate session response
            required_fields = ['session_id', 'status', 'sign_language']
            if not all(key in session for key in required_fields):
                self.log_test("Create session", False, f"Missing fields in session: {session}")
                return False
                
            if session['status'] != 'waiting' or session['sign_language'] != 'ASL':
                self.log_test("Create session", False, "Incorrect session data")
                return False
                
            self.log_test("Create session", True, f"Created session: {session['session_id']}")
            
            # Get session details
            response = requests.get(f"{API_BASE}/sessions/{session['session_id']}", timeout=10)
            if response.status_code != 200:
                self.log_test("Get session details", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            retrieved_session = response.json()
            if retrieved_session['session_id'] != session['session_id']:
                self.log_test("Get session details", False, "Session ID mismatch")
                return False
                
            self.log_test("Get session details", True, "Successfully retrieved session")
            
            # Test joining session (need users first)
            if len(self.created_users) >= 2:
                candidate_id = self.created_users[0]
                hr_id = self.created_users[1]
                
                # Candidate joins session
                join_data = {
                    "user_id": candidate_id,
                    "role": "candidate"
                }
                response = requests.post(f"{API_BASE}/sessions/{session['session_id']}/join", 
                                       params=join_data, timeout=10)
                if response.status_code != 200:
                    self.log_test("Candidate join session", False, f"HTTP {response.status_code}: {response.text}")
                    return False
                    
                join_result = response.json()
                if "Joined session successfully" not in join_result.get("message", ""):
                    self.log_test("Candidate join session", False, f"Unexpected response: {join_result}")
                    return False
                    
                self.log_test("Candidate join session", True, "Candidate successfully joined")
                
                # HR joins session
                join_data = {
                    "user_id": hr_id,
                    "role": "hr"
                }
                response = requests.post(f"{API_BASE}/sessions/{session['session_id']}/join", 
                                       params=join_data, timeout=10)
                if response.status_code != 200:
                    self.log_test("HR join session", False, f"HTTP {response.status_code}: {response.text}")
                    return False
                    
                join_result = response.json()
                if join_result.get("status") != "active":
                    self.log_test("HR join session", False, "Session should be active after both join")
                    return False
                    
                self.log_test("HR join session", True, "HR successfully joined, session is active")
                
                # Test sending messages
                message_data = {
                    "session_id": session['session_id'],
                    "sender_id": candidate_id,
                    "sender_role": "candidate",
                    "message_type": "sign_to_text",
                    "content": "Hello, I am ready for the interview"
                }
                
                response = requests.post(f"{API_BASE}/sessions/{session['session_id']}/messages", 
                                       json=message_data, timeout=10)
                if response.status_code != 200:
                    self.log_test("Send message", False, f"HTTP {response.status_code}: {response.text}")
                    return False
                    
                message_result = response.json()
                if "Message sent successfully" not in message_result.get("message", ""):
                    self.log_test("Send message", False, f"Unexpected response: {message_result}")
                    return False
                    
                self.log_test("Send message", True, "Message sent successfully")
                
                # Verify message was stored in session
                response = requests.get(f"{API_BASE}/sessions/{session['session_id']}", timeout=10)
                if response.status_code == 200:
                    updated_session = response.json()
                    if len(updated_session.get('messages', [])) > 0:
                        stored_message = updated_session['messages'][0]
                        if stored_message['content'] == message_data['content']:
                            self.log_test("Message storage", True, "Message correctly stored in session")
                        else:
                            self.log_test("Message storage", False, "Message content mismatch")
                            return False
                    else:
                        self.log_test("Message storage", False, "No messages found in session")
                        return False
                else:
                    self.log_test("Message storage", False, "Could not retrieve updated session")
                    return False
            
            # Test getting non-existent session
            fake_session_id = str(uuid.uuid4())
            response = requests.get(f"{API_BASE}/sessions/{fake_session_id}", timeout=10)
            if response.status_code != 404:
                self.log_test("Get non-existent session", False, f"Expected 404, got {response.status_code}")
                return False
                
            self.log_test("Get non-existent session", True, "Correctly returned 404 for non-existent session")
            return True
            
        except Exception as e:
            self.log_test("Session management", False, f"Exception: {str(e)}")
            return False
    
    async def test_websocket_connectivity(self):
        """Test WebSocket endpoint connectivity"""
        if not self.created_users:
            self.log_test("WebSocket connectivity", False, "No users available for WebSocket testing")
            return False
            
        try:
            user_id = self.created_users[0]
            ws_url = f"{WS_BASE}/ws/{user_id}"
            
            # Test basic WebSocket connection
            async with websockets.connect(ws_url, timeout=10) as websocket:
                self.log_test("WebSocket connection", True, f"Successfully connected to {ws_url}")
                
                # Test ping-pong
                ping_message = json.dumps({"type": "ping"})
                await websocket.send(ping_message)
                
                response = await asyncio.wait_for(websocket.recv(), timeout=5)
                response_data = json.loads(response)
                
                if response_data.get("type") == "pong":
                    self.log_test("WebSocket ping-pong", True, "Ping-pong working correctly")
                else:
                    self.log_test("WebSocket ping-pong", False, f"Unexpected response: {response_data}")
                    return False
                
                # Test message forwarding (if we have a session)
                if self.created_sessions:
                    session_id = self.created_sessions[0]
                    test_message = {
                        "type": "message",
                        "session_id": session_id,
                        "sender_id": user_id,
                        "content": "WebSocket test message"
                    }
                    
                    await websocket.send(json.dumps(test_message))
                    self.log_test("WebSocket message send", True, "Message sent via WebSocket")
                
                return True
                
        except asyncio.TimeoutError:
            self.log_test("WebSocket connectivity", False, "Connection timeout")
            return False
        except Exception as e:
            self.log_test("WebSocket connectivity", False, f"Exception: {str(e)}")
            return False
    
    def test_ml_dependencies(self):
        """Test if ML dependencies are properly installed"""
        try:
            # Check requirements.txt exists
            if not os.path.exists('/app/backend/requirements.txt'):
                self.log_test("ML dependencies file", False, "requirements.txt not found")
                return False
                
            # Read requirements.txt
            with open('/app/backend/requirements.txt', 'r') as f:
                requirements = f.read()
                
            # Check for key ML dependencies
            required_deps = ['websockets', 'opencv-python', 'mediapipe', 'speechrecognition', 'pydub', 'gtts']
            missing_deps = []
            
            for dep in required_deps:
                if dep not in requirements:
                    missing_deps.append(dep)
                    
            if missing_deps:
                self.log_test("ML dependencies check", False, f"Missing dependencies: {missing_deps}")
                return False
            else:
                self.log_test("ML dependencies check", True, "All required ML dependencies found in requirements.txt")
                
            # Try importing key packages (if installed)
            try:
                import websockets
                self.log_test("WebSocket import", True, "websockets package available")
            except ImportError:
                self.log_test("WebSocket import", False, "websockets package not installed")
                
            return True
            
        except Exception as e:
            self.log_test("ML dependencies", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("=" * 60)
        print("STARTING BACKEND API TESTS")
        print("=" * 60)
        
        # Test 1: ML Dependencies
        print("\n1. Testing ML Dependencies...")
        self.test_ml_dependencies()
        
        # Test 2: Basic API
        print("\n2. Testing Basic API...")
        if not self.test_basic_api():
            print("❌ Basic API failed - stopping tests")
            return False
            
        # Test 3: User Management
        print("\n3. Testing User Management...")
        if not self.test_user_management():
            print("❌ User management failed - continuing with other tests")
            
        # Test 4: Session Management
        print("\n4. Testing Session Management...")
        if not self.test_session_management():
            print("❌ Session management failed - continuing with other tests")
            
        # Test 5: WebSocket
        print("\n5. Testing WebSocket...")
        try:
            asyncio.run(self.test_websocket_connectivity())
        except Exception as e:
            self.log_test("WebSocket test", False, f"AsyncIO error: {str(e)}")
        
        # Summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        
        if total - passed > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"❌ {result['test']}: {result['message']}")
        
        return passed == total

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print("\n💥 SOME TESTS FAILED!")
        sys.exit(1)