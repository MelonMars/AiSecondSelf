import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Network, Target, User, Send, Loader, ChevronRight, LogOut, LogIn, UserPlus, Star, Camera, Share, Copy, X } from "lucide-react";
import GraphView from "./GraphView";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, EmailAuthProvider, linkWithCredential, updateProfile, onAuthStateChanged, getAuth, fetchSignInMethodsForEmail } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import ChatComponent from "./chat";
import ProfileComponent from "./Profile";
import SharedComponent from "./Shared";

const TABS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "graph", label: "Graph", icon: Network },
  { id: "profile", label: "Profile", icon: User },
  { id: "shared", label: "Shared", icon: Share}
];

const saveGraphData = async (graphData) => {
  const authToken = localStorage.getItem("authToken"); 
  if (!authToken) {
      console.warn("No auth token found. Cannot save graph data.");
      return false;
  }
  const dataToSave = {
      nodes: Array.isArray(graphData?.nodes) ? graphData.nodes : [],
      edges: Array.isArray(graphData?.edges) ? graphData.edges : []
  };
  try {
    console.log("Saving graph data:", dataToSave);
    const response = await fetch("http://127.0.0.1:8000/user_data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        user_data: dataToSave
      })
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to save graph data:", response.status, errorText);
        return false;
    }
    console.log("Graph data saved successfully");
    return true;
  } catch (error) {
    console.error("Error saving graph data:", error);
    return false;
  }
};


