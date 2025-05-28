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

const ChatMessage = memo(({ content, darkMode, messager }) => {
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

  const isUser = messager === 'user';

  while ((match = regex.exec(cleanedContent)) !== null) {
    const [full, name, data] = match;
    const start = match.index, end = start + full.length;

    if (last < start) {
      parts.push(
        <div
          key={`t-${idx++}`}
          className={`max-w-4xl mx-auto mb-3 p-4 rounded-3xl backdrop-blur-sm border transition-all duration-300 prose max-w-none ${
            isUser
              ? 'bg-orange-500/70 border-orange-600/50 text-white shadow-md' 
              : darkMode 
                ? 'prose-invert bg-white/8 border-white/15 text-white shadow-lg' 
                : 'bg-white/70 border-white/50 text-gray-800 shadow-md'
          }`}
          style={{
            borderRadius: isUser ? '24px 24px 8px 24px' : '24px 24px 24px 8px'
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              code: ({node, inline, className, children, ...props}) => {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <div className="rounded-2xl overflow-hidden my-3 shadow-md">
                    <div className={`px-3 py-2 text-xs font-medium backdrop-blur-sm border-b ${
                      darkMode 
                        ? 'bg-gradient-to-r from-purple-600/25 to-pink-600/25 border-white/15 text-white/80' 
                        : 'bg-gradient-to-r from-blue-600/25 to-purple-600/25 border-white/30 text-gray-700'
                    }`}>
                      {match[1].toUpperCase()}
                    </div>
                    <SyntaxHighlighter
                      language={match[1]}
                      style={darkMode ? oneDark : oneLight}
                      customStyle={{
                        margin: 0, 
                        borderRadius: '0 0 1rem 1rem',
                        backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.6)' : 'rgba(249, 250, 251, 0.7)',
                        backdropFilter: 'blur(8px)',
                        fontSize: '0.875rem'
                      }}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <code className={`px-2 py-0.5 rounded-lg text-sm backdrop-blur-sm border ${
                    darkMode 
                      ? 'bg-white/15 border-white/20 text-gray-200' 
                      : 'bg-white/60 border-white/40 text-gray-700'
                  }`} {...props}>
                    {children}
                  </code>
                );
              },
              p: ({node, children}) => <p className="mb-2 last:mb-0 leading-relaxed text-sm">{children}</p>,
              ul: ({node, children}) => (
                <ul className={`list-none pl-0 mb-3 space-y-1.5 ${
                  darkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  {children}
                </ul>
              ),
              ol: ({node, children}) => (
                <ol className={`list-none pl-0 mb-3 space-y-1.5 ${
                  darkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  {children}
                </ol>
              ),
              li: ({node, children}) => (
                <li className={`flex items-start gap-2 p-2 rounded-2xl backdrop-blur-sm border transition-all duration-200 text-sm ${
                  darkMode 
                    ? 'bg-white/5 border-white/8 hover:bg-white/8' 
                    : 'bg-white/40 border-white/30 hover:bg-white/50'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${
                    darkMode ? 'bg-gradient-to-r from-purple-400 to-pink-400' : 'bg-gradient-to-r from-blue-500 to-purple-500'
                  }`}></div>
                  <div className="flex-1">{children}</div>
                </li>
              ),
              table: ({node, children}) => (
                <div className={`overflow-x-auto my-3 rounded-2xl backdrop-blur-sm border shadow-md ${
                  darkMode 
                    ? 'bg-white/8 border-white/15' 
                    : 'bg-white/70 border-white/40'
                }`}>
                  <table className="min-w-full text-sm">
                    {children}
                  </table>
                </div>
              ),
              th: ({node, children}) => (
                <th className={`px-3 py-2 text-left text-xs font-semibold border-b ${
                  darkMode 
                    ? 'bg-gradient-to-r from-purple-600/25 to-pink-600/25 border-white/15 text-white/90' 
                    : 'bg-gradient-to-r from-blue-600/25 to-purple-600/25 border-white/30 text-gray-800'
                }`}>
                  {children}
                </th>
              ),
              td: ({node, children}) => (
                <td className={`px-3 py-2 text-xs border-b ${
                  darkMode 
                    ? 'border-white/8 text-gray-200' 
                    : 'border-white/25 text-gray-700'
                }`}>
                  {children}
                </td>
              ),
              hr: () => (
                <hr className={`my-4 border-0 h-px bg-gradient-to-r ${
                  darkMode 
                    ? 'from-transparent via-white/20 to-transparent' 
                    : 'from-transparent via-gray-400/40 to-transparent'
                }`} />
              ),
              h1: ({node, children}) => (
                <h1 className={`text-2xl font-bold mt-4 mb-3 first:mt-0 bg-gradient-to-r bg-clip-text ${
                  darkMode 
                    ? 'from-purple-400 to-pink-400 text-transparent' 
                    : 'from-blue-600 to-purple-600 text-transparent'
                }`}>
                  {children}
                </h1>
              ),
              h2: ({node, children}) => (
                <h2 className={`text-xl font-bold mt-4 mb-2 bg-gradient-to-r bg-clip-text ${
                  darkMode 
                    ? 'from-purple-400 to-pink-400 text-transparent' 
                    : 'from-blue-600 to-purple-600 text-transparent'
                }`}>
                  {children}
                </h2>
              ),
              h3: ({node, children}) => (
                <h3 className={`text-lg font-bold mt-3 mb-2 bg-gradient-to-r bg-clip-text ${
                  darkMode 
                    ? 'from-purple-400 to-pink-400 text-transparent' 
                    : 'from-blue-600 to-purple-600 text-transparent'
                }`}>
                  {children}
                </h3>
              ),
              h4: ({node, children}) => (
                <h4 className={`text-base font-bold mt-3 mb-1 bg-gradient-to-r bg-clip-text ${
                  darkMode 
                    ? 'from-purple-400 to-pink-400 text-transparent' 
                    : 'from-blue-600 to-purple-600 text-transparent'
                }`}>
                  {children}
                </h4>
              ),
              blockquote: ({node, children}) => (
                <blockquote className={`relative p-3 my-3 rounded-2xl backdrop-blur-sm border-l-4 ${
                  darkMode 
                    ? 'bg-white/8 border-l-purple-400 border-white/15 text-gray-200' 
                    : 'bg-white/60 border-l-blue-500 border-white/30 text-gray-700'
                }`}>
                  <div className={`absolute top-2 left-2 w-1.5 h-1.5 rounded-full ${
                    darkMode ? 'bg-purple-400' : 'bg-blue-500'
                  }`}></div>
                  <div className="ml-3 text-sm">{children}</div>
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
      <div key={`w-${idx++}`} className={`max-w-4xl mx-auto mb-3 p-3 rounded-3xl backdrop-blur-sm border transition-all duration-300 ${
        isUser
          ? 'bg-orange-500/70 border-orange-600/50 shadow-md' 
          : darkMode 
            ? 'bg-white/8 border-white/15 shadow-lg' 
            : 'bg-white/70 border-white/50 shadow-md'
      }`}
      style={{
        borderRadius: isUser ? '24px 24px 8px 24px' : '24px 24px 24px 8px'
      }}>
        <DynamicWidget payload={payload} />
      </div>
    );

    last = end;
  }

  if (last < cleanedContent.length) {
    parts.push(
      <div
        key={`t-${idx++}`}
        className={`max-w-4xl mx-auto mb-3 p-4 rounded-3xl backdrop-blur-sm border transition-all duration-300 prose max-w-none ${
          isUser
            ? 'bg-orange-500/70 border-orange-600/50 text-white shadow-md'
            : darkMode 
              ? 'prose-invert bg-white/8 border-white/15 text-white shadow-lg' 
              : 'bg-white/70 border-white/50 text-gray-800 shadow-md'
        }`}
        style={{
          borderRadius: isUser ? '24px 24px 8px 24px' : '24px 24px 24px 8px'
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            code: ({node, inline, className, children, ...props}) => {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <div className="rounded-2xl overflow-hidden my-3 shadow-md">
                  <div className={`px-3 py-2 text-xs font-medium backdrop-blur-sm border-b ${
                    darkMode 
                      ? 'bg-gradient-to-r from-purple-600/25 to-pink-600/25 border-white/15 text-white/80' 
                      : 'bg-gradient-to-r from-blue-600/25 to-purple-600/25 border-white/30 text-gray-700'
                  }`}>
                    {match[1].toUpperCase()}
                  </div>
                  <SyntaxHighlighter
                    language={match[1]}
                    style={darkMode ? oneDark : oneLight}
                    customStyle={{
                      margin: 0, 
                      borderRadius: '0 0 1rem 1rem',
                      backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.6)' : 'rgba(249, 250, 251, 0.7)',
                      backdropFilter: 'blur(8px)',
                      fontSize: '0.875rem'
                    }}
                    PreTag="div"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code className={`px-2 py-0.5 rounded-lg text-sm backdrop-blur-sm border ${
                  darkMode 
                    ? 'bg-white/15 border-white/20 text-gray-200' 
                    : 'bg-white/60 border-white/40 text-gray-700'
                }`} {...props}>
                  {children}
                </code>
              );
            },
            p: ({node, children}) => <p className="mb-2 last:mb-0 leading-relaxed text-sm">{children}</p>,
            ul: ({node, children}) => (
              <ul className={`list-none pl-0 mb-3 space-y-1.5 ${
                darkMode ? 'text-gray-200' : 'text-gray-700'
              }`}>
                {children}
              </ul>
            ),
            ol: ({node, children}) => (
              <ol className={`list-none pl-0 mb-3 space-y-1.5 ${
                darkMode ? 'text-gray-200' : 'text-gray-700'
              }`}>
                {children}
              </ol>
            ),
            li: ({node, children}) => (
              <li className={`flex items-start gap-2 p-2 rounded-2xl backdrop-blur-sm border transition-all duration-200 text-sm ${
                darkMode 
                  ? 'bg-white/5 border-white/8 hover:bg-white/8' 
                  : 'bg-white/40 border-white/30 hover:bg-white/50'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${
                  darkMode ? 'bg-gradient-to-r from-purple-400 to-pink-400' : 'bg-gradient-to-r from-blue-500 to-purple-500'
                }`}></div>
                <div className="flex-1">{children}</div>
              </li>
            ),
            table: ({node, children}) => (
              <div className={`overflow-x-auto my-3 rounded-2xl backdrop-blur-sm border shadow-md ${
                darkMode 
                  ? 'bg-white/8 border-white/15' 
                  : 'bg-white/70 border-white/40'
              }`}>
                <table className="min-w-full text-sm">
                  {children}
                </table>
              </div>
            ),
            th: ({node, children}) => (
              <th className={`px-3 py-2 text-left text-xs font-semibold border-b ${
                darkMode 
                  ? 'bg-gradient-to-r from-purple-600/25 to-pink-600/25 border-white/15 text-white/90' 
                  : 'bg-gradient-to-r from-blue-600/25 to-purple-600/25 border-white/30 text-gray-800'
              }`}>
                {children}
              </th>
            ),
            td: ({node, children}) => (
              <td className={`px-3 py-2 text-xs border-b ${
                darkMode 
                  ? 'border-white/8 text-gray-200' 
                  : 'border-white/25 text-gray-700'
              }`}>
                {children}
              </td>
            ),
            hr: () => (
              <hr className={`my-4 border-0 h-px bg-gradient-to-r ${
                darkMode 
                  ? 'from-transparent via-white/20 to-transparent' 
                  : 'from-transparent via-gray-400/40 to-transparent'
              }`} />
            ),
            h1: ({node, children}) => (
              <h1 className={`text-2xl font-bold mt-4 mb-3 first:mt-0 bg-gradient-to-r bg-clip-text ${
                darkMode 
                  ? 'from-purple-400 to-pink-400 text-transparent' 
                  : 'from-blue-600 to-purple-600 text-transparent'
              }`}>
                {children}
              </h1>
            ),
            h2: ({node, children}) => (
              <h2 className={`text-xl font-bold mt-4 mb-2 bg-gradient-to-r bg-clip-text ${
                darkMode 
                  ? 'from-purple-400 to-pink-400 text-transparent' 
                  : 'from-blue-600 to-purple-600 text-transparent'
              }`}>
                {children}
              </h2>
            ),
            h3: ({node, children}) => (
              <h3 className={`text-lg font-bold mt-3 mb-2 bg-gradient-to-r bg-clip-text ${
                darkMode 
                  ? 'from-purple-400 to-pink-400 text-transparent' 
                  : 'from-blue-600 to-purple-600 text-transparent'
              }`}>
                {children}
              </h3>
            ),
            h4: ({node, children}) => (
              <h4 className={`text-base font-bold mt-3 mb-1 bg-gradient-to-r bg-clip-text ${
                darkMode 
                  ? 'from-purple-400 to-pink-400 text-transparent' 
                  : 'from-blue-600 to-purple-600 text-transparent'
              }`}>
                {children}
              </h4>
            ),
            blockquote: ({node, children}) => (
              <blockquote className={`relative p-3 my-3 rounded-2xl backdrop-blur-sm border-l-4 ${
                darkMode 
                  ? 'bg-white/8 border-l-purple-400 border-white/15 text-gray-200' 
                  : 'bg-white/60 border-l-blue-500 border-white/30 text-gray-700'
              }`}>
                <div className={`absolute top-2 left-2 w-1.5 h-1.5 rounded-full ${
                  darkMode ? 'bg-purple-400' : 'bg-blue-500'
                }`}></div>
                <div className="ml-3 text-sm">{children}</div>
              </blockquote>
            ),
          }}
        >
          {cleanedContent.slice(last)}
        </ReactMarkdown>
      </div>
    );
  }

  return <div className="max-w-full px-2">{parts}</div>;
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
      className={`relative px-3 py-2.5 mb-2 mx-2 rounded-lg backdrop-blur-sm border cursor-pointer group transition-all duration-300 transform hover:scale-[1.02] ${
        isCurrent
          ? darkMode
            ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 border-purple-500/50 shadow-lg shadow-purple-500/25'
            : 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 border-blue-500/50 shadow-lg shadow-blue-500/25'
          : darkMode
            ? 'bg-white/10 border-white/20 hover:bg-white/15 hover:border-white/30'
            : 'bg-white/60 border-white/40 hover:bg-white/70 hover:border-white/50'
      } ${isSidebarCollapsed ? 'justify-center' : ''}`}
      onClick={() => {
        if (!isEditing && loadConversation) {
          loadConversation(conversation.id);
        }
      }}
    >
      {isEditing ? (
        <div className="flex items-center w-full gap-3">
          <input
            ref={inputRef}
            value={localRenamedTitle}
            onChange={(e) => setLocalRenamedTitle(e.target.value)}
            onKeyPress={handleInputKeyPress}
            className={`flex-grow px-4 py-2 rounded-lg border-2 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 ${
              darkMode 
                ? 'bg-white/10 border-white/20 text-white focus:border-purple-500 focus:ring-purple-500/25' 
                : 'bg-white/50 border-white/40 text-gray-800 focus:border-blue-500 focus:ring-blue-500/25'
            }`}
            onClick={e => e.stopPropagation()}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveEdit}
              className={`p-2 rounded-lg transition-all duration-300 hover:scale-110 ${
                darkMode 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg hover:shadow-green-500/25 text-white' 
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg hover:shadow-green-500/25 text-white'
              }`}
              title="Save changes"
            >
              <Check size={16} />
            </button>
            <button
              onClick={handleCancelEdit}
              className={`p-2 rounded-lg transition-all duration-300 hover:scale-110 ${
                darkMode 
                  ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:shadow-lg hover:shadow-red-500/25 text-white' 
                  : 'bg-gradient-to-r from-red-500 to-rose-600 hover:shadow-lg hover:shadow-red-500/25 text-white'
              }`}
              title="Cancel"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center flex-1 min-w-0 gap-2">
              <div className={`p-1.5 rounded-md backdrop-blur-sm border transition-all duration-300 flex-shrink-0 ${
                darkMode 
                  ? 'bg-white/10 border-white/20 text-gray-300' 
                  : 'bg-white/40 border-white/30 text-gray-600'
              }`}>
                <MessageSquare size={14} />
              </div>
              <span className={`truncate font-medium text-sm flex-1 min-w-0 ${
                darkMode ? 'text-white' : 'text-gray-800'
              }`}>
                {conversation.title}
              </span>
            </div>
          )}
          
          <div className={`flex items-center gap-1 flex-shrink-0 ${isSidebarCollapsed ? '' : 'ml-2'}`}>
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button
                  onClick={handleStartEditing}
                  className={`p-1.5 rounded-md transition-all duration-300 hover:scale-110 ${
                    darkMode 
                      ? 'bg-white/10 border-white/20 text-gray-300 hover:bg-white/20 hover:text-white hover:shadow-lg' 
                      : 'bg-white/40 border-white/30 text-gray-600 hover:bg-white/60 hover:text-gray-800 hover:shadow-lg'
                  }`}
                  title="Rename"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={handleShareConversation}
                  className={`p-1.5 rounded-md transition-all duration-300 hover:scale-110 ${
                    darkMode 
                      ? 'bg-white/10 border-white/20 text-gray-300 hover:bg-white/20 hover:text-white hover:shadow-lg' 
                      : 'bg-white/40 border-white/30 text-gray-600 hover:bg-white/60 hover:text-gray-800 hover:shadow-lg'
                  }`}
                  title="Share"
                >
                  <Share size={12} />
                </button>
              </div>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(conversation.id);
              }}
              className={`p-1.5 rounded-md transition-all duration-300 hover:scale-110 ${
                isStarred
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg hover:shadow-yellow-500/25'
                  : darkMode 
                    ? 'bg-white/10 border-white/20 text-gray-300 hover:bg-white/20 hover:text-white hover:shadow-lg' 
                    : 'bg-white/40 border-white/30 text-gray-600 hover:bg-white/60 hover:text-gray-800 hover:shadow-lg'
              }`}
              title={isStarred ? "Unstar conversation" : "Star conversation"}
            >
              <Star size={12} />
            </button>
          </div>
        </div>
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

  const isLastMessagePartFromSender = (messages, currentIndex, currentPartIndex, parts) => {
    if (currentPartIndex !== parts.length - 1) {
      return false;
    }
    
    const nextMessage = messages[currentIndex + 1];
    return !nextMessage || nextMessage.role !== messages[currentIndex].role;
  };

  return (
    <div className={`flex h-full ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <div className={`
        flex flex-col
        transition-all duration-500 ease-out overflow-hidden
        backdrop-blur-xl border-r shadow-2xl
        ${isSidebarCollapsed ? 'w-16 opacity-100' : 'w-64 opacity-100'}
        ${darkMode
          ? 'bg-white/15 border-white/20 shadow-black/20'
          : 'bg-white/70 border-white/30 shadow-black/10'
        }
      `}
      style={{
        background: darkMode 
          ? 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)'
          : 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%)'
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-r-lg" />
      
      {!isSidebarCollapsed && (
        <div className={`flex-shrink-0 px-4 py-4 border-b backdrop-blur-sm ${
          darkMode ? 'border-white/20' : 'border-white/30'
        }`}>
          <button
            onClick={startNewConversation}
            className={`p-3 rounded-xl flex items-center justify-center w-full transition-all duration-300 hover:scale-105 backdrop-blur-sm border shadow-lg relative overflow-hidden ${
              darkMode 
                ? 'bg-white/20 border-white/30 text-orange-300 hover:bg-white/30 hover:shadow-xl' 
                : 'bg-white/40 border-white/50 text-blue-700 hover:bg-white/60 hover:shadow-xl'
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-xl" />
            <MessageSquare className="mr-2 relative z-10" size={18} />
            <span className="font-medium text-sm relative z-10">New Chat</span>
          </button>
        </div>
      )}

      <div className={`flex-shrink-0 ${
        isSidebarCollapsed ? 'px-2 py-4' : 'px-4 py-3'
      } border-b backdrop-blur-sm ${
        darkMode ? 'border-white/20' : 'border-white/30'
      }`}>
        <div className={`flex ${isSidebarCollapsed ? 'flex-col space-y-2' : 'justify-between items-center'}`}>
          <button
            onClick={toggleSidebar}
            className={`${
              isSidebarCollapsed ? 'p-3' : 'p-2'
            } rounded-xl transition-all duration-300 hover:scale-110 backdrop-blur-sm border shadow-lg relative overflow-hidden ${
              darkMode 
                ? 'hover:bg-white/25 text-gray-300 border-white/30 hover:text-white' 
                : 'hover:bg-white/60 border-white/40 text-gray-600 hover:text-gray-800'
            }`}
            title={isSidebarCollapsed ? 'Open Sidebar' : 'Close Sidebar'}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent pointer-events-none rounded-xl" />
            <div className="relative z-10">
              {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </div>
          </button>

          {!isSidebarCollapsed && currentConversationId && (
            <button
              onClick={() => shareConversation(currentConversationId)}
              className={`p-2 rounded-xl transition-all duration-300 hover:scale-110 backdrop-blur-sm border shadow-lg relative overflow-hidden ${
                darkMode 
                  ? 'text-gray-300 hover:text-white hover:bg-white/25 border-white/30' 
                  : 'text-gray-600 hover:text-gray-800 hover:bg-white/60 border-white/40'
              }`}
              title="Share conversation"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent pointer-events-none rounded-xl" />
              <Share size={18} className="relative z-10" />
            </button>
          )}

          {isSidebarCollapsed && (
            <button
              onClick={startNewConversation}
              className={`p-3 rounded-xl transition-all duration-300 hover:scale-110 backdrop-blur-sm border shadow-lg relative overflow-hidden ${
                darkMode 
                  ? 'bg-white/20 border-white/30 text-orange-300 hover:bg-white/30' 
                  : 'bg-white/40 border-white/50 text-blue-700 hover:bg-white/60'
              }`}
              title="New Chat"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-xl" />
              <MessageSquare size={20} className="relative z-10" />
            </button>
          )}

          {isSidebarCollapsed && currentConversationId && (
            <button
              onClick={() => shareConversation(currentConversationId)}
              className={`p-3 rounded-xl transition-all duration-300 hover:scale-110 backdrop-blur-sm border shadow-lg relative overflow-hidden ${
                darkMode 
                  ? 'text-gray-300 hover:text-white hover:bg-white/25 border-white/30' 
                  : 'text-gray-600 hover:text-gray-800 hover:bg-white/60 border-white/40'
              }`}
              title="Share conversation"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent pointer-events-none rounded-xl" />
              <Share size={20} className="relative z-10" />
            </button>
          )}
        </div>
      </div>
          
      {!isSidebarCollapsed && (
        <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-rounded-full scrollbar-track-transparent">
          {isConversationsLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader className={`animate-spin ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
            </div>
          ) : (
            <>
              {starredChats.length > 0 && (
                <>
                  <div className={`px-4 py-3 text-xs uppercase font-semibold tracking-wider border-b mb-2 backdrop-blur-sm ${
                    darkMode 
                      ? 'text-gray-400 border-white/20 bg-white/5' 
                      : 'text-gray-600 border-white/40 bg-white/20'
                  }`}>
                    <div className="flex items-center">
                      <Star className="mr-2" size={12} />
                      Starred
                    </div>
                  </div>
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
                </>
              )}

              {nonStarredChats.length > 0 && (
                <>
                  <div className={`px-4 py-3 text-xs mb-2 uppercase font-semibold tracking-wider border-b backdrop-blur-sm ${
                    darkMode 
                      ? 'text-gray-400 border-white/20 bg-white/5' 
                      : 'text-gray-600 border-white/40 bg-white/20'
                  }`}>
                    <div className="flex items-center">
                      <MessageSquare className="mr-2" size={12} />
                      Chats
                    </div>
                  </div>
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
      )}
    </div>

      <div className="flex-grow flex flex-col" style={{ height: '100vh' }}>
        <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${darkMode ? 'bg-gray-900' : ''} scrollbar-thin scrollbar-thumb-rounded-full scrollbar-track-transparent`}>
        {messages.map((message, index) => {
          const parts = message.content.split('\n\n').filter(part => part.trim() !== '');

          return (
            <>
              {parts.map((part, partIndex) => {
                const shouldShowProfilePicture = isLastMessagePartFromSender(messages, index, partIndex, parts);
                
                return (
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
                        <div className={`w-10 h-10 rounded-full mr-3 p-0.5 backdrop-blur-sm border transition-all duration-300 ${
                          darkMode 
                            ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-white/20 shadow-lg' 
                            : 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-white/40 shadow-md'
                        } ${shouldShowProfilePicture ? 'opacity-100' : 'opacity-0'}`}>
                          <img
                            src={aiPicture}
                            alt="AI Avatar"
                            className="w-full h-full rounded-full object-cover"
                          />
                        </div>
                      )}
                      <div>
                        {editingMessageIndex === index && partIndex === 0 ? (
                          <div className="flex flex-col">
                            <textarea
                              ref={editTextareaRef}
                              value={editMessageContent}
                              onChange={(e) => {
                                setEditMessageContent(e.target.value);
                                adjustTextareaHeight(e.target);
                              }}
                              className={`flex-grow p-3 rounded-2xl mb-3 resize-none backdrop-blur-sm border transition-all duration-300 ${
                                darkMode 
                                  ? 'bg-white/10 border-white/20 text-white placeholder-white/60' 
                                  : 'bg-white/60 border-white/40 text-gray-800 placeholder-gray-500'
                              } focus:outline-none focus:ring-2 ${
                                darkMode 
                                  ? 'focus:ring-purple-400/50' 
                                  : 'focus:ring-blue-500/50'
                              }`}
                              rows={1}
                              style={{ overflow: 'hidden' }}
                              placeholder="Edit your message..."
                            />
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => handleSaveEditMessage(index, editMessageContent, setEditMessageContent, setEditingMessageIndex)}
                                className={`p-2 rounded-full backdrop-blur-sm border transition-all duration-300 hover:scale-105 ${
                                  darkMode 
                                    ? 'bg-green-500/20 border-green-400/30 text-green-400 hover:bg-green-500/30' 
                                    : 'bg-green-500/20 border-green-500/40 text-green-600 hover:bg-green-500/30'
                                }`}
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={handleCancelEditMessage}
                                className={`p-2 rounded-full backdrop-blur-sm border transition-all duration-300 hover:scale-105 ${
                                  darkMode 
                                    ? 'bg-red-500/20 border-red-400/30 text-red-400 hover:bg-red-500/30' 
                                    : 'bg-red-500/20 border-red-500/40 text-red-600 hover:bg-red-500/30'
                                }`}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <ChatMessage content={part} darkMode={darkMode} messager={message.role}/>
                        )}
                      </div>
                      {message.role === 'user' && (
                        <div className={`w-10 h-10 rounded-full ml-3 p-0.5 backdrop-blur-sm border transition-all duration-300 ${
                          darkMode 
                            ? 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border-white/20 shadow-lg' 
                            : 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-white/40 shadow-md'
                        } ${shouldShowProfilePicture ? 'opacity-100' : 'opacity-0'}`}>
                          <img
                            src={userPicture}
                            alt="User Avatar"
                            className="w-full h-full rounded-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                    {partIndex === parts.length - 1 && (
                      <>
                        <div className={`flex mt-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${
                            hoveredMessageIndex === index && message.role === 'user'
                              ? 'opacity-100 group-hover:opacity-100'
                              : 'opacity-0 group-hover:opacity-0'
                          } transition-all duration-300 text-sm`}
                        >
                          {message.role === 'user' && (
                            <button
                              onClick={() => handleStartEditingMessage(index, message.content)}
                              className={`p-2 rounded-full backdrop-blur-sm border transition-all duration-300 hover:scale-105 ${
                                darkMode 
                                  ? 'bg-white/10 hover:bg-white/20 border-white/20 text-gray-300 shadow-lg' 
                                  : 'bg-white/60 hover:bg-white/80 border-white/40 text-gray-600 shadow-md'
                              }`}
                              title="Edit message"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                        </div>

                        <div className={`flex mt-2 space-x-2 ${message.role !== 'user' ? 'justify-end' : 'justify-start'} ${
                            hoveredMessageIndex === index && message.role !== 'user'
                              ? 'opacity-100 group-hover:opacity-100'
                              : 'opacity-0 group-hover:opacity-0'
                          } transition-all duration-300 text-sm`}
                        >
                          {message.role !== 'user' && (
                            <>
                              <button
                                onClick={() => handleLikeMessage(index, message.content)}
                                className={`p-2 rounded-full backdrop-blur-sm border transition-all duration-300 hover:scale-105 ${
                                  darkMode 
                                    ? 'bg-white/10 hover:bg-green-500/20 border-white/20 hover:border-green-400/30 text-gray-300 hover:text-green-400 shadow-lg' 
                                    : 'bg-white/60 hover:bg-green-500/20 border-white/40 hover:border-green-500/40 text-gray-600 hover:text-green-600 shadow-md'
                                }`}
                                title="Like message"
                              >
                                <ThumbsUp size={14} />
                              </button>
                              <button
                                onClick={() => handleDislikeMessage(index, message.content)}
                                className={`p-2 rounded-full backdrop-blur-sm border transition-all duration-300 hover:scale-105 ${
                                  darkMode 
                                    ? 'bg-white/10 hover:bg-red-500/20 border-white/20 hover:border-red-400/30 text-gray-300 hover:text-red-400 shadow-lg' 
                                    : 'bg-white/60 hover:bg-red-500/20 border-white/40 hover:border-red-500/40 text-gray-600 hover:text-red-600 shadow-md'
                                }`}
                                title="Dislike message"
                              >
                                <ThumbsDown size={14} />
                              </button>
                            </>
                          )}
                        </div>

                        {(
                          (currentConversationBranchInfo?.parent_conversation_id && currentConversationBranchInfo.branch_from_message_index === index) ||
                          (currentConversationBranchInfo?.children_branches && currentConversationBranchInfo.children_branches.some(b => b.branch_from_message_index === index))
                        ) && (
                          <div className={`flex mt-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                            <div className={`relative inline-block text-left ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                              <button
                                onClick={() => {
                                  setOpenBranchDropdownIndex(openBranchDropdownIndex === index ? null : index);
                                }}
                                className={`inline-flex justify-center px-4 py-2 text-sm font-medium rounded-2xl backdrop-blur-sm border transition-all duration-300 hover:scale-105 ${
                                  darkMode 
                                    ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white shadow-lg' 
                                    : 'bg-white/60 hover:bg-white/80 border-white/40 text-gray-700 shadow-md'
                                } focus:outline-none focus:ring-2 ${
                                  darkMode 
                                    ? 'focus:ring-purple-400/50' 
                                    : 'focus:ring-blue-500/50'
                                }`}
                                id={`options-menu-${index}`}
                                aria-haspopup="true"
                                aria-expanded="true"
                              >
                                Branches
                                <ChevronDown className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
                              </button>

                              {openBranchDropdownIndex === index && (
                                <div
                                  className={`origin-top-right absolute ${message.role === 'user' ? 'right-0' : 'left-0'} mt-2 w-56 rounded-2xl backdrop-blur-sm border shadow-xl transition-all duration-300 ${
                                    darkMode 
                                      ? 'bg-white/10 border-white/20' 
                                      : 'bg-white/80 border-white/50'
                                  }`}
                                  role="menu"
                                  aria-orientation="vertical"
                                  aria-labelledby={`options-menu-${index}`}
                                >
                                  <div className="py-2" role="none">
                                    {currentConversationBranchInfo?.parent_conversation_id &&
                                      currentConversationBranchInfo.branch_from_message_index === index && (
                                      <button
                                        onClick={() => {
                                          loadConversation(currentConversationBranchInfo.parent_conversation_id);
                                          setOpenBranchDropdownIndex(null);
                                        }}
                                        className={`${
                                          darkMode 
                                            ? 'text-gray-300 hover:bg-white/20' 
                                            : 'text-gray-700 hover:bg-white/60'
                                        } block px-4 py-2 text-sm w-full text-left rounded-xl mx-2 transition-all duration-200`}
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
                                        className={`${
                                          darkMode 
                                            ? 'text-gray-300 hover:bg-white/20' 
                                            : 'text-gray-700 hover:bg-white/60'
                                        } block px-4 py-2 text-sm w-full text-left rounded-xl mx-2 transition-all duration-200`}
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
                                        className={`${
                                          darkMode 
                                            ? 'text-orange-400 bg-gradient-to-r from-orange-500/20 to-red-500/20' 
                                            : 'text-blue-600 bg-gradient-to-r from-blue-500/20 to-purple-500/20'
                                        } block px-4 py-2 text-sm w-full text-left cursor-default rounded-xl mx-2`}
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
                );
              })}
            </>
          );
        })}          
        <div ref={messagesEndRef} />
        </div>

        <div className={`flex-shrink-0 p-4 border-t shadow-xl backdrop-blur-sm transition-all duration-300 ${
          darkMode 
            ? 'bg-white/10 border-white/20' 
            : 'bg-white/60 border-white/40'
        }`}>
          <div className="flex items-end space-x-3">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Send a message..."
              className={`flex-grow p-4 rounded-2xl resize-none max-h-40 backdrop-blur-sm border transition-all duration-300 ${
                darkMode
                  ? 'bg-white/10 border-white/20 text-white placeholder-white/60 focus:border-orange-400/50 focus:ring-2 focus:ring-orange-400/20'
                  : 'bg-white/60 border-white/40 text-gray-800 placeholder-gray-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20'
              } focus:outline-none`}
              rows={1}
              style={{ overflow: 'auto' }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim()}
              className={`p-4 rounded-2xl backdrop-blur-sm border transition-all duration-300 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                darkMode
                  ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-400/30 text-orange-400 hover:bg-gradient-to-r hover:from-orange-500/30 hover:to-red-500/30'
                  : 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-500/40 text-blue-600 hover:bg-gradient-to-r hover:from-blue-500/30 hover:to-purple-500/30'
              }`}
            >
              <ArrowBigUp size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatComponent;