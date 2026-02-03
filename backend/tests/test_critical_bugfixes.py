"""
Test critical bug fixes for NeonPub Karaoke:
1. Voting notification to client when admin opens vote
2. Quiz multi-question flow with admin controls
3. YouTube search endpoint
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSetup:
    """Setup test data"""
    
    @pytest.fixture(scope="class")
    def test_pub(self):
        """Create a test pub"""
        response = requests.post(f"{BASE_URL}/api/pub/create", json={
            "name": "TestPubCritical",
            "admin_password": "testadmin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "code" in data
        return data
    
    @pytest.fixture(scope="class")
    def admin_token(self, test_pub):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/admin", json={
            "pub_code": test_pub["code"],
            "password": "testadmin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        return data["token"]
    
    @pytest.fixture(scope="class")
    def client_token(self, test_pub):
        """Get client token"""
        response = requests.post(f"{BASE_URL}/api/auth/join", json={
            "pub_code": test_pub["code"],
            "nickname": "TestClient"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        return data
    
    @pytest.fixture(scope="class")
    def performer_token(self, test_pub):
        """Get performer token (different user)"""
        response = requests.post(f"{BASE_URL}/api/auth/join", json={
            "pub_code": test_pub["code"],
            "nickname": "TestPerformer"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        return data


class TestYouTubeSearch(TestSetup):
    """Test YouTube search endpoint"""
    
    def test_youtube_search_requires_admin(self, test_pub, client_token):
        """YouTube search should require admin auth"""
        headers = {"Authorization": f"Bearer {client_token['token']}"}
        response = requests.get(
            f"{BASE_URL}/api/youtube/search",
            params={"title": "Bohemian Rhapsody", "artist": "Queen"},
            headers=headers
        )
        # Should fail with 403 (not admin)
        assert response.status_code == 403
    
    def test_youtube_search_with_admin(self, test_pub, admin_token):
        """YouTube search should work for admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/youtube/search",
            params={"title": "Bohemian Rhapsody", "artist": "Queen"},
            headers=headers
        )
        # Should succeed or fail with API error (not auth error)
        # If YOUTUBE_API_KEY is not configured, it returns 500
        # If configured, it returns 200 with results
        assert response.status_code in [200, 500]
        
        if response.status_code == 200:
            data = response.json()
            assert "results" in data
            assert "query" in data
            assert "karaoke" in data["query"].lower()
            print(f"YouTube search returned {len(data['results'])} results")
        else:
            # API key not configured or quota exceeded
            print(f"YouTube API error: {response.json().get('detail', 'Unknown error')}")


