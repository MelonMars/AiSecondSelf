import React, { useState, useEffect } from 'react';
import { Moon, Sun, User, Bot, Upload, Camera, Sparkles, Settings, User2, Brain, CreditCard, Coins, Trash2 } from 'lucide-react';

function ProfileComponent({
  authToken,
  userName,
  userEmail,
  chatPrefs,
  handleChatPrefsChange,
  sendMessageWithDoc,
  isLoading,
  darkMode,
  setDarkMode,
  userAvatarUrl,
  aiAvatarUrl,
  handleUserAvatarUpload,
  handleAIAvatarUpload,
  aiName,
  handleAINameChange,
  aiPersonalities,
  togglePersonality,
  customPersonalities,
  fetchUserCredits,
  setShowPaymentModal,
  creditsInfo,
  loadingCredits,
  uploadBackgroundImage,
  removeBackgroundImage
}) {
  const [activeSection, setActiveSection] = useState('profile');

  useEffect(() => {
    fetchUserCredits();
  }, [authToken]);

  const newLocal = '';
  const availablePersonalities = [
    { name: 'Friendly', color: 'from-green-400 to-emerald-500', icon: '😊' },
    { name: 'Formal', color: 'from-blue-400 to-blue-600', icon: '🎩' },
    { name: 'Witty', color: 'from-purple-400 to-pink-500', icon: '🧠' },
    { name: 'Sarcastic', color: 'from-orange-400 to-red-500', icon: '😏' },
    { name: 'Helpful', color: 'from-cyan-400 to-blue-500', icon: '🤝' },
    { name: 'Concise', color: 'from-gray-400 to-gray-600', icon: '⚡' },
    { name: 'Creative', color: 'from-pink-400 to-purple-500', icon: '🎨' },
    { name: 'Analytical', color: 'from-indigo-400 to-purple-600', icon: '📊' },
    { name: 'Empathetic', color: 'from-rose-400 to-pink-500', icon: '💝' },
    { name: 'Custom', color: 'from-yellow-400 to-orange-500', icon: '➕' }
  ];

  const sections = [
    { id: 'profile', name: 'Profile', icon: User2 },
    { id: 'credits', name: 'Credits', icon: CreditCard },
    { id: 'ai', name: 'AI Settings', icon: Brain },
    { id: 'preferences', name: 'Preferences', icon: Settings }
  ];

  const availablePersonalityNames = new Set(availablePersonalities.map(p => p.name))

  const customPersonalityObjects = customPersonalities.map((personality) => ({
    name: personality.name,
    icon: personality.icon || '✨',
    color: 'from-purple-500 to-indigo-500',
  }));
  
  const allPersonalitiesToDisplay = [...availablePersonalities, ...customPersonalityObjects];

  return (
    <div className={`min-h-screen transition-all duration-500 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900' 
        : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
    }`}>
      <br />
      <br />
      <br />

      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full backdrop-blur-sm border transition-all duration-300 ${
            darkMode 
              ? 'bg-white/10 border-white/20 text-white' 
              : 'bg-white/60 border-white/40 text-gray-800'
          }`}>
            <Sparkles className="w-6 h-6 text-purple-500" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text">
              Profile Center
            </h1>
          </div>
        </div>

        {authToken ? (
          <div className="grid lg:grid-cols-4 gap-6">
            <div className={`lg:col-span-1 rounded-2xl backdrop-blur-sm border p-6 transition-all duration-300 ${
              darkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white/60 border-white/40'
            }`}>
              <nav className="space-y-2">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                        activeSection === section.id
                          ? darkMode
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                            : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                          : darkMode
                            ? 'text-gray-300 hover:bg-white/10 hover:text-white'
                            : 'text-gray-600 hover:bg-white/50 hover:text-gray-800'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{section.name}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="mt-8 pt-6 border-t border-white/20">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                    darkMode
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:shadow-lg hover:shadow-yellow-500/25'
                      : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg hover:shadow-indigo-500/25'
                  }`}
                >
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  <span className="font-medium">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-3">
              {activeSection === 'profile' && (
                <div className={`rounded-2xl backdrop-blur-sm border p-8 transition-all duration-500 ${
                  darkMode 
                    ? 'bg-white/10 border-white/20' 
                    : 'bg-white/60 border-white/40'
                }`}>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600">
                      <User2 className="w-6 h-6 text-white" />
                    </div>
                    <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                      Your Profile
                    </h2>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className={`p-6 rounded-xl border transition-all duration-300 ${
                        darkMode 
                          ? 'bg-white/5 border-white/10' 
                          : 'bg-white/40 border-black/30'
                      }`}>
                        <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                          Account Details
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              Name
                            </label>
                            <p className={`text-lg ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                              {userName}
                            </p>
                          </div>
                          <div>
                            <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              Email
                            </label>
                            <p className={`text-lg ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                              {userEmail}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={`p-6 rounded-xl border transition-all duration-300 ${
                        darkMode 
                          ? 'bg-white/5 border-white/10' 
                          : 'bg-white/40 border-black/30'
                      }`}>
                        <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                          Background Image
                        </h3>
                        <div className="flex flex-col items-center space-y-4">
                          <div className="flex gap-3">
                            <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                              darkMode
                                ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-green-500/25'
                                : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-green-500/25'
                            }`}>
                              <Upload className="w-4 h-4" />
                              Upload Background
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => uploadBackgroundImage(e.target.files[0])}
                                className="hidden"
                                disabled={isLoading}
                              />
                            </label>
                            <button
                              onClick={removeBackgroundImage}
                              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                                darkMode
                                  ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg hover:shadow-red-500/25'
                                  : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg hover:shadow-red-500/25'
                              }`}
                              disabled={isLoading}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                              Remove Background
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className={`p-6 rounded-xl border transition-all duration-300 ${
                        darkMode 
                          ? 'bg-white/5 border-white/10' 
                          : 'bg-white/40 border-black/30'
                      }`}>
                        <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                          Profile Picture
                        </h3>
                        <div className="flex flex-col items-center space-y-4">
                          <div className="relative group">
                            {userAvatarUrl ? (
                              <img 
                                src={userAvatarUrl} 
                                alt="User Avatar" 
                                className="w-24 h-24 rounded-full object-cover shadow-xl ring-4 ring-white/20 transition-transform duration-300 group-hover:scale-105" 
                              />
                            ) : (
                              <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl ring-4 ring-white/20 transition-all duration-300 group-hover:scale-105 ${
                                darkMode ? 'bg-gradient-to-br from-gray-700 to-gray-800 text-gray-400' : 'bg-gradient-to-br from-gray-200 to-gray-300 text-gray-500'
                              }`}>
                                <User size={40} />
                              </div>
                            )}
                            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                              <Camera className="w-6 h-6 text-white" />
                            </div>
                          </div>
                          <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                            darkMode
                              ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-purple-500/25'
                              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-blue-500/25'
                          }`}>
                            <Upload className="w-4 h-4" />
                            Upload Photo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleUserAvatarUpload(e.target.files[0])}
                              className="hidden"
                              disabled={isLoading}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'credits' && (
                <div className={`rounded-2xl backdrop-blur-sm border p-8 transition-all duration-500 ${
                  darkMode 
                    ? 'bg-white/10 border-white/20' 
                    : 'bg-white/60 border-white/40'
                }`}>
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600">
                        <CreditCard className="w-6 h-6 text-white" />
                      </div>
                      <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                        Credits & Usage
                      </h2>
                    </div>
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                        darkMode
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/25'
                          : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25'
                      }`}
                    >
                      Purchase Credits
                    </button>
                  </div>

                  {loadingCredits ? (
                    <div className="flex items-center justify-center py-12">
                      <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${
                        darkMode ? 'border-purple-500' : 'border-blue-500'
                      }`}></div>
                    </div>
                  ) : creditsInfo ? (
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className={`p-6 rounded-xl border transition-all duration-300 ${
                        darkMode 
                          ? 'bg-white/5 border-white/10' 
                          : 'bg-white/40 border-white/30'
                      }`}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600">
                            <Coins className="w-5 h-5 text-white" />
                          </div>
                          <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                            Available Credits
                          </h3>
                        </div>
                        <div className="text-center py-6">
                          <div className={`text-4xl font-bold mb-2 ${
                            creditsInfo > 10 
                              ? 'text-emerald-500' 
                              : creditsInfo > 5 
                                ? 'text-yellow-500' 
                                : 'text-red-500'
                          }`}>
                            {creditsInfo || 0}
                          </div>
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Credits remaining
                          </p>
                        </div>
                        {creditsInfo <= 10 && (
                          <div className={`p-3 rounded-lg ${
                            creditsInfo <= 5 
                              ? 'bg-red-500/20 border border-red-500/30' 
                              : 'bg-yellow-500/20 border border-yellow-500/30'
                          }`}>
                            <p className={`text-sm text-center ${
                              creditsInfo <= 5 ? 'text-red-400' : 'text-yellow-400'
                            }`}>
                              {creditsInfo <= 5 
                                ? 'Low credits - consider purchasing more!' 
                                : 'Credits running low'}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Second card can be used for additional info or stats */}
                      <div className={`p-6 rounded-xl border transition-all duration-300 ${
                        darkMode 
                          ? 'bg-white/5 border-white/10' 
                          : 'bg-white/40 border-white/30'
                      }`}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600">
                            <CreditCard className="w-5 h-5 text-white" />
                          </div>
                          <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                            Quick Purchase
                          </h3>
                        </div>
                        <div className="text-center py-6">
                          <p className={`text-sm mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Need more credits? Purchase them instantly to continue using our services without interruption.
                          </p>
                          <button
                            onClick={() => setShowPaymentModal(true)}
                            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
                              darkMode
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white'
                                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white'
                            }`}
                          >
                            Buy Credits Now
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`text-center py-12 rounded-xl border ${
                      darkMode 
                        ? 'bg-white/5 border-white/10' 
                        : 'bg-white/40 border-white/30'
                    }`}>
                      <CreditCard className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                      <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                        Credits Unavailable
                      </h3>
                      <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Unable to load credit information at this time
                      </p>
                      <button
                        onClick={fetchUserCredits}
                        className={`mt-4 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                          darkMode
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                            : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
                        }`}
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'ai' && (
                <div className={`rounded-2xl backdrop-blur-sm border p-8 transition-all duration-500 ${
                  darkMode 
                    ? 'bg-white/10 border-white/20' 
                    : 'bg-white/60 border-white/40'
                }`}>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600">
                      <Brain className="w-6 h-6 text-white" />
                    </div>
                    <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                      AI Configuration
                    </h2>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className={`p-6 rounded-xl border transition-all duration-300 ${
                      darkMode 
                        ? 'bg-white/5 border-white/10' 
                        : 'bg-white/40 border-white/30'
                    }`}>
                      <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                        AI Avatar
                      </h3>
                      <div className="flex flex-col items-center space-y-4">
                        <div className="relative group">
                          {aiAvatarUrl ? (
                            <img 
                              src={aiAvatarUrl} 
                              alt="AI Avatar" 
                              className="w-24 h-24 rounded-full object-cover shadow-xl ring-4 ring-purple-500/30 transition-transform duration-300 group-hover:scale-105" 
                            />
                          ) : (
                            <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl ring-4 ring-purple-500/30 transition-all duration-300 group-hover:scale-105 bg-gradient-to-br from-purple-600 to-pink-600 text-white`}>
                              <Bot size={40} />
                            </div>
                          )}
                          <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <Camera className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-purple-500/25`}>
                          <Upload className="w-4 h-4" />
                          Upload AI Avatar
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleAIAvatarUpload(e.target.files[0])}
                            className="hidden"
                            disabled={isLoading}
                          />
                        </label>
                      </div>
                    </div>

                    <div className={`p-6 rounded-xl border transition-all duration-300 ${
                      darkMode 
                        ? 'bg-white/5 border-white/10' 
                        : 'bg-white/40 border-white/30'
                    }`}>
                      <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                        AI Identity
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            AI Name
                          </label>
                          <input
                            type="text"
                            value={aiName}
                            onChange={(e) => handleAINameChange(e.target.value)}
                            className={`w-full px-4 py-3 rounded-lg border-2 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 ${
                              darkMode
                                ? "bg-white/10 text-white border-white/20 focus:border-purple-500 focus:ring-purple-500/25"
                                : "bg-white/50 text-gray-800 border-gray/30 focus:border-blue-500 focus:ring-blue-500/25"
                            }`}
                            placeholder="Enter the AI's name"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`mt-8 p-6 rounded-xl border transition-all duration-300 ${
                    darkMode 
                      ? 'bg-white/5 border-white/10' 
                      : 'bg-white/40 border-white/30'
                  }`}>
                    <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                      AI Personalities
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {allPersonalitiesToDisplay.map((personality) => (
                        <button
                          key={personality.name}
                          type="button"
                          onClick={() => togglePersonality(personality.name)}
                          className={`group relative p-4 rounded-xl text-center transition-all duration-300 transform hover:scale-105 ${
                            aiPersonalities.includes(personality.name)
                              ? `bg-gradient-to-br ${personality.color} text-white shadow-lg`
                              : darkMode 
                                ? "bg-white/10 text-gray-300 hover:bg-white/20 border border-white/20" 
                                : "bg-white/50 text-gray-700 hover:bg-white/70 border border-white/30"
                          }`}
                        >
                          <div className="text-2xl mb-2">{personality.icon}</div>
                          <div className="text-sm font-medium">{personality.name}</div>
                          {aiPersonalities.includes(personality.name) && (
                            <div className={`absolute top-1 right-1 w-3 h-3 ${darkMode ? 'bg-white' : 'bg-gray-200' } rounded-full shadow-lg`}></div>
                          )}
                        </button>
                      ))}
                    </div>
                    <p className={`text-sm mt-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Select personality traits to shape your AI's communication style
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'preferences' && (
                <div className={`rounded-2xl backdrop-blur-sm border p-8 transition-all duration-500 ${
                  darkMode 
                    ? 'bg-white/10 border-white/20' 
                    : 'bg-white/60 border-white/40'
                }`}>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-green-500 to-teal-600">
                      <Settings className="w-6 h-6 text-white" />
                    </div>
                    <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                      Preferences & Settings
                    </h2>
                  </div>

                  <div className="space-y-8">
                    <div className={`p-6 rounded-xl border transition-all duration-300 ${
                      darkMode 
                        ? 'bg-white/5 border-white/10' 
                        : 'bg-white/40 border-white/30'
                    }`}>
                      <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                        System Prompt
                      </h3>
                      <textarea
                        value={chatPrefs}
                        onChange={(e) => handleChatPrefsChange(e.target.value)}
                        rows={8}
                        className={`w-full px-4 py-3 rounded-lg border-2 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 resize-none ${
                          darkMode
                            ? "bg-white/10 text-white border-white/20 focus:border-purple-500 focus:ring-purple-500/25"
                            : "bg-white/50 text-gray-800 border-black/30 focus:border-blue-500 focus:ring-blue-500/25"
                        }`}
                        placeholder="Define how your AI should behave, respond, and interact with you..."
                      />
                      <p className={`text-sm mt-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Customize your AI's behavior with detailed instructions and preferences
                      </p>
                    </div>

                    <div className={`p-6 rounded-xl border transition-all duration-300 ${
                      darkMode 
                        ? 'bg-white/5 border-white/10' 
                        : 'bg-white/40 border-white/30'
                    }`}>
                      <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                        Document Upload
                      </h3>
                      <div className="flex items-center justify-center w-full">
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                          darkMode 
                            ? 'border-white/30 hover:border-purple-500 bg-white/5 hover:bg-white/10' 
                            : 'border-gray-300 hover:border-blue-500 bg-gray/30 hover:bg-gray/50'
                        }`}>
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className={`w-8 h-8 mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                            <p className={`mb-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              <span className="font-semibold">Click to upload</span> or drag and drop
                            </p>
                            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              TXT files only
                            </p>
                          </div>
                          <input
                            type="file"
                            accept=".txt"
                            onChange={(e) => sendMessageWithDoc(e.target.files[0])}
                            className="hidden"
                            disabled={isLoading}
                          />
                        </label>
                      </div>
                    </div>

                    <div
                      id="doc-result"
                      className={`p-4 rounded-xl border transition-all duration-300 min-h-[50px] ${
                        darkMode
                          ? "bg-white/5 border-white/10 text-gray-300"
                          : "bg-white/40 border-white/30 text-gray-700"
                      }`}
                    >
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={`text-center py-20 rounded-2xl backdrop-blur-sm border ${
            darkMode 
              ? 'bg-white/10 border-white/20' 
              : 'bg-white/60 border-white/40'
          }`}>
            <div className="p-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <h3 className={`text-xl font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              Authentication Required
            </h3>
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Please log in to access your profile and settings
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfileComponent;