from fastapi import FastAPI, Depends, HTTPException, status, Header, Body, File, UploadFile, Form, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
from pydantic import BaseModel, Field
from fastapi.logger import logger
from typing import List, Optional, Dict, Any, AsyncGenerator
import requests
import time
import firebase_admin
from firebase_admin import credentials, firestore, auth
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import json
import datetime
import logging
import os
import google.generativeai as genai

cred = ""
gemini_cred = ""
if not firebase_admin._apps:
    # use my Mac service account or my Desktop service account
    if os.name == 'posix':
        cred = credentials.Certificate("aisecondself-8a616-firebase-adminsdk-fbsvc-83bb9cb5c9.json")
        gemini_cred = open("geminikey.txt", "r").read()
    else:
        cred = credentials.Certificate("aisecondself-8a616-firebase-adminsdk-fbsvc-3341d01ff4.json")
    firebase_admin.initialize_app(cred)

print("Got gemini cred: ", gemini_cred)
client = genai.configure(api_key="AIzaSyA9z3L28gtJ91FJpl-YX3Bam00UCVF6Qyw")

db = firestore.client()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Conversation-Id"] 
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
    print(f"ID Token: {id_token}")
    try:
        time.sleep(0.5)
        decoded_token = auth.verify_id_token(id_token)
        print(f"Decoded token: {decoded_token}")
        return decoded_token
    except Exception as e:
        print(f"Error verifying token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
async def optional_verify_token(authorization: str = Header(None)) -> Optional[Dict]:
    if authorization is None:
        return None
    else:
        return await verify_token(authorization)
    

@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI application!"}

class Message(BaseModel):
    role: str
    content: str
    timestamp: Optional[datetime.datetime] = Field(default_factory=datetime.datetime.now)

    class Config:
        arbitrary_types_allowed = True

class ChatRequest(BaseModel):
    messages: List[Message]
    bulletProse: str

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

class ConversationSummary(BaseModel):
    id: str
    title: str
    last_updated: datetime.datetime
    starred: bool

class Conversation(BaseModel):
    id: str
    user_id: str
    title: str
    messages: List[Message]
    created_at: datetime.datetime
    last_updated: datetime.datetime
    starred: bool
    shared: bool
    parent_conversation_id: Optional[str] = None
    branch_from_message_index: Optional[int] = None
    forked_from_message_id: Optional[str] = None
    children_branches: Optional[List[dict]] = []

class ChatRequest(BaseModel):
    messages: List[dict]
    bulletProse: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    conversation_id: Optional[str] = None 

class EditRequest(BaseModel):
    conversation_id: str
    message_index: int
    new_message_content: str
    bulletProse: str = ""

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.get("/conversations", response_model=List[ConversationSummary])
async def list_conversations(user_info: dict = Depends(verify_token)):
    user_uid = user_info["uid"]
    conversations_ref = db.collection("users").document(user_uid).collection("conversations")

    try:
        docs = conversations_ref.order_by("last_updated", direction=firestore.Query.DESCENDING).get()

        summaries: List[ConversationSummary] = []
        for doc in docs:
            data = doc.to_dict()
            if data.get("parent_conversation_id") is not None:
                continue
            summary = ConversationSummary(
                id=doc.id,
                title=data.get("title", "Untitled Conversation"),
                last_updated=data.get("last_updated", datetime.datetime.min),
                starred=data.get("starred", False)
            )
            summaries.append(summary)

        logger.info(f"Listed {len(summaries)} conversations for user {user_uid}")
        return summaries

    except Exception as e:
        logger.error(f"Error listing conversations for user {user_uid}: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving conversations")

@app.get("/conversations/{owner_id}/{conversation_id}", response_model=Conversation)
async def get_conversation(
    conversation_id: str,
    owner_id: str,
    user_info: dict = Depends(verify_token)
):
    caller_uid = user_info["uid"]

    conversation_ref = db.collection("users").document(owner_id).collection("conversations").document(conversation_id)

    user_ref = db.collection("users").document(owner_id)

    try:
        doc = conversation_ref.get()

        if not doc.exists:
            logger.warning(f"Conversation {conversation_id} not found for owner {owner_id} (requested by {caller_uid})")
            raise HTTPException(status_code=404, detail="Conversation not found")

        data = doc.to_dict()

        conversation_owner_uid = data.get("user_id")
        is_shared = data.get("shared", False)

        if conversation_owner_uid != caller_uid and not is_shared:
             logger.warning(f"User {caller_uid} attempted to access unshared conversation {conversation_id} owned by {conversation_owner_uid}")
             raise HTTPException(status_code=403, detail="Not authorized to access this conversation")


        messages = [
             Message(role=msg['role'], content=msg['content'], timestamp=msg.get('timestamp', datetime.datetime.min))
             for msg in data.get('messages', [])
        ]

        conversation = Conversation(
            id=doc.id,
            user_id=conversation_owner_uid,
            title=data.get("title", "Untitled Conversation"),
            messages=messages,
            created_at=data.get("created_at", data.get('_createdAt', datetime.datetime.min)),
            last_updated=data.get("last_updated", data.get('_updatedAt', datetime.datetime.min)),
            starred=data.get("starred", False),
            shared=is_shared,
            parent_conversation_id=data.get("parent_conversation_id"),
            branch_from_message_index=data.get("branch_from_message_index"),
            forked_from_message_id=data.get("forked_from_message_id"),
        )

        if conversation_owner_uid == caller_uid:
             logger.info(f"Owner {caller_uid} retrieved conversation {conversation_id}.")
        elif is_shared:
             logger.info(f"User {caller_uid} retrieved shared conversation {conversation_id} owned by {conversation_owner_uid}.")


        children_snapshot = user_ref.collection("conversations").where("parent_conversation_id", "==", conversation_id).get()
        conversation.children_branches = []
        for child_doc in children_snapshot:
            child_data = child_doc.to_dict()
            conversation.children_branches.append({
                "id": child_doc.id,
                "title": child_data.get("title", "Untitled Branch"),
                "branch_from_message_index": child_data.get("branch_from_message_index")
            })
        logger.info(f"Found {len(conversation.children_branches)} child branches for conversation {conversation_id}.")

        return conversation


    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving conversation {conversation_id} for owner {owner_id} (accessed by {caller_uid}): {e}")
        raise HTTPException(status_code=500, detail="Error retrieving conversation")

async def post_stream_save_to_db(
    user_ref: firestore.DocumentReference,
    conversation_ref: firestore.DocumentReference,
    all_messages: List[Message],
    full_ai_reply: str,
    is_brand_new_conversation: bool
):
    logger.info(f"Background task started for conversation: {conversation_ref.id}")
    ai_message = Message(role="assistant", content=full_ai_reply, timestamp=datetime.datetime.now(datetime.timezone.utc))
    all_messages.append(ai_message)

    user_uid = user_ref.id
    ai_reply_content = full_ai_reply
    if "<GRAPH>" in ai_reply_content and "</GRAPH>" in ai_reply_content:
        try:
            start_index = ai_reply_content.find("<GRAPH>") + len("<GRAPH>")
            end_index = ai_reply_content.find("</GRAPH>", start_index)
            graph_string = ai_reply_content[start_index:end_index]
            graph_data = json.loads(graph_string)
            user_ref.update({"edges": graph_data.get("edges", []), "nodes": graph_data.get("nodes", [])})
            logger.info(f"Graph data updated in Firestore for user {user_uid}")
        except Exception as e:
            logger.error(f"Error processing graph data in background: {e}")

    if "<PREF>" in ai_reply_content and "</PREF>" in ai_reply_content:
        try:
            start_index = ai_reply_content.find("<PREF>") + len("<PREF>")
            end_index = ai_reply_content.find("</PREF>", start_index)
            pref = ai_reply_content[start_index:end_index]
            user_ref.update({"ChatPreferences": pref})
            logger.info(f"User preferences updated in Firestore for user {user_uid}")
        except Exception as e:
            logger.error(f"Error processing user preferences in background: {e}")

    messages_to_store = [msg.model_dump() for msg in all_messages]
    update_data = {
        "messages": messages_to_store,
        "last_updated": datetime.datetime.now(datetime.timezone.utc)
    }

    if is_brand_new_conversation and all_messages and all_messages[0].role == "user":
        try:
            first_message_content = all_messages[0].content
            with open("titleprompt.txt", "r") as f:
                titleprompt = f.read()
            title_model = genai.GenerativeModel('gemini-1.5-flash-latest')
            title_response = await title_model.generate_content_async(
                f"{titleprompt}\n\nPlease generate a short, descriptive conversation title for this message:\n{first_message_content}"
            )
            title = title_response.text.strip().replace('"', '')
            update_data["title"] = title
            logger.info(f"Generated title for new conversation {conversation_ref.id}: '{title}'")
        except Exception as e:
            logger.error(f"Error during title generation in background: {e}")

    conversation_ref.update(update_data)
    logger.info(f"Background task finished. Conversation {conversation_ref.id} updated in Firestore.")

async def summarize_long_chat_history(
    messages: List[Message],
    model: genai.GenerativeModel,
    max_messages_to_keep: int
) -> List[Message]:
    if len(messages) <= max_messages_to_keep:
        logger.info(f"Chat history length ({len(messages)}) is within limits. No summarization needed.")
        return messages

    num_messages_to_summarize = len(messages) - (max_messages_to_keep - 1)
    
    messages_to_summarize = messages[:num_messages_to_summarize]
    
    summary_prompt_parts = [
        "Please summarize the following conversation history for context. "
        "The summary should be concise, capturing all crucial details and "
        "maintaining the original tone and key information. "
        "This summary will be used to provide context to an AI model for a continuing conversation. "
        "Do not add any conversational filler, just the summary.\n\n"
    ]
    for msg in messages_to_summarize:
        summary_prompt_parts.append(f"{msg.role}: {msg.content}\n")

    summary_prompt = "".join(summary_prompt_parts)
    
    logger.info(f"Initiating summarization for {num_messages_to_summarize} messages.")
    logger.debug(f"Summarization prompt preview: {summary_prompt[:200]}...")

    try:
        summarization_response = await model.generate_content_async(
            [{"role": "user", "parts": [summary_prompt]}]
        )
        
        summary_text = summarization_response.text
        logger.info(f"Summarization complete. Summary length: {len(summary_text)} characters.")

        summary_message = Message(
            role="user",
            content=f"Previous conversation summary: {summary_text}",
            timestamp=datetime.datetime.now(datetime.timezone.utc)
        )

        processed_messages = [summary_message] + messages[num_messages_to_summarize:]
        logger.info(f"Chat history reduced to {len(processed_messages)} messages after summarization.")
        return processed_messages

    except Exception as e:
        logger.error(f"Error during chat summarization: {e}. Sending last {max_messages_to_keep} messages instead.")
        return messages[len(messages) - max_messages_to_keep:]


@app.post("/chat-stream")
async def chat_stream(
    request: ChatRequest,
    raw_request: Request,
    background_tasks: BackgroundTasks,
    user_info: dict = Depends(verify_token)
):
    user_uid = user_info["uid"]
    user_ref = db.collection("users").document(user_uid)
    conversation_id = request.conversation_id
    now = datetime.datetime.now(datetime.timezone.utc)
    is_brand_new_conversation_this_call = False

    if conversation_id:
        conversation_ref = user_ref.collection("conversations").document(conversation_id)
        conversation_doc = conversation_ref.get()
        if not conversation_doc.exists:
            conversation_ref = user_ref.collection("conversations").document()
            conversation_id = conversation_ref.id
            is_brand_new_conversation_this_call = True
    else:
        conversation_ref = user_ref.collection("conversations").document()
        conversation_id = conversation_ref.id
        is_brand_new_conversation_this_call = True

    if is_brand_new_conversation_this_call:
        conversation_ref.set({
            "user_id": user_uid,
            "created_at": now,
            "last_updated": now,
            "messages": [],
            "title": "New Conversation"
        })
        logger.info(f"Created new conversation: {conversation_id} for user {user_uid}")
    else:
        logger.info(f"Continuing conversation: {conversation_id} for user {user_uid}")

    all_messages: List[Message] = [Message(**msg) for msg in request.messages]
    if all_messages and not all_messages[-1].timestamp:
        all_messages[-1].timestamp = now

    user_doc = user_ref.get()
    user_data = user_doc.to_dict() if user_doc.exists else {}
    
    try:
        with open("prompt.txt", "r") as f:
            prompt_template = f.read()
    except FileNotFoundError:
        logger.error("prompt.txt not found. Using a default prompt template.")
        prompt_template = (
            "You are a helpful AI assistant named {name}. "
            "The current date is {date} and time is {time}. "
            "Your user is {user}. "
            "Your location is {location} in {country}. "
            "Here are some instructions: {instructionSet}. "
            "Your personalities are: {personalities}. "
            "Context: {bulletProse}"
        )

    system_prompt = prompt_template.replace("{bulletProse}", request.bulletProse)
    system_prompt = system_prompt.replace("{name}", user_data.get("systemName", "AI"))
    system_prompt = system_prompt.replace("{date}", datetime.date.today().strftime("%Y-%m-%d"))
    system_prompt = system_prompt.replace("{time}", datetime.datetime.now().strftime("%H:%M:%S"))
    system_prompt = system_prompt.replace("{location}", user_data.get("location", "Unknown"))
    system_prompt = system_prompt.replace("{user}", user_data.get("name", "User"))
    system_prompt = system_prompt.replace("{instructionSet}", user_data.get("ChatPreferences", ""))
    system_prompt = system_prompt.replace("{personalities}", ",".join(user_data.get("personalities", [])))
    system_prompt = system_prompt.replace("{country}", user_data.get("country", "Unknown"))

    model = genai.GenerativeModel(
        model_name='gemini-1.5-flash-latest',
        system_instruction=system_prompt
    )

    messages_for_gemini_processing = list(all_messages) 
    
    processed_messages_for_gemini = await summarize_long_chat_history(
        messages_for_gemini_processing,
        model,
        10
    )
    logger.info(f"Messages prepared for Gemini (after potential summarization): {len(processed_messages_for_gemini)} messages.")

    messages_for_gemini = []
    for msg in processed_messages_for_gemini:
        role = 'model' if msg.role == 'assistant' else 'user'
        messages_for_gemini.append({'role': role, 'parts': [msg.content]})

    async def stream_generator() -> AsyncGenerator[str, None]:
        full_response_content = []
        try:
            response_stream = await model.generate_content_async(
                messages_for_gemini,
                stream=True
            )
            async for chunk in response_stream:
                if chunk.text:
                    print(f"Streaming chunk: {chunk.text}")
                    yield chunk.text 
                    full_response_content.append(chunk.text)
        except Exception as e:
            logger.error(f"Error during Gemini stream: {e}")
            yield "Error: Could not get response from AI."
        finally:
            logger.info("Stream finished. Scheduling background task for DB update.")
            final_reply = "".join(full_response_content)
            
            background_tasks.add_task(
                post_stream_save_to_db,
                user_ref=user_ref,
                conversation_ref=conversation_ref,
                all_messages=all_messages,
                full_ai_reply=final_reply,
                is_brand_new_conversation=is_brand_new_conversation_this_call
            )

    headers = {"X-Conversation-Id": conversation_id}
    return StreamingResponse(stream_generator(), media_type="text/plain", headers=headers)

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, raw_request: Request, user_info: dict = Depends(verify_token)):
    user_uid = user_info["uid"]
    user_ref = db.collection("users").document(user_uid)

    client_ip = raw_request.client.host if raw_request.client else "Unknown IP"
    location = "Unknown Location"
    if client_ip:
        try:
            ipinfo_token = "38c16d946ecb52"
            response = requests.get(f"https://ipinfo.io/{client_ip}?token={ipinfo_token}")
            response.raise_for_status()
            location_data = response.json()
            print(f"Location data for IP {client_ip}: {location_data}")
            location = location_data.get("city", "Unknown City") + ", " + location_data.get("region", "Unknown Region")
        except Exception as e:
            logger.error(f"Error retrieving location for IP {client_ip}: {e}")

    conversation_ref: firestore.DocumentReference
    conversation_id = request.conversation_id
    now = datetime.datetime.now(datetime.timezone.utc)
    is_brand_new_conversation_this_call = False

    if conversation_id:
        conversation_ref = user_ref.collection("conversations").document(conversation_id)
        conversation_doc = conversation_ref.get()

        if not conversation_doc.exists:
            logger.warning(f"Provided conversation ID {conversation_id} not found for user {user_uid}. Starting a new conversation with a *new* ID.")
            conversation_ref = user_ref.collection("conversations").document()
            conversation_id = conversation_ref.id
            conversation_ref.set({
                "user_id": user_uid,
                "created_at": now,
                "last_updated": now,
                "messages": [],
                "title": "New Conversation"
            })
            logger.info(f"Created new conversation with ID {conversation_id} as provided ID was not found.")

    else:
        conversation_ref = user_ref.collection("conversations").document()
        conversation_id = conversation_ref.id
        conversation_ref.set({
            "user_id": user_uid,
            "created_at": now,
            "last_updated": now,
            "messages": [],
            "title": "New Conversation"
        })
        logger.info(f"Started brand new conversation: {conversation_id} for user {user_uid}")
        is_brand_new_conversation_this_call = True

    if not request.messages:
        logger.warning(f"Received empty message list for conversation {conversation_id}")
        return ChatResponse(reply="No messages received", conversation_id=conversation_id)

    all_messages: List[Message] = [
         Message(role=msg['role'], content=msg['content'], timestamp=msg.get('timestamp', now))
         for msg in request.messages
     ]

    if all_messages and not all_messages[-1].timestamp:
         all_messages[-1].timestamp = now


    print("Full message history from request:", all_messages)

    user_doc = user_ref.get()
    user_data = user_doc.to_dict() if user_doc.exists else {"name": "User"}
    username = user_data.get("name", "User")
    user_prefs = user_data.get("ChatPreferences", "")
    ai_personalities = user_data.get("personalities", [])

    try:
        with open("prompt.txt", "r") as f:
            prompt_template = f.read()
    except FileNotFoundError:
        logger.error("prompt.txt not found")
        return ChatResponse(reply="Server error: Prompt file not found.", conversation_id=conversation_id)

    current_date = datetime.date.today().strftime("%Y-%m-%d")
    current_time = datetime.datetime.now().strftime("%H:%M:%S")

    system_prompt = prompt_template.replace("{bulletProse}", request.bulletProse)
    system_prompt = system_prompt.replace("{name}", user_data.get("systemName", "AI"))
    system_prompt = system_prompt.replace("{date}", current_date)
    system_prompt = system_prompt.replace("{time}", current_time)
    system_prompt = system_prompt.replace("{location}", location)
    system_prompt = system_prompt.replace("{user}", username)
    system_prompt = system_prompt.replace("{instructionSet}", user_prefs)
    system_prompt = system_prompt.replace("{personalities}", ",".join(ai_personalities))

    # system_message = {"role": "system", "content": prompt}

    MAX_WORDS = 120000
    # total_length = 0

    # messages_for_ai.append(system_message)
    # total_length += len(system_message["content"].split())

    truncated_history_messages = []
    total_length = 0
    for msg in all_messages:
        message_content = msg.content
        message_words = message_content.split()
        if total_length + len(message_words) > MAX_WORDS:
            remaining_words = MAX_WORDS - total_length
            if remaining_words > 0:
                truncated_content = ' '.join(message_words[:remaining_words])
                truncated_history_messages.append({"role": msg.role, "content": truncated_content})
                total_length += len(truncated_content.split())
            break
        else:
            truncated_history_messages.append({"role": msg.role, "content": message_content})
            total_length += len(message_words)

    # messages_for_ai.extend(truncated_history_messages)

    if total_length >= MAX_WORDS:
        logger.warning(f"Total message length ({total_length} words) exceeds {MAX_WORDS}, messages have been truncated for AI call (Conversation ID: {conversation_id})")

    # print("Messages sent to AI:", messages_for_ai)

    try:
        model = genai.GenerativeModel(
            model_name='gemini-1.5-flash-latest',
            system_instruction=system_prompt
        )

        messages_for_gemini = []
        for msg in truncated_history_messages:
            if not msg.get('content'):
                continue
            role = 'model' if msg['role'] == 'assistant' else 'user'
            messages_for_gemini.append({
                'role': role,
                'parts': [msg['content']]
            })
        
        logger.info(f"Sending {len(messages_for_gemini)} messages to Gemini for conversation {conversation_id}")
        chat_session = model.start_chat(history=messages_for_gemini[:-1])
        last_message = messages_for_gemini[-1]['parts'][0]
        
        response = chat_session.send_message(last_message)

        ai_reply_content = response.text
        logger.info(f"Received AI reply for conversation {conversation_id}")
        ai_message = Message(role="assistant", content=ai_reply_content, timestamp=datetime.datetime.now(datetime.timezone.utc))
        all_messages.append(ai_message)

        graph_string = None
        if "<GRAPH>" in ai_reply_content and "</GRAPH>" in ai_reply_content:
            try:
                start_index = ai_reply_content.find("<GRAPH>") + len("<GRAPH>")
                end_index = ai_reply_content.find("</GRAPH>", start_index)
                if end_index != -1:
                    graph_string = ai_reply_content[start_index:end_index]
                    graph_data = json.loads(graph_string)
                    user_ref.update({
                        "edges": graph_data.get("edges", []),
                        "nodes": graph_data.get("nodes", [])
                    })
                    logger.info(f"Graph data updated in Firestore for user {user_uid}")
                    ai_reply_content = ai_reply_content.replace(f"<GRAPH>{graph_string}</GRAPH>", "")
                else:
                    logger.warning("Mismatched <GRAPH> tags in AI response.")
                    ai_reply_content += "\n\n(Warning: Mismatched GRAPH tags)" 
            except json.JSONDecodeError as e:
                logger.error(f"Error decoding JSON graph data from AI: {e}")
                ai_reply_content += "\n\n(Error processing graph data)" 
            except Exception as e:
                logger.error(f"Unexpected error processing graph data: {e}")
                ai_reply_content += "\n\n(Error processing graph data)"


        pref = None
        if "<PREF>" in ai_reply_content and "</PREF>" in ai_reply_content:
            try:
                start_index = ai_reply_content.find("<PREF>") + len("<PREF>")
                end_index = ai_reply_content.find("</PREF>", start_index)
                if end_index != -1:
                    pref = ai_reply_content[start_index:end_index]
                    user_ref.update({
                        "ChatPreferences": pref
                    })
                    logger.info(f"User preferences updated in Firestore for user {user_uid}")
                    ai_reply_content = ai_reply_content.replace(f"<PREF>{pref}</PREF>", "")
                else:
                    logger.warning("Mismatched <PREF> tags in AI response.")
                    ai_reply_content += "\n\n(Warning: Mismatched PREF tags)"
            except Exception as e:
                logger.error(f"Unexpected error processing user preferences: {e}")
                ai_reply_content += "\n\n(Error processing user preferences)"

        messages_to_store = [msg.model_dump() for msg in all_messages]

        update_data = {
            "messages": messages_to_store,
            "last_updated": datetime.datetime.now(datetime.timezone.utc)
        }

        if is_brand_new_conversation_this_call and len(all_messages) > 0 and all_messages[0].role == "user":
            try:
                first_message_content = all_messages[0].content
                with open("titleprompt.txt", "r") as f:
                    titleprompt = f.read()

                title_model = genai.GenerativeModel('gemini-1.5-flash-latest')
                title_generation_prompt = f"Please generate a short, descriptive conversation title for the following message:\n{first_message_content}"
                
                title_response = title_model.generate_content(
                    title_generation_prompt,
                )

                title = title_response.text.strip().replace('"', '')
                update_data["title"] = title
                logger.info(f"Generated title for new conversation {conversation_id}: '{title}'")

            except FileNotFoundError:
                logger.error("titleprompt.txt not found, could not generate title.")
            except Exception as e:
                logger.error(f"An unexpected error occurred during Gemini title generation: {e}")

        conversation_ref.update(update_data)
        logger.info(f"Conversation {conversation_id} updated in Firestore with {len(all_messages)} messages.")

        return ChatResponse(reply=ai_reply_content.strip(), conversation_id=conversation_id)
        
    except Exception as e:
        logger.error(f"An unexpected error occurred in /chat with Gemini: {e}", exc_info=True)
        try:
            messages_to_store = [msg.model_dump() for msg in all_messages]
            conversation_ref.update({
                "messages": messages_to_store,
                "last_updated": datetime.datetime.now(datetime.timezone.utc)
            })
            logger.info(f"Conversation {conversation_id} updated in Firestore after unexpected error.")
        except Exception as db_e:
            logger.error(f"Failed to save conversation history after unexpected error: {db_e}")

        return ChatResponse(reply=f"An unexpected server error occurred with the AI model: {str(e)}", conversation_id=conversation_id)

    # url = "https://ai.hackclub.com/chat/completions"
    # headers = {
    #     "Content-Type": "application/json",
    # }
    # data_to_send = {
    #     "messages": messages_for_ai,
    #     "model": "llama-3.3-70b-versatile"
    # }

    # try:
    #     response = requests.post(url, headers=headers, json=data_to_send)
    #     response.raise_for_status()

    #     response_data = response.json()

    #     ai_reply_content = "No valid response from AI"
    #     if "choices" in response_data and len(response_data["choices"]) > 0:
    #         ai_reply_content = response_data["choices"][0]["message"]["content"]
    #         logger.info(f"Received AI reply for conversation {conversation_id}")
    #         ai_message = Message(role="assistant", content=ai_reply_content, timestamp=datetime.datetime.now(datetime.timezone.utc))
    #         all_messages.append(ai_message)

    #         graph_string = None
    #         if "<GRAPH>" in ai_reply_content and "</GRAPH>" in ai_reply_content:
    #             try:
    #                 start_index = ai_reply_content.find("<GRAPH>") + len("<GRAPH>")
    #                 end_index = ai_reply_content.find("</GRAPH>", start_index)
    #                 if end_index != -1:
    #                     graph_string = ai_reply_content[start_index:end_index]
    #                     graph_data = json.loads(graph_string)
    #                     user_ref.update({
    #                         "edges": graph_data.get("edges", []),
    #                         "nodes": graph_data.get("nodes", [])
    #                     })
    #                     logger.info(f"Graph data updated in Firestore for user {user_uid}")
    #                     ai_reply_content = ai_reply_content.replace(f"<GRAPH>{graph_string}</GRAPH>", "")
    #                 else:
    #                     logger.warning("Mismatched <GRAPH> tags in AI response.")
    #                     ai_reply_content += "\n\n(Warning: Mismatched GRAPH tags)" 
    #             except json.JSONDecodeError as e:
    #                 logger.error(f"Error decoding JSON graph data from AI: {e}")
    #                 ai_reply_content += "\n\n(Error processing graph data)" 
    #             except Exception as e:
    #                 logger.error(f"Unexpected error processing graph data: {e}")
    #                 ai_reply_content += "\n\n(Error processing graph data)"


    #         pref = None
    #         if "<PREF>" in ai_reply_content and "</PREF>" in ai_reply_content:
    #             try:
    #                 start_index = ai_reply_content.find("<PREF>") + len("<PREF>")
    #                 end_index = ai_reply_content.find("</PREF>", start_index)
    #                 if end_index != -1:
    #                     pref = ai_reply_content[start_index:end_index]
    #                     user_ref.update({
    #                         "ChatPreferences": pref
    #                     })
    #                     logger.info(f"User preferences updated in Firestore for user {user_uid}")
    #                     ai_reply_content = ai_reply_content.replace(f"<PREF>{pref}</PREF>", "")
    #                 else:
    #                     logger.warning("Mismatched <PREF> tags in AI response.")
    #                     ai_reply_content += "\n\n(Warning: Mismatched PREF tags)"
    #             except Exception as e:
    #                 logger.error(f"Unexpected error processing user preferences: {e}")
    #                 ai_reply_content += "\n\n(Error processing user preferences)"

    #         messages_to_store = [msg.model_dump() for msg in all_messages]

    #         update_data = {
    #             "messages": messages_to_store,
    #             "last_updated": datetime.datetime.now(datetime.timezone.utc)
    #         }

    #         if is_brand_new_conversation_this_call and len(all_messages) > 0 and all_messages[0].role == "user":
    #             try:
    #                 first_message_content = all_messages[0].content
    #                 titleprompt = open("titleprompt.txt", "r").read()
    #                 title_data_to_send = {
    #                     "messages": [
    #                         {
    #                             "role": "system",
    #                             "content": titleprompt
    #                         },
    #                         {
    #                             "role": "user",
    #                             "content": "Please generate a short, descriptive conversation title for the following message:\n" + first_message_content
    #                         }
    #                     ],
    #                     "model": "llama-3.3-70b-versatile"
    #                 }
    #                 title_response = requests.post(url, headers=headers, json=title_data_to_send)
    #                 title_response.raise_for_status()
    #                 title_response_data = title_response.json()
    #                 if "choices" in title_response_data and len(title_response_data["choices"]) > 0:
    #                     title = title_response_data["choices"][0]["message"]["content"].strip()
    #                     update_data["title"] = title
    #                     logger.info(f"Generated title for new conversation {conversation_id}: '{title}'")
    #                 else:
    #                     logger.error("No choices found in the AI response for title generation.")
    #             except FileNotFoundError:
    #                 logger.error("titleprompt.txt not found, could not generate title.")
    #             except requests.exceptions.RequestException as e:
    #                 logger.error(f"Error calling AI for title generation: {e}")
    #             except Exception as e:
    #                 logger.error(f"An unexpected error occurred during title generation: {e}")


    #         conversation_ref.update(update_data)
    #         logger.info(f"Conversation {conversation_id} updated in Firestore with {len(all_messages)} messages.")

    #         return ChatResponse(reply=ai_reply_content.strip(), conversation_id=conversation_id)

    #     else:
    #         logger.error("No choices found in the AI response payload.")
    #         messages_to_store = [msg.model_dump() for msg in all_messages]
    #         conversation_ref.update({
    #             "messages": messages_to_store,
    #             "last_updated": datetime.datetime.now(datetime.timezone.utc)
    #         })
    #         logger.info(f"Conversation {conversation_id} updated in Firestore after AI error.")
    #         return ChatResponse(reply="No valid response from AI", conversation_id=conversation_id)


    # except requests.exceptions.HTTPError as e:
    #     logger.error(f"HTTP error from AI API: {e.response.status_code} - {e.response.text}")
    #     try:
    #         messages_to_store = [msg.model_dump() for msg in all_messages]
    #         conversation_ref.update({
    #             "messages": messages_to_store,
    #             "last_updated": datetime.datetime.now(datetime.timezone.utc)
    #         })
    #         logger.info(f"Conversation {conversation_id} updated in Firestore after HTTP error.")
    #     except Exception as db_e:
    #         logger.error(f"Failed to save conversation history after HTTP error: {db_e}")

    #     return ChatResponse(reply=f"Error communicating with AI: {e.response.status_code} - {e.response.text}", conversation_id=conversation_id)

    # except requests.exceptions.RequestException as e:
    #     logger.error(f"Network error communicating with AI API: {e}")
    #     try:
    #         messages_to_store = [msg.model_dump() for msg in all_messages]
    #         conversation_ref.update({
    #             "messages": messages_to_store,
    #             "last_updated": datetime.datetime.now(datetime.timezone.utc)
    #         })
    #         logger.info(f"Conversation {conversation_id} updated in Firestore after network error.")
    #     except Exception as db_e:
    #         logger.error(f"Failed to save conversation history after network error: {db_e}")

    #     return ChatResponse(reply="Network error communicating with AI", conversation_id=conversation_id)

    # except Exception as e:
    #     logger.error(f"An unexpected error occurred in /chat: {e}", exc_info=True)
    #     try:
    #         messages_to_store = [msg.model_dump() for msg in all_messages]
    #         conversation_ref.update({
    #             "messages": messages_to_store,
    #             "last_updated": datetime.datetime.now(datetime.timezone.utc)
    #         })
    #         logger.info(f"Conversation {conversation_id} updated in Firestore after unexpected error.")
    #     except Exception as db_e:
    #         logger.error(f"Failed to save conversation history after unexpected error: {db_e}")

    #     return ChatResponse(reply="An unexpected server error occurred", conversation_id=conversation_id)

