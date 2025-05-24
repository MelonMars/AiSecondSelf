import React, { useEffect, useRef, useState, memo, useMemo } from 'react';
import { Loader } from 'lucide-react'; 
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import * as Babel from "@babel/standalone";
import { useParams, useLocation } from 'react-router-dom';

function DynamicWidget({ payload }) {
  const containerRef = useRef(null);

  const Comp = useMemo(() => {
    const codeToCompile = typeof payload?.code === 'string' ? payload.code : '()=><div>Invalid widget code format</div>';
    const toCompile = `var Comp = ${codeToCompile};`;

    try {
      const { code: js } = Babel.transform(toCompile, {
        presets: ['es2015', 'react']
      });

      const finalBody = js + '\nreturn Comp;';

      return new Function('React', finalBody)(React);
    } catch (e) {
      console.error('Error compiling widget code:', e);
      return () => (
        <pre className="bg-red-100 p-2 text-sm">
          Error compiling widget code: {e.message}
        </pre>
      );
    }
  }, [payload?.code]); 

  const props = typeof payload?.props === 'object' && payload.props !== null ? payload.props : {};


  return (
    <div
      ref={containerRef}
      className="my-4 p-4 border border-gray-200 rounded-lg shadow-sm bg-white"
    >
      <Comp {...props} /> 
    </div>
  );
}

const ChatMessage = memo(({ content, darkMode }) => {
  const parts = [];
  const regex = /<WIDGET\s+name="([^"]+)">([\s\S]*?)<\/WIDGET>/g;
  let last = 0, match, idx = 0;

  const safeContent = typeof content === 'string' ? content : '';

  while ((match = regex.exec(safeContent)) !== null) {
    const [full, name, data] = match;
    const start = match.index, end = start + full.length;

    if (last < start) {
      parts.push(
        <div key={`t-${idx++}`} className={`${darkMode ? 'text-white' : 'text-black'} m-0 p-0 message-text`}>
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {safeContent.slice(last, start)}
          </ReactMarkdown>
        </div>
      );
    }

    let payload;
    try { 
        const decodedData = data
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
        payload = JSON.parse(decodedData); 
    }
    catch (e) { 
        console.error("Error parsing widget JSON:", e);
        payload = { code: `()=><pre className="bg-red-100 p-2 text-sm">Invalid Widget JSON: ${e.message}</pre>`, props: {} }; 
    }

    parts.push(
      <DynamicWidget key={`w-${idx++}`} payload={payload} />
    );

    last = end;
  }

  if (last < safeContent.length) {
    parts.push(
      <div key={`t-${idx++}`} className={`${darkMode ? 'text-white' : 'text-black'} m-0 p-0 message-text`}>
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {safeContent.slice(last)}
        </ReactMarkdown>
      </div>
    );
  }

   if (parts.length === 0 && safeContent.trim() !== '') {
       parts.push(
        <div key={`t-${idx++}`} className={`${darkMode ? 'text-white' : 'text-black'} m-0 p-0 message-text`}>
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {safeContent}
          </ReactMarkdown>
        </div>
      );
   } else if (parts.length === 0 && safeContent.trim() === '') {
       return null;
   }


  return <div className="max-w-full">{parts}</div>;
});

const SharedComponent = () => {
  const [conversation, setConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ownerId, setOwnerId] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || null);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true' || false);
  const { ownerId: urlOwnerId, conversationId: urlConversationId } = useParams();
  const location = useLocation();

  useEffect(() => {
    setOwnerId(urlOwnerId);
    setConversationId(urlConversationId);

    if (urlOwnerId && urlConversationId) {
      handleLoadSharedUrlFromParams(urlOwnerId, urlConversationId);
    } else {
        setError("Invalid shared URL. Owner ID and Conversation ID are missing.");
    }
  }, [urlOwnerId, urlConversationId, authToken]); 

  const handleLoadSharedUrlFromParams = async (currentOwnerId, currentConversationId) => {
    setIsLoading(true);
    setError(null);
    setConversation(null);

    try {
      const url = `http://127.0.0.1:8000/conversations/${currentOwnerId}/${currentConversationId}`;

      const res = await fetch(url, {headers: {
        'Authorization': `Bearer ${authToken}`,
      }});

      if (!res.ok) {
        let errorMessage = `Server error: ${res.status}`;
        if (res.status === 401) {
          errorMessage = "Authentication failed. Please log in again.";
        } else if (res.status === 404) {
          errorMessage = "Conversation not found.";
        } else {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      setConversation(data);
    } catch (e) {
      console.error("Error fetching conversation:", e);
      setError(e.message || "Failed to load conversation.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-black'}`}>

      <div className={`p-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} border-b flex justify-between items-center shadow-sm`}>
        <h1 className={`text-xl font-semibold ${darkMode ? 'text-white' : ''}`}>
          Shared Conversation{conversation?.title ? `: ${conversation.title}` : ''}
        </h1>
      </div>

      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {isLoading && (
          <div className="flex justify-center items-center h-full">
            <Loader className={`animate-spin ${darkMode ? 'text-gray-300' : 'text-gray-500'}`} size={32} />
          </div>
        )}

        {error && !isLoading && (
          <div className="flex justify-center items-center h-full">
            <div className={`text-red-500 font-semibold p-4 border ${darkMode ? 'border-red-700 bg-red-900' : 'border-red-100 bg-red-100'} rounded-lg`}>
              {error}
            </div>
          </div>
        )}

        {!isLoading && !error && !conversation && (
             <div className="flex justify-center items-center h-full text-center">
                 <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                     Loading conversation...
                 </p>
             </div>
        )}
         {!isLoading && !error && conversation && (!conversation.messages || conversation.messages.length === 0) && (
              <div className="flex justify-center items-center h-full text-center">
                  <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                      This conversation is empty.
                  </p>
              </div>
         )}


        {!isLoading && !error && conversation?.messages?.length > 0 && (
            conversation.messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-2xl px-3 py-2 rounded-lg relative ${
                    message.role === 'user'
                      ? darkMode ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
                      : darkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-black'
                  }`}
                >
                  <ChatMessage content={message.content} darkMode={darkMode}/>
                </div>
              </div>
            ))
        )}
          <div ref={useRef(null)} />
      </div>

      {/* <div className={`p-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} border-t shadow-sm`}>
        <div className="flex items-center">
          <input
            type="text"
            value={sharedUrlInput}
            onChange={handleUrlInputChange}
            onKeyPress={handleInputKeyPress}
            placeholder="Paste shared conversation URL here (e.g., 127.0.0.1:8000/conversations/...)"
            className={`flex-grow p-2 border rounded-lg mr-2 ${
              darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300'
            }`}
          />
          <button
            onClick={handleLoadSharedUrl}
            disabled={!sharedUrlInput.trim() || isLoading}
            className={`${darkMode ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-500 hover:bg-blue-600'} text-white p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? 'Loading...' : 'Load'}
          </button>
        </div>
      </div> */}
    </div>
  );
};

export default SharedComponent;