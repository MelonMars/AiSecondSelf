import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Network, Target, User, Send, Loader, ChevronRight, LogOut, LogIn, UserPlus, Star, Camera } from "lucide-react";
import GraphView from "./GraphView";
import { signInWithEmailAndPassword, getAuth } from "firebase/auth";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import parse from 'html-react-parser';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const TABS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "graph", label: "Graph", icon: Network },
  { id: "profile", label: "Profile", icon: User }
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
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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

  const [graphData, setGraphData] = useState(null);
  const [chatPrefs, setChatPrefs] = useState("");

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
        setGraphData({ nodes: [], edges: [] });
        setIsLoading(false);
        console.log("Firebase auth state changed. User logged out.");
      }
    });

    return () => unsubscribe();
  }, []);


   useEffect(() => {
        if (authToken) {
           if (graphData === null) {
               fetchUserData(authToken);
               fetchUserPrefs(authToken);
           }
        } else {
             setGraphData({ nodes: [], edges: [] });
        }

   }, [authToken]);


  const fetchUserPrefs = async (token) => {
    if (!token) return;
    try {
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
  }


  const login = async () => {
    setAuthError("");
    if (!email || !password) {
      setAuthError("Email and password are required");
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setShowAuthModal(false);
      setEmail("");
      setPassword("");

    } catch (error) {
      setAuthError(error.message);
      console.error("Login error:", error);
    } finally {}
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
        setAuthToken(null);
        setUid(null);
        setUserName("");
        setUserEmail("");
        localStorage.removeItem("authToken");
        localStorage.removeItem("uid");
        localStorage.removeItem("userName");
        localStorage.removeItem("userEmail");
        setMessages([]);
        setGraphData({ nodes: [], edges: [] });
     } finally {
        setIsLoading(false);
     }
  };


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (tab === "chat") {
      inputRef.current?.focus();
    }
  }, [tab]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    const bulletProse = graphData ? JSON.stringify(graphData) : null;

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const headers = {
        "Content-Type": "application/json"
      };

      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const res = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: [...messages, userMessage], bulletProse })
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
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, there was an error processing your message. Please try again later."
      }]);
    } finally {
      setIsLoading(false);
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
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      console.log("Document processed:", data);

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
                 console.warn("Element with ID 'doc-result' not found.");
             }
       }

    } catch (error) {
      console.error("Error sending document:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "error processing your document." },
      ]);
       const injectElem = document.getElementById("doc-result");
       if (injectElem) {
           injectElem.innerHTML = `Error: ${error.message}`;
       }
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderMessage = (message, index) => {
    const isUser = message.role === "user";
    const aiContent = message.content;
  
    return (
      <div
        key={index}
        className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4 animate-fadeIn`}
      >
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
            AI
          </div>
        )}
  
        <div
          className={`px-4 py-3 rounded-2xl max-w-3xl ${
            isUser
              ? "bg-blue-500 text-white rounded-tr-none"
              : "bg-gray-100 text-gray-800 rounded-tl-none"
          }`}
        >
          <div className={`prose ${isUser ? 'prose-invert' : ''}`}>
              <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
              >
                  {message.content}
              </ReactMarkdown>
          </div>
  
          <div className={`text-xs mt-1 ${isUser ? "text-blue-100" : "text-gray-500"} text-right`}>
            {formatTime()}
          </div>
        </div>
  
        {isUser && (
          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center ml-2 flex-shrink-0">
            you
          </div>
        )}
      </div>
    );
  };
        
  const renderAuthModal = () => {
    if (!showAuthModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h2 className="text-2xl font-medium text-gray-800 mb-4">
            {authMode === "login" ? "Log in" : "Sign up"}
          </h2>

          {authError && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
              {authError}
            </div>
          )}

          <div className="space-y-4">
            {authMode === "signup" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={authMode === "login" ? login : signup}
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {isLoading ? (
                <Loader size={20} className="animate-spin" />
              ) : (
                authMode === "login" ? "Log in" : "Sign up"
              )}
            </button>
          </div>

          <div className="mt-4 text-center">
            {authMode === "login" ? (
              <p className="text-sm text-gray-600">
                Don't have an account?{" "}
                <button
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthError("");
                  }}
                  className="text-blue-600 hover:text-blue-800 focus:outline-none"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
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
              className="text-sm text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
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
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
                <span className="text-sm text-gray-600 mr-3">{userName}</span>
                <button
                  onClick={logout}
                  className="flex items-center text-sm text-gray-600 hover:text-gray-800"
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
                  className="flex items-center text-sm text-gray-600 hover:text-gray-800"
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
                  className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                >
                  <UserPlus size={16} className="mr-1" />
                  Sign up
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative">
          {isLoading && (
             <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
               <Loader size={40} className="animate-spin text-blue-600" />
             </div>
           )}

         {tab === "chat" && (
            <div className="max-w-4xl mx-auto pt-4 pb-20">
              {messages.length === 0 && !isLoading ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare size={24} className="text-blue-500" />
                  </div>
                  <h3 className="text-xl font-medium text-gray-700 mb-2">Start a conversation</h3>
                  <p className="text-gray-500 max-w-md mx-auto">
                    Send a message to begin chatting with the AI assistant
                  </p>
                </div>
              ) : (
                <>
                  {messages.map(renderMessage)}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
          )}

         {tab === "graph" && (
             <GraphView
                 data={graphData}
                 onDataChange={handleGraphDataChange}
             />
          )}

         {tab === "profile" && (
            <div className="max-w-4xl mx-auto py-4">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                {authToken ? (
                  <>
                    <div className="flex items-center mb-6">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 text-xl font-bold mr-4">
                        {userName ? userName.charAt(0).toUpperCase() : "U"}
                      </div>
                      <div>
                        <h2 className="text-xl font-medium text-gray-800">{userName}</h2>
                         {userEmail && <p className="text-gray-500 text-sm">{userEmail}</p>}
                        <p className="text-gray-500 text-sm">Personal information and preferences</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <h3 className="font-medium text-gray-700 border-b pb-2">Account Details</h3>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Name</span>
                            <span className="font-medium">{userName}</span>
                          </div>
                           {uid && (
                           <div className="flex justify-between items-center">
                             <span className="text-gray-500">UID</span>
                             <span className="font-medium text-xs break-all text-right">{uid}</span>
                           </div>
                           )}
                        </div>

                        <div className="space-y-4">
                          <h3 className="font-medium text-gray-700 border-b pb-2">Preferences (Placeholder)</h3>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Theme</span>
                            <span className="font-medium">Light</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Notifications</span>
                            <span className="font-medium">Enabled</span>
                          </div>
                        </div>

                        <button
                          onClick={logout}
                          className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors flex items-center"
                        >
                          <LogOut size={16} className="mr-2" />
                          Log out
                        </button>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-4">
                           <h3 className="font-medium text-gray-700 border-b pb-2">File Operations</h3>
                           <div className="mt-4">
                             <h4 className="text-sm font-medium text-gray-700 mb-2">Upload a .txt file to update graph</h4>
                             <input
                               type="file"
                               accept=".txt"
                               onChange={(e) => sendMessageWithDoc(e.target.files[0])}
                               className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                             />
                           </div>

                           <div className="mt-4">
                             <h4 className="text-sm font-medium text-gray-700 mb-2">Upload Result</h4>
                             <div className="p-4 bg-gray-100 rounded-md text-gray-800 text-sm max-h-40 overflow-y-auto">
                               <p id="doc-result">No result yet.</p>
                             </div>
                           </div>
                        </div>

                         <div className="space-y-4">
                           <h3 className="font-medium text-gray-700 border-b pb-2">Chat Preferences</h3>
                            <label htmlFor="chat-prefs" className="block text-sm font-medium text-gray-700 mb-1">Instructions for AI</label>
                           <textarea
                             id="chat-prefs"
                             rows="3"
                             value={chatPrefs}
                             onChange={(e) => {
                             const newValue = e.target.value;
                             setChatPrefs(newValue);
                             handleChatPrefsChange(newValue);
                             }}
                             className="block w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                             placeholder="e.g., Always respond concisely, Focus on practical advice, Use markdown formatting"
                           />
                         </div>
                      </div>

                    </div>
                  </>
                ) : (
                  <div className="text-center py-10">
                    <User size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-xl font-medium text-gray-700 mb-3">Log in to view your profile</h3>
                    <p className="text-gray-500 mb-6">
                      Create an account or log in to access your profile and save your data.
                    </p>
                    <div className="flex justify-center space-x-4">
                      <button
                        onClick={() => {
                          setAuthMode("login");
                          setAuthError("");
                          setShowAuthModal(true);
                        }}
                        className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                      >
                        Log in
                      </button>
                      <button
                        onClick={() => {
                          setAuthMode("signup");
                          setAuthError("");
                          setShowAuthModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Sign up
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
           )}
      </div>

      {tab === "chat" && (
       <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
         <div className="max-w-4xl mx-auto">
           <div className="flex items-center bg-white border border-gray-300 rounded-full overflow-hidden focus-within:ring-2 focus-within:ring-blue-300 focus-within:border-blue-500">
             <input
               ref={inputRef}
               type="text"
               value={input}
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
               placeholder="Type your message..."
               className="flex-1 py-3 px-4 focus:outline-none"
               disabled={isLoading}
             />
             <button
               onClick={sendMessage}
               disabled={!input.trim() || isLoading}
               className={`p-3 mr-1 rounded-full transition-colors ${
                 input.trim() && !isLoading
                   ? 'bg-blue-500 text-white hover:bg-blue-600'
                   : 'bg-gray-100 text-gray-400 cursor-not-allowed'
               }`}
             >
               {isLoading ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
             </button>
           </div>
         </div>
       </div>
       )}


      {renderAuthModal()}

      <style jsx global>{`
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }

        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }

        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}