@app.post("/edit", response_model=ChatResponse)
async def edit_conversation(request: EditRequest, user_info: dict = Depends(verify_token)):
    user_uid = user_info["uid"]
    user_ref = db.collection("users").document(user_uid)
    now = datetime.datetime.now(datetime.timezone.utc)

    original_conversation_ref = user_ref.collection("conversations").document(request.conversation_id)
    original_conversation_doc = original_conversation_ref.get()

    if not original_conversation_doc.exists:
        logger.warning(f"Original conversation ID {request.conversation_id} not found for user {user_uid}. Cannot branch.")
        raise HTTPException(status_code=404, detail="Original conversation not found.")

    original_data = original_conversation_doc.to_dict()
    original_messages_raw = original_data.get("messages", [])

    if not (0 <= request.message_index < len(original_messages_raw)):
        logger.warning(f"Invalid message index {request.message_index} for conversation {request.conversation_id}.")
        raise HTTPException(status_code=400, detail="Invalid message index.")

    parent_conversation_id = request.conversation_id
    branch_from_message_index = request.message_index
    edited_message = original_messages_raw[request.message_index]

    if "parent_conversation_id" in original_data and original_data["parent_conversation_id"] is not None:
        if (
            "branch_from_message_index" in original_data
            and original_data["branch_from_message_index"] == request.message_index
        ):
            parent_conversation_id = original_data["parent_conversation_id"]
            branch_from_message_index = original_data["branch_from_message_index"]
            logger.info(
                f"Editing a message that is already a branch (parent: {parent_conversation_id}, index: {branch_from_message_index}). "
                "Setting new branch parent to previous parent."
            )

    new_conversation_ref = user_ref.collection("conversations").document()
    new_conversation_id = new_conversation_ref.id

    messages_for_new_branch = [
        Message(role=msg['role'], content=msg['content'], timestamp=msg.get('timestamp', now))
        for msg in original_messages_raw[:request.message_index + 1]
    ]

    edited_message_obj = messages_for_new_branch[-1]
    if edited_message_obj.role == "user":
        edited_message_obj.content = request.new_message_content
        edited_message_obj.timestamp = now
    else:
        logger.warning(f"Attempted to edit non-user message at index {request.message_index}. Proceeding with user message content replacement.")
        messages_for_new_branch[-1] = Message(role="user", content=request.new_message_content, timestamp=now)

    new_conversation_ref.set({
        "user_id": user_uid,
        "created_at": now,
        "last_updated": now,
        "messages": [msg.model_dump() for msg in messages_for_new_branch],
        "title": original_data.get("title", "New Conversation Branch") + f" (Branch from message {request.message_index + 1})",
        "parent_conversation_id": parent_conversation_id,
        "branch_from_message_index": branch_from_message_index,
    })
    logger.info(f"Created new conversation branch {new_conversation_id} from {parent_conversation_id}.")

    original_children_branches = original_data.get("children_branches", [])
    original_children_branches.append({
        "id": new_conversation_id,
        "title": original_data.get("title", "Unnamed Branch") + f" (Branch from message {request.message_index + 1})",
        "branch_from_message_index": request.message_index
    })

    original_conversation_ref.update({
        "children_branches": original_children_branches,
        "last_updated": now
    })

    user_doc = user_ref.get()
    user_data = user_doc.to_dict() if user_doc.exists else {"name": "User"}
    username = user_data.get("name", "User")
    user_prefs = user_data.get("ChatPreferences", "")

    try:
        with open("prompt.txt", "r") as f:
            prompt_template = f.read()
    except FileNotFoundError:
        logger.error("prompt.txt not found")
        raise HTTPException(status_code=500, detail="Server error: Prompt file not found.")

    current_date = datetime.date.today().strftime("%Y-%m-%d")
    current_time = datetime.datetime.now().strftime("%H:%M:%S")

    prompt = prompt_template.replace("{bulletProse}", request.bulletProse)
    prompt = prompt.replace("{name}", user_data.get("name", "User"))
    prompt = prompt.replace("{date}", current_date)
    prompt = prompt.replace("{time}", current_time)
    prompt = prompt.replace("{location}", "NYC")
    prompt = prompt.replace("{user}", username)
    prompt = prompt.replace("{instructionSet}", user_prefs)

    system_message = {"role": "system", "content": prompt}

    MAX_WORDS = 120000
    messages_for_ai = []
    total_length = 0

    messages_for_ai.append(system_message)
    total_length += len(system_message["content"].split())

    truncated_history_messages = []
    for msg in messages_for_new_branch:
        message_content = msg.content
        message_words = message_content.split()
        if total_length + len(message_words) > MAX_WORDS:
            remaining_words = MAX_WORDS - total_length
            if remaining_words > 0:
                truncated_content = ' '.join(message_words[:remaining_words])
                truncated_history_messages.append({"role": msg.role, "content": truncated_content})
                total_length += len(truncated_content.split())
            break
        else:
            truncated_history_messages.append({"role": msg.role, "content": message_content})
            total_length += len(message_words)

    messages_for_ai.extend(truncated_history_messages)

    if total_length >= MAX_WORDS:
        logger.warning(f"Total message length ({total_length} words) exceeds {MAX_WORDS}, messages have been truncated for AI call (Conversation ID: {new_conversation_id})")

    print("Messages sent to AI for new branch:", messages_for_ai)

    url = "https://ai.hackclub.com/chat/completions"
    headers = {
        "Content-Type": "application/json",
    }
    data_to_send = {
        "messages": messages_for_ai,
        "model": "llama-3.3-70b-versatile"
    }

    try:
        response = requests.post(url, headers=headers, json=data_to_send)
        response.raise_for_status()

        response_data = response.json()

        ai_reply_content = "No valid response from AI"
        if "choices" in response_data and len(response_data["choices"]) > 0:
            ai_reply_content = response_data["choices"][0]["message"]["content"]
            logger.info(f"Received AI reply for new conversation branch {new_conversation_id}")
            ai_message = Message(role="assistant", content=ai_reply_content, timestamp=datetime.datetime.now(datetime.timezone.utc))
            messages_for_new_branch.append(ai_message)

            graph_string = None
            if "<GRAPH>" in ai_reply_content and "</GRAPH>" in ai_reply_content:
                try:
                    start_index = ai_reply_content.find("<GRAPH>") + len("<GRAPH>")
                    end_index = ai_reply_content.find("</GRAPH>", start_index)
                    if end_index != -1:
                        graph_string = ai_reply_content[start_index:end_index]
                        graph_data = json.loads(graph_string)
                        user_ref.update({
                            "edges": graph_data.get("edges", []),
                            "nodes": graph_data.get("nodes", [])
                        })
                        logger.info(f"Graph data updated in Firestore for user {user_uid}")
                        ai_reply_content = ai_reply_content.replace(f"<GRAPH>{graph_string}</GRAPH>", "")
                    else:
                        logger.warning("Mismatched <GRAPH> tags in AI response.")
                        ai_reply_content += "\n\n(Warning: Mismatched GRAPH tags)"
                except json.JSONDecodeError as e:
                    logger.error(f"Error decoding JSON graph data from AI: {e}")
                    ai_reply_content += "\n\n(Error processing graph data)"
                except Exception as e:
                    logger.error(f"Unexpected error processing graph data: {e}")
                    ai_reply_content += "\n\n(Error processing graph data)"

            pref = None
            if "<PREF>" in ai_reply_content and "</PREF>" in ai_reply_content:
                try:
                    start_index = ai_reply_content.find("<PREF>") + len("<PREF>")
                    end_index = ai_reply_content.find("</PREF>", start_index)
                    if end_index != -1:
                        pref = ai_reply_content[start_index:end_index]
                        user_ref.update({
                            "ChatPreferences": pref
                        })
                        logger.info(f"User preferences updated in Firestore for user {user_uid}")
                        ai_reply_content = ai_reply_content.replace(f"<PREF>{pref}</PREF>", "")
                    else:
                        logger.warning("Mismatched <PREF> tags in AI response.")
                        ai_reply_content += "\n\n(Warning: Mismatched PREF tags)"
                except Exception as e:
                    logger.error(f"Unexpected error processing user preferences: {e}")
                    ai_reply_content += "\n\n(Error processing user preferences)"

            messages_to_store = [msg.model_dump() for msg in messages_for_new_branch]

            new_conversation_ref.update({
                "messages": messages_to_store,
                "last_updated": datetime.datetime.now(datetime.timezone.utc)
            })
            logger.info(f"New conversation branch {new_conversation_id} updated in Firestore with {len(messages_for_new_branch)} messages.")

            return ChatResponse(reply=ai_reply_content.strip(), conversation_id=new_conversation_id)

        else:
            logger.error("No choices found in the AI response payload for new branch.")
            messages_to_store = [msg.model_dump() for msg in messages_for_new_branch]
            new_conversation_ref.update({
                "messages": messages_to_store,
                "last_updated": datetime.datetime.now(datetime.timezone.utc)
            })
            logger.info(f"New conversation branch {new_conversation_id} updated in Firestore after AI error.")
            return ChatResponse(reply="No valid response from AI", conversation_id=new_conversation_id)

    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error from AI API for new branch: {e.response.status_code} - {e.response.text}")
        try:
            messages_to_store = [msg.model_dump() for msg in messages_for_new_branch]
            new_conversation_ref.update({
                "messages": messages_to_store,
                "last_updated": datetime.datetime.now(datetime.timezone.utc)
            })
            logger.info(f"New conversation branch {new_conversation_id} updated in Firestore after HTTP error.")
        except Exception as db_e:
            logger.error(f"Failed to save conversation history for new branch after HTTP error: {db_e}")
        raise HTTPException(status_code=e.response.status_code, detail=f"Error communicating with AI: {e.response.text}")

    except requests.exceptions.RequestException as e:
        logger.error(f"Network error communicating with AI API for new branch: {e}")
        try:
            messages_to_store = [msg.model_dump() for msg in messages_for_new_branch]
            new_conversation_ref.update({
                "messages": messages_to_store,
                "last_updated": datetime.datetime.now(datetime.timezone.utc)
            })
            logger.info(f"New conversation branch {new_conversation_id} updated in Firestore after network error.")
        except Exception as db_e:
            logger.error(f"Failed to save conversation history for new branch after network error: {db_e}")
        raise HTTPException(status_code=500, detail="Network error communicating with AI")

    except Exception as e:
        logger.error(f"An unexpected error occurred in /edit: {e}", exc_info=True)
        try:
            messages_to_store = [msg.model_dump() for msg in messages_for_new_branch]
            new_conversation_ref.update({
                "messages": messages_to_store,
                "last_updated": datetime.datetime.now(datetime.timezone.utc)
            })
            logger.info(f"New conversation branch {new_conversation_id} updated in Firestore after unexpected error.")
        except Exception as db_e:
            logger.error(f"Failed to save conversation history for new branch after unexpected error: {db_e}")
        raise HTTPException(status_code=500, detail="An unexpected server error occurred")

    return {"message": "Conversation updated successfully"}

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

