import React, { useEffect, useRef, useState, memo, useMemo } from 'react';
import { MessageSquare, Loader, Edit2, Check, X, Star, ChevronLeft, ChevronRight, ChevronDown, Share, ArrowBigUp, ThumbsUp, ThumbsDown, ArrowLeft, GitBranch } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import * as Babel from "@babel/standalone";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

function DynamicWidget({ key, payload }) {
  const containerRef = useRef(null);

  const Comp = useMemo(() => {
    const toCompile = `var Comp = ${payload.code};`;

    try {
      const { code: js } = Babel.transform(toCompile, {
        presets: ['es2015', 'react']
      });

      const finalBody = js + '\nreturn Comp;';

      return new Function('React', finalBody)(React);
    } catch (e) {
      console.error('Error compiling widget code:', e);
      return () => (
        <pre className="bg-red-100 p-2">
          Error compiling widget code
        </pre>
      );
    }
  }, [payload.code]);

  return (
    <div
      ref={containerRef}
      className="my-4 p-4 border border-gray-200 rounded-lg shadow-sm bg-white"
    >
      <Comp {...payload.props} />
    </div>
  );
}

const ChatMessage = memo(({ content, darkMode }) => {
  let displayContent = content;
  const unclosedGraph = /<GRAPH(?![^>]*?>[\s\S]*?<\/GRAPH>)/.exec(content);
  const unclosedPref = /<PREF(?![^>]*?>[\s\S]*?<\/PREF>)/.exec(content);

  if (unclosedGraph) {
    displayContent = content.substring(0, unclosedGraph.index);
  } else if (unclosedPref) {
    displayContent = content.substring(0, unclosedPref.index);
  }

  let cleanedContent = displayContent
    .replace(/<GRAPH[\s\S]*?<\/GRAPH>/g, '')
    .replace(/<PREF[\s\S]*?<\/PREF>/g, '');

  const parts = [];
  const regex = /<WIDGET\s+name="([^"]+)">([\s\S]*?)<\/WIDGET>/g;
  let last = 0, match, idx = 0;

  while ((match = regex.exec(cleanedContent)) !== null) {
    const [full, name, data] = match;
    const start = match.index, end = start + full.length;

    if (last < start) {
      parts.push(
        <div
          key={`t-${idx++}`}
          className={`m-0 p-0 prose max-w-none ${darkMode ? 'prose-invert' : ''} ${darkMode ? 'text-white' : 'text-black'}`}
        >
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              code: ({node, inline, className, children, ...props}) => {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <div className="rounded-md overflow-hidden my-2">
                    <div className={`px-4 py-1 text-xs ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                      {match[1].toUpperCase()}
                    </div>
                    <SyntaxHighlighter
                      language={match[1]}
                      style={darkMode ? oneDark : oneLight}
                      customStyle={{margin: 0, borderRadius: '0 0 0.375rem 0.375rem'}}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <code className={`${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100'} px-1 py-0.5 rounded text-sm`} {...props}>
                    {children}
                  </code>
                );
              },
              p: ({node, children}) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({node, children}) => <ul className="list-disc pl-6 mb-2 space-y-1">{children}</ul>,
              ol: ({node, children}) => <ol className="list-decimal pl-6 mb-2 space-y-1">{children}</ol>,
              li: ({node, children}) => <li className="mb-1">{children}</li>,
              table: ({node, children}) => (
                <div className="overflow-x-auto my-2">
                  <table className={`min-w-full divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                    {children}
                  </table>
                </div>
              ),
              th: ({node, children}) => (
                <th className={`px-3 py-2 text-left text-sm font-medium ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                  {children}
                </th>
              ),
              td: ({node, children}) => (
                <td className={`px-3 py-2 text-sm ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  {children}
                </td>
              ),
              hr: () => <hr className={`my-4 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`} />,
              h1: ({node, children}) => <h1 className="text-2xl font-bold mt-6 mb-3 first:mt-0">{children}</h1>,
              h2: ({node, children}) => <h2 className="text-xl font-bold mt-5 mb-2">{children}</h2>,
              h3: ({node, children}) => <h3 className="text-lg font-bold mt-4 mb-2">{children}</h3>,
              h4: ({node, children}) => <h4 className="text-base font-bold mt-3 mb-1">{children}</h4>,
              blockquote: ({node, children}) => (
                <blockquote className={`border-l-4 ${darkMode ? 'border-gray-600 bg-gray-800/50' : 'border-gray-300 bg-gray-50'} pl-4 py-1 my-3`}>
                  {children}
                </blockquote>
              ),
            }}
          >
            {cleanedContent.slice(last, start)}
          </ReactMarkdown>
        </div>
      );
    }

    let payload;
    try { payload = JSON.parse(data); }
    catch { payload = { code: `()=><pre>Invalid JSON</pre>` }; }

    parts.push(
      <div key={`w-${idx++}`} className="my-2 w-full">
        <DynamicWidget payload={payload} />
      </div>
    );

    last = end;
  }

  if (last < cleanedContent.length) {
    parts.push(
      <div
        key={`t-${idx++}`}
        className={`m-0 p-0 prose max-w-none ${darkMode ? 'prose-invert' : ''} ${darkMode ? 'text-white' : 'text-black'}`}
      >
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            code: ({node, inline, className, children, ...props}) => {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <div className="rounded-md overflow-hidden my-2">
                  <div className={`px-4 py-1 text-xs ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                    {match[1].toUpperCase()}
                  </div>
                  <SyntaxHighlighter
                    language={match[1]}
                    style={darkMode ? oneDark : oneLight}
                    customStyle={{margin: 0, borderRadius: '0 0 0.375rem 0.375rem'}}
                    PreTag="div"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code className={`${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100'} px-1 py-0.5 rounded text-sm`} {...props}>
                  {children}
                </code>
              );
            },
            p: ({node, children}) => <p className="mb-2 last:mb-0">{children}</p>,
            ul: ({node, children}) => <ul className="list-disc pl-6 mb-2 space-y-1">{children}</ul>,
            ol: ({node, children}) => <ol className="list-decimal pl-6 mb-2 space-y-1">{children}</ol>,
            li: ({node, children}) => <li className="mb-1">{children}</li>,
            table: ({node, children}) => (
              <div className="overflow-x-auto my-2">
                <table className={`min-w-full divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {children}
                </table>
              </div>
            ),
            th: ({node, children}) => (
              <th className={`px-3 py-2 text-left text-sm font-medium ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                {children}
              </th>
            ),
            td: ({node, children}) => (
              <td className={`px-3 py-2 text-sm ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                {children}
              </td>
            ),
            hr: () => <hr className={`my-4 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`} />,
            h1: ({node, children}) => <h1 className="text-2xl font-bold mt-6 mb-3 first:mt-0">{children}</h1>,
            h2: ({node, children}) => <h2 className="text-xl font-bold mt-5 mb-2">{children}</h2>,
            h3: ({node, children}) => <h3 className="text-lg font-bold mt-4 mb-2">{children}</h3>,
            h4: ({node, children}) => <h4 className="text-base font-bold mt-3 mb-1">{children}</h4>,
            blockquote: ({node, children}) => (
              <blockquote className={`border-l-4 ${darkMode ? 'border-gray-600 bg-gray-800/50' : 'border-gray-300 bg-gray-50'} pl-4 py-1 my-3`}>
                {children}
              </blockquote>
            ),
          }}
        >
          {cleanedContent.slice(last)}
        </ReactMarkdown>
      </div>
    );
  }

  return <div className="max-w-full">{parts}</div>;
});

const ConversationItem = ({
  conversation,
  currentConversationId,
  darkMode,
  loadConversation,
  onConversationRenamed,
  onToggleStar,
  starredConversations,
  isSidebarCollapsed,
  onConversationShare
}) => {

  const [isEditing, setIsEditing] = useState(false);
  const [localRenamedTitle, setLocalRenamedTitle] = useState(conversation.title);
  const inputRef = useRef(null);

  useEffect(() => {
    setLocalRenamedTitle(conversation.title);
  }, [conversation.title]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
        inputRef.current.focus();
    }
  }, [isEditing]);


  const handleStartEditing = (e) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setIsEditing(false);
    setLocalRenamedTitle(conversation.title);
  };

  const handleSaveEdit = (e) => {
    e.stopPropagation();
    if (localRenamedTitle.trim() && onConversationRenamed) {
      onConversationRenamed(conversation.id, localRenamedTitle.trim());
      setIsEditing(false);
    }
  };

  const handleInputKeyPress = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSaveEdit(e);
      } else if (e.key === 'Escape') {
          handleCancelEdit(e);
      }
  };

  const handleShareConversation = (e) => {
    e.stopPropagation();
    console.log("Sharing conversation", conversation.title);
    onConversationShare(conversation.id);
  }


  const isCurrent = currentConversationId === conversation.id;
  const isStarred = starredConversations.includes(conversation.id);


  return (
    <div
      key={conversation.id}
      className={`py-2.5 px-3 ${
        darkMode
          ? `hover:bg-gray-700 ${isCurrent ? 'bg-gray-700' : 'bg-gray-800'}`
          : `hover:bg-gray-100 ${isCurrent ? 'bg-gray-200' : ''}`
      } cursor-pointer flex items-center justify-between ${isSidebarCollapsed ? 'justify-center' : ''} rounded-md mx-2 my-1 group transition-colors duration-200`}
      onClick={() => {
        if (!isEditing && loadConversation) {
          loadConversation(conversation.id);
        }
      }}
    >
      {isEditing ? (
        <div className="flex items-center w-full">
          <input
            ref={inputRef}
            value={localRenamedTitle}
            onChange={(e) => setLocalRenamedTitle(e.target.value)}
            onKeyPress={handleInputKeyPress}
            className={`flex-grow mr-2 p-1.5 border rounded text-sm ${
              darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-orange-500' : 'focus:border-blue-500 focus:ring-blue-500'
            } focus:outline-none focus:ring-1`}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={handleSaveEdit}
            className={`mr-1 ${darkMode ? 'text-green-400 hover:bg-green-900' : 'text-green-500 hover:bg-green-100'} rounded-full p-1.5 transition-colors duration-200`}
            title="Save changes"
          >
            <Check size={16} />
          </button>
          <button
            onClick={handleCancelEdit}
            className={`${darkMode ? 'text-red-400 hover:bg-red-900' : 'text-red-500 hover:bg-red-100'} rounded-full p-1.5 transition-colors duration-200`}
            title="Cancel"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <>
          {!isSidebarCollapsed && (
            <div className="flex items-center flex-grow truncate">
              <div className={`flex items-center justify-center ${darkMode ? 'text-gray-400' : 'text-gray-500'} mr-2`}>
                <MessageSquare size={16} />
              </div>
              <span className={`truncate text-sm ${darkMode ? 'text-gray-300' : ''} font-medium`}>
                {conversation.title}
              </span>
            </div>
          )}
          <div className={`flex items-center ${isSidebarCollapsed ? '' : 'ml-2'}`}>
            {!isSidebarCollapsed && (
              <div className={`flex items-center ${darkMode ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                <button
                  onClick={handleStartEditing}
                  className={`mr-2 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'} p-1 rounded-full hover:bg-opacity-10 ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'} transition-colors duration-200`}
                  title="Rename"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={handleShareConversation}
                  className={`mr-2 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'} p-1 rounded-full hover:bg-opacity-10 ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'} transition-colors duration-200`}
                  title="Share"
                >
                  <Share size={14} />
                </button>
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(conversation.id);
              }}
              className={`${
                isStarred
                  ? 'text-yellow-500 hover:text-yellow-600'
                  : darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
              } p-1 rounded-full hover:bg-opacity-10 ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'} transition-colors duration-200`}
              title={isStarred ? "Unstar conversation" : "Star conversation"}
            >
              <Star size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const ChatComponent = ({
  messages,
  conversations,
  currentConversationId,
  isLoading,
  isConversationsLoading,
  loadConversation,
  startNewConversation,
  setAuthError,
  setShowAuthModal,
  logout,
  starredConversations,
  onToggleStar,
  onConversationRenamed,
  sendMessage,
  sendMessages,
  shareConversation,
  darkMode,
  updateMessages,
  handleLikeMessage,
  handleDislikeMessage,
  handleSaveEditMessage,
  currentConversationBranchInfo,
  aiPicture,
  userPicture,
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [editingConversationId, setEditingConversationId] = useState(null);
  const [renamedTitle, setRenamedTitle] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); 
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);
  const [editMessageContent, setEditMessageContent] = useState('');
  const [hoveredMessageIndex, setHoveredMessageIndex] = useState(null);
  const [openBranchDropdownIndex, setOpenBranchDropdownIndex] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const editTextareaRef = useRef(null);

  useEffect(() => {
    if (editingMessageIndex !== null && editTextareaRef.current) {
      editTextareaRef.current.focus();
      adjustTextareaHeight(editTextareaRef.current);
    }
  }, [editingMessageIndex]);

  const adjustTextareaHeight = (textarea) => {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [currentConversationId, messages]);

  useEffect(() => {
    if (editingMessageIndex !== null && editTextareaRef.current) {
      editTextareaRef.current.focus();
      adjustTextareaHeight(editTextareaRef.current);
    }
  }, [editingMessageIndex]);

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

  const handleStartEditingMessage = (index, content) => {
    setEditingMessageIndex(index);
    setEditMessageContent(content);
    setHoveredMessageIndex(null);
  };


  const handleCancelEditMessage = () => {
    setEditingMessageIndex(null);
    setEditMessageContent('');
  };


return (
    <div className={`flex h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <div className={`flex flex-col mt-10 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-r transition-all duration-300 ease-in-out ${
        isSidebarCollapsed ? 'w-16 items-center' : 'w-64'
      } shadow-md`}>
        <div className="py-6 px-4">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!isSidebarCollapsed && (
              <button
                onClick={startNewConversation}
                className={`p-2 ${darkMode ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-lg flex items-center flex-grow justify-center transition-colors duration-200 shadow-sm`}
              >
                <MessageSquare className={`${isSidebarCollapsed ? '' : 'mr-2'}`} size={18} />
                {!isSidebarCollapsed && <span className="font-medium">New Chat</span>}
              </button>
            )}
            <button
              onClick={toggleSidebar}
              className={`p-2 rounded-full ${darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200'} ${isSidebarCollapsed ? 'ml-0 mt-4' : 'ml-4'} transition-colors duration-200`}
              title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>
        </div>
 
        <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-rounded-full scrollbar-track-transparent">
          {isConversationsLoading ? (
            <div className={`flex justify-center items-center ${isSidebarCollapsed ? 'h-full' : 'h-auto'} py-8`}>
              <Loader className={`animate-spin ${darkMode ? 'text-gray-300' : ''}`} />
            </div>
          ) : (
            <>
              {starredChats.length > 0 && (
                <>
                  {!isSidebarCollapsed && (
                    <div className={`px-4 py-2 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase font-semibold tracking-wider ${darkMode ? 'border-gray-700' : 'border-gray-200'} border-b`}>
                      Starred
                    </div>
                  )}
                  {starredChats.map(conversation => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      currentConversationId={currentConversationId}
                      darkMode={darkMode}
                      loadConversation={loadConversation}
                      onConversationRenamed={onConversationRenamed}
                      onToggleStar={onToggleStar}
                      starredConversations={starredConversations}
                      isSidebarCollapsed={isSidebarCollapsed}
                      onConversationShare={shareConversation}
                    />
                  ))}
                  {starredChats.length > 0 && nonStarredChats.length > 0 && !isSidebarCollapsed && (
                    <div className={`border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} my-2`}></div>
                  )}
                </>
              )}
 
              {nonStarredChats.length > 0 && (
                <>
                  {!isSidebarCollapsed && (
                    <div className={`px-4 py-2 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase font-semibold tracking-wider ${darkMode ? 'border-gray-700' : 'border-gray-200'} border-b`}>
                      Chats
                    </div>
                  )}
                  {nonStarredChats.map(conversation => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      currentConversationId={currentConversationId}
                      darkMode={darkMode}
                      loadConversation={loadConversation}
                      onConversationRenamed={onConversationRenamed}
                      onToggleStar={onToggleStar}
                      starredConversations={starredConversations}
                      isSidebarCollapsed={isSidebarCollapsed}
                      onConversationShare={shareConversation}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
 
        <div className={`p-4 ${darkMode ? 'border-gray-700' : 'border-gray-200'} border-t ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
          <button
            onClick={logout}
            className={`p-2 text-left ${darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100'} rounded-lg transition-colors duration-200 ${isSidebarCollapsed ? 'w-auto' : 'w-full'}`}
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
              {!isSidebarCollapsed && <span className={`${darkMode ? 'text-gray-300' : ''} font-medium`}>Logout</span>}
            </div>
          </button>
        </div>
      </div>
 
      <div className={`flex-grow flex flex-col ${darkMode ? 'bg-gray-900' : ''}`}>
        <div className={`p-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} border-b flex justify-between items-center shadow-sm`}>
          <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : ''}`}>
            {conversations.find(c => c.id === currentConversationId)?.title || 'New Chat'}
          </h2>
          {currentConversationId && (
            <button
              onClick={() => shareConversation(currentConversationId)}
              className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-700'} p-2 rounded-full hover:bg-opacity-10 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors duration-200`}
              title="Share conversation"
            >
              <Share size={20} />
            </button>
          )}
        </div>
 
        <div className={`flex-grow overflow-y-auto p-6 space-y-6 ${darkMode ? 'bg-gray-900' : ''} scrollbar-thin scrollbar-thumb-rounded-full scrollbar-track-transparent`}>
        {messages.map((message, index) => {
          const parts = message.content.split('\n\n');

          return (
            <>
              {parts.map((part, partIndex) => (
                <div
                  key={`${index}-${partIndex}`}
                  className={`flex flex-col group ${
                    message.role === 'user' ? 'justify-end items-end' : 'justify-start items-start'
                  }`}
                  onMouseEnter={() => setHoveredMessageIndex(index)}
                  onMouseLeave={() => setHoveredMessageIndex(null)}
                >
                  <div className="flex items-end">
                    {message.role !== 'user' && (
                      <img
                        src={aiPicture}
                        alt="AI Avatar"
                        className="w-8 h-8 rounded-full mr-2"
                      />
                    )}
                    <div
                      className={`max-w-2xl px-4 py-3 rounded-lg relative shadow-sm ${
                        message.role === 'user'
                          ? darkMode ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'
                          : darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-black'
                      } ${message.role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none'}`}
                    >
                      {editingMessageIndex === index && partIndex === 0 ? (
                                        <div className="flex flex-col">
                            <textarea
                              ref={editTextareaRef}
                              value={editMessageContent}
                              onChange={(e) => {
                                setEditMessageContent(e.target.value);
                                adjustTextareaHeight(e.target);
                              }}
                              className={`flex-grow p-2 border rounded-lg mb-2 resize-none ${
                                darkMode ? 'bg-gray-600 border-gray-500 text-white' : 'border-gray-300'
                              }`}
                              rows={1}
                              style={{ overflow: 'hidden' }}
                            />
                            <div className="flex justify-end">
                              <button
                                onClick={() => handleSaveEditMessage(index, editMessageContent, setEditMessageContent, setEditingMessageIndex)}
                                className={`mr-1 ${darkMode ? 'text-green-400 hover:bg-green-900' : 'text-green-500 hover:bg-green-100'} rounded-full p-1`}
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={handleCancelEditMessage}
                                className={`${darkMode ? 'text-red-400 hover:bg-red-900' : 'text-red-500 hover:bg-red-100'} rounded-full p-1`}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                      ) : (
                        <ChatMessage content={part} darkMode={darkMode}/>
                      )}
                    </div>
                    {message.role === 'user' && (
                      <img
                        src={userPicture}
                        alt="User Avatar"
                        className="w-8 h-8 rounded-full ml-2"
                      />
                    )}
                  </div>
                  {partIndex === parts.length - 1 && (
                    <>
                      <div className={`flex mt-1 ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${
                          hoveredMessageIndex === index && message.role === 'user'
                            ? 'opacity-100 group-hover:opacity-100'
                            : 'opacity-0 group-hover:opacity-0'
                        } transition-opacity text-sm`}
                      >
                        {message.role === 'user' && (
                          <button
                            onClick={() => handleStartEditingMessage(index, message.content)}
                            className={`p-1.5 rounded-full ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-white hover:bg-gray-200 text-gray-600'} shadow-sm`}
                            title="Edit message"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                      </div>

                      <div className={`flex mt-1 ${message.role !== 'user' ? 'justify-end' : 'justify-start'} ${
                          hoveredMessageIndex === index && message.role !== 'user'
                            ? 'opacity-100 group-hover:opacity-100'
                            : 'opacity-0 group-hover:opacity-0'
                        } transition-opacity text-sm`}
                      >
                        {message.role !== 'user' && (
                          <div>
                            <button
                              onClick={() => handleLikeMessage(index, message.content)}
                              className={`p-1.5 rounded-full ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-white hover:bg-gray-200 text-gray-600'} shadow-sm`}
                              title="Like message"
                              >
                                <ThumbsUp size={14} />
                            </button>
                            <button
                                onClick={() => handleDislikeMessage(index, message.content)}
                                className={`p-1.5 rounded-full ml-1 ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-white hover:bg-gray-200 text-gray-600'} shadow-sm`}
                                title="Dislike message"
                                >
                                  <ThumbsDown size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      {(
                        (currentConversationBranchInfo?.parent_conversation_id && currentConversationBranchInfo.branch_from_message_index === index) ||
                        (currentConversationBranchInfo?.children_branches && currentConversationBranchInfo.children_branches.some(b => b.branch_from_message_index === index))
                      ) && (
                        <div className={`flex mt-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                          <div className={`relative inline-block text-left ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                            <button
                              onClick={() => {
                                setOpenBranchDropdownIndex(openBranchDropdownIndex === index ? null : index);
                              }}
                              className={`inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 text-sm font-medium ${darkMode ? 'bg-gray-700 hover:bg-gray-600 border-gray-600' : 'bg-white hover:bg-gray-50 text-gray-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 ${darkMode ? 'focus:ring-offset-gray-800 focus:ring-orange-500' : 'focus:ring-offset-gray-100 focus:ring-blue-500'}`}
                              id={`options-menu-${index}`}
                              aria-haspopup="true"
                              aria-expanded="true"
                            >
                              Branches
                              <ChevronDown className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
                            </button>

                            {openBranchDropdownIndex === index && (
                              <div
                                className={`origin-top-right absolute ${message.role === 'user' ? 'right-0' : 'left-0'} mt-2 w-56 rounded-md shadow-lg ${darkMode ? 'bg-gray-700 ring-1 ring-black ring-opacity-5' : 'bg-white ring-1 ring-black ring-opacity-5'}`}
                                role="menu"
                                aria-orientation="vertical"
                                aria-labelledby={`options-menu-${index}`}
                              >
                                <div className="py-1" role="none">
                                  {currentConversationBranchInfo?.parent_conversation_id &&
                                    currentConversationBranchInfo.branch_from_message_index === index && (
                                    <button
                                      onClick={() => {
                                        loadConversation(currentConversationBranchInfo.parent_conversation_id);
                                          setOpenBranchDropdownIndex(null);
                                        }}
                                        className={`${darkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'} block px-4 py-2 text-sm w-full text-left`}
                                        role="menuitem"
                                        >
                                        <ArrowLeft className="inline-block mr-2" size={14} /> Go to Parent
                                        </button>
                                      )}

                                      {currentConversationBranchInfo?.children_branches
                                        .filter(b => b.branch_from_message_index === index && b.id !== currentConversationId)
                                        .map((branch, idx) => (
                                        <button
                                          key={branch.id}
                                          onClick={() => {
                                          loadConversation(branch.id);
                                          setOpenBranchDropdownIndex(null);
                                          }}
                                          className={`${darkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'} block px-4 py-2 text-sm w-full text-left`}
                                          role="menuitem"
                                        >
                                          <GitBranch className="inline-block mr-2" size={14} /> Branch {idx + 1}
                                        </button>
                                        ))}

                                        {currentConversationBranchInfo?.parent_conversation_id &&
                                          currentConversationBranchInfo.branch_from_message_index === index && (
                                        <button
                                          onClick={() => {
                                          setOpenBranchDropdownIndex(null);
                                        }}
                                        className={`${darkMode ? 'text-orange-400 bg-gray-600' : 'text-blue-600 bg-blue-50'} block px-4 py-2 text-sm w-full text-left cursor-default`}
                                        role="menuitem"
                                        disabled
                                      >
                                         <Check className="inline-block mr-2" size={14} /> Current Branch
                                      </button>
                                    )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </>
          );
        })}          {isLoading && (
            <div className="flex justify-start">
              <div className={`flex items-center space-x-1 p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} shadow-sm`}>
                <span className={`dot w-2 h-2 rounded-full ${darkMode ? 'bg-gray-300' : 'bg-gray-500'} animate-bounce`} style={{ animationDelay: '0.1s' }}></span>
                <span className={`dot w-2 h-2 rounded-full ${darkMode ? 'bg-gray-300' : 'bg-gray-500'} animate-bounce`} style={{ animationDelay: '0.2s' }}></span>
                <span className={`dot w-2 h-2 rounded-full ${darkMode ? 'bg-gray-300' : 'bg-gray-500'} animate-bounce`} style={{ animationDelay: '0.3s' }}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
 
        <div className={`p-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} border-t shadow-md`}>
          <div className="flex items-end">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Send a message..."
              className={`flex-grow p-3 border rounded-lg mr-2 resize-none max-h-40 focus:outline-none focus:ring-2 ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-orange-500' 
                  : 'focus:ring-blue-300 focus:border-blue-300'
              }`}
              rows={1}
              style={{ overflow: 'auto' }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim()}
              className={`${
                darkMode 
                  ? 'bg-orange-500 hover:bg-orange-600' 
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white p-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm`}
            >
              <ArrowBigUp />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatComponent;