import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const HomePage = () => {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const createNewSession = async () => {
    setIsCreating(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sign_language: 'ASL'
        }),
      });
      
      const session = await response.json();
      setSessionId(session.session_id);
      
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Failed to create session. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const joinAsCandidate = () => {
    if (!sessionId) {
      alert('Please create a session or enter a session ID first.');
      return;
    }
    navigate(`/candidate/${sessionId}`);
  };

  const joinAsHR = () => {
    if (!sessionId) {
      alert('Please create a session or enter a session ID first.');
      return;
    }
    navigate(`/hr/${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              🤟 Sign Language Interview Tool
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              Bridge the communication gap in interviews with real-time sign language translation
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-6">
              <div className="text-2xl mb-3">👤</div>
              <h3 className="text-lg font-semibold text-blue-800 mb-2">For Candidates</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Use webcam for sign language input</li>
                <li>• Real-time gesture recognition</li>
                <li>• Receive HR messages as text</li>
              </ul>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-6">
              <div className="text-2xl mb-3">👔</div>
              <h3 className="text-lg font-semibold text-purple-800 mb-2">For HR Managers</h3>
              <ul className="text-sm text-purple-700 space-y-1">
                <li>• Voice-to-text input</li>
                <li>• Automatic sign language conversion</li>
                <li>• Hear candidate's responses</li>
              </ul>
            </div>
          </div>

          {/* Session Management */}
          <div className="space-y-6">
            <div className="border-t border-gray-200 pt-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Start or Join Interview</h2>
              
              <div className="space-y-4">
                <div>
                  <button
                    onClick={createNewSession}
                    disabled={isCreating}
                    className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                  >
                    {isCreating ? '⏳ Creating Session...' : '🆕 Create New Session'}
                  </button>
                </div>
                
                <div className="text-center text-gray-500 font-medium">OR</div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter Session ID:
                  </label>
                  <input
                    type="text"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    placeholder="Enter session ID to join existing interview"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {sessionId && (
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600">Session ID:</p>
                  <p className="text-lg font-mono font-bold text-gray-800 bg-white px-4 py-2 rounded border">
                    {sessionId}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={joinAsCandidate}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                  >
                    👤 Join as Candidate
                  </button>
                  
                  <button
                    onClick={joinAsHR}
                    className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                  >
                    👔 Join as HR Manager
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-8 border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">📋 How it works:</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>1.</strong> Create a new session or enter an existing session ID</p>
              <p><strong>2.</strong> Choose your role (Candidate or HR Manager)</p>
              <p><strong>3.</strong> Wait for both participants to join</p>
              <p><strong>4.</strong> Start communicating in real-time!</p>
            </div>
          </div>

          {/* Support */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Supported signs: Hello, Yes, No, Thank you, I, Goodbye
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;