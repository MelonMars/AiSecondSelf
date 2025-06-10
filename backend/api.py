from fastapi import FastAPI, Depends, HTTPException, status, Header, Body, File, UploadFile, Form, Request, BackgroundTasks, Response
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
from google import genai
from google.genai import types
import stripe
import asyncio
import io
from openai import OpenAI
import base64

cred = ""
gemini_cred = ""
if not firebase_admin._apps:
    # use my Mac service account or my Desktop service account
    if os.name == 'posix':
        cred = credentials.Certificate("aisecondself-8a616-firebase-adminsdk-fbsvc-83bb9cb5c9.json")
        gemini_cred = open("geminikey.txt", "r").read()
    else:
        cred = credentials.Certificate("aisecondself-8a616-firebase-adminsdk-fbsvc-3341d01ff4.json")
        gemini_cred = open("geminikey.txt", "r").read()
    firebase_admin.initialize_app(cred)

print("Got gemini cred: ", gemini_cred)
# client = genai.configure(api_key="AIzaSyA9z3L28gtJ91FJpl-YX3Bam00UCVF6Qyw")
stripe.api_key = open("stripekey.txt", "r").read()

db = firestore.client()

app = FastAPI()

CREDIT_PACKAGES = {
    "starter": {"credits": 100, "price": 5.00, "price_id": "price_1RTvU2BQFEsZhRVarP1OqCOY"},
    "standard": {"credits": 500, "price": 20.00, "price_id": "price_1RTvUeBQFEsZhRVaTpDGPvTm"},
    "premium": {"credits": 1000, "price": 35.00, "price_id": "price_1RTvVOBQFEsZhRVaouCGkPFU"},
    "unlimited": {"credits": 5000, "price": 100.00, "price_id": "price_1RTvV5BQFEsZhRVa6iu51sbu"}
}