@app.get("/user_prefs")
async def get_user_prefs(user_info: dict = Depends(verify_token)):
    try:
        user_ref = db.collection("users").document(user_info["uid"])
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_data = user_doc.to_dict()
        prefs = user_data.get("ChatPreferences", "")
        print(f"User preferences retrieved: {prefs}")
        return {"prefs": prefs}
    except Exception as e:
        print(f"Error retrieving user preferences: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving user preferences: {str(e)}"
        )

@app.post("/user_prefs")
async def update_user_prefs(user_info: dict = Depends(verify_token), prefs: dict = Body(...)):
    try:
        prefs_value = prefs.get("prefs", "")
        user_ref = db.collection("users").document(user_info["uid"])
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_ref.update({
            "ChatPreferences": prefs_value
        })
        
        return {"message": "User preferences updated successfully"}
    except Exception as e:
        print(f"Error updating user preferences: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating user preferences: {str(e)}"
        )

@app.post("/change_conversation_title")
async def change_conversation_title(user_info: dict = Depends(verify_token), title: str = Body(...), conversation_id: str = Body(...)):
    try:
        user_ref = db.collection("users").document(user_info["uid"])
        conversation_ref = user_ref.collection("conversations").document(conversation_id)
        conversation_doc = conversation_ref.get()
        
        if not conversation_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
        
        conversation_ref.update({
            "title": title
        })
        
        return {"message": "Conversation title updated successfully"}
    except Exception as e:
        print(f"Error updating conversation title: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating conversation title: {str(e)}"
        )