export default function App() {
  const [tab, setTab] = useState("chat");

  const [authToken, setAuthToken] = useState(localStorage.getItem("authToken"));
  const [uid, setUid] = useState(localStorage.getItem("uid"));
  const [userName, setUserName] = useState(localStorage.getItem("userName") || "");
  const [userEmail, setUserEmail] = useState(localStorage.getItem("userEmail") || "");

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState("");
  const [linkError, setLinkError] = useState(""); 

  const [graphData, setGraphData] = useState(null);
  const [chatPrefs, setChatPrefs] = useState("");

  const [sharedURL, setSharedURL] = useState("");
  const [showSharedModal, setShowSharedModal] = useState(false);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState([]); 
  const [currentConversationId, setCurrentConversationId] = useState(null); 
  const [isConversationsLoading, setIsConversationsLoading] = useState(false);
  const [starredConversations, setStarredConversations] = useState([]);
  const [darkMode, setDarkMode] = useState(true);


  const messagesEndRef = useRef(null);

  const inputRef = useRef(null);

  const signInWithGoogle = async () => {
    setIsLoading(true);
    setAuthError("");
    setLinkError("");

    try {
        const result = await signInWithPopup(auth, googleProvider);
        console.log("Google sign-in successful:", result.user);
        setShowAuthModal(false);
    } catch (error) {
        console.error("Google sign-in error:", error);
        if (error.code === 'auth/account-exists-with-different-credential') {
            const email = error.customData.email;
            setAuthError(`An account with this email (${email}) already exists. Please log in with your email and password first, then link your Google account.`);
        } else {
            setAuthError(error.message);
        }
    } finally {
        setIsLoading(false);
        fetchConversations();
    }
};

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) {
        user.getIdToken().then(idToken => {
           setAuthToken(idToken);
           setUid(user.uid);
           setUserName(user.displayName || "User");
           setUserEmail(user.email || "");
           localStorage.setItem("authToken", idToken);
           localStorage.setItem("uid", user.uid);
           localStorage.setItem("userName", user.displayName || "User");
           localStorage.setItem("userEmail", user.email || "");

           console.log("Firebase auth state changed. User logged in.");
           setIsLoading(false);

           setTimeout(() => {
             if (graphData === null) {
               fetchUserData(idToken);
               fetchUserPrefs(idToken);
             }
           }, 0);
        }).catch(error => {
             console.error("Failed to get ID token:", error);
             setIsLoading(false);
             logout();
        });
      } else {
        setAuthToken(null);
        setUid(null);
        setUserName("");
        setUserEmail("");
        localStorage.removeItem("authToken");
        localStorage.removeItem("uid");
        localStorage.removeItem("userName");
        localStorage.removeItem("userEmail");

        setMessages([]);
        setConversations([]); 
        setCurrentConversationId(null);
        setGraphData({ nodes: [], edges: [] }); 
        setIsLoading(false);
        setIsConversationsLoading(false); 
        console.log("Firebase auth state changed. User logged out.");
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (authToken) {
      fetchConversations();
    } else {
      setConversations([]);
    }
  }, [authToken]);


  useEffect(() => {
    if (tab === "chat") {
      inputRef.current?.focus();
    }
  }, [tab]);


  const fetchConversations = async () => {
    if (!authToken) {
        setConversations([]);
        return;
    }

    setIsConversationsLoading(true);
    try {
        const headers = { "Authorization": `Bearer ${authToken}` };
        const res = await fetch("http://127.0.0.1:8000/conversations", { headers });

        if (!res.ok) {
            if (res.status === 401) {
                setAuthError("Authentication failed. Please log in again.");
                setShowAuthModal(true);
                logout();
            }
            throw new Error(`Server error: ${res.status}`);
        }

        const data = await res.json();
        setConversations(data);
        console.log("Fetched conversations:", data);
        for (const conversation of data) {
            if (conversation.starred) {
                console.log("Starred conversation found:", conversation);
                setStarredConversations((prev) => [...prev, conversation]);
            }
        }
      } catch (error) {
        console.error("Error fetching conversations:", error);
    } finally {
        setIsConversationsLoading(false);
    }
  };

  useEffect(() => {
    console.log("Starred conversations updated:", starredConversations);
  }, [starredConversations]);

  const onToggleStar = async (conversationId) => {
      if (!authToken) {
          setAuthError("Please log in to star conversations.");
          setShowAuthModal(true);
          return;
      }
      const headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
      };
      try {
          const res = await fetch("http://127.0.1:8000/star_conversation", {
              method: "POST",
              headers: headers,
              body: JSON.stringify(conversationId)
          });
          if (!res.ok) {
              if (res.status === 401) {
                  setAuthError("Authentication failed. Please log in again.");
                  setShowAuthModal(true);
                  logout();
              }
              throw new Error(`Server error: ${res.status}`);
          }
          const data = await res.json();
          console.log("Star conversation response:", data);
          if (data.success) {
              setStarredConversations((prev) => {
                  const isStarred = prev.some((conv) => conv.id === conversationId);
                  if (isStarred) {
                      return prev.filter((conv) => conv.id !== conversationId);
                  } else {
                      const starredConv = conversations.find((conv) => conv.id === conversationId);
                      return [...prev, starredConv];
                  }
              });
          } else {
              console.error("Failed to toggle star status:", data.message);
          }
      } catch (error) {
          console.error("Error toggling star status:", error);
      }
    }

  const renameConversation = async (conversationId, newName) => {
    if (!authToken) {
        setAuthError("Please log in to rename conversations.");
        setShowAuthModal(true);
        return;
    }
    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
    };
    try {
        const res = await fetch("http://127.0.0.1:8000/change_conversation_title", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({ conversation_id: conversationId, title: newName })
        });
        if (!res.ok) {
            if (res.status === 401) {
                setAuthError("Authentication failed. Please log in again.");
                setShowAuthModal(true);
                logout();
            }
            throw new Error(`Server error: ${res.status}`);
        }
        const data = await res.json();
        console.log("Rename conversation response:", data);
        if (data.success) {
            setConversations((prev) => {
                return prev.map((conv) => {
                    if (conv.id === conversationId) {
                        return { ...conv, title: newName };
                    }
                    return conv;
                });
            });
        } else {
            console.error("Failed to rename conversation:", data.message);
        }
      } catch (error) {
        console.error("Error renaming conversation:", error);
      }

      fetchConversations();
  }

  const loadConversation = async (conversationId) => {
      if (!authToken || conversationId === currentConversationId) {
           return;
      }

      setIsLoading(true);
      setCurrentConversationId(conversationId); 
      setMessages([]);

      try {
           const headers = { "Authorization": `Bearer ${authToken}` };
           const res = await fetch(`http://127.0.0.1:8000/conversations/${uid}/${conversationId}`, { headers });

           if (!res.ok) {
               if (res.status === 401) {
                   setAuthError("Authentication failed. Please log in again.");
                   setShowAuthModal(true);
                   logout();
               } else if (res.status === 404) {
                    console.warn(`Conversation ${conversationId} not found. Starting a new chat.`);
                    startNewConversation(); 
                    setMessages([{ role: "assistant", content: "Conversation not found. Starting a new chat." }]);
               } else {
                    throw new Error(`Server error: ${res.status}`);
               }
               return;
           }

           const data = await res.json();
           setMessages(data.messages);
           console.log("Loaded conversation:", conversationId);

        } catch (error) {
            console.error(`Error loading conversation ${conversationId}:`, error);
            setMessages([{ role: "assistant", content: "Failed to load conversation." }]);
        } finally {
            setIsLoading(false); 
        }
  };

  const sendMessage = async (messageInput) => {
    console.log("Attempting to send message in App.js"); 
    console.log("Input state:", messageInput, "AuthToken exists:", !!authToken, "IsLoading state:", isLoading); 

    if (!messageInput.trim()) {
      console.log("Input is empty, returning.");
      return;
    }
    if (!authToken) {
      console.log("Auth token missing, cannot send.");
      setAuthError("Please log in to send messages.");
      setShowAuthModal(true);
      return;
    }
    if (isLoading) {
      console.log("Already loading, ignoring send.");
      return;
    }

    const userMessageContent = messageInput;
    const userMessage = { role: "user", content: userMessageContent };

    const bulletProse = graphData ? JSON.stringify(graphData) : null;

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    console.log("c:", [...messages, userMessage]);
    try {
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      };

      console.log("Bullet Prose is:", bulletProse);

      const requestBody = {
        messages: [...messages, userMessage],
        conversation_id: currentConversationId,
        bulletProse: bulletProse
      };

      console.log("Sending message to server from App.js:", requestBody);

      const res = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      console.log("Got response from server in App.js:", res.ok, res.status); 

      if (!res.ok) {
        const errorText = await res.text(); 
        console.error(`Server error ${res.status}:`, errorText);

        if (res.status === 401) {
          setAuthError("Authentication failed. Please log in again.");
          setShowAuthModal(true);
          logout();
        }
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: `Error from server: ${res.status}. Details: ${errorText.substring(0, 150)}...`
        }]);
        return; 
      }

      const data = await res.json();
      console.log("AI response data from App.js:", data);

      if (data && data.reply) {
        const aiMessage = { role: "assistant", content: data.reply };
        setMessages((prev) => [...prev, aiMessage]);

        if (data.conversation_id && data.conversation_id !== currentConversationId) {
          console.log("Backend created new conversation with ID:", data.conversation_id);
          setCurrentConversationId(data.conversation_id); 
          fetchConversations();
        } else if (currentConversationId) {
          fetchConversations();
        } else if (data.conversation_id && !currentConversationId) {
          setCurrentConversationId(data.conversation_id);
          fetchConversations();
        }

      } else {
        console.warn("AI response data missing 'reply' field in App.js:", data);
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "Received unexpected response from AI. Response data:",
        }]);
      }

    } catch (error) { 
      console.error("Network or processing error in App.js sendMessage:", error);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, there was a connection or processing error. Please try again later."
      }]);
    } finally {
      console.log("sendMessage finally block reached in App.js");
      setIsLoading(false); 
    }
  };

  const sendMessages = async (messages) => {
    console.log("Attempting to send messages in App.js");
    if (!authToken) {
      console.log("Auth token missing, cannot send.");
      setAuthError("Please log in to send messages.");
      setShowAuthModal(true);
      return;
    }
    if (isLoading) {
      console.log("Already loading, ignoring send.");
      return;
    }
    setMessages(messages);
    setInput("");
    setIsLoading(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      };
      const bulletProse = graphData ? JSON.stringify(graphData) : null;
      const requestBody = {
        messages: messages,
        conversation_id: currentConversationId,
        bulletProse: bulletProse
      };
      const res = await fetch("http://127.0.1:8000/chat", {
        method: "POST",
        headers: headers,
        body: JSON.stringify(requestBody)
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Server error ${res.status}:`, errorText);
        if (res.status === 401) {
          setAuthError("Authentication failed. Please log in again.");
          setShowAuthModal(true);
          logout();
        }
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: `Error from server: ${res.status}. Details: ${errorText.substring(0, 150)}...`
        }]);
        return;
      }
      const data = await res.json();
      console.log("AI response data from App.js:", data);
      if (data && data.reply) {
        const aiMessage = { role: "assistant", content: data.reply };
        setMessages((prev) => [...prev, aiMessage]);
        if (data.conversation_id && data.conversation_id !== currentConversationId) {
          console.log("Backend created new conversation with ID:", data.conversation_id);
          setCurrentConversationId(data.conversation_id);
          fetchConversations();
        } else if (currentConversationId) {
          fetchConversations();
        } else if (data.conversation_id && !currentConversationId) {
          setCurrentConversationId(data.conversation_id);
          fetchConversations();
        }
      } else {
        console.warn("AI response data missing 'reply' field in App.js:", data);
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "Received unexpected response from AI. Response data:",
        }]);
      }
    } catch (error) {
      console.error("Network or processing error in App.js sendMessages:", error);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, there was a connection or processing error. Please try again later."
      }]);
    }
    finally {
      console.log("sendMessages finally block reached in App.js");
      setIsLoading(false);
    }
  }

  const startNewConversation = () => {
      console.log("Starting new conversation in App.js");
      setCurrentConversationId(null); 
      setMessages([]);
      setInput(""); 
      inputRef.current?.focus();
  };

  const renderAuthModal = () => {
     if (!showAuthModal) return null;
      return (
        <div className={`fixed inset-0 ${darkMode ? 'bg-gray-900' : 'bg-black'} bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn`}>
            <div className={`${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} rounded-lg p-6 w-full max-w-md`}>
                <h2 className="text-2xl font-medium mb-4">
                    {authMode === "login" ? "Log in" : "Sign up"}
                </h2>

                {authError && (
                    <div className={`mb-4 p-3 ${darkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-700'} rounded-md text-sm`}>
                        {authError}
                    </div>
                )}
                {linkError && (
                    <div className={`mb-4 p-3 ${darkMode ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-100 text-yellow-700'} rounded-md text-sm`}>
                        {linkError}
                    </div>
                )}

                <div className="space-y-4">
                    {authMode === "signup" && (
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className={`w-full px-3 py-2 border ${darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                placeholder="Your name"
                            />
                        </div>
                    )}

                    <div>
                        <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={`w-full px-3 py-2 border ${darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            placeholder="your@email.com"
                        />
                    </div>

                    <div>
                        <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`w-full px-3 py-2 border ${darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <div className="mt-6">
                    <button
                        onClick={authMode === "login" ? login : signup}
                        disabled={isLoading}
                        className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-white ${darkMode ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                    >
                        {isLoading ? (
                            <Loader size={20} className="animate-spin" />
                        ) : (
                            authMode === "login" ? "Log in" : "Sign up"
                        )}
                    </button>
                </div>

                <div className="mt-4 text-center">
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Or
                    </p>
                    <button
                        onClick={signInWithGoogle}
                        disabled={isLoading}
                        className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-gray-800 ${darkMode ? 'bg-white hover:bg-gray-200' : 'bg-gray-100 hover:bg-gray-200'} mt-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500`}
                    >
                        {isLoading ? (
                            <Loader size={20} className="mr-2 animate-spin" />
                        ) : (
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" className="w-5 h-5 mr-2" />
                        )}
                        Sign in with Google
                    </button>
                </div>

                <div className="mt-4 text-center">
                    {authMode === "login" ? (
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Don't have an account?{" "}
                            <button
                                onClick={() => {
                                    setAuthMode("signup");
                                    setAuthError("");
                                    setLinkError("");
                                }}
                                className="text-blue-600 hover:text-blue-800 focus:outline-none"
                            >
                                Sign up
                            </button>
                        </p>
                    ) : (
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Already have an account?{" "}
                            <button
                                onClick={() => {
                                    setAuthMode("login");
                                    setAuthError("");
                                    setLinkError("");
                                }}
                                className="text-blue-600 hover:text-blue-800 focus:outline-none"
                            >
                                Log in
                            </button>
                        </p>
                    )}
                </div>

                <div className="mt-4 text-center">
                    <button
                        onClick={() => setShowAuthModal(false)}
                        className={`text-sm ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'} focus:outline-none`}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
      );
  };

  const fetchUserPrefs = async (token) => {
    if (!token) return;
    try {
      console.log("Fetching user prefs with token:", token);
      const response = await fetch("http://127.0.0.1:8000/user_prefs", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setChatPrefs(data.prefs || "");
      } else {
         if (response.status === 401) {
            console.error("Auth failed fetching user prefs. Logging out.");
            logout();
         } else {
            console.error("Failed to fetch user preferences", response.status);
         }
         setChatPrefs("");
      }
    }
    catch (error) {
      console.error("Error fetching user preferences:", error);
       setChatPrefs(""); 
    } finally {
      // Don't set loading, bc you need to fetch more than one thing
    }
  };


    const fetchUserData = async (token) => {
      if (!token) {
          setGraphData({ nodes: [], edges: [] });
          return;
      }
      setIsLoading(true);
      try {
        console.log("Fetching user data with token:", token);
        const response = await fetch("http://127.0.0.1:8000/user_data", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
  
        if (response.ok) {
          const data = await response.json();
          if (data && data.user_data && (Array.isArray(data.user_data.nodes) || Array.isArray(data.user_data.edges))) {
             const nodes = Array.isArray(data.user_data.nodes) ? data.user_data.nodes.map(node => ({
               ...node,
               type: node.type || 'default',
               description: node.description || ''
             })) : [];
             const edges = Array.isArray(data.user_data.edges) ? data.user_data.edges : [];
  
             setGraphData({ nodes, edges }); 
  
          } else if (data && (Array.isArray(data.nodes) || Array.isArray(data.edges))) {
               const nodes = Array.isArray(data.nodes) ? data.nodes.map(node => ({
                  ...node,
                  type: node.type || 'default',
                  description: node.description || ''
               })) : [];
               const edges = Array.isArray(data.edges) ? data.edges : [];
               setGraphData({ nodes, edges });
  
          }
           else {
            console.warn("Fetched user data is not in expected format. Loading empty graph.", data);
            setGraphData({ nodes: [], edges: [] });
          }
        } else {
           if (response.status === 401) {
              console.error("Auth failed fetching user data. Logging out.");
              logout();
           } else {
              console.error("Failed to fetch user data", response.status);
              setGraphData({ nodes: [], edges: [] }); 
           }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
         setGraphData({ nodes: [], edges: [] });
      } finally {
          setIsLoading(false); 
      }
    };
    
    const handleGraphDataChange = async (updatedStructuralGraphData) => {
      console.log("Graph data changed by GraphView (structural):", updatedStructuralGraphData);
      setGraphData(updatedStructuralGraphData);
      const success = await saveGraphData(updatedStructuralGraphData);
      return success;
    };
    const handleChatPrefsChange = (newValue) => {
      setChatPrefs(newValue); 
      const authToken = localStorage.getItem("authToken");
      if (!authToken) {
          console.warn("No auth token found. Cannot save chat preferences.");
          return;
      }
  
      fetch("http://127.0.0.1:8000/user_prefs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ prefs: newValue })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error("Failed to update user preferences");
        }
        return response.json();
      })
      .then(data => {
        console.log("User preferences updated:", data);
      })
      .catch(error => {
        console.error("Error updating user preferences:", error);
      });
    };

    const login = async () => {
      setIsLoading(true);
      setAuthError("");
      setLinkError("");

      try {
          console.log("Signing in with email:", email, "and password:", password);
          await signInWithEmailAndPassword(auth, email, password);
          console.log("Email/Password login successful!");
          setShowAuthModal(false);
      } catch (error) {
          console.error("Login error:", error);
          if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            try {
              const signInMethods = await fetchSignInMethodsForEmail(auth, email);

              if (signInMethods.includes(googleProvider.providerId)) {
                setAuthError("This email is registered with a Google account. Please log in with that instead.")
              } else {
                console.log("Sign in methods for email:", signInMethods);
                setAuthError("Invalid email or password. Please try again.");
              }
            } catch (e) {
              console.error("Error fetching sign-in methods:", e);
              setAuthError("Login failed. Please check your network connection and try again.");
            }
          }
      } finally {
          setIsLoading(false);
      }
  };

    const signup = async () => {
      setAuthError("");
      if (!email || !password || !name) {
        setAuthError("All fields are required");
        return;
      }
  
      setIsLoading(true);
      try {
        const response = await fetch("http://127.0.0.1:8000/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name })
        });
  
        const data = await response.json();
  
        if (!response.ok) {
          throw new Error(data.detail || "Signup failed");
        }
  
         await signInWithEmailAndPassword(auth, email, password);
  
        setShowAuthModal(false);
        setEmail("");
        setPassword("");
        setName("");
  
      } catch (error) {
        setAuthError(error.message);
        console.error("Signup error:", error);
      } finally {
      }
    };

    const logout = async () => {
       setIsLoading(true);
       try {
          const firebaseAuth = getAuth();
          await firebaseAuth.signOut();
       } catch (error) {
          console.error("Error signing out:", error);
          setAuthToken(null); setUid(null); setUserName(""); setUserEmail("");
          localStorage.removeItem("authToken"); localStorage.removeItem("uid");
          localStorage.removeItem("userName"); localStorage.removeItem("userEmail");
          setMessages([]); setConversations([]); setCurrentConversationId(null);
          setGraphData({ nodes: [], edges: [] });
       } finally {
          setIsLoading(false);
       }
    };

    const handleGoogleLinkAfterEmailLogin = async (googleCredential) => {
      setLinkError("");
      try {
          await linkWithCredential(auth.currentUser, googleCredential);
          console.log("Google account linked successfully!");
          setShowAuthModal(false);
      } catch (error) {
          console.error("Error linking Google account:", error);
          setLinkError("Failed to link Google account. " + error.message);
      }
    };

    const sendMessageWithDoc = async (file) => {
         if (!file || file.type !== "text/plain") {
            console.error("only .txt files are supported");
            return;
          }

          const headers = {};
          if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`;
          } else {
               console.warn("No auth token available to send document.");
               setAuthError("Please log in to upload documents.");
               setShowAuthModal(true);
               return;
          }

          const graphDataString = graphData ? JSON.stringify(graphData) : null;
          const formData = new FormData();
          formData.append("txt_file", file);
          formData.append("bulletProse", graphDataString);

          setIsLoading(true);
          try {
            const res = await fetch("http://127.0.0.1:8000/update_graph_with_doc", {
              method: "POST",
              headers: {
                  "Authorization": `Bearer ${authToken}`
              },
              body: formData,
            });

            if (!res.ok) {
              if (res.status === 401) {
                setAuthError("Authentication failed. Please log in again.");
                setShowAuthModal(true);
                 logout();
                 return;
              }
               const errorText = await res.text();
               console.error(`Server error ${res.status}:`, errorText);
               setMessages((prev) => [ 
                  ...prev,
                  { role: "assistant", content: `Error processing document: ${res.status}. Details: ${errorText.substring(0, 100)}...` },
                ]);
               return;
            }

            const data = await res.json();
            console.log("Document processed response:", data);

            if (data && data.updated_graph && Array.isArray(data.updated_graph.nodes)) {
                console.log("Received updated graph from backend after doc processing");
                const nodes = Array.isArray(data.updated_graph.nodes) ? data.updated_graph.nodes.map(node => ({
                    ...node,
                    type: node.type || 'default',
                    description: node.description || ''
                })) : [];
                const edges = Array.isArray(data.updated_graph.edges) ? data.updated_graph.edges : [];

                setGraphData({ nodes, edges });
            } else {
                 console.warn("Backend did not return updated graph data in expected format after doc processing.");
            }

             if (data && data.reply) {
                  const injectElem = document.getElementById("doc-result");
                   if (injectElem) {
                      injectElem.innerHTML = data.reply;
                   } else {
                       console.warn("Element with ID 'doc-result' not found. Document reply not displayed.");
                        setMessages((prev) => [...prev, { role: "assistant", content: `Document processed. Reply: ${data.reply}` }]);
                   }
             } else {
                  console.warn("Backend did not return a 'reply' field after doc processing.");
                   setMessages((prev) => [...prev, { role: "assistant", content: "Document processed." }]);
             }


          } catch (error) {
            console.error("Error sending document:", error);
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: "Sorry, there was an error processing your document." },
            ]);
             const injectElem = document.getElementById("doc-result");
             if (injectElem) {
                 injectElem.innerHTML = `Error: ${error.message}`;
             }
          } finally {
            setIsLoading(false);
          }
    };

  const updateMessages = (newMessages) => {
    setMessages(newMessages);
  }

  const shareConversation = async (conversationId) => {
    console.log("Sharing conversation with ID:", conversationId);

    if (!authToken) {
      console.warn("No auth token found. Cannot share conversation.");
      setAuthError("Please log in to share conversations.");
      setShowAuthModal(true);
      return;
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json"
    };

    try {
      const res = await fetch("http://127.0.0.1:8000/share_conversation", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ conversation_id: conversationId })
      });

      if (!res.ok) {
        if (res.status === 401) {
          setAuthError("Authentication failed. Please log in again.");
          setShowAuthModal(true);
          logout();
        }
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      if (data.conversation_url) {
        console.log("Conversation shared successfully. URL:", data.conversation_url);
        setSharedURL(data.conversation_url);
        setShowSharedModal(true);
      } else {
        console.warn("No conversation URL returned from backend.");
      }
    } catch (error) {
      console.error("Error sharing conversation:", error);
    }
  };

  const copySharedURL = async () => {
    try {
      await navigator.clipboard.writeText(sharedURL);
      console.log("Shared URL copied to clipboard:", sharedURL);
      const copyButton = document.getElementById("copy-button");
      if (copyButton) {
        copyButton.classList.add("bg-green-500", "text-white");
        setTimeout(() => {
          copyButton.classList.remove("bg-green-500", "text-white");
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to copy URL: ", err);
      alert("Failed to copy URL.");
    }
  };

  const handleLikeMessage = (index, content) => {
    console.log("Liked message: ", index);
    handlePrefMessage(content, "liked");
  }

  const handleDislikeMessage = (index, content) => {
    console.log("Disliked message: ", index);
    handlePrefMessage(content, "disliked");
  }

  const handlePrefMessage = async (content, pref) => {
    const headers = {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json"
    }
    const requestBody = {
      targetMessage: content,
      convoHistory: messages,
      pref: pref
    };
    const res = await fetch("http://127.0.0.1:8000/update_prefs_from_message", {
      method: "POST",
      headers: headers,
      body: JSON.stringify(requestBody)
    }); 
    if (!res.ok) {
      if (res.status === 401) {
        setAuthError("Authentication failed. Please log in again.");
        setShowAuthModal(true);
        logout();
      }
      throw new Error(`Server error: ${res.status}`);
    }
    const data = await res.json();
    console.log("Preference message response:", data);
  }

  return (
    <div className={`flex flex-col h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex overflow-x-auto hide-scrollbar">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.id;

              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center px-6 py-4 transition-all focus:outline-none border-b-2 ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : `border-transparent ${darkMode ? 'text-gray-400 hover:text-gray-300 hover:border-gray-600' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}`
                  }`}
                >
                  <Icon size={18} className="mr-2" />
                  <span className="font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pr-4">
            {authToken ? (
              <div className="flex items-center">
                <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'} mr-3`}>{userName}</span>
                <button
                  onClick={logout}
                  className={`flex items-center text-sm ${darkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  <LogOut size={16} className="mr-1" />
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                    setShowAuthModal(true);
                  }}
                  className={`flex items-center text-sm ${darkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  <LogIn size={16} className="mr-1" />
                  Log in
                </button>
                <button
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthError("");
                    setShowAuthModal(true);
                  }}
                  className={`flex items-center text-sm ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                >
                  <UserPlus size={16} className="mr-1" />
                  Sign up
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
         {tab === "chat" && (
             <ChatComponent
                 messages={messages}
                 conversations={conversations}
                 currentConversationId={currentConversationId}
                 isLoading={isLoading}
                 isConversationsLoading={isConversationsLoading}
                 loadConversation={loadConversation}
                 startNewConversation={startNewConversation}
                 setAuthError={setAuthError} 
                 setShowAuthModal={setShowAuthModal}
                 logout={logout}
                 starredConversations={starredConversations}
                 onToggleStar={onToggleStar}
                 onConversationRenamed={renameConversation}
                 sendMessage={sendMessage}
                 sendMessages={sendMessages}
                 darkMode={darkMode}
                 updateMessages={updateMessages}
                 shareConversation={shareConversation}
                 handleLikeMessage={handleLikeMessage}
                 handleDislikeMessage={handleDislikeMessage}
             />
         )}
         {tab === "graph" && (<GraphView 
                                data={graphData} 
                                onDataChange={handleGraphDataChange} 
                                darkMode={darkMode}/>)}
         {tab === "profile" && (<ProfileComponent 
                    authToken={authToken} 
                    userName={userName} 
                    userEmail={userEmail} 
                    chatPrefs={chatPrefs}
                    handleChatPrefsChange={handleChatPrefsChange}
                    sendMessageWithDoc={sendMessageWithDoc}
                    isLoading={isLoading}
                    darkMode={darkMode}
                    setDarkMode={setDarkMode}/>)}
         {tab === "shared" && (<SharedComponent 
                               darkMode={darkMode}
                               authToken={authToken}/>)}

      </div>

      {renderAuthModal()}

      {showSharedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className={`rounded-lg shadow-lg p-6 w-full max-w-md relative ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
            <h3 className="text-lg font-semibold mb-4">Share Conversation</h3>
            <div className={`flex items-center border rounded-md ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-100'}`}>
              <input
                type="text"
                value={sharedURL}
                readOnly
                className={`flex-grow px-3 py-2 text-sm focus:outline-none rounded-l-md ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}
              />
              <button
                onClick={copySharedURL}
                className={`px-4 py-2 text-sm font-medium rounded-r-md transition-colors ${darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                aria-label="Copy URL to clipboard"
                id="copy-button"
              >
                <Copy size={16} />
              </button>
            </div>
            <button
              onClick={() => setShowSharedModal(false)}
              className={`absolute top-2 right-2 rounded-full p-1 transition-colors ${darkMode ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}