from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import jwt
import bcrypt
import asyncio
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'neonpub-secret-key-2024')
JWT_ALGORITHM = "HS256"

# YouTube API
YOUTUBE_API_KEY = os.environ.get('YOUTUBE_API_KEY', '')
OFFLINE_MODE = os.environ.get('OFFLINE_MODE', 'false').lower() == 'true'

# Create the main app
app = FastAPI(title="NeonPub Karaoke API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# ============== MOCK YOUTUBE DATA FOR OFFLINE MODE ==============

MOCK_YOUTUBE_VIDEOS = {
    "bohemian rhapsody": [
        {
            "title": "Queen - Bohemian Rhapsody (Official Video Remastered)",
            "channel": "Queen Official",
            "thumbnail": "https://i.ytimg.com/vi/fJ9rUzIMcZQ/default.jpg",
            "url": "https://www.youtube.com/watch?v=fJ9rUzIMcZQ",
            "duration": "5:55"
        },
        {
            "title": "Queen - Bohemian Rhapsody (Karaoke Version)",
            "channel": "Karaoke World",
            "thumbnail": "https://i.ytimg.com/vi/mock1/default.jpg",
            "url": "https://www.youtube.com/watch?v=mock1",
            "duration": "5:55"
        }
    ],
    "hotel california": [
        {
            "title": "Eagles - Hotel California (Official Video)",
            "channel": "Eagles",
            "thumbnail": "https://i.ytimg.com/vi/BciS5krYL80/default.jpg",
            "url": "https://www.youtube.com/watch?v=BciS5krYL80",
            "duration": "6:30"
        }
    ],
    "imagine": [
        {
            "title": "John Lennon - Imagine (Official Video)",
            "channel": "John Lennon",
            "thumbnail": "https://i.ytimg.com/vi/YkgkThdzX-8/default.jpg",
            "url": "https://www.youtube.com/watch?v=YkgkThdzX-8",
            "duration": "3:03"
        }
    ],
    "azzurro": [
        {
            "title": "Adriano Celentano - Azzurro",
            "channel": "Adriano Celentano Official",
            "thumbnail": "https://i.ytimg.com/vi/mock_azzurro/default.jpg",
            "url": "https://www.youtube.com/watch?v=mock_azzurro",
            "duration": "3:45"
        }
    ],
    "default": [
        {
            "title": "Karaoke - {search_term}",
            "channel": "Karaoke Channel",
            "thumbnail": "https://i.ytimg.com/vi/default/default.jpg",
            "url": "https://www.youtube.com/watch?v=default_video",
            "duration": "3:30"
        }
    ]
}

def search_mock_youtube(query: str, max_results: int = 5):
    """Mock YouTube search for offline development"""
    query_lower = query.lower()
    
    # Try to find matching mock data
    for key, videos in MOCK_YOUTUBE_VIDEOS.items():
        if key in query_lower:
            return videos[:max_results]
    
    # Return default mock results
    default_videos = []
    for i in range(min(max_results, 3)):
        video = MOCK_YOUTUBE_VIDEOS["default"][0].copy()
        video["title"] = video["title"].replace("{search_term}", query)
        video["url"] = f"https://www.youtube.com/watch?v=mock_{i}"
        default_videos.append(video)
    
    return default_videos

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, pub_id: str):
        await websocket.accept()
        if pub_id not in self.active_connections:
            self.active_connections[pub_id] = []
        self.active_connections[pub_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, pub_id: str):
        if pub_id in self.active_connections:
            if websocket in self.active_connections[pub_id]:
                self.active_connections[pub_id].remove(websocket)
    
    async def broadcast(self, pub_id: str, message: dict):
        if pub_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[pub_id]:
                try:
                    await connection.send_json(message)
                except:
                    disconnected.append(connection)
            for conn in disconnected:
                self.disconnect(conn, pub_id)

manager = ConnectionManager()

# ============== MODELS (same as original) ==============

class PubCreate(BaseModel):
    name: str
    admin_password: str

class PubResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    code: str
    created_at: str

class UserJoin(BaseModel):
    pub_code: str
    nickname: str

class AdminLogin(BaseModel):
    pub_code: str
    password: str

class TokenResponse(BaseModel):
    token: str
    user: dict

class SongRequestCreate(BaseModel):
    title: str
    artist: str
    youtube_url: Optional[str] = None

class SongRequestResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    pub_id: str
    user_id: str
    user_nickname: str
    title: str
    artist: str
    youtube_url: Optional[str]
    status: str
    position: int
    created_at: str

class ReactionCreate(BaseModel):
    emoji: str
    message: Optional[str] = None

class MessageCreate(BaseModel):
    text: str