@app.post("/star_conversation")
async def star_conversation(user_info: dict = Depends(verify_token), conversation_id: str = Body(...)):
    try:
        user_ref = db.collection("users").document(user_info["uid"])
        conversation_ref = user_ref.collection("conversations").document(conversation_id)
        conversation_doc = conversation_ref.get()
        
        if not conversation_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
        
        conversation_data = conversation_doc.to_dict()
        starred = conversation_data.get("starred", False)
        nxt = not starred

        conversation_ref.update({
            "starred": nxt
        })
        
        return {"message": "Conversation starred successfully", "success": "true"}
    except Exception as e:
        print(f"Error starring conversation: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error starring conversation: {str(e)}"
        )

@app.post("/share_conversation")
async def share_conversation(user_info: dict = Depends(verify_token), conversation_id: str = Body(..., embed=True)):
    try:
        user_ref = db.collection("users").document(user_info["uid"])
        conversation_ref = user_ref.collection("conversations").document(conversation_id)
        conversation_doc = conversation_ref.get()
        
        if not conversation_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
        
        conversation_data = conversation_doc.to_dict()
        shared = conversation_data.get("shared", False)
        nxt = not shared

        conversation_ref.update({
            "shared": nxt
        })
        
        owner_id = user_info["uid"]
        return {"message": "Conversation shared successfully", "success": "true", "conversation_url": f"http://127.0.0.1:8000/conversations/{owner_id}/{conversation_id}"}
    except Exception as e:
        print(f"Error sharing conversation: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error sharing conversation: {str(e)}"
        )

