import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Modal,
  Alert,
  Dimensions,
  StatusBar,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: Date;
}

interface ChatComponentProps {}

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
  darkMode: boolean;
  conversations: Conversation[];
  onNewChat: () => void;
  onSelectConversation: (conversation: Conversation) => void;
  currentConversation?: Conversation;
}

const Sidebar: React.FC<SidebarProps> = ({
  visible,
  onClose,
  darkMode,
  conversations,
  onNewChat,
  onSelectConversation,
  currentConversation,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity style={{ flex: 1 }} onPress={onClose}>
        <BlurView
          intensity={darkMode ? 50 : 20}
          tint={darkMode ? 'dark' : 'light'}
          style={{ flex: 1 }}
        >
          <View
            style={{
              backgroundColor: darkMode ? '#1a1a1a' : '#fff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              marginTop: 'auto',
              maxHeight: height * 0.8,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: 'bold',
                  color: darkMode ? '#fff' : '#000',
                }}
              >
                Chat History
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons
                  name="close"
                  size={24}
                  color={darkMode ? '#fff' : '#000'}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={{
                backgroundColor: '#007AFF',
                padding: 15,
                borderRadius: 12,
                marginBottom: 20,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => {
                onNewChat();
                onClose();
              }}
            >
              <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text
                style={{
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: 16,
                }}
              >
                New Chat
              </Text>
            </TouchableOpacity>

            <ScrollView style={{ maxHeight: height * 0.5 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: darkMode ? '#fff' : '#000',
                  marginBottom: 15,
                }}
              >
                Recent Conversations
              </Text>
              {conversations.map((conversation) => (
                <TouchableOpacity
                  key={conversation.id}
                  style={{
                    backgroundColor: currentConversation?.id === conversation.id 
                      ? (darkMode ? '#333' : '#e8e8e8') 
                      : (darkMode ? '#2a2a2a' : '#f8f8f8'),
                    padding: 15,
                    borderRadius: 10,
                    marginBottom: 10,
                    borderWidth: currentConversation?.id === conversation.id ? 2 : 0,
                    borderColor: '#007AFF',
                  }}
                  onPress={() => {
                    onSelectConversation(conversation);
                    onClose();
                  }}
                >
                  <Text
                    style={{
                      color: darkMode ? '#fff' : '#000',
                      fontWeight: '500',
                      fontSize: 14,
                    }}
                    numberOfLines={2}
                  >
                    {conversation.title}
                  </Text>
                  <Text
                    style={{
                      color: darkMode ? '#aaa' : '#666',
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    {conversation.lastUpdated.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
              ))}
              {conversations.length === 0 && (
                <Text
                  style={{
                    color: darkMode ? '#aaa' : '#666',
                    textAlign: 'center',
                    fontStyle: 'italic',
                    marginTop: 20,
                  }}
                >
                  No conversations yet
                </Text>
              )}
            </ScrollView>
          </View>
        </BlurView>
      </TouchableOpacity>
    </Modal>
  );
};

const MessageBubble: React.FC<{ message: Message; darkMode: boolean }> = ({ message, darkMode }) => {
  const isUser = message.role === 'user';
  
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 15,
        paddingHorizontal: 15,
      }}
    >
      <View
        style={{
          maxWidth: width * 0.75,
          backgroundColor: isUser 
            ? '#007AFF' 
            : (darkMode ? '#2a2a2a' : '#f0f0f0'),
          padding: 15,
          borderRadius: 18,
          borderBottomRightRadius: isUser ? 4 : 18,
          borderBottomLeftRadius: isUser ? 18 : 4,
        }}
      >
        <Text
          style={{
            color: isUser ? '#fff' : (darkMode ? '#fff' : '#000'),
            fontSize: 16,
            lineHeight: 22,
          }}
        >
          {message.content}
        </Text>
        <Text
          style={{
            color: isUser ? 'rgba(255,255,255,0.7)' : (darkMode ? '#aaa' : '#666'),
            fontSize: 12,
            marginTop: 5,
          }}
        >
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
};

const HomePage: React.FC<ChatComponentProps> = ({}) => {
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const darkMode = true;

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  useEffect(() => {
    if (currentConversation?.messages.length) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [currentConversation?.messages]);

  const generateConversationTitle = (firstMessage: string): string => {
    return firstMessage.length > 30 ? firstMessage.substring(0, 30) + '...' : firstMessage;
  };

  const createNewConversation = useCallback(() => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      lastUpdated: new Date(),
    };
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversation(newConversation);
  }, []);

  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    if (!currentConversation) {
      const newConversation: Conversation = {
        id: Date.now().toString(),
        title: generateConversationTitle(inputMessage.trim()),
        messages: [userMessage],
        lastUpdated: new Date(),
      };
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversation(newConversation);
      setInputMessage('');
      setIsLoading(true);

      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "I'm a demo AI assistant. This is where I would respond to your message!",
          timestamp: new Date(),
        };
        
        setConversations(prev => 
          prev.map(conv => 
            conv.id === newConversation.id 
              ? { ...conv, messages: [...conv.messages, aiMessage], lastUpdated: new Date() }
              : conv
          )
        );
        setCurrentConversation(prev => 
          prev ? { ...prev, messages: [...prev.messages, aiMessage] } : null
        );
        setIsLoading(false);
      }, 1500);
      return;
    }

    const updatedConversation = {
      ...currentConversation,
      messages: [...currentConversation.messages, userMessage],
      lastUpdated: new Date(),
    };

    setCurrentConversation(updatedConversation);
    setConversations(prev => 
      prev.map(conv => conv.id === currentConversation.id ? updatedConversation : conv)
    );
    setInputMessage('');
    setIsLoading(true);

    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm a demo AI assistant. This is where I would respond to your message!",
        timestamp: new Date(),
      };
      
      setConversations(prev => 
        prev.map(conv => 
          conv.id === currentConversation.id 
            ? { ...conv, messages: [...conv.messages, aiMessage], lastUpdated: new Date() }
            : conv
        )
      );
      setCurrentConversation(prev => 
        prev ? { ...prev, messages: [...prev.messages, aiMessage] } : null
      );
      setIsLoading(false);
    }, 1500);
  }, [inputMessage, currentConversation]);

  const selectConversation = useCallback((conversation: Conversation) => {
    setCurrentConversation(conversation);
  }, []);

  const renderWelcomeScreen = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 }}>
      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#007AFF',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <Ionicons name="chatbubble-ellipses" size={40} color="#fff" />
        </View>
        <Text
          style={{
            fontSize: 32,
            fontWeight: 'bold',
            color: darkMode ? '#fff' : '#000',
            marginBottom: 10,
          }}
        >
          Welcome to Chat
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: darkMode ? '#aaa' : '#666',
            textAlign: 'center',
            lineHeight: 24,
          }}
        >
          Start a conversation by typing a message below
        </Text>
      </View>
      
      <View style={{ width: '100%' }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '600',
            color: darkMode ? '#fff' : '#000',
            marginBottom: 15,
          }}
        >
          Quick starters:
        </Text>
        {[
          "Hello! How can you help me today?",
          "What's the weather like?",
          "Tell me a joke",
          "Help me plan my day"
        ].map((starter, index) => (
          <TouchableOpacity
            key={index}
            style={{
              backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8',
              padding: 15,
              borderRadius: 12,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: darkMode ? '#333' : '#e0e0e0',
            }}
            onPress={() => setInputMessage(starter)}
          >
            <Text
              style={{
                color: darkMode ? '#fff' : '#000',
                fontSize: 16,
              }}
            >
              {starter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      
      <LinearGradient
        colors={darkMode ? ['#1a1a1a', '#2a2a2a'] : ['#f8f9fa', '#ffffff']}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 15,
            borderBottomWidth: 1,
            borderBottomColor: darkMode ? '#333' : '#e0e0e0',
          }}
        >
          <TouchableOpacity
            onPress={() => setIsSidebarVisible(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: darkMode ? '#333' : '#f0f0f0',
              paddingHorizontal: 15,
              paddingVertical: 10,
              borderRadius: 20,
            }}
          >
            <Ionicons 
              name="menu" 
              size={20} 
              color={darkMode ? '#fff' : '#000'} 
              style={{ marginRight: 8 }}
            />
            <Text style={{ color: darkMode ? '#fff' : '#000', fontWeight: '600' }}>
              Menu
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              fontSize: 18,
              fontWeight: 'bold',
              color: darkMode ? '#fff' : '#000',
            }}
          >
            {currentConversation?.title || 'Chat'}
          </Text>

          <TouchableOpacity
            onPress={createNewConversation}
            style={{
              backgroundColor: darkMode ? '#333' : '#f0f0f0',
              padding: 10,
              borderRadius: 20,
            }}
          >
            <Ionicons name="add" size={20} color={darkMode ? '#fff' : '#000'} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {!currentConversation || currentConversation.messages.length === 0 ? (
            renderWelcomeScreen()
          ) : (
            <ScrollView
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingVertical: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {currentConversation.messages.map((message) => (
                <MessageBubble key={message.id} message={message} darkMode={darkMode} />
              ))}
              {isLoading && (
                <View style={{ flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 15 }}>
                  <View
                    style={{
                      backgroundColor: darkMode ? '#2a2a2a' : '#f0f0f0',
                      padding: 15,
                      borderRadius: 18,
                      borderBottomLeftRadius: 4,
                    }}
                  >
                    <Text style={{ color: darkMode ? '#aaa' : '#666' }}>
                      Typing...
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 15,
              paddingVertical: 15,
              borderTopWidth: 1,
              borderTopColor: darkMode ? '#333' : '#e0e0e0',
              backgroundColor: darkMode ? '#1a1a1a' : '#fff',
              paddingBottom: Platform.OS === 'ios' ? 60 : 40
            }}
          >
            <TextInput
              ref={inputRef}
              style={{
                flex: 1,
                backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8',
                borderRadius: 25,
                paddingHorizontal: 20,
                paddingVertical: 12,
                fontSize: 16,
                color: darkMode ? '#fff' : '#000',
                maxHeight: 100,
                marginRight: 10,
              }}
              placeholder="Type a message..."
              placeholderTextColor={darkMode ? '#aaa' : '#666'}
              value={inputMessage}
              onChangeText={setInputMessage}
              multiline
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <TouchableOpacity
              onPress={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              style={{
                backgroundColor: inputMessage.trim() && !isLoading ? '#007AFF' : (darkMode ? '#333' : '#ccc'),
                width: 44,
                height: 44,
                borderRadius: 22,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons 
                name="send" 
                size={20} 
                color={inputMessage.trim() && !isLoading ? '#fff' : (darkMode ? '#666' : '#999')} 
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>

      <Sidebar
        visible={isSidebarVisible}
        onClose={() => setIsSidebarVisible(false)}
        darkMode={darkMode}
        conversations={conversations}
        onNewChat={createNewConversation}
        onSelectConversation={selectConversation}
        currentConversation={currentConversation || undefined}
      />
    </SafeAreaView>
  );
};

export default HomePage;