class VoteCreate(BaseModel):
    performance_id: str
    score: int  # 1-5

class PerformanceResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    pub_id: str
    user_id: str
    user_nickname: str
    song_title: str
    song_artist: str
    youtube_url: Optional[str]
    status: str
    average_score: float
    vote_count: int
    started_at: Optional[str]
    ended_at: Optional[str]

class QuizQuestionCreate(BaseModel):
    question: str
    options: List[str]
    correct_index: int
    points: int = 10
    category: Optional[str] = None

class QuizAnswerSubmit(BaseModel):
    quiz_id: str
    answer_index: int

class AdminEffectCreate(BaseModel):
    effect_type: str  # emoji_burst, filter, text_overlay
    data: dict

class PresetQuizCategory(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    questions_count: int

# Note: PRESET_QUIZZES data would go here (same as original file, lines 161-218)
# Shortened for brevity - copy from original

# ============== AUTH HELPERS ==============

def create_token(data: dict) -> str:
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing token")
    return verify_token(credentials.credentials)

async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = verify_token(credentials.credentials)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def generate_pub_code() -> str:
    import random, string
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

# ============== PUB ENDPOINTS ==============

@api_router.post("/pub/create", response_model=PubResponse)
async def create_pub(pub_data: PubCreate):
    code = generate_pub_code()
    while await db.pubs.find_one({"code": code}):
        code = generate_pub_code()
    
    hashed_pw = bcrypt.hashpw(pub_data.admin_password.encode(), bcrypt.gensalt())
    
    pub_doc = {
        "id": str(uuid.uuid4()),
        "name": pub_data.name,
        "code": code,
        "admin_password": hashed_pw.decode(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "settings": {
            "max_queue_per_user": 2,
            "voting_enabled": True,
            "chat_enabled": True
        }
    }
    
    await db.pubs.insert_one(pub_doc)
    return {k: v for k, v in pub_doc.items() if k not in ["_id", "admin_password"]}

@api_router.post("/pub/join", response_model=TokenResponse)
async def join_pub(join_data: UserJoin):
    pub = await db.pubs.find_one({"code": join_data.pub_code.upper()}, {"_id": 0})
    if not pub:
        raise HTTPException(status_code=404, detail="Pub not found")
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "pub_id": pub["id"],
        "nickname": join_data.nickname,
        "is_admin": False,
        "score": 0,
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token_data = {
        "user_id": user_doc["id"],
        "pub_id": pub["id"],
        "nickname": user_doc["nickname"],
        "is_admin": False
    }
    
    token = create_token(token_data)
    return {"token": token, "user": {k: v for k, v in user_doc.items() if k != "_id"}}

@api_router.post("/admin/login", response_model=TokenResponse)
async def admin_login(login_data: AdminLogin):
    pub = await db.pubs.find_one({"code": login_data.pub_code.upper()}, {"_id": 0})
    if not pub:
        raise HTTPException(status_code=404, detail="Pub not found")
    
    if not bcrypt.checkpw(login_data.password.encode(), pub["admin_password"].encode()):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    token_data = {
        "user_id": "admin",
        "pub_id": pub["id"],
        "nickname": "Admin",
        "is_admin": True
    }
    
    token = create_token(token_data)
    return {"token": token, "user": {"id": "admin", "pub_id": pub["id"], "nickname": "Admin", "is_admin": True}}

@api_router.get("/pub/info")
async def get_pub_info(user: dict = Depends(get_current_user)):
    pub = await db.pubs.find_one({"id": user["pub_id"]}, {"_id": 0, "admin_password": 0})
    if not pub:
        raise HTTPException(status_code=404, detail="Pub not found")
    return pub

# ============== YOUTUBE SEARCH - OFFLINE VERSION ==============

@api_router.get("/youtube/search")
async def search_youtube(
    title: str = Query(...),
    artist: str = Query(None),
    admin: dict = Depends(get_admin_user)
):
    """
    Search YouTube for karaoke videos.
    In OFFLINE_MODE, returns mock data instead of real API calls.
    """
    
    if OFFLINE_MODE:
        # OFFLINE MODE: Use mock data
        logging.info(f"🔌 OFFLINE MODE: Searching mock data for '{title}' by '{artist}'")
        
        search_query = f"{title} {artist}" if artist else title
        mock_results = search_mock_youtube(search_query)
        
        return {
            "results": mock_results,
            "mode": "offline",
            "message": "Using mock data - OFFLINE_MODE enabled"
        }
    
    # ONLINE MODE: Real YouTube API
    if not YOUTUBE_API_KEY:
        raise HTTPException(
            status_code=503, 
            detail="YouTube API key not configured. Set OFFLINE_MODE=true in .env for offline development"
        )
    
    search_query = f"{title} {artist} karaoke" if artist else f"{title} karaoke"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={
                    "part": "snippet",
                    "q": search_query,
                    "type": "video",
                    "maxResults": 5,
                    "key": YOUTUBE_API_KEY
                },
                timeout=10.0
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="YouTube API error")
            
            data = response.json()
            results = []
            
            for item in data.get("items", []):
                snippet = item["snippet"]
                results.append({
                    "title": snippet["title"],
                    "channel": snippet["channelTitle"],
                    "thumbnail": snippet["thumbnails"]["default"]["url"],
                    "url": f"https://www.youtube.com/watch?v={item['id']['videoId']}",
                    "duration": "N/A"
                })
            
            return {"results": results, "mode": "online"}
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Network error: {str(e)}")

# ============== SONG REQUESTS ==============

@api_router.post("/songs/request", response_model=SongRequestResponse)
async def request_song(song_data: SongRequestCreate, user: dict = Depends(get_current_user)):
    pub = await db.pubs.find_one({"id": user["pub_id"]}, {"_id": 0})
    if not pub:
        raise HTTPException(status_code=404, detail="Pub not found")
    
    user_queue_count = await db.song_requests.count_documents({
        "pub_id": user["pub_id"],
        "user_id": user["user_id"],
        "status": "queued"
    })
    
    max_per_user = pub.get("settings", {}).get("max_queue_per_user", 2)
    if user_queue_count >= max_per_user:
        raise HTTPException(
            status_code=400, 
            detail=f"Maximum {max_per_user} songs in queue per user"
        )
    
    last_song = await db.song_requests.find_one(
        {"pub_id": user["pub_id"], "status": "queued"},
        {"_id": 0},
        sort=[("position", -1)]
    )
    next_position = (last_song["position"] + 1) if last_song else 1
    
    song_doc = {
        "id": str(uuid.uuid4()),
        "pub_id": user["pub_id"],
        "user_id": user["user_id"],
        "user_nickname": user["nickname"],
        "title": song_data.title,
        "artist": song_data.artist,
        "youtube_url": song_data.youtube_url,
        "status": "queued",
        "position": next_position,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.song_requests.insert_one(song_doc)
    
    await manager.broadcast(user["pub_id"], {
        "type": "queue_updated",
        "data": {k: v for k, v in song_doc.items() if k != "_id"}
    })
    
    return {k: v for k, v in song_doc.items() if k != "_id"}

@api_router.get("/songs/queue", response_model=List[SongRequestResponse])
async def get_queue(user: dict = Depends(get_current_user)):
    songs = await db.song_requests.find(
        {"pub_id": user["pub_id"], "status": "queued"},
        {"_id": 0}
    ).sort("position", 1).to_list(100)
    return songs

@api_router.delete("/songs/{song_id}")
async def delete_song_request(song_id: str, user: dict = Depends(get_current_user)):
    song = await db.song_requests.find_one({"id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song request not found")
    
    if song["user_id"] != user["user_id"] and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.song_requests.delete_one({"id": song_id})
    
    await manager.broadcast(song["pub_id"], {
        "type": "song_deleted",
        "data": {"song_id": song_id}
    })
    
    return {"status": "deleted"}

# ============== PERFORMANCES ==============

@api_router.post("/admin/performance/start/{song_id}", response_model=PerformanceResponse)
async def start_performance(song_id: str, admin: dict = Depends(get_admin_user)):
    song = await db.song_requests.find_one({"id": song_id, "pub_id": admin["pub_id"]}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song request not found")
    
    await db.song_requests.update_one({"id": song_id}, {"$set": {"status": "performing"}})
    
    performance_doc = {
        "id": str(uuid.uuid4()),
        "pub_id": admin["pub_id"],
        "user_id": song["user_id"],
        "user_nickname": song["user_nickname"],
        "song_title": song["title"],
        "song_artist": song["artist"],
        "youtube_url": song.get("youtube_url"),
        "status": "active",
        "average_score": 0,
        "vote_count": 0,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None
    }
    
    await db.performances.insert_one(performance_doc)
    await db.pubs.update_one({"id": admin["pub_id"]}, {"$set": {"current_performance_id": performance_doc["id"]}})
    
    await manager.broadcast(admin["pub_id"], {
        "type": "performance_started",
        "data": {k: v for k, v in performance_doc.items() if k != "_id"}
    })
    
    return {k: v for k, v in performance_doc.items() if k != "_id"}

@api_router.post("/admin/performance/end/{performance_id}")
async def end_performance(performance_id: str, admin: dict = Depends(get_admin_user)):
    performance = await db.performances.find_one({"id": performance_id, "pub_id": admin["pub_id"]}, {"_id": 0})
    if not performance:
        raise HTTPException(status_code=404, detail="Performance not found")
    
    votes = await db.votes.find({"performance_id": performance_id}, {"_id": 0}).to_list(1000)
    avg_score = sum(v["score"] for v in votes) / len(votes) if votes else 0
    
    await db.performances.update_one(
        {"id": performance_id},
        {"$set": {
            "status": "completed",
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "average_score": avg_score,
            "vote_count": len(votes)
        }}
    )
    
    await db.pubs.update_one({"id": admin["pub_id"]}, {"$set": {"current_performance_id": None}})
    
    song_id = None
    song = await db.song_requests.find_one(
        {"user_id": performance["user_id"], "title": performance["song_title"], "status": "performing"},
        {"_id": 0}
    )
    if song:
        song_id = song["id"]
        await db.song_requests.update_one({"id": song_id}, {"$set": {"status": "completed"}})
    
    await manager.broadcast(admin["pub_id"], {
        "type": "performance_ended",
        "data": {
            "performance_id": performance_id,
            "average_score": avg_score,
            "vote_count": len(votes)
        }
    })
    
    return {"status": "ended", "average_score": avg_score, "vote_count": len(votes)}

@api_router.post("/vote")
async def vote_performance(vote_data: VoteCreate, user: dict = Depends(get_current_user)):
    performance = await db.performances.find_one(
        {"id": vote_data.performance_id, "pub_id": user["pub_id"]},
        {"_id": 0}
    )
    if not performance:
        raise HTTPException(status_code=404, detail="Performance not found")
    
    if performance["status"] != "active":
        raise HTTPException(status_code=400, detail="Performance is not active")
    
    if vote_data.score < 1 or vote_data.score > 5:
        raise HTTPException(status_code=400, detail="Score must be between 1 and 5")
    
    existing_vote = await db.votes.find_one({
        "performance_id": vote_data.performance_id,
        "user_id": user["user_id"]
    })
    
    if existing_vote:
        await db.votes.update_one(
            {"performance_id": vote_data.performance_id, "user_id": user["user_id"]},
            {"$set": {"score": vote_data.score}}
        )
    else:
        vote_doc = {
            "id": str(uuid.uuid4()),
            "performance_id": vote_data.performance_id,
            "pub_id": user["pub_id"],
            "user_id": user["user_id"],
            "score": vote_data.score,
            "voted_at": datetime.now(timezone.utc).isoformat()
        }
        await db.votes.insert_one(vote_doc)
    
    return {"status": "voted"}

# Continue with remaining endpoints (reactions, messages, quiz, etc.)
# Same as original file...

# ============== LEADERBOARD ==============

@api_router.get("/leaderboard")
async def get_leaderboard(user: dict = Depends(get_current_user)):
    users = await db.users.find(
        {"pub_id": user["pub_id"]},
        {"_id": 0, "id": 1, "nickname": 1, "score": 1}
    ).sort("score", -1).to_list(20)
    return users

# ============== DISPLAY DATA ==============

@api_router.get("/display/data")
async def get_display_data(pub_code: str):
    pub = await db.pubs.find_one({"code": pub_code.upper()}, {"_id": 0})
    if not pub:
        raise HTTPException(status_code=404, detail="Pub not found")
    
    current_performance = None
    if pub.get("current_performance_id"):
        current_performance = await db.performances.find_one(
            {"id": pub["current_performance_id"]},
            {"_id": 0}
        )
    
    queue = await db.song_requests.find(
        {"pub_id": pub["id"], "status": "queued"},
        {"_id": 0}
    ).sort("position", 1).to_list(10)
    
    leaderboard = await db.users.find(
        {"pub_id": pub["id"]},
        {"_id": 0, "nickname": 1, "score": 1}
    ).sort("score", -1).to_list(5)
    
    return {
        "pub": {"name": pub["name"], "code": pub["code"]},
        "current_performance": current_performance,
        "queue": queue,
        "leaderboard": leaderboard
    }

# ============== WEBSOCKET ==============

@app.websocket("/api/ws/{pub_code}")
async def websocket_endpoint(websocket: WebSocket, pub_code: str):
    pub = await db.pubs.find_one({"code": pub_code.upper()}, {"_id": 0})
    if not pub:
        await websocket.close(code=4004)
        return
    
    await manager.connect(websocket, pub["id"])
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, pub["id"])

# ============== ROOT ==============

@api_router.get("/")
async def root():
    mode = "OFFLINE" if OFFLINE_MODE else "ONLINE"
    return {
        "message": "NeonPub Karaoke API", 
        "version": "1.1.0-offline",
        "mode": mode
    }

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