@app.post("/update_prefs_from_message")
async def update_prefs_from_message(user_info: dict = Depends(verify_token), body: dict = Body(...)):
    target_message = body.get("targetMessage")
    convo_history = body.get("convoHistory")
    pref = body.get("pref")

    if not target_message or not convo_history or not pref:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both 'targetMessage' and 'convoHistory' are required"
        )

    try:
        with open("promptlikedislike.txt", "r") as f:
            prompt_template = f.read()
    except FileNotFoundError:
        logger.error("promptlikedislike.txt not found")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server error: Prompt file not found."
        )

    user_doc = db.collection("users").document(user_info["uid"]).get()
    if not user_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    user_data = user_doc.to_dict()
    chat_prefs = user_data.get("ChatPreferences", "")

    prompt = prompt_template.replace("{RESPONSE}", pref).replace("{PREFS}", chat_prefs)

    url = "https://ai.hackclub.com/chat/completions"
    headers = {
        "Content-Type": "application/json",
    }
    data = {
        "messages": [
            {
                "role": "system",
                "content": prompt
            },
            {
                "role": "user",
                "content": f"I {pref} {target_message} in convo {convo_history}"
            }
        ],
        "model": "llama-3.3-70b-versatile"
    }

    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()

        response_data = response.json()
        if "choices" in response_data and len(response_data["choices"]) > 0:
            reply = response_data["choices"][0]["message"]["content"]

            if "<PREF>" in reply and "</PREF>" in reply:
                start_index = reply.find("<PREF>") + len("<PREF>")
                end_index = reply.find("</PREF>", start_index)
                if end_index != -1:
                    extracted_prefs = reply[start_index:end_index]

                    user_ref = db.collection("users").document(user_info["uid"])
                    user_ref.update({
                        "ChatPreferences": extracted_prefs
                    })

                    logger.info(f"User preferences updated successfully for user {user_info['uid']}")
                    return {"message": "Preferences updated successfully", "prefs": extracted_prefs}
                else:
                    logger.error("Mismatched <PREF> tags in AI response")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Error processing preferences from AI response"
                    )
            else:
                logger.error("No <PREF> tags found in AI response")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No preferences found in AI response"
                )
        else:
            logger.error("No choices found in the AI response")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No valid response from AI"
            )
    except requests.exceptions.RequestException as e:
        logger.error(f"Error communicating with AI: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error communicating with AI"
        )
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        )

