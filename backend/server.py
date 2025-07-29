from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.websockets import WebSocketState
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import uuid
from datetime import datetime
import json
import asyncio


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            
    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_text(message)
                
    async def send_to_session(self, message: dict, session_id: str):
        # Send message to all participants in a session
        session = await db.interview_sessions.find_one({"session_id": session_id})
        if session:
            for participant_id in [session.get("candidate_id"), session.get("hr_id")]:
                if participant_id and participant_id in self.active_connections:
                    websocket = self.active_connections[participant_id]
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_text(json.dumps(message))

manager = ConnectionManager()

# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class User(BaseModel):
    user_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    role: str  # "candidate" or "hr"
    session_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    name: str
    role: str

class InterviewSession(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    candidate_id: Optional[str] = None
    hr_id: Optional[str] = None
    status: str = "waiting"  # waiting, active, completed
    sign_language: str = "ASL"  # American Sign Language by default
    created_at: datetime = Field(default_factory=datetime.utcnow)
    messages: List[Dict] = []

class SessionCreate(BaseModel):
    sign_language: str = "ASL"

class Message(BaseModel):
    session_id: str
    sender_id: str
    sender_role: str
    message_type: str  # "sign_to_text", "text_to_speech", "text_to_sign"
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Sign Language Interview Tool API"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# User management endpoints
@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate):
    user_dict = user_data.dict()
    user_obj = User(**user_dict)
    await db.users.insert_one(user_obj.dict())
    return user_obj

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**user)

# Session management endpoints
@api_router.post("/sessions", response_model=InterviewSession)
async def create_session(session_data: SessionCreate):
    session_dict = session_data.dict()
    session_obj = InterviewSession(**session_dict)
    await db.interview_sessions.insert_one(session_obj.dict())
    return session_obj

@api_router.get("/sessions/{session_id}", response_model=InterviewSession)
async def get_session(session_id: str):
    session = await db.interview_sessions.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return InterviewSession(**session)

@api_router.post("/sessions/{session_id}/join")
async def join_session(session_id: str, user_id: str, role: str):
    # Update session with participant
    session = await db.interview_sessions.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    update_data = {}
    if role == "candidate":
        update_data["candidate_id"] = user_id
    elif role == "hr":
        update_data["hr_id"] = user_id
    
    # Check if both participants are present
    if role == "candidate" and session.get("hr_id"):
        update_data["status"] = "active"
    elif role == "hr" and session.get("candidate_id"):
        update_data["status"] = "active"
        
    await db.interview_sessions.update_one(
        {"session_id": session_id}, 
        {"$set": update_data}
    )
    
    # Update user's session_id
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"session_id": session_id}}
    )
    
    return {"message": "Joined session successfully", "status": update_data.get("status", "waiting")}

@api_router.post("/sessions/{session_id}/messages")
async def send_message(session_id: str, message: Message):
    # Store message in database
    message_dict = message.dict()
    await db.interview_sessions.update_one(
        {"session_id": session_id},
        {"$push": {"messages": message_dict}}
    )
    
    # Send to all participants via WebSocket
    await manager.send_to_session(message_dict, session_id)
    
    return {"message": "Message sent successfully"}

# WebSocket endpoint
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Handle different message types
            if message_data.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif message_data.get("type") == "message":
                # Forward message to session participants
                session_id = message_data.get("session_id")
                if session_id:
                    await manager.send_to_session(message_data, session_id)
                    
    except WebSocketDisconnect:
        manager.disconnect(user_id)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
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
