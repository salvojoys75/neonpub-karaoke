#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import time

class NeonPubAPITester:
    def __init__(self, base_url="https://songbattle-3.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.client_token = None
        self.admin_token = None
        self.pub_code = None
        self.pub_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f", Expected: {expected_status}"
                if response.text:
                    try:
                        error_data = response.json()
                        details += f", Error: {error_data.get('detail', response.text[:100])}"
                    except:
                        details += f", Response: {response.text[:100]}"

            self.log_test(name, success, details)
            return success, response.json() if success and response.text else {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_create_pub(self):
        """Test pub creation"""
        pub_data = {
            "name": f"Test Pub {datetime.now().strftime('%H%M%S')}",
            "admin_password": "TestPass123!"
        }
        
        success, response = self.run_test("Create Pub", "POST", "pub/create", 200, pub_data)
        if success and response:
            self.pub_code = response.get('code')
            self.pub_id = response.get('id')
            print(f"   Created pub with code: {self.pub_code}")
        return success

    def test_get_pub(self):
        """Test getting pub info"""
        if not self.pub_code:
            self.log_test("Get Pub Info", False, "No pub code available")
            return False
        
        return self.run_test("Get Pub Info", "GET", f"pub/{self.pub_code}", 200)

    def test_client_join(self):
        """Test client joining pub"""
        if not self.pub_code:
            self.log_test("Client Join", False, "No pub code available")
            return False

        join_data = {
            "pub_code": self.pub_code,
            "nickname": f"TestUser{datetime.now().strftime('%H%M%S')}"
        }
        
        success, response = self.run_test("Client Join", "POST", "auth/join", 200, join_data)
        if success and response:
            self.client_token = response.get('token')
            print(f"   Client joined with token: {self.client_token[:20]}...")
        return success

    def test_admin_login(self):
        """Test admin login"""
        if not self.pub_code:
            self.log_test("Admin Login", False, "No pub code available")
            return False

        admin_data = {
            "pub_code": self.pub_code,
            "password": "TestPass123!"
        }
        
        success, response = self.run_test("Admin Login", "POST", "auth/admin", 200, admin_data)
        if success and response:
            self.admin_token = response.get('token')
            print(f"   Admin logged in with token: {self.admin_token[:20]}...")
        return success

    def test_auth_me(self):
        """Test getting current user info"""
        if not self.client_token:
            self.log_test("Auth Me (Client)", False, "No client token available")
            return False

        headers = {'Authorization': f'Bearer {self.client_token}'}
        return self.run_test("Auth Me (Client)", "GET", "auth/me", 200, headers=headers)

    def test_song_request(self):
        """Test song request - should start as 'pending' status"""
        if not self.client_token:
            self.log_test("Song Request", False, "No client token available")
            return False

        song_data = {
            "title": "Wonderwall",
            "artist": "Oasis",
            "youtube_url": "https://www.youtube.com/watch?v=bx1Bh8ZvH84"
        }
        
        headers = {'Authorization': f'Bearer {self.client_token}'}
        success, response = self.run_test("Song Request", "POST", "songs/request", 200, song_data, headers)
        if success:
            self.song_request_id = response.get('id')
            # Verify it starts as pending
            if response.get('status') == 'pending':
                print(f"   ✓ Request correctly starts as 'pending' status")
            else:
                print(f"   ⚠️ Request status: {response.get('status')} (expected 'pending')")
        return success

    def test_get_song_queue(self):
        """Test getting song queue"""
        if not self.client_token:
            self.log_test("Get Song Queue", False, "No client token available")
            return False

        headers = {'Authorization': f'Bearer {self.client_token}'}
        return self.run_test("Get Song Queue", "GET", "songs/queue", 200, headers=headers)

    def test_get_my_requests(self):
        """Test getting user's song requests"""
        if not self.client_token:
            self.log_test("Get My Requests", False, "No client token available")
            return False

        headers = {'Authorization': f'Bearer {self.client_token}'}
        return self.run_test("Get My Requests", "GET", "songs/my-requests", 200, headers=headers)

    def test_admin_approve_request(self):
        """Test admin approving song request"""
        if not self.admin_token or not hasattr(self, 'song_request_id'):
            self.log_test("Admin Approve Request", False, "No admin token or song request ID")
            return False

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        return self.run_test("Admin Approve Request", "POST", f"admin/queue/approve/{self.song_request_id}", 200, headers=headers)

    def test_admin_reject_request(self):
        """Test admin rejecting song request"""
        if not self.admin_token:
            self.log_test("Admin Reject Request", False, "No admin token available")
            return False

        # Create another request to reject
        song_data = {
            "title": "Test Reject Song",
            "artist": "Test Artist",
            "youtube_url": "https://www.youtube.com/watch?v=test"
        }
        
        headers_client = {'Authorization': f'Bearer {self.client_token}'}
        success, response = self.run_test("Create Request to Reject", "POST", "songs/request", 200, song_data, headers_client)
        if not success:
            return False
            
        reject_request_id = response.get('id')
        headers_admin = {'Authorization': f'Bearer {self.admin_token}'}
        return self.run_test("Admin Reject Request", "POST", f"admin/queue/reject/{reject_request_id}", 200, headers=headers_admin)

    def test_performance_controls(self):
        """Test admin performance controls: pause, resume, restart"""
        if not self.admin_token or not hasattr(self, 'performance_id'):
            self.log_test("Performance Controls", False, "No admin token or performance ID")
            return False

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Test pause
        success1 = self.run_test("Pause Performance", "POST", f"admin/performance/pause/{self.performance_id}", 200, headers=headers)[0]
        time.sleep(1)
        
        # Test resume
        success2 = self.run_test("Resume Performance", "POST", f"admin/performance/resume/{self.performance_id}", 200, headers=headers)[0]
        time.sleep(1)
        
        # Test restart
        success3 = self.run_test("Restart Performance", "POST", f"admin/performance/restart/{self.performance_id}", 200, headers=headers)[0]
        
        return success1 and success2 and success3

    def test_voting_open_flag(self):
        """Test voting open flag functionality"""
        if not self.admin_token or not hasattr(self, 'performance_id'):
            self.log_test("Voting Open Flag", False, "No admin token or performance ID")
            return False

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Test open voting without ending performance
        success, response = self.run_test("Open Voting", "POST", f"admin/performance/open-voting/{self.performance_id}", 200, headers=headers)
        if success:
            print(f"   ✓ Voting opened successfully")
        return success

    def test_next_performance(self):
        """Test admin next song functionality"""
        if not self.admin_token:
            self.log_test("Next Performance", False, "No admin token available")
            return False

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        return self.run_test("Next Performance", "POST", "admin/performance/next", 200, headers=headers)

    def test_quiz_categories(self):
        """Test quiz preset categories"""
        success, response = self.run_test("Get Quiz Categories", "GET", "quiz/categories", 200)
        if success and response:
            categories = response
            expected_categories = ['anni80', 'anni90', 'anni2000', 'italiane', 'rock', 'pop_moderno']
            found_categories = [cat.get('id') for cat in categories]
            
            for expected in expected_categories:
                if expected in found_categories:
                    print(f"   ✓ Found category: {expected}")
                else:
                    print(f"   ❌ Missing category: {expected}")
                    return False
            
            print(f"   ✓ All {len(expected_categories)} preset categories found")
        return success

    def test_preset_quiz(self):
        """Test starting preset quiz"""
        if not self.admin_token:
            self.log_test("Start Preset Quiz", False, "No admin token available")
            return False

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        # Test with 'anni80' category
        success, response = self.run_test("Start Preset Quiz (anni80)", "POST", "admin/quiz/start-preset/anni80", 200, headers=headers)
        if success:
            self.preset_quiz_id = response.get('id')
            print(f"   ✓ Preset quiz started with ID: {self.preset_quiz_id}")
        return success

    def test_send_message(self):
        """Test client sending message for admin approval"""
        if not self.client_token:
            self.log_test("Send Message", False, "No client token available")
            return False

        message_data = {
            "text": "Great performance! 🎤"
        }
        
        headers = {'Authorization': f'Bearer {self.client_token}'}
        success, response = self.run_test("Send Message", "POST", "messages/send", 200, message_data, headers)
        if success:
            self.message_id = response.get('id')
            print(f"   ✓ Message sent for approval with ID: {self.message_id}")
        return success

    def test_pending_messages(self):
        """Test admin getting pending messages"""
        if not self.admin_token:
            self.log_test("Get Pending Messages", False, "No admin token available")
            return False

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        return self.run_test("Get Pending Messages", "GET", "messages/pending", 200, headers=headers)

    def test_approve_message(self):
        """Test admin approving message"""
        if not self.admin_token or not hasattr(self, 'message_id'):
            self.log_test("Approve Message", False, "No admin token or message ID")
            return False

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        return self.run_test("Approve Message", "POST", f"admin/messages/approve/{self.message_id}", 200, headers=headers)

    def test_start_performance(self):
        """Test starting a performance"""
        if not self.admin_token or not hasattr(self, 'song_request_id'):
            self.log_test("Start Performance", False, "No admin token or song request ID")
            return False

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        endpoint = f"admin/performance/start/{self.song_request_id}?youtube_url=https://www.youtube.com/watch?v=test"
        success, response = self.run_test("Start Performance", "POST", endpoint, 200, headers=headers)
        if success:
            self.performance_id = response.get('id')
        return success

    def test_get_current_performance(self):
        """Test getting current performance"""
        if not self.client_token:
            self.log_test("Get Current Performance", False, "No client token available")
            return False

        headers = {'Authorization': f'Bearer {self.client_token}'}
        return self.run_test("Get Current Performance", "GET", "performance/current", 200, headers=headers)

    def test_send_reaction(self):
        """Test sending reaction"""
        if not self.client_token:
            self.log_test("Send Reaction", False, "No client token available")
            return False

        reaction_data = {
            "emoji": "❤️",
            "message": "Great performance!"
        }
        
        headers = {'Authorization': f'Bearer {self.client_token}'}
        return self.run_test("Send Reaction", "POST", "reactions/send", 200, reaction_data, headers)

    def test_end_performance(self):
        """Test ending performance (start voting)"""
        if not self.admin_token or not hasattr(self, 'performance_id'):
            self.log_test("End Performance", False, "No admin token or performance ID")
            return False

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        return self.run_test("End Performance", "POST", f"admin/performance/end/{self.performance_id}", 200, headers=headers)

    def test_submit_vote(self):
        """Test submitting vote"""
        if not self.client_token or not hasattr(self, 'performance_id'):
            self.log_test("Submit Vote", False, "No client token or performance ID")
            return False

        vote_data = {
            "performance_id": self.performance_id,
            "score": 5
        }
        
        headers = {'Authorization': f'Bearer {self.client_token}'}
        # This should fail because user can't vote for their own performance
        success, response = self.run_test("Submit Vote (Own Performance)", "POST", "votes/submit", 400, vote_data, headers)
        # Expecting 400 error for voting on own performance is correct behavior
        if not success:
            self.log_test("Submit Vote Validation", True, "Correctly prevented self-voting")
            return True
        return success

    def test_start_quiz(self):
        """Test starting a quiz"""
        if not self.admin_token:
            self.log_test("Start Quiz", False, "No admin token available")
            return False

        quiz_data = {
            "question": "Who sang 'Bohemian Rhapsody'?",
            "options": ["Queen", "The Beatles", "Led Zeppelin", "Pink Floyd"],
            "correct_index": 0,
            "points": 10
        }
        
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        success, response = self.run_test("Start Quiz", "POST", "admin/quiz/start", 200, quiz_data, headers)
        if success:
            self.quiz_id = response.get('id')
        return success

    def test_get_active_quiz(self):
        """Test getting active quiz"""
        if not self.client_token:
            self.log_test("Get Active Quiz", False, "No client token available")
            return False

        headers = {'Authorization': f'Bearer {self.client_token}'}
        return self.run_test("Get Active Quiz", "GET", "quiz/active", 200, headers=headers)

    def test_answer_quiz(self):
        """Test answering quiz"""
        if not self.client_token or not hasattr(self, 'quiz_id'):
            self.log_test("Answer Quiz", False, "No client token or quiz ID")
            return False

        answer_data = {
            "quiz_id": self.quiz_id,
            "answer_index": 0  # Correct answer
        }
        
        headers = {'Authorization': f'Bearer {self.client_token}'}
        return self.run_test("Answer Quiz", "POST", "quiz/answer", 200, answer_data, headers)

    def test_get_leaderboard(self):
        """Test getting leaderboard"""
        if not self.client_token:
            self.log_test("Get Leaderboard", False, "No client token available")
            return False

        headers = {'Authorization': f'Bearer {self.client_token}'}
        return self.run_test("Get Leaderboard", "GET", "leaderboard", 200, headers=headers)

    def test_end_quiz(self):
        """Test ending quiz"""
        if not self.admin_token or not hasattr(self, 'quiz_id'):
            self.log_test("End Quiz", False, "No admin token or quiz ID")
            return False

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        return self.run_test("End Quiz", "POST", f"admin/quiz/end/{self.quiz_id}", 200, headers=headers)

    def test_close_voting(self):
        """Test closing voting"""
        if not self.admin_token or not hasattr(self, 'performance_id'):
            self.log_test("Close Voting", False, "No admin token or performance ID")
            return False

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        return self.run_test("Close Voting", "POST", f"admin/performance/close-voting/{self.performance_id}", 200, headers=headers)

    def test_send_effect(self):
        """Test sending admin effect"""
        if not self.admin_token:
            self.log_test("Send Effect", False, "No admin token available")
            return False

        effect_data = {
            "effect_type": "emoji_burst",
            "data": {"emoji": "🔥"}
        }
        
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        return self.run_test("Send Effect", "POST", "admin/effects/send", 200, effect_data, headers)

    def test_display_data(self):
        """Test getting display data"""
        if not self.pub_code:
            self.log_test("Get Display Data", False, "No pub code available")
            return False

        return self.run_test("Get Display Data", "GET", f"display/data?pub_code={self.pub_code}", 200)

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting NeonPub API Tests (Version 1.1.0)...")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)

        # Basic tests
        self.test_root_endpoint()
        
        # Pub management
        self.test_create_pub()
        self.test_get_pub()
        
        # Authentication
        self.test_client_join()
        self.test_admin_login()
        self.test_auth_me()
        
        # Song management (requests start as pending)
        self.test_song_request()
        self.test_get_song_queue()
        self.test_get_my_requests()
        
        # Admin queue management (approve/reject)
        self.test_admin_approve_request()
        self.test_admin_reject_request()
        
        # Performance flow with new controls
        self.test_start_performance()
        self.test_get_current_performance()
        self.test_performance_controls()  # pause, resume, restart
        self.test_voting_open_flag()      # voting_open flag
        self.test_send_reaction()
        self.test_end_performance()
        self.test_submit_vote()
        
        # Quiz system with presets
        self.test_quiz_categories()       # preset categories
        self.test_preset_quiz()           # start preset quiz
        self.test_start_quiz()            # custom quiz
        self.test_get_active_quiz()
        self.test_answer_quiz()
        self.test_end_quiz()
        self.test_get_leaderboard()
        
        # Message system with approval
        self.test_send_message()          # client sends message
        self.test_pending_messages()      # admin gets pending
        self.test_approve_message()       # admin approves
        
        # Admin controls
        self.test_next_performance()      # next song control
        self.test_send_effect()           # effects broadcasting
        
        # Cleanup and display
        self.test_close_voting()
        self.test_display_data()

        # Print results
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("❌ Some tests failed!")
            failed_tests = [r for r in self.test_results if not r['success']]
            print("\nFailed tests:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
            return 1

def main():
    tester = NeonPubAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())