@app.post("/update_picture")
async def update_picture(user_info: dict = Depends(verify_token), body: dict = Body(...)):
    picture_url = body.get("pictureUrl")
    avatarType = body.get("avatarType")
    if not picture_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Picture URL is required"
        )

    try:
        user_ref = db.collection("users").document(user_info["uid"])
        user_ref.update({
            avatarType: picture_url
        })
        return {"message": "Profile picture updated successfully"}
    except Exception as e:
        logger.error(f"Error updating profile picture: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating profile picture: {str(e)}"
        )

@app.get("/pictures")
async def get_pictures(user_info: dict = Depends(verify_token)):
    try:
        user_ref = db.collection("users").document(user_info["uid"])
        user_doc = user_ref.get()

        if not user_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_data = user_doc.to_dict()
        pictures = {
            "userAvatarUrl": user_data.get("userAvatarUrl", ""),
            "aiAvatarUrl": user_data.get("aiAvatarUrl", "")
        }
        return pictures
    except Exception as e:
        logger.error(f"Error retrieving profile pictures: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving profile pictures: {str(e)}"
        )

@app.post("/rename_ai")
async def rename_ai(user_info: dict = Depends(verify_token), body: dict = Body(...)):
    new_name = body.get("newName")
    if not new_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New name is required"
        )

    try:
        user_ref = db.collection("users").document(user_info["uid"])
        user_ref.update({
            "systemName": new_name
        })
        return {"message": "AI name updated successfully"}
    except Exception as e:
        logger.error(f"Error updating AI name: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating AI name: {str(e)}"
        )

