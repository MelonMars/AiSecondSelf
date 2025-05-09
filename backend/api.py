from fastapi import FastAPI, Depends, HTTPException, status, Header, Body, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel, Field
from fastapi.logger import logger
from typing import List, Optional, Dict, Any
import requests
import time
import firebase_admin
from firebase_admin import credentials, firestore, auth
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import json


if not firebase_admin._apps:
    cred = credentials.Certificate("aisecondself-8a616-firebase-adminsdk-fbsvc-3341d01ff4.json")
    firebase_admin.initialize_app(cred)

db = firestore.client()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

async def verify_token(authorization: str = Header(...)) -> Dict:
    print("Verifying token...")
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )

    id_token = authorization.split(" ")[1]
    try:
        decoded_token = auth.verify_id_token(id_token)
        print(f"Decoded token: {decoded_token}")
        return decoded_token
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    

@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI application!"}

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    bulletProse: str

class ChatResponse(BaseModel):
    reply: str

class UserRegistration(BaseModel):
    email: str
    password: str
    name: str
    
class UserLogin(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    token: str
    uid: str
    name: Optional[str] = None

class DocumentRequest(BaseModel):
    bulletProse: str

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, user_info: dict = Depends(verify_token)):
    if request.messages:
        url = "https://ai.hackclub.com/chat/completions"
        headers = {
            "Content-Type": "application/json",
        }
        data = {
            "messages": [message.dict() for message in request.messages],
            "model": "llama-3.3-70b-versatile"
        }

        user_ref = db.collection("users").document(user_info["uid"])
        user_doc = user_ref.get()
        user_data = user_doc.to_dict() if user_doc.exists else {"name": "User"}
        username = user_data.get("name", "User")
        
        prompt = open("prompt.txt", "r").read()
        prompt = prompt.replace("{bulletProse}", request.bulletProse)
        prompt = prompt.replace("{name}", user_data.get("name", "User"))
        prompt = prompt.replace("{date}", time.strftime("%Y-%m-%d"))
        prompt = prompt.replace("{time}", time.strftime("%H:%M:%S"))
        prompt = prompt.replace("{location}", "NYC")
        prompt = prompt.replace("{user}", username)
        MAX_WORDS = 120000

        total_length = 0
        truncated_messages = []

        for message in data["messages"]:
            message_words = message["content"].split()
            if total_length + len(message_words) > MAX_WORDS:
                remaining_words = MAX_WORDS - total_length
                if remaining_words > 0:
                    truncated_content = ' '.join(message_words[:remaining_words])
                    truncated_messages.append({
                        **message,
                        "content": truncated_content
                    })
                break
            else:
                truncated_messages.append(message)
                total_length += len(message_words)

        if total_length >= MAX_WORDS:
            logger.warning("Total message length exceeds 120000 words, messages have been truncated")

        data["messages"] = truncated_messages
        data["messages"] = [{"role": "system", "content": prompt}] + data["messages"]
        print("Messages sent to AI:", data["messages"])
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 200:
            response_data = response.json()
            print(f"Response from AI: {response_data}")
            if "choices" in response_data and len(response_data["choices"]) > 0:
                reply = response_data["choices"][0]["message"]["content"]
                if "<GRAPH>" in reply:
                    graph_string = reply.split("<GRAPH>")[1].split("</GRAPH>")[0]
                    try:
                        graph_data = json.loads(graph_string)
                        user_ref.update({
                            "edges": graph_data["edges"],
                            "nodes": graph_data["nodes"]
                        })
                        print("Graph data updated in Firestore")
                        return ChatResponse(reply=reply.replace(graph_string, "").replace("<GRAPH>", "").replace("</GRAPH>", ""))
                    except json.JSONDecodeError as e:
                        logger.error(f"Error decoding JSON: {e}")
                        print("Error decoding JSON:", e)
                        return ChatResponse(reply="Error processing graph data")
                return ChatResponse(reply=reply)
            else:
                logger.error("No choices found in the response")
                return ChatResponse(reply="No valid response from AI")
        else:
            logger.error(f"Error from AI: {response.status_code} - {response.text}")
            return ChatResponse(reply="Error communicating with AI")
        logger.error(f"Error from AI: {response.status_code} - {response.text}")
    else:
        return ChatResponse(reply="No messages received")

