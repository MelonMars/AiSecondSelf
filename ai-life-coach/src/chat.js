import React, { useEffect, useRef, useState, memo, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, Loader, Edit2, Check, X, Star, ChevronLeft, ChevronRight, Share, ArrowBigUp, ThumbsUp, ThumbsDown, Menu, Paperclip, MessageCircle } from 'lucide-react';
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

const ChatMessage = memo(({ content, darkMode, messager, reaction }) => {
  let displayContent = content;
  const unclosedGraph = /<GRAPH(?![^>]*?>[\s\S]*?<\/GRAPH>)/.exec(content);
  const unclosedPref = /<PREF(?![^>]*?>[\s\S]*?<\/PREF>)/.exec(content);
  const unclosedReaction = /REACTION\{[^}]*$/.exec(content);

  if (unclosedGraph) {
    displayContent = content.substring(0, unclosedGraph.index);
  } else if (unclosedPref) {
    displayContent = content.substring(0, unclosedPref.index);
  } else if (unclosedReaction) {
    displayContent = content.substring(0, unclosedReaction.index);
  }

  let cleanedContent = displayContent
    .replace(/<GRAPH[\s\S]*?<\/GRAPH>/g, '')
    .replace(/<PREF[\s\S]*?<\/PREF>/g, '');

  if (messager !== 'user') {
    cleanedContent = cleanedContent.replace(/REACTION\{[^}]*\}/g, '');
  }

  if (!cleanedContent.trim()) {
    return null;
  }

  cleanedContent = cleanedContent.replace(/^\d{2}\/\d{2}\/\d{4},\s*\d{1,2}:\d{2}\s*(AM|PM)\s*-\s*/, '');

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
          className={`max-w-4xl mx-auto mb-3 p-4 rounded-3xl backdrop-blur-sm border transition-all duration-300 prose max-w-none relative ${
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
          {isUser && reaction && (
            <div className="absolute -top-2 -right-2 bg-white rounded-full p-1.5 shadow-lg border-2 border-orange-200 z-10">
              <span className="text-lg leading-none block">{reaction}</span>
            </div>
          )}
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
      <div key={`w-${idx++}`} className={`max-w-4xl mx-auto mb-3 p-3 rounded-3xl backdrop-blur-sm border transition-all duration-300 relative ${
        isUser
          ? 'bg-orange-500/70 border-orange-600/50 shadow-md' 
          : darkMode 
            ? 'bg-white/8 border-white/15 shadow-lg' 
            : 'bg-white/70 border-white/50 shadow-md'
      }`}
      style={{
        borderRadius: isUser ? '24px 24px 8px 24px' : '24px 24px 24px 8px'
      }}>
        {isUser && reaction && (
          <div className="absolute -top-2 -right-2 bg-white rounded-full p-1.5 shadow-lg border-2 border-orange-200 z-10">
            <span className="text-lg leading-none block">{reaction}</span>
          </div>
        )}
        <DynamicWidget payload={payload} />
      </div>
    );

    last = end;
  }

  if (last < cleanedContent.length) {
    parts.push(
      <div
        key={`t-${idx++}`}
        className={`max-w-4xl mx-auto mb-3 p-4 rounded-3xl backdrop-blur-sm border transition-all duration-300 prose max-w-none relative ${
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
        {isUser && reaction && (
          <div className="absolute -top-2 -right-2 bg-white rounded-full p-1.5 shadow-lg border-2 border-orange-200 z-10">
            <span className="text-lg leading-none block">{reaction}</span>
          </div>
        )}
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

  return <div className="max-w-full px-2 max-w-[40vw]">{parts}</div>;
});

export const extractReaction = (content) => {
  const reactionMatch = /REACTION\{([^}]*)\}/.exec(content);
  return reactionMatch ? reactionMatch[1] : null;
};