@app.get("/personalities")
async def get_personalities(user_info: dict = Depends(verify_token)):
    try:
        user_ref = db.collection("users").document(user_info["uid"])
        user_doc = user_ref.get()

        if not user_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_data = user_doc.to_dict()
        personalities = {
            "personalities": user_data.get("personalities", [])
        }
        return personalities
    except Exception as e:
        logger.error(f"Error retrieving personalities: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving personalities: {str(e)}"
        )

@app.post("/toggle_personality")
async def toggle_personality(user_info: dict = Depends(verify_token), body: dict = Body(...)):
    personality = body.get("personality")
    if not personality:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Personality is required"
        )

    try:
        user_ref = db.collection("users").document(user_info["uid"])
        user_doc = user_ref.get()

        if not user_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_data = user_doc.to_dict()
        personalities = user_data.get("personalities", [])
        
        if personality in personalities:
            personalities.remove(personality)
        else:
            personalities.append(personality)
        
        user_ref.update({
            "personalities": personalities
        })
        
        return {"message": "Personality toggled successfully"}
    except Exception as e:
        logger.error(f"Error toggling personality: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error toggling personality: {str(e)}"
        )

@app.get("/ai_name")
async def get_ai_name(user_info: dict = Depends(verify_token)):
    try:
        user_ref = db.collection("users").document(user_info["uid"])
        user_doc = user_ref.get()

        if not user_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_data = user_doc.to_dict()
        ai_name = user_data.get("systemName", "AI")
        return {"ai_name": ai_name}
    except Exception as e:
        logger.error(f"Error retrieving AI name: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving AI name: {str(e)}"
        )

if __name__ == "__main__":
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True, log_level="info")