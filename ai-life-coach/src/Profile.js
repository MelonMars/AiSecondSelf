import React from 'react';

function ProfileComponent({
  authToken,
  userName,
  userEmail,
  chatPrefs,
  handleChatPrefsChange,
  sendMessageWithDoc,
  isLoading
}) {

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Profile</h2>
      {authToken ? (
        <div className="space-y-4 text-gray-700">
          <p>
            <strong>Name:</strong> {userName}
          </p>
          <p>
            <strong>Email:</strong> {userEmail}
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chat Preferences (System Prompt)
            </label>
            <textarea
              value={chatPrefs}
              onChange={(e) => handleChatPrefsChange(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter preferences or custom instructions for the AI..."
            />
          </div>
          <div
            id="doc-result"
            className="mt-4 p-3 bg-blue-50 rounded-md text-sm text-gray-700"
          >
          </div>
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Upload Document (.txt only)
            </label>
            <input
              type="file"
              accept=".txt"
              onChange={(e) => sendMessageWithDoc(e.target.files[0])}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={isLoading}
            />
          </div>
        </div>
      ) : (
        <p className="text-gray-600">Please log in to view your profile.</p>
      )}
    </div>
  );
}

export default ProfileComponent;