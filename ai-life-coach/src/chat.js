import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Loader, Edit2, Check, X, Star, ChevronLeft, ChevronRight, ChevronDown, Share } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const ChatComponent = ({
  messages,
  conversations,
  currentConversationId,
  isLoading,
  isConversationsLoading,
  loadConversation,
  startNewConversation,
  authToken,
  setAuthError,
  setShowAuthModal,
  logout,
  starredConversations,
  onToggleStar,
  onConversationRenamed,
  sendMessage,
  shareConversation,
  darkMode,
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [editingConversationId, setEditingConversationId] = useState(null);
  const [renamedTitle, setRenamedTitle] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); 
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [currentConversationId, messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      sendMessage(inputMessage);
      setInputMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStartEditingConversation = (conversationId, currentTitle) => {
    setEditingConversationId(conversationId);
    setRenamedTitle(currentTitle);
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
    }
  };

  const handleCancelRename = () => {
    setEditingConversationId(null);
    setRenamedTitle('');
  };

  const handleSaveRename = (conversationId) => {
    if (renamedTitle.trim()) {
      onConversationRenamed(conversationId, renamedTitle.trim());
      setEditingConversationId(null);
    }
  };

  const isConversationStarred = (conversationId) => {
    return starredConversations.includes(conversationId);
  }

  const starredChats = conversations.filter(isConversationStarred);
  const nonStarredChats = conversations.filter(conv => !isConversationStarred(conv.id));

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const ConversationItem = ({ conversation }) => {
    const isCurrent = currentConversationId === conversation.id;
    const isEditing = editingConversationId === conversation.id;

    return (
        <div
          key={conversation.id}
          className={`p-3 ${
            darkMode 
              ? `hover:bg-gray-700 ${isCurrent ? 'bg-gray-700' : 'bg-gray-800'}`
              : `hover:bg-gray-100 ${isCurrent ? 'bg-gray-200' : ''}`
          } cursor-pointer flex items-center justify-between ${isSidebarCollapsed ? 'justify-center' : ''}`}
          onClick={() => {
            if (!isEditing) {
              loadConversation(conversation.id);
            }
          }}
        >
          {isEditing ? (
            <div className="flex items-center w-full">
              <input
                value={renamedTitle}
                onChange={(e) => setRenamedTitle(e.target.value)}
                className={`flex-grow mr-2 p-1 border rounded text-sm ${
                  darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''
                }`}
                onClick={e => e.stopPropagation()}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveRename(conversation.id);
                }}
                className={`mr-1 ${darkMode ? 'text-green-400 hover:bg-green-900' : 'text-green-500 hover:bg-green-100'} rounded-full p-1`}
              >
                <Check size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelRename();
                }}
                className={`${darkMode ? 'text-red-400 hover:bg-red-900' : 'text-red-500 hover:bg-red-100'} rounded-full p-1`}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              {!isSidebarCollapsed && (
                <span className={`flex-grow truncate text-sm ${darkMode ? 'text-gray-300' : ''}`}>
                  {conversation.title}
                </span>
              )}
              <div className={`flex items-center ${isSidebarCollapsed ? '' : 'ml-2'}`}>
                {!isSidebarCollapsed && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEditingConversation(conversation.id, conversation.title);
                    }}
                    className={darkMode ? 'mr-2 text-gray-400 hover:text-white' : 'mr-2 text-gray-500 hover:text-gray-700'}
                  >
                    <Edit2 size={16} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStar(conversation.id);
                  }}
                  className={
                    starredConversations.includes(conversation.id)
                      ? 'text-yellow-500'
                      : darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                  }
                >
                  <Star size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      );
  };


  return (
    <div className={`flex h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <div className={`flex flex-col ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-r transition-width duration-300 ease-in-out ${
        isSidebarCollapsed ? 'w-16 items-center' : 'w-64'
      }`}>
        <br />
        <br />
        <div className={`flex items-center p-4 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isSidebarCollapsed && (
            <button
              onClick={startNewConversation}
              className={`p-2 ${darkMode ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-lg flex items-center flex-grow justify-center`}
            >
              <MessageSquare className={`${isSidebarCollapsed ? '' : 'mr-2'}`} />
              {!isSidebarCollapsed && 'New Chat'}
            </button>
          )}
          <button
            onClick={toggleSidebar}
            className={`p-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} ${isSidebarCollapsed ? 'ml-0' : 'ml-4'}`}
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isSidebarCollapsed ? <ChevronRight size={20} className={darkMode ? 'text-gray-300' : ''} /> : <ChevronLeft size={20} className={darkMode ? 'text-gray-300' : ''} />}
          </button>
        </div>
  
        <div className="flex-grow overflow-y-auto">
          {isConversationsLoading ? (
            <div className={`flex justify-center items-center ${isSidebarCollapsed ? 'h-full' : 'h-auto'}`}>
              <Loader className={`animate-spin ${darkMode ? 'text-gray-300' : ''}`} />
            </div>
          ) : (
            <>
              {starredChats.length > 0 && (
                <>
                  {!isSidebarCollapsed && (
                    <div className={`px-3 py-2 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase font-semibold ${darkMode ? 'border-gray-700' : 'border-gray-200'} border-b`}>
                      Starred
                    </div>
                  )}
                  {starredChats.map(conversation => (
                    <ConversationItem key={conversation.id} conversation={conversation} />
                  ))}
                  {starredChats.length > 0 && nonStarredChats.length > 0 && !isSidebarCollapsed && (
                    <div className={`border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} my-2`}></div>
                  )}
                </>
              )}
  
              {nonStarredChats.length > 0 && (
                <>
                  {!isSidebarCollapsed && (
                    <div className={`px-3 py-2 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase font-semibold ${darkMode ? 'border-gray-700' : 'border-gray-200'} border-b`}>
                      Chats
                    </div>
                  )}
                  {nonStarredChats.map(conversation => (
                    <ConversationItem key={conversation.id} conversation={conversation} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
  
        <div className={`p-4 ${darkMode ? 'border-gray-700' : 'border-gray-200'} border-t ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
          <button
            onClick={logout}
            className={`p-2 text-left ${darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100'} rounded ${isSidebarCollapsed ? 'w-auto' : 'w-full'}`}
            title={isSidebarCollapsed ? 'Logout' : ''}
          >
            <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : ''}`}>
              <span className={isSidebarCollapsed ? (darkMode ? 'text-gray-300' : 'text-gray-500') : 'mr-2'}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-log-out">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <path d="M16 17l5-5-5-5"/>
                  <path d="M21 12H9"/>
                </svg>
              </span>
              {!isSidebarCollapsed && <span className={darkMode ? 'text-gray-300' : ''}>Logout</span>}
            </div>
          </button>
        </div>
      </div>
  
      <div className={`flex-grow flex flex-col ${darkMode ? 'bg-gray-900' : ''}`}>
        <div className={`p-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200'} border-b flex justify-between items-center`}>
          <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : ''}`}>
            {conversations.find(c => c.id === currentConversationId)?.title || 'New Chat'}
          </h2>
          {currentConversationId && (
            <button
              onClick={() => shareConversation(currentConversationId)}
              className={darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-700'}
            >
              <Share size={20} />
            </button>
          )}
        </div>
  
        <div className={`flex-grow overflow-y-auto p-4 space-y-4 ${darkMode ? 'bg-gray-900' : ''}`}>
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-2xl p-3 rounded-lg ${
                  message.role === 'user'
                    ? darkMode ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
                    : darkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-black'
                }`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                <Loader className={`animate-spin ${darkMode ? 'text-gray-300' : ''}`} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
  
        <div className={`p-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200'} border-t`}>
          <div className="flex items-end">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Send a message..."
              className={`flex-grow p-2 border rounded-lg mr-2 resize-none max-h-40 ${
                darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : ''
              }`}
              rows={1}
              style={{ overflow: 'auto' }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim()}
              className={`${darkMode ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-500 hover:bg-blue-600'} text-white p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatComponent;