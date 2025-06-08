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
  removeBackgroundImage,
  gradientTone,
  setGradientTone,
  tonePresets
}) {
  const [activeSection, setActiveSection] = useState('profile');
  const [showGradientCustomizer, setShowGradientCustomizer] = useState(false);

  useEffect(() => {
    fetchUserCredits();
  }, [authToken]);

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

                      <div className={`p-6 rounded-xl border transition-all duration-300 backdrop-blur-md ${
                        darkMode 
                          ? 'bg-white/5 border-white/10' 
                          : 'bg-white/40 border-black/30'
                      }`}>
                        <h3 className={`text-lg font-semibold mb-6 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                          Background Customization
                        </h3>
                        
                        <div className="mb-8">
                          <h4 className={`text-md font-medium mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                            Background Image
                          </h4>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <label className={`group cursor-pointer flex-1 relative overflow-hidden rounded-2xl transition-all duration-300 transform hover:scale-[1.02] backdrop-blur-xl border ${
                              darkMode
                                ? 'bg-gradient-to-r from-emerald-500/20 via-green-500/20 to-teal-500/20 hover:from-emerald-400/30 hover:via-green-400/30 hover:to-teal-400/30 border-emerald-400/30 hover:border-emerald-300/50 shadow-[0_8px_32px_rgba(16,185,129,0.15)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.25)]'
                                : 'bg-gradient-to-r from-emerald-400/30 via-green-400/30 to-teal-400/30 hover:from-emerald-300/40 hover:via-green-300/40 hover:to-teal-300/40 border-emerald-300/40 hover:border-emerald-200/60 shadow-[0_8px_32px_rgba(16,185,129,0.2)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.3)]'
                            }`}>
                              <div className="flex items-center justify-center gap-3 px-6 py-4 text-white font-semibold relative z-10">
                                <Upload className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                                <span className="drop-shadow-lg">Upload Image</span>
                              </div>
                              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-60"></div>
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
                              className={`group flex-1 relative overflow-hidden rounded-2xl transition-all duration-300 transform hover:scale-[1.02] backdrop-blur-xl border ${
                                darkMode
                                  ? 'bg-gradient-to-r from-red-500/20 via-rose-500/20 to-pink-500/20 hover:from-red-400/30 hover:via-rose-400/30 hover:to-pink-400/30 border-red-400/30 hover:border-red-300/50 shadow-[0_8px_32px_rgba(239,68,68,0.15)] hover:shadow-[0_12px_40px_rgba(239,68,68,0.25)]'
                                  : 'bg-gradient-to-r from-red-400/30 via-rose-400/30 to-pink-400/30 hover:from-red-300/40 hover:via-rose-300/40 hover:to-pink-300/40 border-red-300/40 hover:border-red-200/60 shadow-[0_8px_32px_rgba(239,68,68,0.2)] hover:shadow-[0_12px_40px_rgba(239,68,68,0.3)]'
                              }`}
                              disabled={isLoading}
                            >
                              <div className="flex items-center justify-center gap-3 px-6 py-4 text-white font-semibold relative z-10">
                                <Trash2 className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                                <span className="drop-shadow-lg">Remove Image</span>
                              </div>
                              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-60"></div>
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h4 className={`text-md font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                              Gradient Background
                            </h4>
                            <button
                              onClick={() => setShowGradientCustomizer(!showGradientCustomizer)}
                              className={`px-6 py-3 rounded-2xl font-medium transition-all duration-300 backdrop-blur-xl border transform hover:scale-[1.02] ${
                                showGradientCustomizer
                                  ? darkMode
                                    ? 'bg-purple-500/25 text-white border-purple-400/40 shadow-[0_8px_32px_rgba(147,51,234,0.2)] hover:shadow-[0_12px_40px_rgba(147,51,234,0.3)]'
                                    : 'bg-blue-500/25 text-white border-blue-400/40 shadow-[0_8px_32px_rgba(59,130,246,0.2)] hover:shadow-[0_12px_40px_rgba(59,130,246,0.3)]'
                                  : darkMode
                                    ? 'bg-white/10 text-gray-300 hover:bg-white/20 border-white/20 hover:border-white/30 shadow-[0_4px_16px_rgba(255,255,255,0.05)] hover:shadow-[0_8px_24px_rgba(255,255,255,0.1)]'
                                    : 'bg-white/30 text-gray-700 hover:bg-white/40 border-white/30 hover:border-white/50 shadow-[0_4px_16px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)]'
                              }`}
                            >
                              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-60 rounded-2xl"></div>
                              <span className="relative z-10">{showGradientCustomizer ? 'Hide' : 'Customize'}</span>
                            </button>
                          </div>

                          {showGradientCustomizer && (
                            <div className={`p-5 rounded-2xl border transition-all duration-500 backdrop-blur-xl ${
                              darkMode 
                                ? 'bg-white/5 border-white/10' 
                                : 'bg-white/30 border-white/40'
                            }`}>
                              <div className="space-y-6">
                                <div className="space-y-4">
                                  <label className={`block text-sm font-medium ${
                                    darkMode ? 'text-gray-300' : 'text-gray-600'
                                  }`}>
                                    Choose Gradient Style
                                  </label>
                                  <div className="grid grid-cols-2 gap-4">
                                    {Object.entries(tonePresets).map(([toneName, toneData]) => (
                                      <button
                                        key={toneName}
                                        onClick={() => setGradientTone(toneName)}
                                        className={`relative overflow-hidden rounded-2xl h-20 transition-all duration-300 transform hover:scale-[1.02] border-2 backdrop-blur-md ${
                                          gradientTone === toneName
                                            ? 'border-white/60 shadow-[0_8px_32px_rgba(147,51,234,0.25)] ring-2 ring-purple-400/50'
                                            : 'border-white/20 hover:border-white/40 shadow-[0_4px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)]'
                                        }`}
                                        style={{
                                          background: `linear-gradient(135deg, ${toneData.colors.join(', ')})`
                                        }}
                                      >
                                        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center">
                                          <span className="text-white font-semibold capitalize text-sm drop-shadow-lg">
                                            {toneName}
                                          </span>
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-60"></div>
                                        {gradientTone === toneName && (
                                          <div className="absolute top-2 right-2 w-5 h-5 bg-white/80 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center border border-white/20">
                                            <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                                          </div>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <label className={`block text-sm font-medium ${
                                    darkMode ? 'text-gray-300' : 'text-gray-600'
                                  }`}>
                                    Current Selection: <span className="capitalize font-semibold">{gradientTone}</span>
                                  </label>
                                  <div 
                                    className="h-24 rounded-2xl shadow-inner border-2 border-white/20 relative overflow-hidden backdrop-blur-md"
                                    style={{
                                      background: `linear-gradient(135deg, ${tonePresets[gradientTone]?.colors.join(', ')})`
                                    }}
                                  >
                                    <div className="absolute inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center">
                                      <span className="text-white font-medium drop-shadow-lg">
                                        Preview
                                      </span>
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-60"></div>
                                  </div>
                                </div>

                                <div className={`p-4 rounded-2xl backdrop-blur-md border ${
                                  darkMode ? 'bg-white/5 border-white/10' : 'bg-white/30 border-white/30'
                                }`}>
                                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-60 rounded-2xl"></div>
                                  <h4 className={`text-sm font-medium mb-3 relative z-10 ${
                                    darkMode ? 'text-gray-300' : 'text-gray-600'
                                  }`}>
                                    Gradient Properties
                                  </h4>
                                  <div className="grid grid-cols-2 gap-4 text-sm relative z-10">
                                    <div>
                                      <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                        Animation Speed:
                                      </span>
                                      <span className={`ml-2 font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                                        {tonePresets[gradientTone]?.speed}x
                                      </span>
                                    </div>
                                    <div>
                                      <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                        Intensity:
                                      </span>
                                      <span className={`ml-2 font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                                        {Math.round((tonePresets[gradientTone]?.intensity || 0) * 100)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                  <button
                                    onClick={() => setGradientTone('classic')}
                                    className={`flex-1 px-4 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-[1.02] backdrop-blur-xl border relative overflow-hidden ${
                                      darkMode
                                        ? 'bg-gray-600/20 hover:bg-gray-500/30 text-white border-gray-400/30 hover:border-gray-300/50 shadow-[0_8px_32px_rgba(107,114,128,0.15)] hover:shadow-[0_12px_40px_rgba(107,114,128,0.25)]'
                                        : 'bg-gray-400/20 hover:bg-gray-300/30 text-gray-700 border-gray-300/40 hover:border-gray-200/60 shadow-[0_8px_32px_rgba(107,114,128,0.15)] hover:shadow-[0_12px_40px_rgba(107,114,128,0.25)]'
                                    }`}
                                  >
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-60"></div>
                                    <span className="relative z-10">Reset to Classic</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      console.log('Applying gradient tone:', gradientTone, tonePresets[gradientTone]);
                                      setShowGradientCustomizer(false);
                                    }}
                                    className={`flex-1 px-4 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-[1.02] backdrop-blur-xl border relative overflow-hidden ${
                                      darkMode
                                        ? 'bg-gradient-to-r from-purple-600/25 to-pink-600/25 hover:from-purple-500/35 hover:to-pink-500/35 text-white border-purple-400/40 hover:border-purple-300/60 shadow-[0_8px_32px_rgba(147,51,234,0.2)] hover:shadow-[0_12px_40px_rgba(147,51,234,0.3)]'
                                        : 'bg-gradient-to-r from-blue-600/25 to-purple-600/25 hover:from-blue-500/35 hover:to-purple-500/35 text-white border-blue-400/40 hover:border-blue-300/60 shadow-[0_8px_32px_rgba(59,130,246,0.2)] hover:shadow-[0_12px_40px_rgba(59,130,246,0.3)]'
                                    }`}
                                  >
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-60"></div>
                                    <span className="relative z-10 drop-shadow-sm">Apply Gradient</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
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