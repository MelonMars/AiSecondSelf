import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Loader, Edit2, Check, X, Star, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
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
  sendMessage
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [editingConversationId, setEditingConversationId] = useState(null);
  const [renamedTitle, setRenamedTitle] = useState('');
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

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <button 
          onClick={startNewConversation}
          className="m-4 p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center"
        >
          <MessageSquare className="mr-2" /> New Chat
        </button>

        <div className="flex-grow overflow-y-auto">
          {isConversationsLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader className="animate-spin" />
            </div>
          ) : (
            conversations.map(conversation => (
              <div 
                key={conversation.id} 
                className={`p-3 hover:bg-gray-100 cursor-pointer flex items-center justify-between ${
                  currentConversationId === conversation.id ? 'bg-gray-200' : ''
                }`}
                onClick={() => loadConversation(conversation.id)}
              >
                {editingConversationId === conversation.id ? (
                  <div className="flex items-center w-full">
                    <input 
                      value={renamedTitle}
                      onChange={(e) => setRenamedTitle(e.target.value)}
                      className="flex-grow mr-2 p-1 border rounded"
                    />
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveRename(conversation.id);
                      }}
                      className="mr-2 text-green-500 hover:bg-green-100 rounded-full p-1"
                    >
                      <Check size={20} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelRename();
                      }}
                      className="text-red-500 hover:bg-red-100 rounded-full p-1"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-grow truncate">{conversation.title}</span>
                    <div className="flex items-center">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditingConversation(conversation.id, conversation.title);
                        }}
                        className="mr-2 text-gray-500 hover:text-gray-700"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStar(conversation.id);
                        }}
                        className={`${
                          starredConversations.includes(conversation.id) 
                            ? 'text-yellow-500' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Star size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-200">
          <button 
            onClick={logout}
            className="w-full p-2 text-left hover:bg-gray-100 rounded"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="flex-grow flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {conversations.find(c => c.id === currentConversationId)?.title || 'New Chat'}
          </h2>
        </div>

        <div className="flex-grow overflow-y-auto p-4 space-y-4">
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
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-black'
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
              <div className="bg-gray-200 p-3 rounded-lg">
                <Loader className="animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-end">
            <textarea 
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Send a message..."
              className="flex-grow p-2 border rounded-lg mr-2 resize-none max-h-40"
              rows={1}
              style={{ overflow: 'auto' }}
            />
            <button 
              onClick={handleSendMessage}
              disabled={!inputMessage.trim()}
              className="bg-blue-500 text-white p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600"
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