const ConversationItem = memo(({
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
});

const Sidebar = memo(({
  isSidebarCollapsed,
  darkMode,
  toggleSidebar,
  startNewConversation,
  currentConversationId,
  shareConversation,
  showModeDropdown,
  setShowModeDropdown,
  aiModes,
  aiMode,
  setAiMode,
  isConversationsLoading,
  starredChats,
  nonStarredChats,
  onConversationRenamed,
  onToggleStar,
  starredConversations,
  loadConversation,
  setIsSidebarCollapsed,
}) => {
  const handleClickOutside = useCallback(() => {
    setIsSidebarCollapsed(true);
  }, [setIsSidebarCollapsed]);

  return (
    <>
      {!isSidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-10 md:hidden"
          onClick={handleClickOutside}
        />
      )}

      <div className={`
        flex flex-col fixed md:relative z-20 md:z-auto
        transition-all duration-500 ease-out overflow-hidden
        backdrop-blur-xl border-r shadow-2xl
        ${isSidebarCollapsed ? 'w-0 md:w-16 opacity-0 md:opacity-100 -translate-x-full md:translate-x-0' : 'w-80 md:w-64 opacity-100 translate-x-0'}
        ${darkMode
          ? 'bg-white/15 border-white/20 shadow-black/20'
          : 'bg-white/70 border-white/30 shadow-black/10'
        }
        h-full
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
              className={`p-3 rounded-xl flex items-center justify-center w-full transition-all duration-300 hover:scale-105 active:scale-95 backdrop-blur-sm border shadow-lg relative overflow-hidden ${
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
              } rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 backdrop-blur-sm border shadow-lg relative overflow-hidden ${
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
                className={`p-2 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 backdrop-blur-sm border shadow-lg relative overflow-hidden ${
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

            {!isSidebarCollapsed && (
              <div className="relative">
                <button
                  onClick={() => setShowModeDropdown(!showModeDropdown)}
                  className={`p-2 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 backdrop-blur-sm border shadow-lg relative overflow-hidden ${
                    darkMode 
                      ? 'text-gray-300 hover:text-white hover:bg-white/25 border-white/30' 
                      : 'text-gray-600 hover:text-gray-800 hover:bg-white/60 border-white/40'
                  }`}
                  title="AI Mode"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent pointer-events-none rounded-xl" />
                  {React.createElement(aiModes.find(mode => mode.id === aiMode)?.icon || MessageCircle, { size: 18, className: "relative z-10" })}
                </button>
                
                {showModeDropdown && createPortal(
                  <div className={`fixed z-50 w-56 rounded-2xl backdrop-blur-sm border shadow-xl ${
                    darkMode 
                      ? 'bg-white/10 border-white/20' 
                      : 'bg-white/80 border-white/50'
                  }`}
                  style={{
                    left: isSidebarCollapsed ? '72px' : '272px',
                    top: '120px',
                  }}>
                    <div className="py-2">
                      {aiModes.map((mode) => (
                        <button
                          key={mode.id}
                          onClick={() => {
                            setAiMode(mode.id);
                            setShowModeDropdown(false);
                          }}
                          className={`w-[95%] px-4 py-3 text-left rounded-xl mx-2 transition-all duration-200 hover:scale-[0.98] active:scale-95 ${
                            aiMode === mode.id
                              ? darkMode
                                ? 'bg-orange-500/20 text-orange-300 border border-orange-400/30'
                                : 'bg-blue-500/20 text-blue-700 border border-blue-500/40'
                              : darkMode
                                ? 'text-gray-300 hover:bg-white/20'
                                : 'text-gray-700 hover:bg-white/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              {React.createElement(mode.icon, { size: 16, className: "mr-3" })}
                              <div>
                                <div className="font-medium text-sm">{mode.name}</div>
                                <div className={`text-xs ${
                                  darkMode ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                  {mode.description}
                                </div>
                              </div>
                            </div>
                            {aiMode === mode.id && (
                              <Check size={16} className="flex-shrink-0" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>,
                  document.body
                )}
              </div>
            )}

            {isSidebarCollapsed && (
              <>
                <button
                  onClick={startNewConversation}
                  className={`p-3 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 backdrop-blur-sm border shadow-lg relative overflow-hidden ${
                    darkMode 
                      ? 'bg-white/20 border-white/30 text-orange-300 hover:bg-white/30' 
                      : 'bg-white/40 border-white/50 text-blue-700 hover:bg-white/60'
                  }`}
                  title="New Chat"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-xl" />
                  <MessageSquare size={20} className="relative z-10" />
                </button>

                {currentConversationId && (
                  <button
                    onClick={() => shareConversation(currentConversationId)}
                    className={`p-3 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 backdrop-blur-sm border shadow-lg relative overflow-hidden ${
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

                <div className="relative">
                  <button
                    onClick={() => setShowModeDropdown(!showModeDropdown)}
                    className={`p-3 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 backdrop-blur-sm border shadow-lg relative overflow-hidden ${
                      darkMode 
                        ? 'text-gray-300 hover:text-white hover:bg-white/25 border-white/30' 
                        : 'text-gray-600 hover:text-gray-800 hover:bg-white/60 border-white/40'
                    }`}
                    title={`AI Mode: ${aiModes.find(mode => mode.id === aiMode)?.name || 'Normal'}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent pointer-events-none rounded-xl" />
                    {React.createElement(aiModes.find(mode => mode.id === aiMode)?.icon || MessageCircle, { size: 20, className: "relative z-10" })}
                  </button>
                  
                  {showModeDropdown && createPortal(
                    <div className={`fixed z-50 w-56 rounded-2xl backdrop-blur-sm border shadow-xl ${
                      darkMode 
                        ? 'bg-white/10 border-white/20' 
                        : 'bg-white/80 border-white/50'
                    }`}
                    style={{
                      left: isSidebarCollapsed ? '72px' : '272px',
                      top: '120px',
                    }}>
                      <div className="py-2">
                        {aiModes.map((mode) => (
                          <button
                            key={mode.id}
                            onClick={() => {
                              setAiMode(mode.id);
                              setShowModeDropdown(false);
                            }}
                            className={`w-[95%] px-4 py-3 text-left rounded-xl mx-2 transition-all duration-200 hover:scale-[0.98] active:scale-95 ${
                              aiMode === mode.id
                                ? darkMode
                                  ? 'bg-orange-500/20 text-orange-300 border border-orange-400/30'
                                  : 'bg-blue-500/20 text-blue-700 border border-blue-500/40'
                                : darkMode
                                  ? 'text-gray-300 hover:bg-white/20'
                                  : 'text-gray-700 hover:bg-white/60'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                {React.createElement(mode.icon, { size: 16, className: "mr-3" })}
                                <div>
                                  <div className="font-medium text-sm">{mode.name}</div>
                                  <div className={`text-xs ${
                                    darkMode ? 'text-gray-400' : 'text-gray-500'
                                  }`}>
                                    {mode.description}
                                  </div>
                                </div>
                              </div>
                              {aiMode === mode.id && (
                                <Check size={16} className="flex-shrink-0" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
              </>
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
    </>
  );
});

Sidebar.displayName = 'Sidebar';

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
  handleDocumentUpload,
  backgroundImageUrl,
  gradientTone,
  gradientTones,
  aiMode,
  setAiMode,
  aiModes,
  uploadedFiles,
  setUploadedFiles,
  navigateToNextBranch,
  navigateToPreviousBranch,
  currentBranchGroup,
  currentBranchIndex,
}) => {
  const [inputMessage, setInputMessage] = useState('');
  // const [editingConversationId, setEditingConversationId] = useState(null);
  // const [renamedTitle, setRenamedTitle] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); 
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);
  const [editMessageContent, setEditMessageContent] = useState('');
  const [hoveredMessageIndex, setHoveredMessageIndex] = useState(null);
  // const [openBranchDropdownIndex, setOpenBranchDropdownIndex] = useState(null);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [gradientPhase, setGradientPhase] = useState(0);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const editTextareaRef = useRef(null);

  const isConversationStarred = useCallback((conversationId) => {
    return starredConversations.includes(conversationId);
  }, [starredConversations]);

  const starredChats = useMemo(() => 
    conversations.filter(isConversationStarred), 
    [conversations, isConversationStarred]
  );
  
  const nonStarredChats = useMemo(() => 
    conversations.filter(conv => !isConversationStarred(conv.id)), 
    [conversations, isConversationStarred]
  );

  const sidebarProps = useMemo(() => ({
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    darkMode,
    toggleSidebar: () => setIsSidebarCollapsed(!isSidebarCollapsed),
    startNewConversation,
    currentConversationId,
    shareConversation,
    showModeDropdown,
    setShowModeDropdown,
    aiModes,
    aiMode,
    setAiMode,
    isConversationsLoading,
    starredChats,
    nonStarredChats,
    onConversationRenamed,
    onToggleStar,
    starredConversations,
    loadConversation,
  }), [
    isSidebarCollapsed,
    darkMode,
    startNewConversation,
    currentConversationId,
    shareConversation,
    showModeDropdown,
    aiModes,
    aiMode,
    setAiMode,
    isConversationsLoading,
    starredChats,
    nonStarredChats,
    onConversationRenamed,
    onToggleStar,
    starredConversations,
    loadConversation,
  ]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showModeDropdown && !event.target.closest('.relative')) {
        setShowModeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModeDropdown]);

  useEffect(() => {
    if (editingMessageIndex !== null && editTextareaRef.current) {
      editTextareaRef.current.focus();
      adjustTextareaHeight(editTextareaRef.current);
    }
  }, [editingMessageIndex]);

  useEffect(() => {
    const interval = setInterval(() => {
      setGradientPhase(prev => (prev + 1) % 360);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
  
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
  
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [currentConversationId, messages]);

  const adjustTextareaHeight = useCallback((textarea) => {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    if (window.innerWidth >= 768) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const getAnimatedGradientStyle = useCallback(() => {
    return {
      background: darkMode
        ? 'radial-gradient(ellipse 120% 80% at 50% 30%, #a78bfa33 0%, transparent 60%), radial-gradient(ellipse 100% 120% at 70% 60%, #f472b633 0%, transparent 55%), radial-gradient(ellipse 140% 90% at 40% 80%, #fbbf2433 0%, transparent 65%), #111827'
        : 'radial-gradient(ellipse 120% 80% at 50% 30%, #60a5fa33 0%, transparent 60%), radial-gradient(ellipse 100% 120% at 70% 60%, #a78bfa33 0%, transparent 55%), radial-gradient(ellipse 140% 90% at 40% 80%, #f472b633 0%, transparent 65%), #f3f4f6',
      transition: 'background 0.1s ease-out'
    };
  }, [darkMode]);

  const gradientStyle = getAnimatedGradientStyle();

  const handleSendMessage = useCallback(() => {
    if (inputMessage.trim()) {
      sendMessage(inputMessage);
      setInputMessage('');
      setUploadedFiles([]);
      const fileInput = document.getElementById('fileInput');
      if (fileInput) {
        fileInput.value = '';
      }
    }
  }, [inputMessage, sendMessage, setUploadedFiles]);

  const handleRemoveFile = useCallback(() => {
    setUploadedFiles([]);
    
    if (inputRef.current) {
      const fileInput = document.getElementById('document-upload');
      if (fileInput) {
        fileInput.value = '';
      }
    }
  }, [setUploadedFiles]);

  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleStartEditingMessage = useCallback((index, content) => {
    setEditingMessageIndex(index);
    setEditMessageContent(content);
    setHoveredMessageIndex(null);
  }, []);

  const handleCancelEditMessage = useCallback(() => {
    setEditingMessageIndex(null);
    setEditMessageContent('');
  }, []);

  const isLastMessagePartFromSender = useCallback((messages, currentIndex, currentPartIndex, parts) => {
    if (currentPartIndex !== parts.length - 1) {
      return false;
    }
    
    const nextMessage = messages[currentIndex + 1];
    return !nextMessage || nextMessage.role !== messages[currentIndex].role;
  }, []);

  return (
    <div
      className="flex h-full relative"
      style={
        backgroundImageUrl && backgroundImageUrl.trim() !== ''
          ? {
              backgroundImage: `url(${backgroundImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }
          : gradientStyle
      }
    >

      <Sidebar {...sidebarProps} />
      <div className="flex-grow flex flex-col" style={{ minHeight: '100vh' }}>
        <div className={`md:hidden flex items-center justify-between p-4 border-b backdrop-blur-sm ${
          darkMode ? 'bg-white/10 border-white/20' : 'bg-white/60 border-white/40'
        }`}>
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            className={`p-2 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 backdrop-blur-sm border shadow-lg ${
              darkMode 
                ? 'hover:bg-white/25 text-gray-300 border-white/30 hover:text-white' 
                : 'hover:bg-white/60 border-white/40 text-gray-600 hover:text-gray-800'
            }`}
          >
            <Menu size={20} />
          </button>
          
          <h1 className={`font-semibold text-lg ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            Chat
          </h1>
          
          {currentConversationId && (
            <button
              onClick={() => shareConversation(currentConversationId)}
              className={`p-2 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 backdrop-blur-sm border shadow-lg ${
                darkMode 
                  ? 'text-gray-300 hover:text-white hover:bg-white/25 border-white/30' 
                  : 'text-gray-600 hover:text-gray-800 hover:bg-white/60 border-white/40'
              }`}
            >
              <Share size={18} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 md:space-y-6 scrollbar-thin scrollbar-thumb-rounded-full scrollbar-track-transparent pb-safe">
        {messages.map((message, index) => {
          const parts = message.content.split('\n\n').filter(part => part.trim() !== '');

          let userReaction = null;
          if (message.role === 'user' && index < messages.length - 1) {
            const nextMessage = messages[index + 1];
            if (nextMessage && nextMessage.role === 'assistant') {
              userReaction = extractReaction(nextMessage.content);
            }
          }

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
                    <div className="flex items-end max-w-full md:max-w-none">
                      {message.role !== 'user' && (
                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full mr-2 md:mr-3 p-0.5 backdrop-blur-sm border transition-all duration-300 flex-shrink-0 ${
                          darkMode 
                            ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-white/20 shadow-lg' 
                            : 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-white/40 shadow-md'
                        } ${shouldShowProfilePicture ? 'opacity-100' : 'opacity-0'}`}>
                          {aiPicture ? (
                            <img
                              src={aiPicture}
                              alt="AI Avatar"
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full rounded-full flex items-center justify-center text-xs font-bold">
                              <span className={darkMode ? 'text-purple-200' : 'text-blue-700'}>AI</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {editingMessageIndex === index && partIndex === 0 ? (
                          <div className="flex flex-col">
                            <textarea
                              ref={editTextareaRef}
                              value={editMessageContent}
                              onChange={(e) => {
                                setEditMessageContent(e.target.value);
                                adjustTextareaHeight(e.target);
                              }}
                              className={`flex-grow p-3 rounded-2xl mb-3 resize-none backdrop-blur-sm border transition-all duration-300 w-full ${
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
                                className={`p-2 rounded-full backdrop-blur-sm border transition-all duration-300 hover:scale-105 active:scale-95 ${
                                  darkMode 
                                    ? 'bg-green-500/20 border-green-400/30 text-green-400 hover:bg-green-500/30' 
                                    : 'bg-green-500/20 border-green-500/40 text-green-600 hover:bg-green-500/30'
                                }`}
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={handleCancelEditMessage}
                                className={`p-2 rounded-full backdrop-blur-sm border transition-all duration-300 hover:scale-105 active:scale-95 ${
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
                          <ChatMessage content={part} darkMode={darkMode} messager={message.role} reaction={message.role === 'user' ? userReaction : null}/>
                        )}
                      </div>
                      {message.role === 'user' && (
                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full ml-2 md:ml-3 p-0.5 backdrop-blur-sm border transition-all duration-300 flex-shrink-0 ${
                          darkMode 
                            ? 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border-white/20 shadow-lg' 
                            : 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-white/40 shadow-md'
                        } ${shouldShowProfilePicture ? 'opacity-100' : 'opacity-0'}`}>
                          {userPicture ? (
                            <img
                              src={userPicture}
                              alt="User Avatar"
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full rounded-full flex items-center justify-center text-xs font-bold">
                              <span className={darkMode ? 'text-orange-200' : 'text-blue-700'}>You</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {partIndex === parts.length - 1 && (
                      <>
                        <div className={`flex mt-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${
                            hoveredMessageIndex === index && message.role === 'user'
                              ? 'opacity-100 group-hover:opacity-100'
                              : 'opacity-0 group-hover:opacity-100 md:group-hover:opacity-0'
                          } md:opacity-0 transition-all duration-300 text-sm`}
                        >
                          {message.role === 'user' && (
                            <button
                              onClick={() => handleStartEditingMessage(index, message.content)}
                              className={`p-2 rounded-full backdrop-blur-sm border transition-all duration-300 hover:scale-105 active:scale-95 ${
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
                              : 'opacity-0 group-hover:opacity-100 md:group-hover:opacity-0'
                          } md:opacity-0 transition-all duration-300 text-sm`}
                        >
                          {message.role !== 'user' && (
                            <>
                              <button
                                onClick={() => handleLikeMessage(index, message.content)}
                                className={`p-2 rounded-full backdrop-blur-sm border transition-all duration-300 hover:scale-105 active:scale-95 ${
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
                                className={`p-2 rounded-full backdrop-blur-sm border transition-all duration-300 hover:scale-105 active:scale-95 ${
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
                        {(currentBranchGroup && currentBranchGroup.length > 1) && 
                          (currentConversationBranchInfo?.branch_from_message_index === index || 
                            (currentConversationBranchInfo?.children_branches && 
                            currentConversationBranchInfo.children_branches.some(b => b.branch_from_message_index === index))) && (
                          <div className={`flex mt-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={navigateToPreviousBranch}
                                className={`p-2 rounded-full backdrop-blur-sm border transition-all duration-300 hover:scale-105 active:scale-95 ${
                                  darkMode 
                                    ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white shadow-lg' 
                                    : 'bg-white/60 hover:bg-white/80 border-white/40 text-gray-700 shadow-md'
                                }`}
                                title="Previous branch"
                              >
                                <ChevronLeft size={16} />
                              </button>

                              <div className={`px-3 py-1 rounded-full backdrop-blur-sm border text-xs font-medium ${
                                darkMode 
                                  ? 'bg-white/10 border-white/20 text-white' 
                                  : 'bg-white/60 border-white/40 text-gray-700'
                              }`}>
                                {currentBranchIndex + 1} / {currentBranchGroup.length}
                              </div>

                              <button
                                onClick={navigateToNextBranch}
                                className={`p-2 rounded-full backdrop-blur-sm border transition-all duration-300 hover:scale-105 active:scale-95 ${
                                  darkMode 
                                    ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white shadow-lg' 
                                    : 'bg-white/60 hover:bg-white/80 border-white/40 text-gray-700 shadow-md'
                                }`}
                                title="Next branch"
                              >
                                <ChevronRight size={16} />
                              </button>
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

        <div className={`flex-shrink-0 p-3 md:p-4 border-t shadow-xl backdrop-blur-sm transition-all duration-300 input-container ${
          darkMode 
            ? 'bg-white/10 border-white/20' 
            : 'bg-white/60 border-white/40'
        }`} style={{ position: 'sticky', bottom: 0, zIndex: 100 }}>
          
          {uploadedFiles && uploadedFiles.length > 0 && (
            <div className="mb-3">
              <div className={`p-3 rounded-xl backdrop-blur-sm border transition-all duration-300 ${
                darkMode
                  ? 'bg-white/10 border-white/20'
                  : 'bg-white/60 border-white/40'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      darkMode
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-blue-500/20 text-blue-600'
                    }`}>
                      <Paperclip size={16} />
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${
                        darkMode ? 'text-white' : 'text-gray-800'
                      }`}>
                        {uploadedFiles[0].name}
                      </p>
                      <p className={`text-xs ${
                        darkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {formatFileSize(uploadedFiles[0].size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveFile}
                    className={`p-1 rounded-full transition-all duration-200 hover:scale-110 ${
                      darkMode
                        ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/20'
                        : 'text-gray-500 hover:text-red-600 hover:bg-red-500/20'
                    }`}
                    title="Remove file"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-end space-x-2 md:space-x-3">
            <label htmlFor="document-upload" className={`p-3 md:p-4 rounded-2xl backdrop-blur-sm border transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg flex-shrink-0 cursor-pointer ${
                darkMode
                  ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 border-teal-400/30 text-teal-400 hover:bg-gradient-to-r hover:from-teal-500/30 hover:to-cyan-500/30'
                  : 'bg-gradient-to-r from-green-500/20 to-lime-500/20 border-green-500/40 text-green-600 hover:bg-gradient-to-r hover:from-green-500/30 hover:to-lime-500/30'
            }`}>
              <Paperclip size={18} className="md:hidden" />
              <Paperclip size={20} className="hidden md:block" />
              <input 
                id="document-upload" 
                type="file" 
                className="hidden" 
                onChange={handleDocumentUpload}
              />
            </label>

            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Send a message..."
              className={`flex-grow p-3 md:p-4 rounded-2xl resize-none max-h-32 md:max-h-40 backdrop-blur-sm border transition-all duration-300 text-sm md:text-base ${
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
              className={`p-3 md:p-4 rounded-2xl backdrop-blur-sm border transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex-shrink-0 ${
                darkMode
                  ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-400/30 text-orange-400 hover:bg-gradient-to-r hover:from-orange-500/30 hover:to-red-500/30'
                  : 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-500/40 text-blue-600 hover:bg-gradient-to-r hover:from-blue-500/30 hover:to-purple-500/30'
              }`}
            >
              <ArrowBigUp size={18} className="md:hidden" />
              <ArrowBigUp size={20} className="hidden md:block" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

};

export default ChatComponent;