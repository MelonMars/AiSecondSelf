import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Network, Target, User, Send, Loader, ChevronRight, LogOut, LogIn, MessageCircle, Eye, MapPin, UserPlus, Star, Camera, Share, Copy, X, Eraser, Menu, Save, Smile, Mail, Shield, Zap, Lock, Sparkles, Chrome, UserCheck, CreditCard, Crown, CheckCircle } from "lucide-react";
import GraphView from "./GraphView";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, EmailAuthProvider, linkWithCredential, updateProfile, onAuthStateChanged, getAuth, fetchSignInMethodsForEmail } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import ChatComponent from "./chat";
import ProfileComponent from "./Profile";
import { Cloudinary } from '@cloudinary/url-gen';
import { auto } from '@cloudinary/url-gen/actions/resize';
import { autoGravity } from '@cloudinary/url-gen/qualifiers/gravity';
import { render } from "katex";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const TABS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "graph", label: "Graph", icon: Network },
  { id: "profile", label: "Profile", icon: User },
];

const saveGraphData = async (graphData) => {
  const authToken = localStorage.getItem("authToken"); 
  if (!authToken) {
      console.warn("No auth token found. Cannot save graph data.");
      return false;
  }
  try {
      const response = await fetch('http://127.0.0.1:8000/user_data', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
              user_data: graphData
          }),
      });
      
      if (response.ok) {
          console.log('Graph data saved successfully');
          return true;
      } else {
          console.error('Failed to save graph data');
          return false;
      }
  } catch (error) {
      console.error('Error saving graph data:', error);
      return false;
  }
};