SUBSCRIPTION_PLANS = {
    "basic": {"credits_per_month": 500, "price": 9.99, "price_id": "price_1RTvVbBQFEsZhRVaEwejtzyW"},
    "pro": {"credits_per_month": 2000, "price": 29.99, "price_id": "price_1RTvVpBQFEsZhRVadZlSfhon"},
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
        try:
            return await verify_token(authorization)
        except:
            return None

@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI application!"}

class Message(BaseModel):
    role: str
    content: str
    timestamp: Optional[datetime.datetime] = Field(default_factory=datetime.datetime.now)
    reaction: Optional[str] = None

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

class ChatRequestWithDocs(BaseModel):
    conversation_id: Optional[str] = None
    messages: List[dict]
    bulletProse: str = ""
    documents: Optional[List[dict]] = None

class ChatResponse(BaseModel):
    reply: str
    conversation_id: Optional[str] = None 

class EditRequest(BaseModel):
    conversation_id: str
    message_index: int
    new_message_content: str
    bulletProse: str = ""

class AiChatResponse(BaseModel):
    reply: str
    updated_preferences: str
    updated_graph: str

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CreditManager:
    @staticmethod
    def get_user_credits(user_ref) -> dict:
        """Get user's current credit information"""
        user_doc = user_ref.get()
        user_data = user_doc.to_dict() if user_doc.exists else {}
        
        return {
            "credits": user_data.get("credits", 0),
            "subscription_plan": user_data.get("subscription_plan"),
            "subscription_status": user_data.get("subscription_status"),
            "subscription_expires": user_data.get("subscription_expires"),
            "last_credit_refresh": user_data.get("last_credit_refresh")
        }
    
    @staticmethod
    def deduct_credits(user_ref, amount: int = 1) -> bool:
        """Deduct credits from user account. Returns True if successful."""
        try:
            user_doc = user_ref.get()
            if not user_doc.exists:
                return False
            
            user_data = user_doc.to_dict()
            current_credits = user_data.get("credits", 0)
            
            CreditManager.refresh_subscription_credits(user_ref, user_data)
            
            user_doc = user_ref.get()
            user_data = user_doc.to_dict()
            current_credits = user_data.get("credits", 0)
            
            if current_credits >= amount:
                user_ref.update({
                    "credits": current_credits - amount,
                    "last_used": datetime.datetime.now(datetime.timezone.utc)
                })
                return True
            return False
        except Exception as e:
            logger.error(f"Error deducting credits: {e}")
            return False
    
    @staticmethod
    def add_credits(user_ref, amount: int):
        """Add credits to user account"""
        user_doc = user_ref.get()
        user_data = user_doc.to_dict() if user_doc.exists else {}
        current_credits = user_data.get("credits", 0)
        
        user_ref.update({
            "credits": current_credits + amount,
            "last_credit_addition": datetime.datetime.now(datetime.timezone.utc)
        })
    
    @staticmethod
    def refresh_subscription_credits(user_ref, user_data: dict):
        """Refresh subscription credits if it's a new month"""
        subscription_plan = user_data.get("subscription_plan")
        subscription_status = user_data.get("subscription_status")
        last_refresh = user_data.get("last_credit_refresh")
        
        if not subscription_plan or subscription_status != "active":
            return
        
        now = datetime.datetime.now(datetime.timezone.utc)
        
        if not last_refresh or (now - last_refresh).days >= 30:
            plan_info = SUBSCRIPTION_PLANS.get(subscription_plan)
            if plan_info:
                monthly_credits = plan_info["credits_per_month"]
                user_ref.update({
                    "credits": monthly_credits, 
                    "last_credit_refresh": now
                })

@app.get("/user_credits")
async def get_user_credits(user_info: dict = Depends(verify_token)):
    """Get user's current credit information"""
    user_uid = user_info["uid"]
    user_ref = db.collection("users").document(user_uid)
    
    credits_info = CreditManager.get_user_credits(user_ref)
    print(f"User {user_uid} credits info: {credits_info}")
    return credits_info 

@app.post("/create-payment-intent")
async def create_payment_intent(
    request: dict,
    user_info: dict = Depends(verify_token)
):
    try:
        package_id = request.get("package_id")
        package_info = CREDIT_PACKAGES.get(package_id)
        
        if not package_info:
            raise HTTPException(status_code=400, detail="Invalid package")
        
        user_uid = user_info["uid"]

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price": package_info["price_id"],
                "quantity": 1,
            }],
            mode="payment",
            metadata={
                'user_id': user_uid,
                'package_id': package_id,
                'credits': package_info["credits"],
                'type': 'one_time_purchase'
            },
            ui_mode="embedded",
            return_url="http://localhost:3000/ai-life-coach/payment-success"
        )

        return {
            "client_secret": session.client_secret,
            "session_id": session.id,
            "publishable_key": "pk_test_51RIKBKBQFEsZhRVaP4WiDKydGD8wYJHjDzikt3WH39cI0NRSs4p59ZQ6uiz9A78WObKwvgsmcgWKVIhj5i9soLmk00vYT7dcLc"
        }
    
    except Exception as e:
        logger.error(f"Error creating checkout session: {e}")
        raise HTTPException(status_code=500, detail="Payment creation failed")

@app.post("/create-subscription")
async def create_subscription(
    request: dict,
    user_info: dict = Depends(verify_token)
):
    try:
        plan_id = request.get("plan_id")
        plan_info = SUBSCRIPTION_PLANS.get(plan_id)
        
        if not plan_info:
            raise HTTPException(status_code=400, detail="Invalid plan")
        
        user_uid = user_info["uid"]
        user_ref = db.collection("users").document(user_uid)
        user_doc = user_ref.get()
        user_data = user_doc.to_dict() if user_doc.exists else {}
        
        stripe_customer_id = user_data.get("stripe_customer_id")
        if not stripe_customer_id:
            customer = stripe.Customer.create(
                email=user_data.get("email"),
                metadata={"user_id": user_uid}
            )
            stripe_customer_id = customer.id
            user_ref.update({"stripe_customer_id": stripe_customer_id})
        
        subscription = stripe.Subscription.create(
            customer=stripe_customer_id,
            items=[{"price": plan_info["price_id"]}],
            metadata={
                "user_id": user_uid,
                "plan_id": plan_id
            }
        )
        
        return {"subscription_id": subscription.id, "client_secret": subscription.latest_invoice.payment_intent.client_secret}
    
    except Exception as e:
        logger.error(f"Error creating subscription: {e}")
        raise HTTPException(status_code=500, detail="Subscription creation failed")

