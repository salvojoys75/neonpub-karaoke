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
# YouTube API
YOUTUBE_API_KEY = os.environ.get('YOUTUBE_API_KEY', '')
AUTO_YOUTUBE_SEARCH = os.environ.get('AUTO_YOUTUBE_SEARCH', 'false').lower() == 'true'

# Create the main app
app = FastAPI(title="NeonPub Karaoke API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

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

# ============== MODELS ==============

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

# ============== PRESET QUIZ DATA ==============

PRESET_QUIZZES = {
    "anni80": {
        "name": "Successi Anni '80",
        "description": "I grandi classici degli anni '80",
        "icon": "📻",
        "questions": [
            {"question": "Chi ha cantato 'Thriller'?", "options": ["Michael Jackson", "Prince", "Madonna", "Whitney Houston"], "correct_index": 0},
            {"question": "Quale band ha cantato 'Take On Me'?", "options": ["Depeche Mode", "A-ha", "Duran Duran", "Pet Shop Boys"], "correct_index": 1},
            {"question": "'Don't Stop Believin' è una canzone di...?", "options": ["Bon Jovi", "Journey", "Foreigner", "REO Speedwagon"], "correct_index": 1},
            {"question": "Chi ha cantato 'Like a Virgin'?", "options": ["Cyndi Lauper", "Whitney Houston", "Madonna", "Janet Jackson"], "correct_index": 2},
            {"question": "'Every Breath You Take' è dei...?", "options": ["U2", "The Police", "The Cure", "Depeche Mode"], "correct_index": 1},
        ]
    },
    "anni90": {
        "name": "Successi Anni '90",
        "description": "Le hit che hanno segnato i '90",
        "icon": "💿",
        "questions": [
            {"question": "Chi ha cantato 'Smells Like Teen Spirit'?", "options": ["Pearl Jam", "Nirvana", "Soundgarden", "Alice in Chains"], "correct_index": 1},
            {"question": "'...Baby One More Time' è di...?", "options": ["Christina Aguilera", "Britney Spears", "Jessica Simpson", "Mandy Moore"], "correct_index": 1},
            {"question": "Quale band ha cantato 'Wonderwall'?", "options": ["Blur", "Radiohead", "Oasis", "Pulp"], "correct_index": 2},
            {"question": "'I Will Always Love You' versione famosa è di...?", "options": ["Mariah Carey", "Celine Dion", "Whitney Houston", "Toni Braxton"], "correct_index": 2},
            {"question": "Chi ha cantato 'Macarena'?", "options": ["Los Del Rio", "Ricky Martin", "Enrique Iglesias", "Chayanne"], "correct_index": 0},
        ]
    },
    "anni2000": {
        "name": "Successi Anni 2000",
        "description": "Le hit del nuovo millennio",
        "icon": "📱",
        "questions": [
            {"question": "Chi ha cantato 'Crazy in Love'?", "options": ["Rihanna", "Beyoncé", "Alicia Keys", "Mary J. Blige"], "correct_index": 1},
            {"question": "'In the End' è dei...?", "options": ["Linkin Park", "Evanescence", "Three Days Grace", "Breaking Benjamin"], "correct_index": 0},
            {"question": "Chi ha cantato 'Toxic'?", "options": ["Christina Aguilera", "Pink", "Britney Spears", "Shakira"], "correct_index": 2},
            {"question": "'Hey Ya!' è di...?", "options": ["Black Eyed Peas", "OutKast", "Kanye West", "Pharrell"], "correct_index": 1},
            {"question": "Chi ha cantato 'Umbrella'?", "options": ["Beyoncé", "Lady Gaga", "Rihanna", "Katy Perry"], "correct_index": 2},
        ]
    },
    "italiane": {
        "name": "Canzoni Italiane",
        "description": "I classici della musica italiana",
        "icon": "🇮🇹",
        "questions": [
            {"question": "Chi ha cantato 'Nel blu dipinto di blu'?", "options": ["Adriano Celentano", "Domenico Modugno", "Gianni Morandi", "Lucio Battisti"], "correct_index": 1},
            {"question": "'La canzone del sole' è di...?", "options": ["Lucio Dalla", "Lucio Battisti", "Francesco De Gregori", "Fabrizio De André"], "correct_index": 1},
            {"question": "Chi ha cantato 'Pensieri e Parole'?", "options": ["Mina", "Patty Pravo", "Ornella Vanoni", "Lucio Battisti"], "correct_index": 3},
            {"question": "'Bocca di Rosa' è di...?", "options": ["Francesco De Gregori", "Fabrizio De André", "Francesco Guccini", "Giorgio Gaber"], "correct_index": 1},
            {"question": "Chi ha cantato 'Azzurro'?", "options": ["Gianni Morandi", "Adriano Celentano", "Lucio Dalla", "Mina"], "correct_index": 1},
        ]
    },
    "rock": {
        "name": "Rock Legends",
        "description": "I mostri sacri del rock",
        "icon": "🎸",
        "questions": [
            {"question": "'Stairway to Heaven' è dei...?", "options": ["Pink Floyd", "Led Zeppelin", "Deep Purple", "Black Sabbath"], "correct_index": 1},
            {"question": "Chi ha cantato 'Bohemian Rhapsody'?", "options": ["Queen", "The Beatles", "Rolling Stones", "The Who"], "correct_index": 0},
            {"question": "'Hotel California' è degli...?", "options": ["Eagles", "Fleetwood Mac", "The Doors", "Creedence"], "correct_index": 0},
            {"question": "Chi ha cantato 'Sweet Child O' Mine'?", "options": ["Aerosmith", "Van Halen", "Guns N' Roses", "Bon Jovi"], "correct_index": 2},
            {"question": "'Smoke on the Water' è dei...?", "options": ["Black Sabbath", "Deep Purple", "Led Zeppelin", "Iron Maiden"], "correct_index": 1},
        ]
    },
    "pop_moderno": {
        "name": "Pop Moderno",
        "description": "Le hit più recenti",
        "icon": "🎧",
        "questions": [
            {"question": "Chi ha cantato 'Bad Guy'?", "options": ["Dua Lipa", "Billie Eilish", "Ariana Grande", "Olivia Rodrigo"], "correct_index": 1},
            {"question": "'Shape of You' è di...?", "options": ["Justin Bieber", "Ed Sheeran", "Shawn Mendes", "Bruno Mars"], "correct_index": 1},
            {"question": "Chi ha cantato 'Blinding Lights'?", "options": ["Daft Punk", "The Weeknd", "Post Malone", "Drake"], "correct_index": 1},
            {"question": "'drivers license' è di...?", "options": ["Billie Eilish", "Taylor Swift", "Olivia Rodrigo", "Dua Lipa"], "correct_index": 2},
            {"question": "Chi ha cantato 'Uptown Funk'?", "options": ["Justin Timberlake", "Bruno Mars", "Pharrell", "Chris Brown"], "correct_index": 1},
        ]
    }
}

async def auto_search_youtube_karaoke(title: str, artist: str = ""):
    """Auto-search YouTube for karaoke version - returns first result or None"""
    if not YOUTUBE_API_KEY or not AUTO_YOUTUBE_SEARCH:
        return None
    
    query = f"{title} {artist} karaoke".strip()
    
    try:
        async with httpx.AsyncClient() as http:
            response = await http.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={
                    "part": "snippet",
                    "q": query,
                    "type": "video",
                    "maxResults": 1,
                    "key": YOUTUBE_API_KEY
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json()
                items = data.get("items", [])
                if items:
                    video_id = items[0]["id"]["videoId"]
                    return f"https://www.youtube.com/watch?v={video_id}"
    except Exception as e:
        logging.error(f"Auto YouTube search failed: {e}")
    
    return None

# ============== AUTH HELPERS ==============

def create_token(data: dict) -> str:
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except:
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Token required")
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload

async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = await get_current_user(credentials)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ============== PUB ENDPOINTS ==============

@api_router.post("/pub/create", response_model=PubResponse)
async def create_pub(pub_data: PubCreate):
    pub_code = str(uuid.uuid4())[:8].upper()
    hashed_password = bcrypt.hashpw(pub_data.admin_password.encode(), bcrypt.gensalt()).decode()
    
    pub_doc = {
        "id": str(uuid.uuid4()),
        "name": pub_data.name,
        "code": pub_code,
        "admin_password": hashed_password,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "current_performance_id": None,
        "is_active": True
    }
    
    await db.pubs.insert_one(pub_doc)
    return PubResponse(
        id=pub_doc["id"],
        name=pub_doc["name"],
        code=pub_doc["code"],
        created_at=pub_doc["created_at"]
    )

@api_router.get("/pub/{pub_code}", response_model=PubResponse)
async def get_pub(pub_code: str):
    pub = await db.pubs.find_one({"code": pub_code.upper()}, {"_id": 0, "admin_password": 0})
    if not pub:
        raise HTTPException(status_code=404, detail="Pub not found")
    return PubResponse(**pub)

# ============== AUTH ENDPOINTS ==============

@api_router.post("/auth/join", response_model=TokenResponse)
async def join_pub(data: UserJoin):
    pub = await db.pubs.find_one({"code": data.pub_code.upper()}, {"_id": 0})
    if not pub:
        raise HTTPException(status_code=404, detail="Pub not found")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "pub_id": pub["id"],
        "nickname": data.nickname,
        "is_admin": False,
        "joined_at": datetime.now(timezone.utc).isoformat(),
        "score": 0
    }
    
    await db.users.insert_one(user_doc)
    
    # Create index to ensure score field exists
    await db.users.create_index("pub_id")
    
    token = create_token({
        "user_id": user_id,
        "pub_id": pub["id"],
        "nickname": data.nickname,
        "is_admin": False
    })
    
    return TokenResponse(token=token, user={
        "id": user_id,
        "nickname": data.nickname,
        "pub_id": pub["id"],
        "pub_name": pub["name"],
        "is_admin": False
    })

@api_router.post("/auth/admin", response_model=TokenResponse)
async def admin_login(data: AdminLogin):
    pub = await db.pubs.find_one({"code": data.pub_code.upper()}, {"_id": 0})
    if not pub:
        raise HTTPException(status_code=404, detail="Pub not found")
    
    if not bcrypt.checkpw(data.password.encode(), pub["admin_password"].encode()):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    token = create_token({
        "user_id": "admin-" + pub["id"],
        "pub_id": pub["id"],
        "nickname": "Admin",
        "is_admin": True
    })
    
    return TokenResponse(token=token, user={
        "id": "admin-" + pub["id"],
        "nickname": "Admin",
        "pub_id": pub["id"],
        "pub_name": pub["name"],
        "is_admin": True
    })

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user

# ============== SONG REQUEST ENDPOINTS ==============

@api_router.post("/songs/request", response_model=SongRequestResponse)
async def request_song(song_data: SongRequestCreate, user: dict = Depends(get_current_user)):
    queue_count = await db.song_requests.count_documents({
        "pub_id": user["pub_id"],
        "status": {"$in": ["pending", "queued"]}
    })
    
    # AUTO-SEARCH: Se abilitato e non c'è già un URL, cerca automaticamente
    youtube_url = song_data.youtube_url
    auto_searched = False
    
    if AUTO_YOUTUBE_SEARCH and not youtube_url:
        youtube_url = await auto_search_youtube_karaoke(song_data.title, song_data.artist)
        auto_searched = True
        logging.info(f"Auto-searched YouTube for '{song_data.title}' by '{song_data.artist}': {youtube_url}")
    
    request_doc = {
        "id": str(uuid.uuid4()),
        "pub_id": user["pub_id"],
        "user_id": user["user_id"],
        "user_nickname": user["nickname"],
        "title": song_data.title,
        "artist": song_data.artist,
        "youtube_url": youtube_url,
        "auto_searched": auto_searched,  # Flag per sapere se è stato trovato automaticamente
        "status": "pending",
        "position": queue_count + 1,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.song_requests.insert_one(request_doc)
    
    # Broadcast new request to admin
    await manager.broadcast(user["pub_id"], {
        "type": "new_request",
        "data": {k: v for k, v in request_doc.items() if k != "_id"}
    })
    
    return SongRequestResponse(**request_doc)

@api_router.get("/songs/queue", response_model=List[SongRequestResponse])
async def get_song_queue(user: dict = Depends(get_current_user)):
    requests = await db.song_requests.find(
        {"pub_id": user["pub_id"], "status": {"$in": ["pending", "queued"]}},
        {"_id": 0}
    ).sort("position", 1).to_list(100)
    return requests

@api_router.get("/songs/my-requests", response_model=List[SongRequestResponse])
async def get_my_requests(user: dict = Depends(get_current_user)):
    requests = await db.song_requests.find(
        {"pub_id": user["pub_id"], "user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return requests

# ============== YOUTUBE SEARCH ==============

@api_router.get("/youtube/search")
async def search_youtube_karaoke(title: str, artist: str = "", admin: dict = Depends(get_admin_user)):
    """Search YouTube for karaoke version of a song"""
    if not YOUTUBE_API_KEY:
        raise HTTPException(status_code=500, detail="YouTube API key not configured")
    
    # Build search query
    query = f"{title} {artist} karaoke".strip()
    
    try:
        async with httpx.AsyncClient() as http:
            response = await http.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={
                    "part": "snippet",
                    "q": query,
                    "type": "video",
                    "maxResults": 5,
                    "key": YOUTUBE_API_KEY
                },
                timeout=10.0
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail=f"YouTube API error: {response.text}")
            
            data = response.json()
            results = []
            
            for item in data.get("items", []):
                video_id = item["id"]["videoId"]
                snippet = item["snippet"]
                results.append({
                    "video_id": video_id,
                    "title": snippet["title"],
                    "thumbnail": snippet["thumbnails"]["medium"]["url"],
                    "channel": snippet["channelTitle"],
                    "url": f"https://www.youtube.com/watch?v={video_id}"
                })
            
            return {"results": results, "query": query}
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Network error: {str(e)}")

# ============== ADMIN QUEUE MANAGEMENT ==============

@api_router.post("/admin/queue/approve/{request_id}")
async def approve_request(request_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.song_requests.update_one(
        {"id": request_id, "pub_id": admin["pub_id"]},
        {"$set": {"status": "queued"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await manager.broadcast(admin["pub_id"], {"type": "queue_updated"})
    return {"status": "approved"}

@api_router.post("/admin/queue/reject/{request_id}")
async def reject_request(request_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.song_requests.update_one(
        {"id": request_id, "pub_id": admin["pub_id"]},
        {"$set": {"status": "rejected"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await manager.broadcast(admin["pub_id"], {"type": "queue_updated"})
    return {"status": "rejected"}

@api_router.post("/admin/queue/reorder")
async def reorder_queue(order: List[str], admin: dict = Depends(get_admin_user)):
    for i, request_id in enumerate(order):
        await db.song_requests.update_one(
            {"id": request_id, "pub_id": admin["pub_id"]},
            {"$set": {"position": i + 1}}
        )
    
    await manager.broadcast(admin["pub_id"], {"type": "queue_updated"})
    return {"status": "reordered"}

# ============== PERFORMANCE ENDPOINTS ==============

@api_router.post("/admin/performance/start/{request_id}")
async def start_performance(request_id: str, youtube_url: str = Query(None), admin: dict = Depends(get_admin_user)):
    request = await db.song_requests.find_one({"id": request_id, "pub_id": admin["pub_id"]}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Use provided URL or the one from the request
    final_youtube_url = youtube_url or request.get("youtube_url")
    
    performance_doc = {
        "id": str(uuid.uuid4()),
        "pub_id": admin["pub_id"],
        "request_id": request_id,
        "user_id": request["user_id"],
        "user_nickname": request["user_nickname"],
        "song_title": request["title"],
        "song_artist": request["artist"],
        "youtube_url": final_youtube_url,
        "status": "live",
        "average_score": 0,
        "vote_count": 0,
        "voting_open": False,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None
    }
    
    await db.performances.insert_one(performance_doc)
    await db.song_requests.update_one({"id": request_id}, {"$set": {"status": "performing"}})
    await db.pubs.update_one({"id": admin["pub_id"]}, {"$set": {"current_performance_id": performance_doc["id"]}})
    
    await manager.broadcast(admin["pub_id"], {
        "type": "performance_started",
        "data": {k: v for k, v in performance_doc.items() if k != "_id"}
    })
    
    return {k: v for k, v in performance_doc.items() if k != "_id"}

@api_router.post("/admin/performance/pause/{performance_id}")
async def pause_performance(performance_id: str, admin: dict = Depends(get_admin_user)):
    """Pause current performance"""
    await db.performances.update_one(
        {"id": performance_id, "pub_id": admin["pub_id"]},
        {"$set": {"status": "paused"}}
    )
    
    await manager.broadcast(admin["pub_id"], {
        "type": "performance_paused",
        "data": {"performance_id": performance_id}
    })
    
    return {"status": "paused"}

@api_router.post("/admin/performance/resume/{performance_id}")
async def resume_performance(performance_id: str, admin: dict = Depends(get_admin_user)):
    """Resume paused performance"""
    await db.performances.update_one(
        {"id": performance_id, "pub_id": admin["pub_id"]},
        {"$set": {"status": "live"}}
    )
    
    await manager.broadcast(admin["pub_id"], {
        "type": "performance_resumed",
        "data": {"performance_id": performance_id}
    })
    
    return {"status": "resumed"}

@api_router.post("/admin/performance/restart/{performance_id}")
async def restart_performance(performance_id: str, admin: dict = Depends(get_admin_user)):
    """Restart performance from beginning"""
    await db.performances.update_one(
        {"id": performance_id, "pub_id": admin["pub_id"]},
        {"$set": {"status": "live", "started_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    performance = await db.performances.find_one({"id": performance_id}, {"_id": 0})
    
    await manager.broadcast(admin["pub_id"], {
        "type": "performance_restarted",
        "data": performance
    })
    
    return {"status": "restarted"}

@api_router.post("/admin/performance/open-voting/{performance_id}")
async def open_voting(performance_id: str, admin: dict = Depends(get_admin_user)):
    """Open voting without ending performance"""
    await db.performances.update_one(
        {"id": performance_id, "pub_id": admin["pub_id"]},
        {"$set": {"voting_open": True}}
    )
    
    performance = await db.performances.find_one({"id": performance_id}, {"_id": 0})
    
    await manager.broadcast(admin["pub_id"], {
        "type": "voting_opened",
        "data": {"performance_id": performance_id, "performance": performance}
    })
    
    return {"status": "voting_opened"}

@api_router.post("/admin/performance/end/{performance_id}")
async def end_performance(performance_id: str, admin: dict = Depends(get_admin_user)):
    """End performance and open voting"""
    performance = await db.performances.find_one({"id": performance_id, "pub_id": admin["pub_id"]}, {"_id": 0})
    if not performance:
        raise HTTPException(status_code=404, detail="Performance not found")
    
    await db.performances.update_one(
        {"id": performance_id},
        {"$set": {"status": "voting", "voting_open": True, "ended_at": datetime.now(timezone.utc).isoformat()}}
    )
    await db.song_requests.update_one({"id": performance["request_id"]}, {"$set": {"status": "completed"}})
    
    updated_perf = await db.performances.find_one({"id": performance_id}, {"_id": 0})
    
    await manager.broadcast(admin["pub_id"], {
        "type": "voting_started",
        "data": {"performance_id": performance_id, "performance": updated_perf}
    })
    
    return {"status": "voting_started"}

@api_router.post("/admin/performance/finish/{performance_id}")
async def finish_performance_no_voting(performance_id: str, admin: dict = Depends(get_admin_user)):
    """End performance WITHOUT opening voting - just finish it"""
    performance = await db.performances.find_one({"id": performance_id, "pub_id": admin["pub_id"]}, {"_id": 0})
    if not performance:
        raise HTTPException(status_code=404, detail="Performance not found")
    
    await db.performances.update_one(
        {"id": performance_id},
        {"$set": {"status": "completed", "voting_open": False, "ended_at": datetime.now(timezone.utc).isoformat()}}
    )
    await db.song_requests.update_one({"id": performance["request_id"]}, {"$set": {"status": "completed"}})
    await db.pubs.update_one({"id": admin["pub_id"]}, {"$set": {"current_performance_id": None}})
    
    await manager.broadcast(admin["pub_id"], {
        "type": "performance_finished",
        "data": {"performance_id": performance_id, "message": "Esibizione terminata"}
    })
    
    return {"status": "finished"}

@api_router.post("/admin/performance/close-voting/{performance_id}")
async def close_voting(performance_id: str, admin: dict = Depends(get_admin_user)):
    await db.performances.update_one(
        {"id": performance_id, "pub_id": admin["pub_id"]},
        {"$set": {"status": "completed", "voting_open": False}}
    )
    await db.pubs.update_one({"id": admin["pub_id"]}, {"$set": {"current_performance_id": None}})
    
    performance = await db.performances.find_one({"id": performance_id}, {"_id": 0})
    
    await manager.broadcast(admin["pub_id"], {
        "type": "voting_closed",
        "data": {
            "performance_id": performance_id,
            "average_score": performance.get("average_score", 0),
            "vote_count": performance.get("vote_count", 0)
        }
    })
    
    return {"status": "completed"}

@api_router.post("/admin/performance/next")
async def next_performance(admin: dict = Depends(get_admin_user)):
    """Skip to next queued song"""
    # Close current performance if exists
    pub = await db.pubs.find_one({"id": admin["pub_id"]}, {"_id": 0})
    if pub.get("current_performance_id"):
        await db.performances.update_one(
            {"id": pub["current_performance_id"]},
            {"$set": {"status": "skipped", "ended_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    # Get next queued song
    next_song = await db.song_requests.find_one(
        {"pub_id": admin["pub_id"], "status": "queued"},
        {"_id": 0},
        sort=[("position", 1)]
    )
    
    if not next_song:
        await db.pubs.update_one({"id": admin["pub_id"]}, {"$set": {"current_performance_id": None}})
        await manager.broadcast(admin["pub_id"], {"type": "no_more_songs"})
        return {"status": "no_more_songs"}
    
    # Start next performance
    return await start_performance(next_song["id"], next_song.get("youtube_url"), admin)

@api_router.get("/performance/current")
async def get_current_performance(user: dict = Depends(get_current_user)):
    pub = await db.pubs.find_one({"id": user["pub_id"]}, {"_id": 0})
    if not pub or not pub.get("current_performance_id"):
        return None
    
    performance = await db.performances.find_one(
        {"id": pub["current_performance_id"]},
        {"_id": 0}
    )
    return performance

@api_router.get("/performances/history", response_model=List[PerformanceResponse])
async def get_performance_history(user: dict = Depends(get_current_user)):
    performances = await db.performances.find(
        {"pub_id": user["pub_id"]},
        {"_id": 0}
    ).sort("started_at", -1).to_list(50)
    return performances

# ============== VOTING ENDPOINTS ==============

@api_router.post("/votes/submit")
async def submit_vote(vote_data: VoteCreate, user: dict = Depends(get_current_user)):
    if vote_data.score < 1 or vote_data.score > 5:
        raise HTTPException(status_code=400, detail="Score must be 1-5")
    
    performance = await db.performances.find_one(
        {"id": vote_data.performance_id, "pub_id": user["pub_id"]},
        {"_id": 0}
    )
    if not performance:
        raise HTTPException(status_code=404, detail="Performance not found")
    
    if not performance.get("voting_open"):
        raise HTTPException(status_code=400, detail="Voting not open")
    
    if performance["user_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot vote for yourself")
    
    existing_vote = await db.votes.find_one({
        "performance_id": vote_data.performance_id,
        "user_id": user["user_id"]
    })
    if existing_vote:
        raise HTTPException(status_code=400, detail="Already voted")
    
    vote_doc = {
        "id": str(uuid.uuid4()),
        "performance_id": vote_data.performance_id,
        "pub_id": user["pub_id"],
        "user_id": user["user_id"],
        "score": vote_data.score,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.votes.insert_one(vote_doc)
    
    # Update performance average
    votes = await db.votes.find({"performance_id": vote_data.performance_id}, {"_id": 0}).to_list(1000)
    avg_score = sum(v["score"] for v in votes) / len(votes)
    
    await db.performances.update_one(
        {"id": vote_data.performance_id},
        {"$set": {"average_score": round(avg_score, 2), "vote_count": len(votes)}}
    )
    
    await manager.broadcast(user["pub_id"], {
        "type": "vote_received",
        "data": {"performance_id": vote_data.performance_id, "new_average": round(avg_score, 2), "vote_count": len(votes)}
    })
    
    return {"status": "voted", "new_average": round(avg_score, 2)}

# ============== REACTION ENDPOINTS ==============

REACTION_LIMIT_PER_USER = 3  # Max reactions per user per performance

@api_router.post("/reactions/send")
async def send_reaction(reaction_data: ReactionCreate, user: dict = Depends(get_current_user)):
    # Get current performance to check if there's an active one
    pub = await db.pubs.find_one({"id": user["pub_id"]}, {"_id": 0})
    perf_id = pub.get("current_performance_id") if pub else None
    
    reaction_count = 0
    # Check reaction limit for this performance
    if perf_id:
        reaction_count = await db.reactions.count_documents({
            "pub_id": user["pub_id"],
            "user_id": user["user_id"],
            "performance_id": perf_id
        })
        if reaction_count >= REACTION_LIMIT_PER_USER:
            raise HTTPException(status_code=400, detail=f"Limite raggiunto! Max {REACTION_LIMIT_PER_USER} reazioni per esibizione")
    
    reaction_doc = {
        "id": str(uuid.uuid4()),
        "pub_id": user["pub_id"],
        "user_id": user["user_id"],
        "user_nickname": user["nickname"],
        "performance_id": perf_id,
        "emoji": reaction_data.emoji,
        "message": reaction_data.message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.reactions.insert_one(reaction_doc)
    
    # Get remaining reactions for this user
    remaining = REACTION_LIMIT_PER_USER - (reaction_count + 1) if perf_id else REACTION_LIMIT_PER_USER
    
    await manager.broadcast(user["pub_id"], {
        "type": "reaction",
        "data": {k: v for k, v in reaction_doc.items() if k != "_id"}
    })
    
    return {"status": "sent", "remaining": remaining}

@api_router.get("/reactions/remaining")
async def get_remaining_reactions(user: dict = Depends(get_current_user)):
    """Get how many reactions the user can still send for current performance"""
    pub = await db.pubs.find_one({"id": user["pub_id"]}, {"_id": 0})
    perf_id = pub.get("current_performance_id") if pub else None
    
    if not perf_id:
        return {"remaining": REACTION_LIMIT_PER_USER, "limit": REACTION_LIMIT_PER_USER}
    
    reaction_count = await db.reactions.count_documents({
        "pub_id": user["pub_id"],
        "user_id": user["user_id"],
        "performance_id": perf_id
    })
    
    return {"remaining": max(0, REACTION_LIMIT_PER_USER - reaction_count), "limit": REACTION_LIMIT_PER_USER}

# ============== MESSAGE ENDPOINTS (for overlay) ==============

@api_router.post("/messages/send")
async def send_message(message_data: MessageCreate, user: dict = Depends(get_current_user)):
    """Send a message that needs admin approval before showing on display"""
    message_doc = {
        "id": str(uuid.uuid4()),
        "pub_id": user["pub_id"],
        "user_id": user["user_id"],
        "user_nickname": user["nickname"],
        "text": message_data.text[:100],  # Limit to 100 chars
        "status": "pending",  # pending, approved, rejected
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messages.insert_one(message_doc)
    
    # Notify admin of new message
    await manager.broadcast(user["pub_id"], {
        "type": "new_message",
        "data": {k: v for k, v in message_doc.items() if k != "_id"}
    })
    
    return {"status": "sent", "id": message_doc["id"]}

@api_router.get("/messages/pending")
async def get_pending_messages(admin: dict = Depends(get_admin_user)):
    """Get all pending messages for admin to approve"""
    messages = await db.messages.find(
        {"pub_id": admin["pub_id"], "status": "pending"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(50)
    return messages

@api_router.post("/admin/messages/approve/{message_id}")
async def approve_message(message_id: str, admin: dict = Depends(get_admin_user)):
    """Approve a message to show on display"""
    message = await db.messages.find_one({"id": message_id, "pub_id": admin["pub_id"]}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    await db.messages.update_one({"id": message_id}, {"$set": {"status": "approved"}})
    
    # Broadcast approved message to display
    await manager.broadcast(admin["pub_id"], {
        "type": "message_approved",
        "data": message
    })
    
    return {"status": "approved"}

@api_router.post("/admin/messages/reject/{message_id}")
async def reject_message(message_id: str, admin: dict = Depends(get_admin_user)):
    """Reject a message"""
    await db.messages.update_one(
        {"id": message_id, "pub_id": admin["pub_id"]},
        {"$set": {"status": "rejected"}}
    )
    return {"status": "rejected"}

# ============== QUIZ ENDPOINTS ==============

@api_router.get("/quiz/categories")
async def get_quiz_categories():
    """Get available preset quiz categories"""
    categories = []
    for cat_id, cat_data in PRESET_QUIZZES.items():
        categories.append({
            "id": cat_id,
            "name": cat_data["name"],
            "description": cat_data["description"],
            "icon": cat_data["icon"],
            "questions_count": len(cat_data["questions"])
        })
    return categories

@api_router.post("/admin/quiz/start-session/{category_id}")
async def start_quiz_session(category_id: str, num_questions: int = 5, admin: dict = Depends(get_admin_user)):
    """Start a multi-question quiz session from a category"""
    if category_id not in PRESET_QUIZZES:
        raise HTTPException(status_code=404, detail="Category not found")
    
    category = PRESET_QUIZZES[category_id]
    import random
    
    # Get random questions (up to available)
    available_questions = category["questions"]
    num_q = min(num_questions, len(available_questions))
    selected_questions = random.sample(available_questions, num_q)
    
    session_doc = {
        "id": str(uuid.uuid4()),
        "pub_id": admin["pub_id"],
        "category": category_id,
        "category_name": category["name"],
        "questions": selected_questions,
        "current_question_index": 0,
        "total_questions": num_q,
        "status": "active",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None
    }
    
    await db.quiz_sessions.insert_one(session_doc)
    
    # Start first question
    first_q = selected_questions[0]
    quiz_doc = {
        "id": str(uuid.uuid4()),
        "session_id": session_doc["id"],
        "pub_id": admin["pub_id"],
        "category": category_id,
        "category_name": category["name"],
        "question_number": 1,
        "total_questions": num_q,
        "question": first_q["question"],
        "options": first_q["options"],
        "correct_index": first_q["correct_index"],
        "points": 10,
        "status": "active",
        "started_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.quizzes.insert_one(quiz_doc)
    
    await manager.broadcast(admin["pub_id"], {
        "type": "quiz_started",
        "data": {
            "id": quiz_doc["id"],
            "session_id": session_doc["id"],
            "category": category_id,
            "category_name": category["name"],
            "question": quiz_doc["question"],
            "options": quiz_doc["options"],
            "points": quiz_doc["points"],
            "question_number": 1,
            "total_questions": num_q
        }
    })
    
    return {
        "session_id": session_doc["id"],
        "quiz_id": quiz_doc["id"],
        "question_number": 1,
        "total_questions": num_q,
        "question": quiz_doc["question"],
        "options": quiz_doc["options"]
    }

@api_router.post("/admin/quiz/start-preset/{category_id}")
async def start_preset_quiz(category_id: str, admin: dict = Depends(get_admin_user)):
    """Start a single preset quiz question from a category (backward compatible)"""
    if category_id not in PRESET_QUIZZES:
        raise HTTPException(status_code=404, detail="Category not found")
    
    category = PRESET_QUIZZES[category_id]
    import random
    question = random.choice(category["questions"])
    
    quiz_doc = {
        "id": str(uuid.uuid4()),
        "pub_id": admin["pub_id"],
        "category": category_id,
        "category_name": category["name"],
        "question": question["question"],
        "options": question["options"],
        "correct_index": question["correct_index"],
        "points": 10,
        "status": "active",
        "question_number": 1,
        "total_questions": 1,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "answers": []
    }
    
    await db.quizzes.insert_one(quiz_doc)
    
    await manager.broadcast(admin["pub_id"], {
        "type": "quiz_started",
        "data": {
            "id": quiz_doc["id"],
            "category": category_id,
            "category_name": category["name"],
            "question": quiz_doc["question"],
            "options": quiz_doc["options"],
            "points": quiz_doc["points"],
            "question_number": 1,
            "total_questions": 1
        }
    })
    
    return {k: v for k, v in quiz_doc.items() if k not in ["_id", "correct_index"]}

@api_router.post("/admin/quiz/next-question/{session_id}")
async def next_quiz_question(session_id: str, admin: dict = Depends(get_admin_user)):
    """Move to next question in a quiz session"""
    session = await db.quiz_sessions.find_one({"id": session_id, "pub_id": admin["pub_id"]}, {"_id": 0})
    if not session or session["status"] != "active":
        raise HTTPException(status_code=404, detail="Quiz session not found or ended")
    
    # End current question
    await db.quizzes.update_many(
        {"session_id": session_id, "status": "active"},
        {"$set": {"status": "ended"}}
    )
    
    next_index = session["current_question_index"] + 1
    
    if next_index >= session["total_questions"]:
        # Quiz finished
        await db.quiz_sessions.update_one(
            {"id": session_id},
            {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Get final leaderboard for this session
        leaderboard = await db.users.find(
            {"pub_id": admin["pub_id"]},
            {"_id": 0, "nickname": 1, "score": 1}
        ).sort("score", -1).to_list(10)
        
        await manager.broadcast(admin["pub_id"], {
            "type": "quiz_session_ended",
            "data": {
                "session_id": session_id,
                "message": "Quiz terminato!",
                "leaderboard": leaderboard
            }
        })
        
        return {"status": "session_ended", "leaderboard": leaderboard}
    
    # Update session
    await db.quiz_sessions.update_one(
        {"id": session_id},
        {"$set": {"current_question_index": next_index}}
    )
    
    # Create next question
    next_q = session["questions"][next_index]
    quiz_doc = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "pub_id": admin["pub_id"],
        "category": session["category"],
        "category_name": session["category_name"],
        "question_number": next_index + 1,
        "total_questions": session["total_questions"],
        "question": next_q["question"],
        "options": next_q["options"],
        "correct_index": next_q["correct_index"],
        "points": 10,
        "status": "active",
        "started_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.quizzes.insert_one(quiz_doc)
    
    await manager.broadcast(admin["pub_id"], {
        "type": "quiz_started",
        "data": {
            "id": quiz_doc["id"],
            "session_id": session_id,
            "category": session["category"],
            "category_name": session["category_name"],
            "question": quiz_doc["question"],
            "options": quiz_doc["options"],
            "points": quiz_doc["points"],
            "question_number": next_index + 1,
            "total_questions": session["total_questions"]
        }
    })
    
    return {
        "quiz_id": quiz_doc["id"],
        "question_number": next_index + 1,
        "total_questions": session["total_questions"],
        "question": quiz_doc["question"],
        "options": quiz_doc["options"]
    }

@api_router.post("/admin/quiz/start")
async def start_quiz(quiz_data: QuizQuestionCreate, admin: dict = Depends(get_admin_user)):
    quiz_doc = {
        "id": str(uuid.uuid4()),
        "pub_id": admin["pub_id"],
        "category": quiz_data.category or "custom",
        "question": quiz_data.question,
        "options": quiz_data.options,
        "correct_index": quiz_data.correct_index,
        "points": quiz_data.points,
        "status": "active",
        "question_number": 1,
        "total_questions": 1,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "answers": []
    }
    
    await db.quizzes.insert_one(quiz_doc)
    
    await manager.broadcast(admin["pub_id"], {
        "type": "quiz_started",
        "data": {
            "id": quiz_doc["id"],
            "question": quiz_doc["question"],
            "options": quiz_doc["options"],
            "points": quiz_doc["points"],
            "question_number": 1,
            "total_questions": 1
        }
    })
    
    return {k: v for k, v in quiz_doc.items() if k not in ["_id", "correct_index"]}

@api_router.post("/quiz/answer")
async def answer_quiz(answer_data: QuizAnswerSubmit, user: dict = Depends(get_current_user)):
    quiz = await db.quizzes.find_one(
        {"id": answer_data.quiz_id, "pub_id": user["pub_id"], "status": "active"},
        {"_id": 0}
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found or closed")
    
    # Check if already answered
    existing = await db.quiz_answers.find_one({
        "quiz_id": answer_data.quiz_id,
        "user_id": user["user_id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already answered")
    
    is_correct = answer_data.answer_index == quiz["correct_index"]
    points_earned = quiz["points"] if is_correct else 0
    
    answer_doc = {
        "id": str(uuid.uuid4()),
        "quiz_id": answer_data.quiz_id,
        "pub_id": user["pub_id"],
        "user_id": user["user_id"],
        "user_nickname": user["nickname"],
        "answer_index": answer_data.answer_index,
        "is_correct": is_correct,
        "points_earned": points_earned,
        "answered_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.quiz_answers.insert_one(answer_doc)
    
    if is_correct:
        # Use upsert to create user if not exists, and increment score
        await db.users.update_one(
            {"id": user["user_id"]},
            {
                "$inc": {"score": points_earned},
                "$setOnInsert": {
                    "pub_id": user["pub_id"],
                    "nickname": user["nickname"],
                    "is_admin": False,
                    "joined_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
    
    return {"is_correct": is_correct, "points_earned": points_earned}

@api_router.post("/admin/quiz/end/{quiz_id}")
async def end_quiz(quiz_id: str, admin: dict = Depends(get_admin_user)):
    quiz = await db.quizzes.find_one({"id": quiz_id, "pub_id": admin["pub_id"]}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    await db.quizzes.update_one({"id": quiz_id}, {"$set": {"status": "ended"}})
    
    answers = await db.quiz_answers.find({"quiz_id": quiz_id}, {"_id": 0}).to_list(1000)
    correct_answers = [a for a in answers if a["is_correct"]]
    
    await manager.broadcast(admin["pub_id"], {
        "type": "quiz_ended",
        "data": {
            "quiz_id": quiz_id,
            "correct_answer": quiz["correct_index"],
            "correct_option": quiz["options"][quiz["correct_index"]],
            "winners": [a["user_nickname"] for a in correct_answers],
            "total_answers": len(answers)
        }
    })
    
    return {"status": "ended", "winners": len(correct_answers)}

@api_router.get("/quiz/active")
async def get_active_quiz(user: dict = Depends(get_current_user)):
    quiz = await db.quizzes.find_one(
        {"pub_id": user["pub_id"], "status": "active"},
        {"_id": 0, "correct_index": 0}
    )
    return quiz

# ============== ADMIN EFFECTS ==============

@api_router.post("/admin/effects/send")
async def send_effect(effect_data: AdminEffectCreate, admin: dict = Depends(get_admin_user)):
    await manager.broadcast(admin["pub_id"], {
        "type": "effect",
        "data": {
            "effect_type": effect_data.effect_type,
            "data": effect_data.data
        }
    })
    return {"status": "sent"}

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
            # Handle ping/pong for connection keep-alive
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, pub["id"])

# ============== ROOT ==============

@api_router.get("/")
async def root():
    return {"message": "NeonPub Karaoke API", "version": "1.1.0"}

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