const loadStripe = () => {
  return new Promise((resolve, reject) => {
    if (window.Stripe) {
      resolve(window.Stripe);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => {
      if (window.Stripe) {
        resolve(window.Stripe); 
      } else {
        reject(new Error('Stripe failed to load after script execution.'));
      }
    };
    script.onerror = () => {
      reject(new Error('Failed to load Stripe script. Network error or invalid URL.'));
    };
    document.head.appendChild(script);
  });
};


function CreditModal({
  isOpen,
  onClose,
  darkMode,
  authToken,
  onCreditsUpdate
}) {
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [activeTab, setActiveTab] = useState('credits');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [showStripeCheckout, setShowStripeCheckout] = useState(false);

  const STRIPE_PUBLISHABLE_KEY = 'pk_test_51RIKBKBQFEsZhRVaP4WiDKydGD8wYJHjDzikt3WH39cI0NRSs4p59ZQ6uiz9A78WObKwvgsmcgWKVIhj5i9soLmk00vYT7dcLc';

  const creditPackages = [
    {
      id: 'starter',
      name: 'Starter Pack',
      credits: 100,
      price: 5.00,
      popular: false,
      icon: '💡',
      color: 'from-blue-400 to-blue-600',
      description: 'Perfect for trying out'
    },
    {
      id: 'standard',
      name: 'Standard Pack',
      credits: 500,
      price: 20.00,
      popular: true,
      icon: '⚡',
      color: 'from-purple-400 to-purple-600',
      description: 'Most popular choice'
    },
    {
      id: 'premium',
      name: 'Premium Pack',
      credits: 1000,
      price: 35.00,
      popular: false,
      icon: '🚀',
      color: 'from-pink-400 to-pink-600',
      description: 'Great value for heavy users'
    },
    {
      id: 'unlimited',
      name: 'Power User',
      credits: 5000,
      price: 100.00,
      popular: false,
      icon: '👑',
      color: 'from-yellow-400 to-orange-500',
      description: 'For unlimited conversations'
    }
  ];

  const subscriptionPlans = [
    {
      id: 'basic',
      name: 'Basic Plan',
      credits: 500,
      price: 9.99,
      popular: false,
      features: ['500 credits/month', 'Standard support', 'Basic features'],
      color: 'from-green-400 to-green-600',
      description: 'Essential features for regular use'
    },
    {
      id: 'pro',
      name: 'Pro Plan',
      credits: 2000,
      price: 29.99,
      popular: true,
      features: ['2,000 credits/month', 'Priority support', 'Advanced features', 'Early access'],
      color: 'from-purple-400 to-purple-600',
      description: 'Perfect for power users'
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      credits: 10000,
      price: 99.99,
      popular: false,
      features: ['10,000 credits/month', 'Dedicated support', 'All features', 'Custom integrations'],
      color: 'from-orange-400 to-red-500',
      description: 'For teams and businesses'
    }
  ];

  const refreshUserCredits = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/user_credits', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const creditsData = await response.json();
        if (onCreditsUpdate) {
          onCreditsUpdate(creditsData);
        }
      }
    } catch (error) {
      console.error('Error refreshing credits:', error);
    }
  };

  const handlePurchase = async (type, itemId) => {
    setIsProcessing(true);
    setMessage('');
    setShowStripeCheckout(true);

    console.log(`Starting purchase for ${type} with item ID:`, itemId);
    try {
      const endpoint = type === 'credit' ? 'create-payment-intent' : 'create-subscription';
      const body = type === 'credit' ? { package_id: itemId } : { plan_id: itemId };

      const response = await fetch(`http://127.0.0.1:8000/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to create ${type} session`);
      }

      const { client_secret } = await response.json();

      console.log("Received client secret:", client_secret);
      const Stripe = await loadStripe();
      if (!Stripe) {
        throw new Error('Stripe object not available after loading script.');
      }
      const stripe = Stripe(STRIPE_PUBLISHABLE_KEY); 
      const embeddedCheckoutDiv = document.getElementById('embedded-checkout');
      if (embeddedCheckoutDiv && embeddedCheckoutDiv.firstChild) {
        embeddedCheckoutDiv.innerHTML = '';
      }
      const checkout = await stripe.initEmbeddedCheckout({
        clientSecret: client_secret,
        onComplete: () => {
          setMessage('Payment successful! Your purchase has been completed.');
          
          setTimeout(async () => {
            await refreshUserCredits();
            onClose();
            setSelectedPackage(null);
            setSelectedPlan(null);
            setShowStripeCheckout(false);
          }, 2000);
        }
      });

      checkout.mount('#embedded-checkout');

    } catch (error) {
      console.error(`${type} error:`, error);
      setMessage(`Error: ${error.message}`);
      setIsProcessing(false);
      setShowStripeCheckout(false); 
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-purple-900/30 to-pink-900/30 backdrop-blur-xl animate-pulse"></div>
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-purple-400/30 rounded-full animate-bounce delay-100"></div>
        <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-pink-400/40 rounded-full animate-bounce delay-300"></div>
        <div className="absolute top-1/2 left-3/4 w-1.5 h-1.5 bg-blue-400/30 rounded-full animate-bounce delay-500"></div>
      </div>

      <div className={`relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-3xl transition-all duration-500 transform hover:scale-[1.01] ${
        darkMode
          ? 'bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 shadow-2xl shadow-purple-500/20 border border-white/10'
          : 'bg-gradient-to-br from-white/95 via-gray-50/90 to-white/95 shadow-2xl shadow-gray-500/20 border border-gray-200/50'
      }`}>
        
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-blue-600/20 blur-xl animate-pulse"></div>
        
        <div className={`relative z-10 backdrop-blur-xl border-b transition-all duration-300 ${
          darkMode ? 'bg-gray-900/50 border-white/10' : 'bg-white/50 border-gray-200/50'
        }`}>
          <div className="flex items-center justify-between p-8">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl blur-lg animate-pulse"></div>
                <div className="relative p-3 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-600 shadow-lg">
                  <Zap className="w-8 h-8 text-white" />
                </div>
              </div>
              <div>
                <h2 className={`text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-1`}>
                  {showStripeCheckout ? 'Complete Your Purchase' : 'Supercharge Your Experience'}
                </h2>
                <p className={`text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {showStripeCheckout ? 'Secure payment powered by Stripe' : 'Choose the perfect credit package for your needs'}
                </p>
              </div>
            </div>
            
            <button
              onClick={() => {
                onClose();
                setSelectedPackage(null);
                setActiveTab('credits');
                setMessage('');
                setIsProcessing(false);
                setShowStripeCheckout(false); 
              }}
              className={`group p-3 rounded-2xl transition-all duration-300 hover:scale-110 hover:rotate-90 ${
                darkMode 
                  ? 'hover:bg-red-500/20 text-gray-300 hover:text-red-400 border border-white/10 hover:border-red-500/30' 
                  : 'hover:bg-red-500/20 text-gray-600 hover:text-red-500 border border-gray-200/50 hover:border-red-500/30'
              }`}
            >
              <X className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" />
            </button>
          </div>
        </div>

        <div className="relative z-10 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="p-8">
            {showStripeCheckout ? (
              <div className="relative">
                <div className={`rounded-2xl overflow-hidden border-2 ${
                  darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200/50 bg-white/50'
                }`}>
                  <div id="embedded-checkout" className="min-h-[500px] w-full"></div>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-8">
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 mb-4">
                      <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse"></div>
                      <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                        One-Time Purchase
                      </span>
                    </div>
                    <h3 className={`text-2xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                      Choose Your Credit Package
                    </h3>
                    <p className={`text-base max-w-2xl mx-auto ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Get instant access to premium features with our flexible credit packages. 
                      No recurring charges, use credits at your own pace.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {creditPackages.map((pkg, index) => (
                      <div
                        key={pkg.id}
                        className={`group relative rounded-2xl cursor-pointer transition-all duration-500 hover:scale-105 ${
                          selectedPackage === pkg.id
                            ? 'transform scale-105'
                            : ''
                        }`}
                        style={{ 
                          animationDelay: `${index * 100}ms`,
                          animation: 'fadeInUp 0.6s ease-out forwards'
                        }}
                        onClick={() => setSelectedPackage(pkg.id)}
                      >
                        <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${pkg.color} p-0.5 transition-all duration-300 ${
                          selectedPackage === pkg.id ? 'opacity-100 shadow-lg' : 'opacity-50 group-hover:opacity-75'
                        }`}>
                          <div className={`h-full w-full rounded-2xl ${
                            darkMode ? 'bg-gray-900/95' : 'bg-white/95'
                          } backdrop-blur-sm`}>
                          </div>
                        </div>

                        <div className="relative p-6 h-full">
                          {pkg.popular && (
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                              <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg animate-bounce">
                                <Star className="w-3 h-3" />
                                MOST POPULAR
                              </div>
                            </div>
                          )}

                          <div className="text-center h-full flex flex-col">
                            <div className="relative mb-4">
                              <div className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br ${pkg.color} flex items-center justify-center text-3xl shadow-lg transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-6`}>
                                {pkg.icon}
                              </div>
                              {selectedPackage === pkg.id && (
                                <div className="absolute -top-2 -right-2">
                                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                                    <CheckCircle className="w-5 h-5 text-white" />
                                  </div>
                                </div>
                              )}
                            </div>

                            <h4 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                              {pkg.name}
                            </h4>
                            
                            <div className="flex-1 space-y-2">
                              <div className={`text-4xl font-black ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                                ${pkg.price.toFixed(2)}
                              </div>
                              
                              <div className={`text-lg font-semibold ${darkMode ? 'text-purple-300' : 'text-purple-600'}`}>
                                {pkg.credits.toLocaleString()} credits
                              </div>
                              
                              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-3`}>
                                {pkg.description}
                              </div>
                              
                              <div className={`text-xs px-3 py-1 rounded-full inline-block ${
                                darkMode ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-600'
                              }`}>
                                ${(pkg.price / pkg.credits * 100).toFixed(2)} per 100 credits
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedPackage && (
                    <div className="flex justify-center mt-12">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
                        
                        <button
                          onClick={() => handlePurchase('credit', selectedPackage)}
                          disabled={isProcessing}
                          className={`relative px-12 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 ${
                            isProcessing
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-2xl hover:shadow-purple-500/25'
                          } text-white`}
                        >
                          {isProcessing ? (
                            <div className="flex items-center gap-3">
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              Processing Payment...
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <CreditCard className="w-6 h-6" />
                              Purchase Credits Securely
                              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            </div>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {message && (
              <div className={`mt-8 p-6 rounded-2xl text-center font-medium transition-all duration-300 ${
                message.includes('successful') || message.includes('completed')
                  ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30'
                  : 'bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-400 border border-red-500/30'
              }`}>
                <div className="flex items-center justify-center gap-2">
                  {message.includes('successful') ? (
                    <CheckCircle className="w-5 h-5 animate-bounce" />
                  ) : (
                    <X className="w-5 h-5" />
                  )}
                  {message}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

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
  const [graphHistory, setGraphHistory] = useState([]);
  const [currentGraphIndex, setCurrentGraphIndex] = useState(0);
  const [lifeDomains, setLifeDomains] = useState([]);
  const [coreValues, setCoreValues] = useState([]);
  const [missionStatement, setMissionStatement] = useState("");

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
  const [currentConversationBranchInfo, setCurrentConversationBranchInfo] = useState(null);
  const [aiName, setAIName] = useState("AI");
  const [aiPersonalities, setAiPersonalities] = useState([]); 

  const [authLoading, setAuthLoading] = useState(true);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [userDataLoading, setUserDataLoading] = useState(true);
  const [picturesLoading, setPicturesLoading] = useState(true);
  const [personalitiesLoading, setPersonalitiesLoading] = useState(true);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [creditsInfo, setCreditsInfo] = useState(null);

  const [userCredits, setUserCredits] = useState(0);


  const messagesEndRef = useRef(null);

  const inputRef = useRef(null);

  const [userAvatarUrl, setUserAvatarUrl] = useState('');
  const [aiAvatarUrl, setAiAvatarUrl] = useState('');

  const [userAvatarImage, setAvatarImage] = useState(null);
  const [aiAvatarImage, setAiAvatarImage] = useState(null);

  const [showCustomPersonalityModal, setShowCustomPersonalityModal] = useState(false);
  const [customPersonalityName, setCustomPersonalityName] = useState("");
  const [customPersonalityIcon, setCustomPersonalityIcon] = useState("");
  const [customPersonalityError, setCustomPersonalityError] = useState("");
  const [customPersonalities, setCustomPersonalities] = useState([]);

  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);

  const [isHovering, setIsHovering] = useState(false);
  const personalityIconInputRef = useRef(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const [backgroundImageUrl, setBackgroundImageUrl] = useState('');
  const [gradientTone, setGradientTone] = useState(localStorage.getItem("gradientTone") || "classic");
  const [aiMode, setAiMode] = useState('normal');
  const gradientTones = {
    classic: {
      colors: ['#667eea', '#764ba2', '#f093fb', '#f5576c'],
      speed: 0.8,
      intensity: 0.6
    },
    vibrant: {
      colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'],
      speed: 1.2,
      intensity: 0.8
    },
    calm: {
      colors: ['#a8edea', '#fed6e3', '#e0c3fc', '#8ec5fc'],
      speed: 0.5,
      intensity: 0.4
    },
    cosmic: {
      colors: ['#8360c3', '#2ebf91', '#fc466b', '#3fcdc7', '#fd79a8'],
      speed: 1.5,
      intensity: 0.9
    }
  };


  const navigate = useNavigate();
  const { tab: urlTab, conversationId: urlConversationId} = useParams();
  const location = useLocation();

  const cld = new Cloudinary({ cloud: { cloudName: 'dy78nlcso' } });

  useEffect(() => {
    localStorage.setItem("gradientTone", gradientTone);
  }, [gradientTone]);
  
  const signInWithGoogle = async () => {
    setIsLoading(true);
    setAuthError("");
    setLinkError("");

    try {
        const result = await signInWithPopup(auth, googleProvider);
        console.log("Google sign-in successful:", result.user);
        setShowAuthModal(false);
        localStorage.setItem("lastUsedLoginMethod", "google");
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

  const aiModes = [
    { id: 'normal', name: 'Normal', icon: MessageCircle, description: 'Standard conversation' },
    { id: 'reflect', name: 'Reflect', icon: Eye, description: 'Thoughtful analysis' },
    { id: 'plan', name: 'Plan', icon: MapPin, description: 'Strategic planning' },
    { id: 'review', name: 'Review', icon: CheckCircle, description: 'Critical evaluation' },
  ];

  useEffect(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    
    const filteredParts = pathParts.filter(part => part !== 'ai-life-coach');
    
    if (filteredParts.length === 0) {
      if (tab !== 'chat') {
        setTab('chat');
      }
    } else if (filteredParts.length >= 1) {
      const tabFromUrl = filteredParts[0];
      
      if (['chat', 'profile', 'graph'].includes(tabFromUrl)) {
        if (tab !== tabFromUrl) {
          setTab(tabFromUrl);
        }
        
        if (tabFromUrl === 'chat' && filteredParts.length >= 2) {
          const conversationIdFromUrl = filteredParts[1];
          if (conversationIdFromUrl && conversationIdFromUrl !== currentConversationId) {
            loadConversation(conversationIdFromUrl);
          }
        } else if (tabFromUrl === 'chat' && filteredParts.length === 1) {
          if (currentConversationId) {
          }
        }
      }
    }
  }, [location.pathname, tab, currentConversationId]);

  const handleTabChange = (newTab) => {
    setTab(newTab);
    
    if (newTab === 'chat') {
      if (currentConversationId) {
        navigate(`/chat/${currentConversationId}`);
      } else {
        navigate('/chat');
      }
    } else {
      navigate(`/${newTab}`);
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
          setAuthLoading(false);

          fetchConversations(idToken);

          Promise.allSettled([
            fetchUserPrefs(idToken), 
            fetchAIName(idToken)
          ]).then(() => {
            console.log("High priority user data loaded");
          });

          Promise.allSettled([
            fetchUserData(idToken),
            fetchUserPictures(idToken),
            fetchPersonalities(idToken),
            fetchUserCredits(idToken),
            getBackgroundImage(idToken),
          ]).then(() => {
            console.log("All user data loaded");
          });

        }).catch(error => {
          console.error("Failed to get ID token:", error);
          setAuthLoading(false);
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
        setAuthLoading(false);
        setConversationsLoading(false);
        console.log("Firebase auth state changed. User logged out.");
      }
    });
    return () => unsubscribe();
  }, []);


  useEffect(() => {
    if (tab === "chat") {
      inputRef.current?.focus();
    }
  }, [tab]);

  const fetchConversations = async (token = authToken) => {
    if (!token) {
      setConversations([]);
      return;
    }

    if (conversationsLoading) {
      console.log("fetchConversations already in progress, skipping duplicate call");
      return;
    }

    setConversationsLoading(true);
    try {
      const headers = { "Authorization": `Bearer ${token}` };
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
      
      const starred = data.filter(conv => conv.starred);
      setStarredConversations(starred);
      
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setConversationsLoading(false);
    }
  };

  const fetchUserCredits = async () => {
    if (!authToken) return;
    
    console.log("Fetching user credits with auth token:", authToken);
    setLoadingCredits(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/user_credits', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const credit_info = await response.json();
        console.log("Fetched user credits:", credit_info);
        setCreditsInfo(credit_info.credits || null);
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error);
    } finally {
      setLoadingCredits(false);
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
          const res = await fetch("http://127.0.0.1:8000/star_conversation", {
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
    if (!authToken) {
      console.log("No auth token available for loadConversation");
      return;
    }

    setIsLoading(true);
    setAuthError(null);
    try {
        const headers = {
            "Authorization": `Bearer ${authToken}`,
        };
        const res = await fetch(`http://127.0.0.1:8000/conversations/${uid}/${conversationId}`, {
            headers: headers
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`Server error ${res.status} fetching conversation:`, errorText);
            if (res.status === 401) {
                setAuthError("Authentication failed. Please log in again.");
                setShowAuthModal(true);
                logout();
            } else if (res.status === 403 || res.status === 404) {
                setMessages([{ role: "assistant", content: "Conversation not found or unauthorized access." }]);
                setCurrentConversationId(null);
                setCurrentConversationBranchInfo(null);
                return;
            }
            setMessages([{
                role: "assistant",
                content: `Error loading conversation: ${res.status}. Details: ${errorText.substring(0, 150)}...`
            }]);
            return;
        }

        const data = await res.json();
        console.log("Loaded conversation data:", data);

        setMessages(data.messages);
        setCurrentConversationId(data.id);

        setCurrentConversationBranchInfo({
            id: data.id,
            parent_conversation_id: data.parent_conversation_id,
            branch_from_message_index: data.branch_from_message_index,
            children_branches: data.children_branches || []
        });

    } catch (error) {
        console.error("Network or processing error loading conversation:", error);
        setMessages([{
            role: "assistant",
            content: "Sorry, there was a connection or processing error loading this conversation."
        }]);
    } finally {
        setIsLoading(false);
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

    const waitForGraphData = () => {
      return new Promise((resolve) => {
        const checkGraphData = () => {
          if (graphHistory !== null && graphHistory !== undefined) {
            console.log("GraphHistory is now available, proceeding with message send.");
            resolve();
          } else {
            console.log("GraphHistory not yet available, waiting...");
            setTimeout(checkGraphData, 100);
          }
        };
        checkGraphData();
      });
    };  

    await waitForGraphData();
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    let newMessage = formattedDate + " - " + messageInput;
    const userMessage = { role: "user", content: newMessage };
    const bulletProse = JSON.stringify(graphHistory[-1]);
    const messagesForApi = [...messages, userMessage];
    const placeholderAiMessage = { role: "assistant", content: "" };
    
    setMessages(prev => [...prev, userMessage, placeholderAiMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const headers = {
        "Authorization": `Bearer ${authToken}`,
      };

      const formData = new FormData();

      const requestBody = {
        messages: messagesForApi, 
        conversation_id: currentConversationId,
        bulletProse: bulletProse,
        ai_mode: aiMode,
      };

      formData.append('request', JSON.stringify(requestBody));
      formData.append('ai_mode', aiMode);

      if (uploadedFiles.length > 0) {
        uploadedFiles.forEach((file, index) => {
          formData.append('files', file);
        });
        console.log("Added files to form data:", uploadedFiles.map(f => f.name));
      } else {
        console.log("No files to add to form data.");
      }

      setUploadedFiles([]);

      const formDataEntries = Array.from(formData.entries()).map(([key, value]) => {
        if (value instanceof File) {
          return `${key}: ${value.name} (File)`;
        }
        return `${key}: ${value}`;
      });

      console.log("Sending form data to server in App.js:", formDataEntries.join(", "));

      console.log("Sending message to streaming server from App.js:", requestBody);

      const res = await fetch("http://127.0.0.1:8000/chat-stream", {
        method: "POST",
        headers: headers,
        body: formData,
        mode: 'cors',
        credentials: 'include'
      });

      console.log("Got response from server in App.js:", res.ok, res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Server error ${res.status}:`, errorText);
        if (res.status === 401) {
          setAuthError("Authentication failed. Please log in again.");
          setShowAuthModal(true);
          logout();
        } else if (res.status === 402) {
          console.log("User has run out of credits, showing credit modal.");
          setAuthError("You have run out of credits. Please purchase more to continue.");
          setShowCreditModal(true);
        }
        setMessages(prev => prev.map((msg, index) => 
          index === prev.length - 1 
          ? { ...msg, content: `Error from server: ${res.status}. ${errorText.substring(0, 150)}...` } 
          : msg
        ));
        return;
      }

      const newConvId = res.headers.get('X-Conversation-Id');
      const wasNewConversation = !currentConversationId;
      
      if (newConvId && newConvId !== currentConversationId) {
          console.log("Received new conversation ID from header:", newConvId);
          setCurrentConversationId(newConvId);
      }
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedResponse = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break; 

        const chunk = decoder.decode(value, { stream: true });
        accumulatedResponse += chunk;

        console.log("Received chunk from server in App.js:", chunk);

        setMessages(prev => prev.map((msg, index) => 
          index === prev.length - 1 
          ? { ...msg, content: accumulatedResponse } 
          : msg
        ));
      }

      if (wasNewConversation && newConvId) {
        fetchConversations();
      }

    } catch (error) {
      console.error("Network or processing error in App.js sendMessage:", error);
      setMessages(prev => prev.map((msg, index) => 
        index === prev.length - 1 
        ? { ...msg, content: "Sorry, there was a connection or processing error. Please try again later." } 
        : msg
      ));
    } finally {
      console.log("sendMessage finally block reached in App.js");
      fetchUserData(authToken);
      fetchUserCredits(authToken);
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
      const res = await fetch("http://127.0.0.1/chat", {
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

  const handleSaveEditMessage = async (index, editMessageContent, setEditMessageContent, setEditingMessageIndex) => {
  if (editMessageContent.trim()) {
    const updatedMessages = messages.slice(0, index + 1).map((msg, i) => {
      if (i === index) {
        return {
          ...msg,
          content: editMessageContent.trim()
        };
      }
      return msg;
    });

    const messageToEdit = messages[index];
    if (messageToEdit.role !== 'user') {
      console.warn("Attempting to edit a non-user message. Only user messages can be branched from at this time.");
      setEditingMessageIndex(null);
      setEditMessageContent('');
      return;
    }


    setIsLoading(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      };
      const bulletProse = graphData ? JSON.stringify(graphData) : null;

      const editRequestBody = {
        conversation_id: currentConversationId,
        message_index: index,
        new_message_content: editMessageContent.trim(),
        bulletProse: bulletProse
      };

      const res = await fetch("http://127.0.0.1:8000/edit", {
        method: "POST",
        headers: headers,
        body: JSON.stringify(editRequestBody)
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Server error ${res.status} from /edit:`, errorText);
        if (res.status === 401) {
          setAuthError("Authentication failed. Please log in again.");
          setShowAuthModal(true);
          logout();
        }
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: `Error branching conversation: ${res.status}. Details: ${errorText.substring(0, 150)}...`
        }]);
        return;
      }

      const data = await res.json();
      console.log("AI response data from App.js (edit endpoint):", data);

      if (data && data.reply) {
        const aiMessage = { role: "assistant", content: data.reply };

        const newBranchMessages = [...updatedMessages, aiMessage];
        setMessages(newBranchMessages);

        if (data.conversation_id) {
          console.log("Backend created new conversation branch with ID:", data.conversation_id);
          setCurrentConversationId(data.conversation_id);
          fetchConversations();
        } else {
          console.warn("AI response from /edit missing 'conversation_id' field:", data);
        }
      } else {
        console.warn("AI response data missing 'reply' field from /edit:", data);
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "Received unexpected response from AI for edit operation. Response data:",
        }]);
      }
    } catch (error) {
      console.error("Network or processing error in App.js handleSaveEditMessage:", error);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, there was a connection or processing error during edit. Please try again later."
      }]);
    } finally {
      setIsLoading(false);
      setEditingMessageIndex(null);
      setEditMessageContent('');
    }
  }
  };

  const startNewConversation = () => {
      console.log("Starting new conversation in App.js");
      setCurrentConversationId(null); 
      setMessages([]);
      setInput(""); 
      inputRef.current?.focus();
      navigate('/chat');
  };

  const handleUserAvatarUpload = (file) => {
    uploadAvatarAndSaveUrl(file, 'userAvatarUrl');
  };

  const handleAIAvatarUpload = (file) => {
    uploadAvatarAndSaveUrl(file, 'aiAvatarUrl');
  };

  const uploadAvatarAndSaveUrl = async (file, avatarType) => {
    if (!file || !auth.currentUser) return;

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'profile-picture');

      const cloudinaryUploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/dy78nlcso/image/upload`,
          {
              method: 'POST',
              body: formData,
          }
      );

      if (!cloudinaryUploadRes.ok) {
        const errorData = await cloudinaryUploadRes.json();
        throw new Error(`Cloudinary upload failed: ${errorData.error.message}`);
      }

      const cloudinaryData = await cloudinaryUploadRes.json();
      const imgUrl = cloudinaryData.secure_url;
      
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      }

      const res = await fetch("http://127.0.0.1:8000/update_picture", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ pictureUrl: imgUrl, avatarType: avatarType })
      })

      if (avatarType === 'userAvatarUrl') {
        setUserAvatarUrl(imgUrl);
        setAvatarImage(imgUrl);
      } else if (avatarType === 'aiAvatarUrl') {
        setAiAvatarUrl(imgUrl);
        setAiAvatarImage(imgUrl);
      }

      console.log(`${avatarType} uploaded and URL saved:`, imgUrl);
    } catch (error) {
      console.error('Error uploading avatar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const uploadBackgroundImage = async (file) => {
    if (!file || !auth.currentUser) return;
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'background-image');
      const cloudinaryUploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/dy78nlcso/image/upload`,
          {
              method: 'POST',
              body: formData,
          }
      );
      if (!cloudinaryUploadRes.ok) {
        const errorData = await cloudinaryUploadRes.json();
        throw new Error(`Cloudinary upload failed: ${errorData.error.message}`);
      }
      const cloudinaryData = await cloudinaryUploadRes.json();
      const imgUrl = cloudinaryData.secure_url;
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      }
      const res = await fetch("http://127.0.1:8000/update_background_image", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ backgroundImageUrl: imgUrl })
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Server error ${res.status} updating background image:`, errorText);
        if (res.status === 401) { 
          setAuthError("Authentication failed. Please log in again.");
          setShowAuthModal(true);
          logout();
        }
        throw new Error(`Server error updating background image: ${res.status}`);
      }
      setBackgroundImageUrl(imgUrl);
      console.log("Background image uploaded and URL saved:", imgUrl);
    } catch (error) {
      console.error('Error uploading background image:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const removeBackgroundImage = async () => {
    if (!auth.currentUser) return;
    setIsLoading(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      };
      const res = await fetch("http://127.0.1:8000/remove_background_image", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ backgroundImageUrl: '' })
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Server error ${res.status} removing background image:`, errorText);
        if (res.status === 401) {
          setAuthError("Authentication failed. Please log in again.");
          setShowAuthModal(true);
          logout();
        }
        throw new Error(`Server error removing background image: ${res.status}`);
      }
      setBackgroundImageUrl('');
      console.log("Background image removed successfully.");
    } catch (error) {
      console.error('Error removing background image:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderAuthModal = () => {
    if (!showAuthModal) return null;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
        <div className={`relative w-full max-w-md transform transition-all duration-300 scale-100 ${
          darkMode 
            ? 'bg-gray-900/95 border border-white/20' 
            : 'bg-white/95 border border-gray-200/50'
        } rounded-2xl backdrop-blur-xl shadow-2xl`}>
          
          <div className="relative overflow-hidden rounded-t-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 animate-pulse"></div>
            <div className={`relative p-8 text-center ${darkMode ? 'text-white' : 'text-white'}`}>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mb-4">
                {authMode === 'login' ? (
                  <LogIn className="w-8 h-8" />
                ) : (
                  <UserPlus className="w-8 h-8" />
                )}
              </div>
              <h2 className="text-2xl font-bold">
                {authMode === 'login' ? 'Welcome Back!' : 'Join Us Today!'}
              </h2>
              <p className="text-white/80 mt-2">
                {authMode === 'login' 
                  ? 'Sign in to continue your journey' 
                  : 'Create your account and get started'
                }
              </p>
            </div>
          </div>

          <div className="p-8">
            {authError && (
              <div className={`mb-6 p-4 rounded-xl border-l-4 ${
                darkMode 
                  ? 'bg-red-900/30 border-red-500 text-red-300' 
                  : 'bg-red-50 border-red-500 text-red-700'
              }`}>
                <div className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  <span className="text-sm font-medium">{authError}</span>
                </div>
              </div>
            )}

            {linkError && (
              <div className={`mb-6 p-4 rounded-xl border-l-4 ${
                darkMode 
                  ? 'bg-yellow-900/30 border-yellow-500 text-yellow-300' 
                  : 'bg-yellow-50 border-yellow-500 text-yellow-700'
              }`}>
                <div className="flex items-center">
                  <Zap className="w-5 h-5 mr-2" />
                  <span className="text-sm font-medium">{linkError}</span>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {authMode === 'signup' && (
                <div className="space-y-2">
                  <label className={`flex items-center text-sm font-medium ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    <UserCheck className="w-4 h-4 mr-2" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border-2 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 ${
                      darkMode
                        ? 'bg-white/10 text-white border-white/20 focus:border-purple-500 focus:ring-purple-500/25 placeholder-gray-400'
                        : 'bg-white/80 text-gray-800 border-gray-200 focus:border-blue-500 focus:ring-blue-500/25 placeholder-gray-500'
                    }`}
                    placeholder="Enter your full name"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className={`flex items-center text-sm font-medium ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  <Mail className="w-4 h-4 mr-2" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border-2 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 ${
                    darkMode
                      ? 'bg-white/10 text-white border-white/20 focus:border-purple-500 focus:ring-purple-500/25 placeholder-gray-400'
                      : 'bg-white/80 text-gray-800 border-gray-200 focus:border-blue-500 focus:ring-blue-500/25 placeholder-gray-500'
                  }`}
                  placeholder="Enter your email"
                />
              </div>

              <div className="space-y-2">
                <label className={`flex items-center text-sm font-medium ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  <Lock className="w-4 h-4 mr-2" />
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border-2 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 ${
                    darkMode
                      ? 'bg-white/10 text-white border-white/20 focus:border-purple-500 focus:ring-purple-500/25 placeholder-gray-400'
                      : 'bg-white/80 text-gray-800 border-gray-200 focus:border-blue-500 focus:ring-blue-500/25 placeholder-gray-500'
                  }`}
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div className="space-y-4 mt-8">
              <button
                onClick={authMode === 'login' ? login : signup}
                disabled={isLoading}
                className={`w-full flex justify-center items-center py-4 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] focus:outline-none focus:ring-4 ${
                  darkMode
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-purple-500/25 focus:ring-purple-500/25'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-blue-500/25 focus:ring-blue-500/25'
                } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
              >
                {isLoading ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    {authMode === 'login' ? 'Sign In' : 'Create Account'}
                  </>
                )}
              </button>

              <div className="flex items-center">
                <div className={`flex-1 h-px ${darkMode ? 'bg-white/20' : 'bg-gray-300'}`}></div>
                <span className={`px-4 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  or continue with
                </span>
                <div className={`flex-1 h-px ${darkMode ? 'bg-white/20' : 'bg-gray-300'}`}></div>
              </div>

              <button
                onClick={signInWithGoogle}
                disabled={isLoading}
                className={`w-full flex justify-center items-center py-4 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] focus:outline-none focus:ring-4 border-2 ${
                  darkMode
                    ? 'bg-white/10 border-white/20 text-white hover:bg-white/20 focus:ring-white/25'
                    : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50 focus:ring-gray-500/25'
                } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
              >
                {isLoading ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Chrome className="w-5 h-5 mr-3 text-blue-500" />
                    Continue with Google
                  </>
                )}
              </button>
            </div>

            <div className="text-center mt-6">
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}
                {' '}
                <button
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'signup' : 'login');
                    setAuthError('');
                    setLinkError('');
                  }}
                  className={`font-medium transition-colors ${
                    darkMode 
                      ? 'text-purple-400 hover:text-purple-300' 
                      : 'text-blue-600 hover:text-blue-800'
                  }`}
                >
                  {authMode === 'login' ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </div>

            <div className="text-center mt-4">
              <button
                onClick={() => setShowAuthModal(false)}
                className={`text-sm transition-colors ${
                  darkMode 
                    ? 'text-gray-500 hover:text-gray-400' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Cancel
              </button>
            </div>
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
        console.log("Fetched user preferences:", data);
        setLifeDomains(data.lifeDomains || []);
        setMissionStatement(data.missionStatement || "");
        setCoreValues(data.coreValues || []);
      } else {
         if (response.status === 401) {
            console.error("Auth failed fetching user prefs. Logging out.");
            logout();
         } else {
            console.error("Failed to fetch user preferences", response.status);
         }
        setLifeDomains([]);
        setMissionStatement("");
        setCoreValues([]);
      }
    }
    catch (error) {
      console.error("Error fetching user preferences:", error);
      setLifeDomains([]);
      setMissionStatement("");
      setCoreValues([]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserPrefs = () => {
    const token = authToken;
    if (token) {
      const data = JSON.stringify({
        missionStatement: missionStatement,
        lifeDomains: lifeDomains,
        coreValues: coreValues
      });
      console.log("Saving user preferences with token:", token, "Data:", data);
      fetch("http://127.0.0.1:8000/user_prefs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: data
      });
    }
  };

  const fetchPersonalities = async (token) => {
    if (!token) return;
    setPersonalitiesLoading(true);
    try {
      console.log("Fetching AI personalities with token:", token);
      const response = await fetch("http://127.0.0.1:8000/personalities", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.personalities)) {
          setAiPersonalities(data.personalities);
        } else {
          console.warn("Fetched personalities data is not in expected format. Loading empty array.", data);
          setAiPersonalities([]);
        }
      } else {
          if (response.status === 401) {
            console.error("Auth failed fetching AI personalities. Logging out.");
          } else {
            console.error("Failed to fetch AI personalities", response.status);
          }
        }
      } catch (error) {
          console.error("Error fetching AI personalities:", error);
          setAiPersonalities([]);
    } finally {
      setPersonalitiesLoading(false);
    }
    try {
      const response = await fetch("http://127.0.0.1:8000/custom_personalities", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.custom_personalities)) {
          setCustomPersonalities(data.custom_personalities);
        } else {
          console.warn("Fetched custom personalities data is not in expected format. Loading empty array.", data);
          setCustomPersonalities([]);
        }
      } else {
          if (response.status === 401) {
            console.error("Auth failed fetching custom personalities. Logging out.");
          } else {
            console.error("Failed to fetch custom personalities", response.status);
          }
        }
    } catch (error) {
      console.error("Error fetching custom personalities:", error);
      setCustomPersonalities([]);
    }
  } 

  const fetchAIName = async (token) => {
    if (!token) return;
    try {
      console.log("Fetching AI name with token:", token);
      const response = await fetch("http://127.0.0.1:8000/ai_name", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.ai_name) {
          setAIName(data.ai_name);
        } else {
          console.warn("Fetched AI name data is not in expected format. Loading empty string.", data);
          setAIName("");
        }
      } else {
          if (response.status === 401) {
            console.error("Auth failed fetching AI name. Logging out.");
            setShowAuthModal(true);
          } else {
            console.error("Failed to fetch AI name", response.status);
          }
        }
      } catch (error) {
          console.error("Error fetching AI name:", error);
          setAIName("");
    } finally {
      setIsLoading(false);
    }};

    const fetchUserData = async (token) => {
      if (!token) {
        setGraphData({ nodes: [], edges: [] });
        return;
      }
      
      setUserDataLoading(true);
      try {
        console.log("Fetching user data with token:", token);
        const response = await fetch("http://127.0.0.1:8000/user_data", {
          method: "GET",
          headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setGraphHistory(data.graph_history || []);
          setCurrentGraphIndex(data.graph_history.length - 1);
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
        setGraphHistory([]);
        setCurrentGraphIndex(0);
      } finally {
        setUserDataLoading(false);
      }
    };

    const fetchUserPictures = async (token) => {
      setPicturesLoading(true);
      try {
        const res = await fetch("http://127.0.0.1:8000/pictures", {
          method: "GET",
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data && data.userAvatarUrl) {
            setUserAvatarUrl(data.userAvatarUrl);
            const userImage = await fetch(data.userAvatarUrl);
            const userImageBlob = await userImage.blob();
            const userImageUrl = URL.createObjectURL(userImageBlob);
            setAvatarImage(userImageUrl);
          }
          if (data && data.aiAvatarUrl) {
            setAiAvatarUrl(data.aiAvatarUrl);
            const aiImage = await fetch(data.aiAvatarUrl);
            const aiImageBlob = await aiImage.blob();
            const aiImageUrl = URL.createObjectURL(aiImageBlob);
            setAiAvatarImage(aiImageUrl);
          }
        }
        else {
          if (res.status === 401) {
            console.error("Auth failed fetching user pictures. Logging out.");
            logout();
          } else {
            console.error("Failed to fetch user pictures", res.status);
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setPicturesLoading(false);
      }
    };

    const getBackgroundImage = async (token) => {
      if (!auth.currentUser) return;
      
      try {
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        };
        
        const res = await fetch("http://127.0.0.1:8000/background_image", {
          method: "GET",
          headers: headers
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error(`Server error ${res.status} retrieving background image:`, errorText);
          if (res.status === 401) {
            setAuthError("Authentication failed. Please log in again.");
            setShowAuthModal(true);
            logout();
          }
          throw new Error(`Server error retrieving background image: ${res.status}`);
        }
        
        const data = await res.json();
        setBackgroundImageUrl(data.backgroundImageUrl);
        console.log("Background image retrieved:", data.backgroundImageUrl);
        return data.backgroundImageUrl;
      } catch (error) {
        console.error('Error retrieving background image:', error);
        return '';
      }
    };
    
    const handleGraphDataChange = async (newHistory, newIndex) => {
      console.log("Graph data changed by GraphView:", newHistory, newIndex);
      setGraphHistory(newHistory);
      setCurrentGraphIndex(newIndex);
      const success = await saveGraphData({
          graph_history: newHistory,
      });
      fetchUserData(authToken);
      return success;
    };

    const renderCustomPersonalityModal = () => {
      setShowCustomPersonalityModal(true);
      setCustomPersonalityName("");
      setCustomPersonalityError("");
    };

    const handleSaveCustomPersonality = async () => {
      if (!customPersonalityName.trim()) {
        setCustomPersonalityError("Personality name cannot be empty.");
        return;
      }

      if (!customPersonalityIcon) {
        setCustomPersonalityError("Please select an emoji for the personality.");
        return;
      }

      setCustomPersonalities(prev => [...prev, {
        name: customPersonalityName.trim(),
        icon: customPersonalityIcon,
      }]);

      setAiPersonalities(prev => [...prev, customPersonalityName]);
  
      console.log("Saving Custom Personality:", {
        name: customPersonalityName,
      });
  
      setCustomPersonalityError("");
      handleTogglePersonality(customPersonalityName.trim());
      const res = await fetch("http://127.0.0.1:8000/custom_personality", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: customPersonalityName.trim(),
          icon: customPersonalityIcon
        })
      });
      setShowCustomPersonalityModal(false);
    };

    const handleCloseCustomPersonalityModal = () => {
      setShowCustomPersonalityModal(false);
      setCustomPersonalityError("");
    };

    const handleTogglePersonality = async (personality) => {
      const isActive = aiPersonalities.includes(personality);
      if (personality === "Custom") {
        renderCustomPersonalityModal();
        return;
      }
      console.log(`Toggling personality: ${personality}, currently active: ${isActive}`);
      if (isActive) {
        setAiPersonalities(prev => prev.filter(p => p !== personality));
      } else {
        setAiPersonalities(prev => [...prev, personality]);
      }
      const headers = {
        "Authorization": `Bearer ${authToken}`,
        "Content-Type": "application/json"
      }
      const res = await fetch("http://127.0.0.1:8000/toggle_personality", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ personality: personality })
        }
      );
      if (!res.ok) {
        if (res.status === 401) {
          setAuthError("Authentication failed. Please log in again.");
          setShowAuthModal(true);
        } 
      }
    }

    const handleOpenEmojiPicker = () => {
      if (personalityIconInputRef.current && personalityIconInputRef.current.showPicker) {
        personalityIconInputRef.current.showPicker();
      } else {
        console.warn('showPicker() not supported on this browser/device for text inputs.');
        setCustomPersonalityError('Your browser may not support the native emoji picker.');
      }
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
          localStorage.setItem("lastUsedLoginMethod", "email");
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
          } else {
            setAuthError("Error " + error.code)
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
        var sharedURL = data.conversation_url;

        sharedURL = sharedURL.replace(/\/conversations/g, "/shared").replace(/:8000/g, ":3000");
        setSharedURL(sharedURL);
        setShowSharedModal(true);
      } else {
        console.warn("No conversation URL returned from backend.");
      }
    } catch (error) {
      console.error("Error sharing conversation:", error);
    }
  };

  const handleCreditsUpdate = (creditsData) => {
    setUserCredits(creditsData.credits);
  }

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

  const renameAI = async (newName) => {
    if (!newName) {
      newName = " ";
    }
    setAIName(newName);
    const headers = {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json"
    }
    const requestBody = {
      newName: newName
    }
    const res = await fetch("http://127.0.0.1:8000/rename_ai", {
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
    console.log("Rename AI response:", data);
  }

  const onCreditsUpdate = (newCredits) => {
    setUserCredits(newCredits);
    console.log("User credits updated:", newCredits);
  }

  const handleLoadConversation = (conversationId) => {
    loadConversation(conversationId);
    navigate(`/chat/${conversationId}`);
  };

  const handleStartNewConversation = () => {
    startNewConversation();
    navigate('/chat');
  };

  const handleDocumentUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      console.log("File selected:", file.name, file.type, file.size);
      setUploadedFiles([file]);
      
      console.log(`File "${file.name}" ready to send with next message`);
    }
  };

  return (
    <div className={`flex flex-col h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <header className="md:hidden fixed top-0 left-0 right-0 z-[1000] py-3 px-4">
        <div className={`flex items-center justify-between rounded-xl border border-white/20 px-4 py-3 ${
          darkMode 
            ? 'bg-gray-900/90 backdrop-blur-lg' 
            : 'bg-white/90 backdrop-blur-lg'
        }`}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-2 rounded-lg ${darkMode ? 'text-white' : 'text-gray-800'}`}
          >
            <Menu size={20} />
          </button>
          
          <h1 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            {TABS.find(t => t.id === tab)?.label || 'App'}
          </h1>
          
          {authToken ? (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span className={`text-sm ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                {userName || 'User'}
              </span>
            </div>
          ) : (
            <button
              onClick={() => {
                setAuthMode('login');
                setShowAuthModal(true);
              }}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                darkMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-blue-600 text-white'
              }`}
            >
              Login
            </button>
          )}
        </div>
      </header>

      <header
        className="hidden md:block fixed top-0 left-[25%] w-[50%] z-[1000] py-4 transition-transform duration-500 ease-out"
        style={{
          transform: isHovering ? 'translateY(0)' : 'translateY(-75%)'
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className={`relative transition-all duration-500 ease-out rounded-2xl border border-white/20 ${
              isHovering
                ? 'bg-white/30 backdrop-blur-xl shadow-2xl shadow-black/10 border-white/30'
                : 'bg-white/10 backdrop-blur-md shadow-lg shadow-black/5 border-white/10'
            }`}
            style={{
              background: isHovering 
                ? 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 100%)'
                : 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)'
            }}
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
            
            <div className="relative flex items-center justify-between h-16 px-6">
              <div className="flex items-center">
                <nav className="flex space-x-2">
                  {TABS.map((t) => {
                    const isActive = tab === t.id;
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        onClick={() => handleTabChange(t.id)}
                        className={`relative flex items-center px-4 py-2.5 transition-opacity duration-300 ease-in-out rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 ${
                          isHovering ? 'opacity-100' : 'opacity-70'
                        } ${
                          isActive
                            ? 'bg-white/40 text-gray-800 shadow-lg backdrop-blur-sm border border-white/30'
                            : `text-gray-700 hover:bg-white/20 hover:text-gray-800 hover:shadow-md hover:backdrop-blur-sm ${
                                darkMode
                                  ? 'text-gray-300 hover:text-gray-100'
                                  : 'text-gray-600 hover:text-gray-800'
                              }`
                        }`}
                      >
                        {isActive && (
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                        )}
                        <span className="relative z-10 flex items-center">
                          <Icon className="w-5 h-5 mr-2" />
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className={`flex items-center transition-all duration-300 ease-out ${
                isHovering 
                  ? 'opacity-100 transform translate-y-0' 
                  : 'opacity-60 transform translate-y-1'
              }`}>
                {authToken ? (
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3 px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur-sm border border-white/20">
                      <div className="w-2 h-2 bg-green-400 rounded-full shadow-sm shadow-green-400/50" />
                      <span className="text-sm font-medium text-gray-800">
                        {userName || 'User'}
                      </span>
                    </div>
                    <button
                      className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 hover:bg-white/20 hover:backdrop-blur-sm hover:border hover:border-white/20 ${
                        darkMode
                          ? 'text-gray-300 hover:text-gray-100'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                      onClick={logout}
                    >
                      Log out
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError('');
                        setShowAuthModal(true);
                      }}
                      className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 hover:bg-white/20 hover:backdrop-blur-sm hover:shadow-md ${
                        darkMode
                          ? 'text-gray-300 hover:text-gray-100'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      Log in
                    </button>
                    <button
                      onClick={() => {
                        setAuthMode('signup');
                        setAuthError('');
                        setShowAuthModal(true);
                      }}
                      className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 bg-white/30 backdrop-blur-sm border border-white/30 hover:bg-white/40 hover:shadow-lg ${
                        darkMode
                          ? 'text-blue-300 hover:text-blue-200'
                          : 'text-blue-700 hover:text-blue-800'
                      }`}
                    >
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                      <span className="relative z-10">Sign up</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div 
            className={`fixed left-0 top-0 h-full w-64 ${
              darkMode ? 'bg-gray-900' : 'bg-white'
            } shadow-xl transform transition-transform duration-300 ease-out`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  Navigation
                </h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className={`p-2 rounded-lg ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <nav className="p-4 space-y-2">
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTab(t.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center px-4 py-3 rounded-lg text-left transition-colors ${
                      isActive
                        ? darkMode 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-blue-600 text-white'
                        : darkMode
                          ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {t.label}
                  </button>
                );
              })}
            </nav>

            {authToken && (
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className={`text-sm ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                      {userName || 'User'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      darkMode 
                        ? 'text-gray-400 hover:text-white hover:bg-gray-800' 
                        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`flex-1 relative pt-20 md:pt-4 ${tab === "chat" ? "overflow-hidden" : "overflow-y-auto"} scrollbar-thin scrollbar-thumb-rounded-full scrollbar-track-transparent`}>
        {tab === "chat" && (
          <ChatComponent
            messages={messages}
            conversations={conversations}
            currentConversationId={currentConversationId}
            isLoading={isLoading}
            isConversationsLoading={isConversationsLoading}
            loadConversation={handleLoadConversation}
            startNewConversation={handleStartNewConversation}
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
            handleSaveEditMessage={handleSaveEditMessage}
            currentConversationBranchInfo={currentConversationBranchInfo}
            aiPicture={aiAvatarImage}
            userPicture={userAvatarImage}
            handleDocumentUpload={handleDocumentUpload}
            backgroundImageUrl={backgroundImageUrl}
            gradientTone={gradientTone}
            gradientTones={gradientTones}
            aiModes={aiModes}
            aiMode={aiMode}
            setAiMode={setAiMode}
            uploadedFiles={uploadedFiles}
            setUploadedFiles={setUploadedFiles}
          />
        )}
        {tab === "graph" && (
          <GraphView
            darkMode={darkMode}
            graphHistory={graphHistory}
            currentGraphIndex={currentGraphIndex}
            onDataChange={handleGraphDataChange}
            onGraphIndexChange={setCurrentGraphIndex}
          />
        )}
        {tab === "profile" && (
          <ProfileComponent 
            authToken={authToken} 
            userName={userName} 
            userEmail={userEmail} 
            isLoading={isLoading}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            handleUserAvatarUpload={handleUserAvatarUpload}
            handleAIAvatarUpload={handleAIAvatarUpload}
            aiAvatarUrl={aiAvatarImage}
            userAvatarUrl={userAvatarImage}
            handleAINameChange={renameAI}
            aiName={aiName}
            aiPersonalities={aiPersonalities}
            togglePersonality={handleTogglePersonality}
            customPersonalities={customPersonalities}
            fetchUserCredits={fetchUserCredits}
            setShowPaymentModal={setShowCreditModal}
            creditsInfo={creditsInfo}
            loadingCredits={loadingCredits}
            uploadBackgroundImage={uploadBackgroundImage}
            removeBackgroundImage={removeBackgroundImage}
            gradientTone={gradientTone}
            setGradientTone={setGradientTone}
            tonePresets={gradientTones}
            missionStatement={missionStatement}
            setMissionStatement={setMissionStatement}
            coreValues={coreValues}
            setCoreValues={setCoreValues}
            lifeDomains={lifeDomains}
            setLifeDomains={setLifeDomains}
            updateUserPrefs={updateUserPrefs}
          />
        )}
      </div>

      {renderAuthModal()}

      <CreditModal 
        isOpen={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        darkMode={darkMode}
        authToken={authToken}
        onCreditsUpdate={onCreditsUpdate}
      />

      {showSharedModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className={`relative w-full max-w-md transform transition-all duration-300 scale-100 ${
            darkMode 
              ? 'bg-gray-900/95 border border-white/20' 
              : 'bg-white/95 border border-gray-200/50'
          } rounded-2xl backdrop-blur-xl shadow-2xl`}>
            
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  Share Conversation
                </h3>
                <button
                  onClick={() => setShowSharedModal(false)}
                  className={`p-2 rounded-full transition-all duration-300 hover:scale-110 ${
                    darkMode 
                      ? 'text-gray-400 hover:text-white hover:bg-white/10' 
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  <X size={20} />
                </button>
              </div>
              <p className={`text-sm mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Share this conversation with others
              </p>
            </div>

            <div className="p-6">
              <div className={`flex flex-col sm:flex-row items-stretch sm:items-center rounded-xl border-2 overflow-hidden ${
                darkMode 
                  ? 'border-white/20 bg-white/10' 
                  : 'border-gray-200 bg-gray-50'
              }`}>
                <input
                  type="text"
                  value={sharedURL}
                  readOnly
                  className={`flex-grow px-4 py-3 text-sm focus:outline-none bg-transparent ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}
                />
                <button
                  onClick={copySharedURL}
                  className={`px-6 py-3 mt-2 sm:mt-0 font-medium transition-all rounded-md duration-300 hover:scale-105 ${
                    darkMode 
                      ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Copy size={16} />
                </button>
              </div>
              <p className={`text-xs mt-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Anyone with this link can view the conversation
              </p>
            </div>
          </div>
        </div>
      )}

      {showCustomPersonalityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className={`rounded-lg shadow-lg p-6 w-full max-w-md relative ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
            <h3 className="text-xl font-semibold mb-6 text-center">Create Custom Personality</h3>

            <button
              onClick={handleCloseCustomPersonalityModal}
              className={`absolute top-2 right-2 rounded-full p-1 transition-colors ${darkMode ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>

            <div className="mb-4">
              <label htmlFor="personalityName" className="block text-sm font-medium mb-1">
                Personality Name:
              </label>
              <input
                type="text"
                id="personalityName"
                value={customPersonalityName}
                onChange={(e) => setCustomPersonalityName(e.target.value)}
                className={`w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-300 focus:ring-blue-500' : 'bg-gray-100 border-gray-300 text-gray-800 focus:ring-blue-400'}`}
                placeholder="e.g., Sarcastic Chef"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="personalityIcon" className="block text-sm font-medium mb-1">
                Personality Icon:
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  id="personalityIcon"
                  value={customPersonalityIcon}
                  onChange={(e) => setCustomPersonalityIcon(e.target.value)}
                  className={`w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-300 focus:ring-blue-500' : 'bg-gray-100 border-gray-300 text-gray-800 focus:ring-blue-400'}`}
                  placeholder="e.g., 😊"
                />

                <button
                  type="button"
                  onClick={() => setShowCustomPersonalityModal(false)}
                  className={`p-2 rounded-md transition-colors flex items-center justify-center ${darkMode ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-800'}`}
                  aria-label="Open emoji picker"
                >
                  <Smile size={20} />
                </button>
              </div>
            </div>

            {customPersonalityError && (
              <p className="text-red-500 text-sm mb-4 text-center">{customPersonalityError}</p>
            )}

            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                onClick={handleCloseCustomPersonalityModal}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center ${darkMode ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-800'}`}
              >
                <Eraser size={16} className="mr-2" /> Cancel
              </button>
              <button
                onClick={handleSaveCustomPersonality}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center ${darkMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
              >
                <Save size={16} className="mr-2" /> Save Personality
              </button>
            </div>
          </div>
        </div>
      )}

      {authLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6`}>
            <Loader className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className={darkMode ? 'text-white' : 'text-gray-800'}>Authenticating...</p>
          </div>
        </div>
      )}
    </div>
  );
}