@app.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    endpoint_secret = "whsec_bkjqJhF4z5S8sp9uRpqjZkDFqIcNAAHl"
    
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        if session.get('metadata', {}).get('type') == 'one_time_purchase':
            user_id = session['metadata']['user_id']
            credits = int(session['metadata']['credits'])
            
            user_ref = db.collection("users").document(user_id)
            CreditManager.add_credits(user_ref, credits)
            
            logger.info(f"Added {credits} credits to user {user_id}")
    
    elif event['type'] == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        subscription_id = invoice['subscription']
        
        subscription = stripe.Subscription.retrieve(subscription_id)
        user_id = subscription['metadata']['user_id']
        plan_id = subscription['metadata']['plan_id']
        
        user_ref = db.collection("users").document(user_id)
        plan_info = SUBSCRIPTION_PLANS.get(plan_id)
        
        if plan_info:
            user_ref.update({
                "subscription_plan": plan_id,
                "subscription_status": "active",
                "subscription_expires": datetime.fromtimestamp(subscription['current_period_end']),
                "stripe_subscription_id": subscription_id
            })
            
            CreditManager.add_credits(user_ref, plan_info["credits_per_month"])
            logger.info(f"Added {plan_info['credits_per_month']} credits to user {user_id} for subscription")
    
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        user_id = subscription['metadata']['user_id']
        
        user_ref = db.collection("users").document(user_id)
        user_ref.update({
            "subscription_status": "cancelled",
            "subscription_expires": datetime.datetime.now(datetime.timezone.utc)
        })
        
        logger.info(f"Cancelled subscription for user {user_id}")
    
    return {"status": "success"}

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
    user_info: dict = Depends(optional_verify_token)
):
    try:
        caller_uid = user_info["uid"]
    except (KeyError, TypeError):
        caller_uid = None
        logger.warning("No user info provided, caller_uid will be None")

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
    ai_response: AiChatResponse,
    is_brand_new_conversation: bool
):
    logger.info(f"Background task started for conversation: {conversation_ref.id}")
    ai_message = Message(role="assistant", content=ai_response.reply, timestamp=datetime.datetime.now(datetime.timezone.utc))
    all_messages.append(ai_message)

    user_uid = user_ref.id

    if ai_response.updated_graph:
        updated_graph = json.loads(ai_response.updated_graph)
        try:
            user_doc = user_ref.get()
            
            if not user_doc.exists:
                logger.error(f"User document not found for uid: {user_uid}")
            else:
                existing_user_data = user_doc.to_dict()
                
                if "graph_history" in existing_user_data and existing_user_data["graph_history"]:
                    current_history = existing_user_data["graph_history"]
                    current_index = existing_user_data.get("current_graph_index", len(current_history) - 1)
                else:
                    current_history = []
                    current_index = 0

                if not isinstance(current_history, list):
                    current_history = [current_history]

                update_data = {
                    "graph_history": current_history + [updated_graph],
                }

                user_ref.update(update_data)
                logger.info(f"Graph data updated in Firestore for user {user_uid}")
                
        except Exception as e:
            logger.error(f"Error processing graph data in background: {e}")

    if ai_response.updated_preferences:
        try:
            user_ref.update({"ChatPreferences": ai_response.updated_preferences})
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
            
            title_client = genai.Client(api_key="AIzaSyA9z3L28gtJ91FJpl-YX3Bam00UCVF6Qyw")
            title_response = await title_client.aio.models.generate_content(
                model='gemini-1.5-flash-latest',
                contents=f"{titleprompt}\n\nPlease generate a short, descriptive conversation title for this message:\n{first_message_content}"
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
    client: genai.Client,
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
        summarization_response = await client.aio.models.generate_content(
            model='gemini-1.5-flash-latest',
            contents=summary_prompt
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
    raw_request: Request,
    background_tasks: BackgroundTasks,
    user_info: dict = Depends(verify_token),
    request: str = Form(...),
    files: Optional[List[UploadFile]] = File(None),
    ai_mode: Optional[str] = Form("default")
):
    try:
        request_data = json.loads(request)
        chat_request = ChatRequestWithDocs(**request_data)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON in request field: {e}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid request data: {e}")

    user_uid = user_info["uid"]
    user_ref = db.collection("users").document(user_uid)

    conversation_id = chat_request.conversation_id
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

    all_messages: List[Message] = [Message(**msg) for msg in chat_request.messages]
    if all_messages and not all_messages[-1].timestamp:
        all_messages[-1].timestamp = now

    user_doc = user_ref.get()
    user_data = user_doc.to_dict() if user_doc.exists else {}
    
    # normal, plan, reflect, review
    if ai_mode == "normal":
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
                "Context: {bulletProse}. "
                "You can update user preferences by setting updated_preferences in your response. "
                "You can update the user's knowledge graph by setting updated_graph with nodes and edges. "
                "You can set a reaction emoji by setting reaction in your response."
            )
    elif ai_mode == "plan":
        try:
            with open("planprompt.txt", "r") as f:
                prompt_template = f.read()
        except FileNotFoundError:
            logger.error("planprompt.txt not found. Using a default prompt template.")
            prompt_template = (
                "You are a helpful AI assistant named {name}. "
                "The current date is {date} and time is {time}. "
                "Your user is {user}. "
                "Your location is {location} in {country}. "
                "Here are some instructions: {instructionSet}. "
                "Your personalities are: {personalities}. "
                "Context: {bulletProse}. "
                "You can update user preferences by setting updated_preferences in your response. "
                "You can update the user's knowledge graph by setting updated_graph with nodes and edges. "
                "You can set a reaction emoji by setting reaction in your response."
            )
    elif ai_mode == "reflect":
        try:
            with open("reflectprompt.txt", "r") as f:
                prompt_template = f.read()
        except FileNotFoundError:
            logger.error("reflectprompt.txt not found. Using a default prompt template.")
            prompt_template = (
                "You are a helpful AI assistant named {name}. "
                "The current date is {date} and time is {time}. "
                "Your user is {user}. "
                "Your location is {location} in {country}. "
                "Here are some instructions: {instructionSet}. "
                "Your personalities are: {personalities}. "
                "Context: {bulletProse}. "
                "You can update user preferences by setting updated_preferences in your response. "
                "You can update the user's knowledge graph by setting updated_graph with nodes and edges. "
                "You can set a reaction emoji by setting reaction in your response."
            )
    elif ai_mode == "review":
        try:
            with open("reviewprompt.txt", "r") as f:
                prompt_template = f.read()
        except FileNotFoundError:
            logger.error("reviewprompt.txt not found. Using a default prompt template.")
            prompt_template = (
                "You are a helpful AI assistant named {name}. "
                "The current date is {date} and time is {time}. "
                "Your user is {user}. "
                "Your location is {location} in {country}. "
                "Here are some instructions: {instructionSet}. "
                "Your personalities are: {personalities}. "
                "Context: {bulletProse}. "
                "You can update user preferences by setting updated_preferences in your response. "
                "You can update the user's knowledge graph by setting updated_graph with nodes and edges. "
                "You can set a reaction emoji by setting reaction in your response."
            )

    system_prompt = prompt_template.replace("{bulletProse}", chat_request.bulletProse)
    system_prompt = system_prompt.replace("{name}", user_data.get("systemName", "AI"))
    system_prompt = system_prompt.replace("{date}", datetime.date.today().strftime("%Y-%m-%d"))
    system_prompt = system_prompt.replace("{time}", datetime.datetime.now().strftime("%H:%M:%S"))
    system_prompt = system_prompt.replace("{location}", user_data.get("location", "Unknown"))
    system_prompt = system_prompt.replace("{user}", user_data.get("name", "User"))
    system_prompt = system_prompt.replace("{instructionSet}", user_data.get("ChatPreferences", ""))
    system_prompt = system_prompt.replace("{personalities}", ",".join(user_data.get("personalities", [])))
    system_prompt = system_prompt.replace("{country}", user_data.get("country", "Unknown"))

    client = OpenAI(
        api_key="AIzaSyA9z3L28gtJ91FJpl-YX3Bam00UCVF6Qyw",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    messages_for_gemini_processing = list(all_messages)

    # total_tokens = sum(len(msg.content.split()) for msg in messages_for_gemini_processing) 
    total_tokens = 3 # I think it is so cheap that this is fine, I'm charging like $1 per 10 messages, and 10 messages costs me maybe like .2$
    if not CreditManager.deduct_credits(user_ref, total_tokens/3):
        raise HTTPException(status_code=402, detail="Insufficient credits")
    
    processed_messages_for_gemini = await summarize_long_chat_history(
        messages_for_gemini_processing,
        client,
        10
    )
    logger.info(f"Messages prepared for Gemini (after potential summarization): {len(processed_messages_for_gemini)} messages.")

    openai_messages = [{"role": "system", "content": system_prompt}]
    
    for msg in processed_messages_for_gemini:
        role = 'assistant' if msg.role == 'assistant' else 'user'
        openai_messages.append({
            "role": role,
            "content": msg.content
        })

    if files:
        file = files[0]
        file_content = await file.read()
        file_name = file.filename
        logger.info(f"Received file: {file_name} with size {len(file_content)} bytes")
        
        base64_file = base64.b64encode(file_content).decode('utf-8')
        
        mime_type = file.content_type or "application/octet-stream"
        
        if mime_type.startswith('image/'):
            if openai_messages and openai_messages[-1]["role"] == "user":
                last_message = openai_messages[-1]
                openai_messages[-1] = {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": last_message["content"]
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_file}"
                            }
                        }
                    ]
                }
            else:
                openai_messages.append({
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_file}"
                            }
                        }
                    ]
                })
        else:
            file_content_text = f"[File: {file_name}]"
            if openai_messages and openai_messages[-1]["role"] == "user":
                openai_messages[-1]["content"] += f"\n{file_content_text}"
            else:
                openai_messages.append({
                    "role": "user",
                    "content": file_content_text
                })

    try:
        completion = client.beta.chat.completions.parse(
            model="gemini-2.0-flash",
            messages=openai_messages,
            response_format=AiChatResponse,
        )
        
        structured_response = completion.choices[0].message.parsed
        
        logger.info(f"Generated structured response for conversation {conversation_id}")
        
    except Exception as e:
        logger.error(f"Error during structured response generation: {e}")

        structured_response = AiChatResponse(
            reply="Error: Could not get response from AI. Got error: " + str(e),
            updated_preferences="",
            updated_graph="{}",
        )
    
    background_tasks.add_task(
        post_stream_save_to_db,
        user_ref=user_ref,
        conversation_ref=conversation_ref,
        all_messages=all_messages,
        ai_response=structured_response,
        is_brand_new_conversation=is_brand_new_conversation_this_call
    )

    headers = {"X-Conversation-Id": conversation_id}
    return Response(
        content=structured_response.reply,
        media_type="text/plain",
        headers=headers
    )

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
            "Graph": {},
            "credits": 50,
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
        
        if "graph_history" in user_data and user_data["graph_history"]:
            return {
                "graph_history": user_data["graph_history"],
            }
        else:
            legacy_graph = {
                "nodes": user_data.get("nodes", []),
                "edges": user_data.get("edges", []),
            }
            return {
                "graph_history": [legacy_graph] if legacy_graph["nodes"] or legacy_graph["edges"] else [],
            }
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
        
        update_data = {}

        existing_user_data = user_doc.to_dict()
        if "graph_history" in existing_user_data and existing_user_data["graph_history"]:
            current_history = existing_user_data["graph_history"]
            current_index = existing_user_data.get("current_graph_index", len(current_history) - 1)
        else:
            current_history = []
            current_index = 0

        if not isinstance(current_history, list):
            current_history = [current_history]

        if "graph_history" in user_data["user_data"]:
            update_data.update({
                "graph_history": current_history + [user_data["user_data"]["graph_history"]],
            })
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid graph data format"
            )
        
        user_ref.update(update_data)
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
        mission_statement = user_data.get("missionStatement", "")
        core_values = user_data.get("coreValues", [])
        life_domains = user_data.get("lifeDomains", [])
        return {"missionStatement": mission_statement, "coreValues": core_values, "lifeDomains": life_domains}
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
        mission_statement = prefs.get("missionStatement", "")
        core_values = prefs.get("coreValues", [])
        life_domains = prefs.get("lifeDomains", [])

        user_ref = db.collection("users").document(user_info["uid"])
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_ref.update({
            "missionStatement": mission_statement,
            "coreValues": core_values,
            "lifeDomains": life_domains
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
    # Decided not to actually even have user preferences, deprecated them in order to have a more structured format
    # This is kept to allow the user to say they like/dislike something without actually doing anything about it.
    return {"message": "Preferences updated successfully"}


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

@app.post("/update_background_image")
async def update_background_image(user_info: dict = Depends(verify_token), body: dict = Body(...)):
    background_image_url = body.get("backgroundImageUrl")
    
    if background_image_url is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Background image URL is required"
        )
    
    try:
        user_ref = db.collection("users").document(user_info["uid"])
        user_ref.update({
            "backgroundImageUrl": background_image_url
        })
        return {"message": "Background image updated successfully"}
    except Exception as e:
        logger.error(f"Error updating background image: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating background image: {str(e)}"
        )

@app.post("/remove_background_image")
async def remove_background_image(user_info: dict = Depends(verify_token)):
    try:
        user_ref = db.collection("users").document(user_info["uid"])
        user_ref.update({
            "backgroundImageUrl": ""
        })
        return {"message": "Background image removed successfully"}
    except Exception as e:
        logger.error(f"Error removing background image: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error removing background image: {str(e)}"
        )

@app.get("/background_image")
async def get_background_image(user_info: dict = Depends(verify_token)):
    try:
        user_ref = db.collection("users").document(user_info["uid"])
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_data = user_doc.to_dict()
        background_image = {
            "backgroundImageUrl": user_data.get("backgroundImageUrl", "")
        }
        return background_image
    except Exception as e:
        logger.error(f"Error retrieving background image: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving background image: {str(e)}"
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

@app.post("/custom_personality")
async def create_custom_personality(user_info: dict = Depends(verify_token), body: dict = Body(...)):
    personality_name = body.get("name", "")
    personality_icon = body.get("icon", "")
    if not personality_name or not personality_icon:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Personality name and icon are required"
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
        custom_personalities = user_data.get("customPersonalities", [])
        
        new_personality = {
            "name": personality_name,
            "icon": personality_icon
        }
        
        custom_personalities.append(new_personality)
        
        user_ref.update({
            "customPersonalities": custom_personalities
        })
        
        return {"message": "Custom personality created successfully"}
    except Exception as e:
        logger.error(f"Error creating custom personality: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating custom personality: {str(e)}"
        )

@app.get("/custom_personalities")
async def get_custom_personalities(user_info: dict = Depends(verify_token)):
    try:
        user_ref = db.collection("users").document(user_info["uid"])
        user_doc = user_ref.get()

        if not user_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_data = user_doc.to_dict()
        custom_personalities = user_data.get("customPersonalities", [])
        return {"custom_personalities": custom_personalities}
    except Exception as e:
        logger.error(f"Error retrieving custom personalities: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving custom personalities: {str(e)}"
        )

if __name__ == "__main__":
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True, log_level="info")