class TestVotingFlow(TestSetup):
    """Test voting flow - critical bug: voting not appearing on phone"""
    
    def test_voting_flow_complete(self, test_pub, admin_token, client_token, performer_token):
        """Test complete voting flow"""
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        client_headers = {"Authorization": f"Bearer {client_token['token']}"}
        performer_headers = {"Authorization": f"Bearer {performer_token['token']}"}
        
        # 1. Performer requests a song
        response = requests.post(
            f"{BASE_URL}/api/songs/request",
            json={"title": "Test Song", "artist": "Test Artist"},
            headers=performer_headers
        )
        assert response.status_code == 200
        song_request = response.json()
        request_id = song_request["id"]
        print(f"Song request created: {request_id}")
        
        # 2. Admin approves the request
        response = requests.post(
            f"{BASE_URL}/api/admin/queue/approve/{request_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        print("Song request approved")
        
        # 3. Admin starts performance
        response = requests.post(
            f"{BASE_URL}/api/admin/performance/start/{request_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        performance = response.json()
        performance_id = performance["id"]
        assert performance["voting_open"] == False
        print(f"Performance started: {performance_id}")
        
        # 4. Check current performance from client perspective
        response = requests.get(
            f"{BASE_URL}/api/performance/current",
            headers=client_headers
        )
        assert response.status_code == 200
        current_perf = response.json()
        assert current_perf["id"] == performance_id
        assert current_perf["voting_open"] == False
        print("Client sees performance with voting_open=False")
        
        # 5. Admin opens voting (CRITICAL: this should trigger voting_opened WebSocket event)
        response = requests.post(
            f"{BASE_URL}/api/admin/performance/open-voting/{performance_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "voting_opened"
        print("Admin opened voting")
        
        # 6. Client checks performance - voting_open should be True now
        response = requests.get(
            f"{BASE_URL}/api/performance/current",
            headers=client_headers
        )
        assert response.status_code == 200
        current_perf = response.json()
        assert current_perf["voting_open"] == True, "voting_open should be True after admin opens voting"
        print("Client sees voting_open=True - CRITICAL BUG FIX VERIFIED")
        
        # 7. Client submits vote
        response = requests.post(
            f"{BASE_URL}/api/votes/submit",
            json={"performance_id": performance_id, "score": 5},
            headers=client_headers
        )
        assert response.status_code == 200
        vote_result = response.json()
        assert vote_result["status"] == "voted"
        print(f"Client voted successfully, new average: {vote_result['new_average']}")
        
        # 8. Performer cannot vote for themselves
        response = requests.post(
            f"{BASE_URL}/api/votes/submit",
            json={"performance_id": performance_id, "score": 5},
            headers=performer_headers
        )
        assert response.status_code == 400
        assert "yourself" in response.json()["detail"].lower()
        print("Performer correctly blocked from voting for themselves")
        
        # 9. Admin closes voting
        response = requests.post(
            f"{BASE_URL}/api/admin/performance/close-voting/{performance_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        print("Voting closed successfully")


class TestQuizMultiQuestion(TestSetup):
    """Test quiz multi-question flow - critical bug: quiz not advancing"""
    
    def test_quiz_session_flow(self, test_pub, admin_token, client_token):
        """Test complete quiz session with multiple questions"""
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        client_headers = {"Authorization": f"Bearer {client_token['token']}"}
        
        # 1. Get quiz categories
        response = requests.get(f"{BASE_URL}/api/quiz/categories")
        assert response.status_code == 200
        categories = response.json()
        assert len(categories) > 0
        print(f"Found {len(categories)} quiz categories")
        
        # 2. Start quiz session with 3 questions
        category_id = categories[0]["id"]
        response = requests.post(
            f"{BASE_URL}/api/admin/quiz/start-session/{category_id}?num_questions=3",
            headers=admin_headers
        )
        assert response.status_code == 200
        session_data = response.json()
        
        # Verify session data structure
        assert "session_id" in session_data
        assert "quiz_id" in session_data
        assert "question_number" in session_data
        assert "total_questions" in session_data
        assert session_data["question_number"] == 1
        assert session_data["total_questions"] == 3
        
        session_id = session_data["session_id"]
        quiz_id = session_data["quiz_id"]
        print(f"Quiz session started: {session_id}, Question 1/3")
        
        # 3. Client answers first question
        response = requests.post(
            f"{BASE_URL}/api/quiz/answer",
            json={"quiz_id": quiz_id, "answer_index": 0},
            headers=client_headers
        )
        assert response.status_code == 200
        answer_result = response.json()
        print(f"Client answered Q1: correct={answer_result['is_correct']}, points={answer_result['points_earned']}")
        
        # 4. Admin ends current question
        response = requests.post(
            f"{BASE_URL}/api/admin/quiz/end/{quiz_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        end_result = response.json()
        assert "winners" in end_result or "status" in end_result
        print(f"Q1 ended, winners: {end_result.get('winners', [])}")
        
        # 5. Admin advances to next question (CRITICAL: this is the bug fix)
        response = requests.post(
            f"{BASE_URL}/api/admin/quiz/next-question/{session_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        next_q_data = response.json()
        
        # Should be question 2
        assert next_q_data["question_number"] == 2
        assert next_q_data["total_questions"] == 3
        new_quiz_id = next_q_data["quiz_id"]
        print(f"Advanced to Question 2/3 - QUIZ ADVANCEMENT BUG FIX VERIFIED")
        
        # 6. Client answers second question
        response = requests.post(
            f"{BASE_URL}/api/quiz/answer",
            json={"quiz_id": new_quiz_id, "answer_index": 1},
            headers=client_headers
        )
        assert response.status_code == 200
        print("Client answered Q2")
        
        # 7. Admin ends Q2 and advances to Q3
        response = requests.post(
            f"{BASE_URL}/api/admin/quiz/end/{new_quiz_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        response = requests.post(
            f"{BASE_URL}/api/admin/quiz/next-question/{session_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        q3_data = response.json()
        assert q3_data["question_number"] == 3
        q3_quiz_id = q3_data["quiz_id"]
        print("Advanced to Question 3/3")
        
        # 8. Client answers third question
        response = requests.post(
            f"{BASE_URL}/api/quiz/answer",
            json={"quiz_id": q3_quiz_id, "answer_index": 2},
            headers=client_headers
        )
        assert response.status_code == 200
        print("Client answered Q3")
        
        # 9. Admin ends Q3 and tries to advance (should end session)
        response = requests.post(
            f"{BASE_URL}/api/admin/quiz/end/{q3_quiz_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        response = requests.post(
            f"{BASE_URL}/api/admin/quiz/next-question/{session_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        final_data = response.json()
        
        # Session should be ended
        assert final_data["status"] == "session_ended"
        assert "leaderboard" in final_data
        print(f"Quiz session ended with leaderboard: {final_data['leaderboard']}")
        print("QUIZ MULTI-QUESTION FLOW COMPLETE - ALL TESTS PASSED")


class TestFinishWithoutVoting(TestSetup):
    """Test finish performance without voting"""
    
    def test_finish_no_voting(self, test_pub, admin_token, performer_token):
        """Test admin can finish performance without opening voting"""
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        performer_headers = {"Authorization": f"Bearer {performer_token['token']}"}
        
        # 1. Create and start a performance
        response = requests.post(
            f"{BASE_URL}/api/songs/request",
            json={"title": "No Vote Song", "artist": "Test Artist"},
            headers=performer_headers
        )
        assert response.status_code == 200
        request_id = response.json()["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/admin/queue/approve/{request_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        response = requests.post(
            f"{BASE_URL}/api/admin/performance/start/{request_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        performance_id = response.json()["id"]
        print(f"Performance started: {performance_id}")
        
        # 2. Admin finishes WITHOUT voting
        response = requests.post(
            f"{BASE_URL}/api/admin/performance/finish/{performance_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "finished"
        print("Performance finished without voting - VERIFIED")
        
        # 3. Verify performance is completed (not in voting state)
        response = requests.get(
            f"{BASE_URL}/api/performance/current",
            headers=performer_headers
        )
        # Should be None (no current performance)
        assert response.status_code == 200
        assert response.json() is None
        print("No current performance after finish - VERIFIED")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
