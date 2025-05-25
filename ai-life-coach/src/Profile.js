import React from 'react';
import { Moon, Sun, User, Bot } from 'lucide-react';

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
}) {

    const availablePersonalities = [
        'Friendly',
        'Formal',
        'Witty',
        'Sarcastic',
        'Helpful',
        'Concise',
        'Creative',
        'Analytical',
        'Empathetic',
        'Direct'
    ];

    return (
        <div className={`p-6 max-w-2xl mx-auto ${darkMode ? "bg-gray-900" : "bg-white"}`}>
          <h2 className={`text-2xl font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-800"}`}>Profile</h2>
          {authToken ? (
            <div className={`space-y-4 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
              <p>
                <strong>Name:</strong> {userName}
              </p>
              <p>
                <strong>Email:</strong> {userEmail}
              </p>

              <div className="pt-4">
                <label className={`block text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  Your Profile Picture
                </label>
                <div className="flex items-center space-x-4 mb-2">
                  {userAvatarUrl ? (
                    <img src={userAvatarUrl} alt="User Avatar" className="w-20 h-20 rounded-full object-cover shadow" />
                  ) : (
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'} shadow`}>
                      <User size={40} />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUserAvatarUpload(e.target.files[0])}
                    className={`block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold ${
                      darkMode
                        ? "text-gray-400 file:bg-gray-800 file:text-orange-400 hover:file:bg-gray-700"
                        : "text-gray-500 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    }`}
                    disabled={isLoading}
                  />
                </div>
                <p className="text-xs text-gray-500">Upload your profile picture (e.g., JPEG, PNG).</p>
              </div>

              <div className="pt-4">
                <label className={`block text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  AI Profile Picture
                </label>
                <div className="flex items-center space-x-4 mb-2">
                  {aiAvatarUrl ? (
                    <img src={aiAvatarUrl} alt="AI Avatar" className="w-20 h-20 rounded-full object-cover shadow" />
                  ) : (
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'} shadow`}>
                      <Bot size={40} />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleAIAvatarUpload(e.target.files[0])}
                    className={`block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold ${
                      darkMode
                        ? "text-gray-400 file:bg-gray-800 file:text-orange-400 hover:file:bg-gray-700"
                        : "text-gray-500 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    }`}
                    disabled={isLoading}
                  />
                </div>
                <p className="text-xs text-gray-500">Upload a picture for the AI's avatar (e.g., JPEG, PNG).</p>
              </div>

              <div className="pt-4">
                <label className={`block text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  AI Name
                </label>
                <input
                  type="text"
                  value={aiName}
                  onChange={(e) => handleAINameChange(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    darkMode
                      ? "bg-gray-800 text-white border-gray-700 focus:ring-orange-500"
                      : "bg-white text-gray-700 border-gray-300 focus:ring-blue-500"
                  }`}
                  placeholder="Enter the AI's name"
                />
              </div>

              <div className="pt-4">
                <label className={`block text-sm font-medium mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  AI Personalities
                </label>
                <div className="flex flex-wrap gap-2">
                  {availablePersonalities.map((personality) => (
                    <button
                      key={personality}
                      type="button"
                      onClick={() => togglePersonality(personality)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                        aiPersonalities.includes(personality)
                          ? (darkMode ? "bg-orange-600 text-white" : "bg-blue-600 text-white")
                          : (darkMode ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-200 text-gray-700 hover:bg-gray-300")
                      }`}
                    >
                      {personality}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Select one or more personalities for your AI.</p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  Chat Preferences (System Prompt)
                </label>
                <textarea
                  value={chatPrefs}
                  onChange={(e) => handleChatPrefsChange(e.target.value)}
                  rows={6}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    darkMode
                      ? "bg-gray-800 text-white border-gray-700 focus:ring-orange-500"
                      : "bg-white text-gray-700 border-gray-300 focus:ring-blue-500"
                  }`}
                  placeholder="Enter preferences or custom instructions for the AI..."
                />
              </div>

              <div
                id="doc-result"
                className={`mt-4 p-3 rounded-md text-sm ${
                  darkMode
                    ? "bg-gray-800 text-gray-300"
                    : "bg-blue-50 text-gray-700"
                }`}
              >
              </div>
              <div className="flex items-center mt-4">
                <label className={`mr-2 text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  Dark Mode
                </label>
                <input
                  type="checkbox"
                  checked={darkMode}
                  onChange={() => setDarkMode(!darkMode)}
                  className={`toggle ${darkMode ? "toggle-warning" : "toggle-primary"}`}
                />
                {darkMode ? (
                  <Sun className="ml-2 text-yellow-500" />
                ) : (
                  <Moon className="ml-2 text-gray-500" />
                )}
              </div>
              <div className="mt-6">
                <label className={`block text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  Upload Document (.txt only)
                </label>
                <input
                  type="file"
                  accept=".txt"
                  onChange={(e) => sendMessageWithDoc(e.target.files[0])}
                  className={`block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold ${
                    darkMode
                      ? "text-gray-400 file:bg-gray-800 file:text-orange-400 hover:file:bg-gray-700"
                      : "text-gray-500 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  }`}
                  disabled={isLoading}
                />
              </div>
            </div>
          ) : (
            <p className={darkMode ? "text-gray-400" : "text-gray-600"}>Please log in to view your profile.</p>
          )}
        </div>
      );
}

export default ProfileComponent;