@app.post("/update_graph_with_doc", response_model=ChatResponse)
async def update_graph_with_doc(
    bulletProse: str = Form(...),
    txt_file: UploadFile = File(...),
    user_info: dict = Depends(verify_token)
):
    if not txt_file.filename.endswith(".txt"):
        return ChatResponse(message="only .txt files are supported")

    url = "https://ai.hackclub.com/chat/completions"
    headers = {
        "Content-Type": "application/json",
    }
    try:
        content = await txt_file.read()
        text = content.decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"Error reading file: {str(e)}")
        return ChatResponse(message=f"Error reading file: {str(e)}")

    system_prompt = open("uploadprompt.txt", "r").read()
    system_prompt = system_prompt.replace("{userGraph}", bulletProse)
    data = {
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": "Please update the graph based on the following text: " + text
            }
        ],
    }
    user_ref = db.collection("users").document(user_info["uid"])

    response = requests.post(url, headers=headers, json=data)
    if response.status_code == 200:
        response_data = response.json()
        print(f"Response from AI: {response_data}")
        if "choices" in response_data and len(response_data["choices"]) > 0:
            reply = response_data["choices"][0]["message"]["content"]
            if "<GRAPH>" in reply:
                graph_string = reply.split("<GRAPH>")[1].split("</GRAPH>")[0]
                try:
                    graph_data = json.loads(graph_string)
                    user_ref.update({
                        "edges": graph_data["edges"],
                        "nodes": graph_data["nodes"]
                    })
                    print("Graph data updated in Firestore")
                    return ChatResponse(reply=reply.replace(graph_string, "").replace("<GRAPH>", "").replace("</GRAPH>", ""))
                except json.JSONDecodeError as e:
                    logger.error(f"Error decoding JSON: {e}")
                    print("Error decoding JSON:", e)
                    return ChatResponse(reply="Error processing graph data")
            return ChatResponse(reply=reply)
        else:
            logger.error("No choices found in the response")
            return ChatResponse(reply="No valid response from AI")
    else:
        logger.error(f"Error from AI: {response.status_code} - {response.text}")
        return ChatResponse(reply="Error communicating with AI")

@app.post("/signup", response_model=AuthResponse)
async def signup_user(user_data: UserRegistration):
    try:
        user = auth.create_user(
            email=user_data.email,
            password=user_data.password
        )
        
        user_ref = db.collection("users").document(user.uid)
        user_ref.set({
            "name": user_data.name,
            "email": user_data.email,
            "Graph": {}
        })
        
        custom_token = auth.create_custom_token(user.uid)
        
        return AuthResponse(
            token=custom_token.decode('utf-8'),
            uid=user.uid,
            name=user_data.name
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error creating user: {str(e)}"
        )


@app.get("/user_data")
async def get_user_data(user_info: dict = Depends(verify_token)):
    try:
        user_ref = db.collection("users").document(user_info["uid"])
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User data not found"
            )
            
        user_data = user_doc.to_dict()
        graph = {
            "nodes": user_data.get("nodes", []),
            "edges": user_data.get("edges", []),
        }
        return graph
    except Exception as e:
        print(f"Error retrieving user data: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving user data: {str(e)}"
        )

@app.post("/user_data")
async def update_user_data(user_info: dict = Depends(verify_token), user_data: dict = Body(...)):
    print("Updating user data...")
    print(f"User data: {user_data}")
    try:
        user_ref = db.collection("users").document(user_info["uid"])
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_ref.update({
            "nodes": user_data["user_data"].get("nodes", []),
            "edges": user_data["user_data"].get("edges", []),
        })
        
        return {"message": "User data updated successfully"}
    except Exception as e:
        print(f"Error updating user data: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating user data: {str(e)}"
        )

@app.get("/username")
async def username(user_info: dict = Depends(verify_token)):
    try:
        user_ref = db.collection("users").document(user_info["uid"])
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_data = user_doc.to_dict()
        username = user_data.get("name", "User")
        print(f"Username retrieved: {username}")
        return {"name": username}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving username: {str(e)}"
        )


if __name__ == "__main__":
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True, log_level="info")