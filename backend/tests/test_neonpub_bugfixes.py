#!/usr/bin/env python3
"""
NeonPub Karaoke Bug Fix Tests - Iteration 5
Tests for bug fixes and new features:
1. Reaction limit (3 per user per performance)
2. Finish performance without voting endpoint
3. Quiz multi-question sessions (start-session, next-question)
4. Remaining reactions endpoint
5. Voting modal trigger on client
"""

import pytest
import requests
import os
from datetime import datetime
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://songbattle-3.preview.emergentagent.com').rstrip('/')


class TestReactionLimit:
    """Test reaction limit feature - max 3 reactions per user per performance"""
    
    pub_code = None
    client_token = None
    admin_token = None
    performance_id = None
    song_request_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.base_url = f"{BASE_URL}/api"
    
    def test_01_setup_pub_and_users(self):
        """Create pub and users for reaction limit testing"""
        # Create pub
        pub_data = {
            "name": f"Reaction Test Pub {datetime.now().strftime('%H%M%S')}",
            "admin_password": "testadmin123"
        }
        response = requests.post(f"{self.base_url}/pub/create", json=pub_data)
        assert response.status_code == 200
        data = response.json()
        TestReactionLimit.pub_code = data["code"]
        print(f"\n   Created pub: {data['code']}")
        
        # Join as client
        join_data = {"pub_code": TestReactionLimit.pub_code, "nickname": "ReactionTester"}
        response = requests.post(f"{self.base_url}/auth/join", json=join_data)
        assert response.status_code == 200
        TestReactionLimit.client_token = response.json()["token"]
        
        # Login as admin
        login_data = {"pub_code": TestReactionLimit.pub_code, "password": "testadmin123"}
        response = requests.post(f"{self.base_url}/auth/admin", json=login_data)
        assert response.status_code == 200
        TestReactionLimit.admin_token = response.json()["token"]
    
    def test_02_create_and_start_performance(self):
        """Create song request and start performance"""
        # Create song request
        headers = {"Authorization": f"Bearer {TestReactionLimit.client_token}"}
        song_data = {"title": "Test Song", "artist": "Test Artist"}
        response = requests.post(f"{self.base_url}/songs/request", json=song_data, headers=headers)
        assert response.status_code == 200
        TestReactionLimit.song_request_id = response.json()["id"]
        
        # Approve request
        admin_headers = {"Authorization": f"Bearer {TestReactionLimit.admin_token}"}
        response = requests.post(
            f"{self.base_url}/admin/queue/approve/{TestReactionLimit.song_request_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        # Start performance
        response = requests.post(
            f"{self.base_url}/admin/performance/start/{TestReactionLimit.song_request_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        TestReactionLimit.performance_id = response.json()["id"]
        print(f"\n   Performance started: {TestReactionLimit.performance_id}")
    
    def test_03_get_remaining_reactions_initial(self):
        """Test remaining reactions endpoint - should be 3 initially"""
        headers = {"Authorization": f"Bearer {TestReactionLimit.client_token}"}
        response = requests.get(f"{self.base_url}/reactions/remaining", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "remaining" in data
        assert "limit" in data
        assert data["remaining"] == 3
        assert data["limit"] == 3
        print(f"\n   Initial remaining reactions: {data['remaining']}/{data['limit']}")
    
    def test_04_send_first_reaction(self):
        """Send first reaction - should succeed with 2 remaining"""
        headers = {"Authorization": f"Bearer {TestReactionLimit.client_token}"}
        reaction_data = {"emoji": "🔥"}
        response = requests.post(f"{self.base_url}/reactions/send", json=reaction_data, headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "sent"
        assert data["remaining"] == 2
        print(f"\n   Reaction 1 sent, remaining: {data['remaining']}")
    
    def test_05_send_second_reaction(self):
        """Send second reaction - should succeed with 1 remaining"""
        headers = {"Authorization": f"Bearer {TestReactionLimit.client_token}"}
        reaction_data = {"emoji": "❤️"}
        response = requests.post(f"{self.base_url}/reactions/send", json=reaction_data, headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["remaining"] == 1
        print(f"\n   Reaction 2 sent, remaining: {data['remaining']}")
    
    def test_06_send_third_reaction(self):
        """Send third reaction - should succeed with 0 remaining"""
        headers = {"Authorization": f"Bearer {TestReactionLimit.client_token}"}
        reaction_data = {"emoji": "👏"}
        response = requests.post(f"{self.base_url}/reactions/send", json=reaction_data, headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["remaining"] == 0
        print(f"\n   Reaction 3 sent, remaining: {data['remaining']}")
    
    def test_07_send_fourth_reaction_should_fail(self):
        """Send fourth reaction - should FAIL with 400 error"""
        headers = {"Authorization": f"Bearer {TestReactionLimit.client_token}"}
        reaction_data = {"emoji": "🎉"}
        response = requests.post(f"{self.base_url}/reactions/send", json=reaction_data, headers=headers)
        
        # Should fail with 400
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        assert "Limite" in data["detail"] or "Max" in data["detail"]
        print(f"\n   Fourth reaction correctly rejected: {data['detail']}")
    
    def test_08_verify_remaining_is_zero(self):
        """Verify remaining reactions is 0"""
        headers = {"Authorization": f"Bearer {TestReactionLimit.client_token}"}
        response = requests.get(f"{self.base_url}/reactions/remaining", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["remaining"] == 0
        print(f"\n   Confirmed remaining: {data['remaining']}")


class TestFinishPerformanceNoVoting:
    """Test finish performance without voting endpoint"""
    
    pub_code = None
    client_token = None
    admin_token = None
    performance_id = None
    song_request_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.base_url = f"{BASE_URL}/api"
    
    def test_01_setup_pub_and_performance(self):
        """Create pub and start a performance"""
        # Create pub
        pub_data = {
            "name": f"NoVoting Test Pub {datetime.now().strftime('%H%M%S')}",
            "admin_password": "testadmin123"
        }
        response = requests.post(f"{self.base_url}/pub/create", json=pub_data)
        assert response.status_code == 200
        TestFinishPerformanceNoVoting.pub_code = response.json()["code"]
        
        # Join as client
        join_data = {"pub_code": TestFinishPerformanceNoVoting.pub_code, "nickname": "NoVoteTester"}
        response = requests.post(f"{self.base_url}/auth/join", json=join_data)
        assert response.status_code == 200
        TestFinishPerformanceNoVoting.client_token = response.json()["token"]
        
        # Login as admin
        login_data = {"pub_code": TestFinishPerformanceNoVoting.pub_code, "password": "testadmin123"}
        response = requests.post(f"{self.base_url}/auth/admin", json=login_data)
        assert response.status_code == 200
        TestFinishPerformanceNoVoting.admin_token = response.json()["token"]
        
        # Create and approve song request
        headers = {"Authorization": f"Bearer {TestFinishPerformanceNoVoting.client_token}"}
        song_data = {"title": "No Vote Song", "artist": "Test Artist"}
        response = requests.post(f"{self.base_url}/songs/request", json=song_data, headers=headers)
        assert response.status_code == 200
        TestFinishPerformanceNoVoting.song_request_id = response.json()["id"]
        
        admin_headers = {"Authorization": f"Bearer {TestFinishPerformanceNoVoting.admin_token}"}
        response = requests.post(
            f"{self.base_url}/admin/queue/approve/{TestFinishPerformanceNoVoting.song_request_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        # Start performance
        response = requests.post(
            f"{self.base_url}/admin/performance/start/{TestFinishPerformanceNoVoting.song_request_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        TestFinishPerformanceNoVoting.performance_id = response.json()["id"]
        print(f"\n   Performance started: {TestFinishPerformanceNoVoting.performance_id}")
    
    def test_02_finish_without_voting(self):
        """Test /admin/performance/finish/{id} endpoint - ends without voting"""
        admin_headers = {"Authorization": f"Bearer {TestFinishPerformanceNoVoting.admin_token}"}
        
        response = requests.post(
            f"{self.base_url}/admin/performance/finish/{TestFinishPerformanceNoVoting.performance_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "finished"
        print(f"\n   Performance finished without voting: {data['status']}")
    
    def test_03_verify_performance_completed_no_voting(self):
        """Verify performance is completed (not in voting status)"""
        headers = {"Authorization": f"Bearer {TestFinishPerformanceNoVoting.client_token}"}
        response = requests.get(f"{self.base_url}/performances/history", headers=headers)
        assert response.status_code == 200
        
        performances = response.json()
        # Find our performance
        perf = next((p for p in performances if p["id"] == TestFinishPerformanceNoVoting.performance_id), None)
        assert perf is not None
        assert perf["status"] == "completed", f"Expected 'completed', got '{perf['status']}'"
        # Status should be 'completed' not 'voting' - this confirms no voting was opened
        assert perf["status"] != "voting", "Performance should NOT be in voting status"
        print(f"\n   Verified: status={perf['status']} (not voting - correct!)")


class TestQuizMultiQuestion:
    """Test quiz multi-question sessions"""
    
    pub_code = None
    admin_token = None
    client_token = None
    session_id = None
    quiz_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.base_url = f"{BASE_URL}/api"
    
    def test_01_setup_pub(self):
        """Create pub for quiz testing"""
        pub_data = {
            "name": f"Quiz Session Test {datetime.now().strftime('%H%M%S')}",
            "admin_password": "testadmin123"
        }
        response = requests.post(f"{self.base_url}/pub/create", json=pub_data)
        assert response.status_code == 200
        TestQuizMultiQuestion.pub_code = response.json()["code"]
        
        # Join as client
        join_data = {"pub_code": TestQuizMultiQuestion.pub_code, "nickname": "QuizTester"}
        response = requests.post(f"{self.base_url}/auth/join", json=join_data)
        assert response.status_code == 200
        TestQuizMultiQuestion.client_token = response.json()["token"]
        
        # Login as admin
        login_data = {"pub_code": TestQuizMultiQuestion.pub_code, "password": "testadmin123"}
        response = requests.post(f"{self.base_url}/auth/admin", json=login_data)
        assert response.status_code == 200
        TestQuizMultiQuestion.admin_token = response.json()["token"]
        print(f"\n   Pub created: {TestQuizMultiQuestion.pub_code}")
    
    def test_02_start_quiz_session(self):
        """Test starting a multi-question quiz session"""
        admin_headers = {"Authorization": f"Bearer {TestQuizMultiQuestion.admin_token}"}
        
        # Start session with 3 questions from anni80 category
        response = requests.post(
            f"{self.base_url}/admin/quiz/start-session/anni80?num_questions=3",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "session_id" in data
        assert "quiz_id" in data
        assert data["question_number"] == 1
        assert data["total_questions"] == 3
        assert "question" in data
        assert "options" in data
        
        TestQuizMultiQuestion.session_id = data["session_id"]
        TestQuizMultiQuestion.quiz_id = data["quiz_id"]
        print(f"\n   Quiz session started: {data['session_id']}")
        print(f"   Question 1/{data['total_questions']}: {data['question'][:50]}...")
    
    def test_03_answer_first_question(self):
        """Answer the first question"""
        headers = {"Authorization": f"Bearer {TestQuizMultiQuestion.client_token}"}
        answer_data = {
            "quiz_id": TestQuizMultiQuestion.quiz_id,
            "answer_index": 0
        }
        response = requests.post(f"{self.base_url}/quiz/answer", json=answer_data, headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "is_correct" in data
        assert "points_earned" in data
        print(f"\n   Answered Q1 - Correct: {data['is_correct']}, Points: {data['points_earned']}")
    
    def test_04_next_question(self):
        """Move to next question in session"""
        admin_headers = {"Authorization": f"Bearer {TestQuizMultiQuestion.admin_token}"}
        
        response = requests.post(
            f"{self.base_url}/admin/quiz/next-question/{TestQuizMultiQuestion.session_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["question_number"] == 2
        assert data["total_questions"] == 3
        assert "quiz_id" in data
        
        TestQuizMultiQuestion.quiz_id = data["quiz_id"]
        print(f"\n   Moved to question {data['question_number']}/{data['total_questions']}")
        print(f"   Question: {data['question'][:50]}...")
    
    def test_05_answer_second_question(self):
        """Answer the second question"""
        headers = {"Authorization": f"Bearer {TestQuizMultiQuestion.client_token}"}
        answer_data = {
            "quiz_id": TestQuizMultiQuestion.quiz_id,
            "answer_index": 1
        }
        response = requests.post(f"{self.base_url}/quiz/answer", json=answer_data, headers=headers)
        assert response.status_code == 200
        print(f"\n   Answered Q2")
    
    def test_06_next_to_third_question(self):
        """Move to third (last) question"""
        admin_headers = {"Authorization": f"Bearer {TestQuizMultiQuestion.admin_token}"}
        
        response = requests.post(
            f"{self.base_url}/admin/quiz/next-question/{TestQuizMultiQuestion.session_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["question_number"] == 3
        TestQuizMultiQuestion.quiz_id = data["quiz_id"]
        print(f"\n   Moved to question {data['question_number']}/{data['total_questions']}")
    
    def test_07_answer_third_question(self):
        """Answer the third question"""
        headers = {"Authorization": f"Bearer {TestQuizMultiQuestion.client_token}"}
        answer_data = {
            "quiz_id": TestQuizMultiQuestion.quiz_id,
            "answer_index": 0
        }
        response = requests.post(f"{self.base_url}/quiz/answer", json=answer_data, headers=headers)
        assert response.status_code == 200
        print(f"\n   Answered Q3")
    
    def test_08_next_should_end_session(self):
        """Next after last question should end session"""
        admin_headers = {"Authorization": f"Bearer {TestQuizMultiQuestion.admin_token}"}
        
        response = requests.post(
            f"{self.base_url}/admin/quiz/next-question/{TestQuizMultiQuestion.session_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "session_ended"
        assert "leaderboard" in data
        print(f"\n   Quiz session ended! Leaderboard: {len(data['leaderboard'])} entries")


class TestVotingFlow:
    """Test voting flow - verify voting_open triggers client modal"""
    
    pub_code = None
    admin_token = None
    client_token = None
    client2_token = None
    performance_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.base_url = f"{BASE_URL}/api"
    
    def test_01_setup_voting_test(self):
        """Setup pub with two clients for voting test"""
        # Create pub
        pub_data = {
            "name": f"Voting Test Pub {datetime.now().strftime('%H%M%S')}",
            "admin_password": "testadmin123"
        }
        response = requests.post(f"{self.base_url}/pub/create", json=pub_data)
        assert response.status_code == 200
        TestVotingFlow.pub_code = response.json()["code"]
        
        # Join as performer (client 1)
        join_data = {"pub_code": TestVotingFlow.pub_code, "nickname": "Performer"}
        response = requests.post(f"{self.base_url}/auth/join", json=join_data)
        assert response.status_code == 200
        TestVotingFlow.client_token = response.json()["token"]
        
        # Join as voter (client 2)
        join_data = {"pub_code": TestVotingFlow.pub_code, "nickname": "Voter"}
        response = requests.post(f"{self.base_url}/auth/join", json=join_data)
        assert response.status_code == 200
        TestVotingFlow.client2_token = response.json()["token"]
        
        # Login as admin
        login_data = {"pub_code": TestVotingFlow.pub_code, "password": "testadmin123"}
        response = requests.post(f"{self.base_url}/auth/admin", json=login_data)
        assert response.status_code == 200
        TestVotingFlow.admin_token = response.json()["token"]
        print(f"\n   Setup complete: pub={TestVotingFlow.pub_code}")
    
    def test_02_create_and_start_performance(self):
        """Create and start performance for voting"""
        # Create song request
        headers = {"Authorization": f"Bearer {TestVotingFlow.client_token}"}
        song_data = {"title": "Vote Test Song", "artist": "Test Artist"}
        response = requests.post(f"{self.base_url}/songs/request", json=song_data, headers=headers)
        assert response.status_code == 200
        request_id = response.json()["id"]
        
        # Approve and start
        admin_headers = {"Authorization": f"Bearer {TestVotingFlow.admin_token}"}
        requests.post(f"{self.base_url}/admin/queue/approve/{request_id}", headers=admin_headers)
        
        response = requests.post(
            f"{self.base_url}/admin/performance/start/{request_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        TestVotingFlow.performance_id = response.json()["id"]
        print(f"\n   Performance started: {TestVotingFlow.performance_id}")
    
    def test_03_verify_voting_not_open_initially(self):
        """Verify voting is not open initially"""
        headers = {"Authorization": f"Bearer {TestVotingFlow.client2_token}"}
        response = requests.get(f"{self.base_url}/performance/current", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["voting_open"] == False
        print(f"\n   Initial voting_open: {data['voting_open']}")
    
    def test_04_open_voting(self):
        """Admin opens voting"""
        admin_headers = {"Authorization": f"Bearer {TestVotingFlow.admin_token}"}
        response = requests.post(
            f"{self.base_url}/admin/performance/open-voting/{TestVotingFlow.performance_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        print(f"\n   Voting opened by admin")
    
    def test_05_verify_voting_open_true(self):
        """Verify voting_open is now True - this triggers client modal"""
        headers = {"Authorization": f"Bearer {TestVotingFlow.client2_token}"}
        response = requests.get(f"{self.base_url}/performance/current", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["voting_open"] == True, "voting_open should be True after admin opens voting"
        print(f"\n   voting_open after admin action: {data['voting_open']} (should trigger client modal)")
    
    def test_06_submit_vote(self):
        """Submit vote as second client"""
        headers = {"Authorization": f"Bearer {TestVotingFlow.client2_token}"}
        vote_data = {
            "performance_id": TestVotingFlow.performance_id,
            "score": 5
        }
        response = requests.post(f"{self.base_url}/votes/submit", json=vote_data, headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "voted"
        print(f"\n   Vote submitted: score=5, new_average={data['new_average']}")
    
    def test_07_performer_cannot_vote_self(self):
        """Verify performer cannot vote for themselves"""
        headers = {"Authorization": f"Bearer {TestVotingFlow.client_token}"}
        vote_data = {
            "performance_id": TestVotingFlow.performance_id,
            "score": 5
        }
        response = requests.post(f"{self.base_url}/votes/submit", json=vote_data, headers=headers)
        assert response.status_code == 400
        print(f"\n   Performer correctly blocked from self-voting")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
