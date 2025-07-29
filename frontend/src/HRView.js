import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const HRView = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [inputText, setInputText] = useState('');
  const [socket, setSocket] = useState(null);
  const [recognition, setRecognition] = useState(null);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);

  useEffect(() => {
    initializeUser();
    initializeWebSocket();
    setupSpeechRecognition();
    setupTextToSpeech();
    
    return () => {
      if (socket) {
        socket.disconnect();
      }
      if (recognition) {
        recognition.stop();
      }
    };
  }, [sessionId]);

  const initializeUser = async () => {
    try {
      // Create or get user
      const userData = {
        name: `HR_${Date.now()}`,
        role: 'hr'
      };
      
      const response = await fetch(`${BACKEND_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      const newUser = await response.json();
      setUser(newUser);
      
      // Join session
      await joinSession(newUser.user_id);
      
    } catch (error) {
      console.error('Error initializing user:', error);
    }
  };

  const joinSession = async (userId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/join?user_id=${userId}&role=hr`, {
        method: 'POST',
      });
      const result = await response.json();
      
      // Get session details
      const sessionResponse = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}`);
      const sessionData = await sessionResponse.json();
      setSession(sessionData);
      
    } catch (error) {
      console.error('Error joining session:', error);
    }
  };

  const initializeWebSocket = () => {
    if (user) {
      const newSocket = io(BACKEND_URL);
      
      newSocket.on('connect', () => {
        console.log('Connected to WebSocket');
      });
      
      newSocket.on('message', (data) => {
        setMessages(prev => [...prev, data]);
        
        // If it's a message from candidate, speak it aloud
        if (data.sender_role === 'candidate' && data.message_type === 'sign_to_text') {
          speakText(data.content);
        }
      });
      
      setSocket(newSocket);
    }
  };

  const setupSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          }
        }
        
        if (transcript) {
          setInputText(transcript);
          sendTextMessage(transcript);
        }
      };
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
      };
      
      setRecognition(recognitionInstance);
    } else {
      console.log('Speech recognition not supported');
    }
  };

  const setupTextToSpeech = () => {
    if ('speechSynthesis' in window) {
      const updateVoices = () => {
        const availableVoices = speechSynthesis.getVoices();
        setVoices(availableVoices);
        
        // Select a default voice (prefer English)
        const englishVoice = availableVoices.find(voice => 
          voice.lang.startsWith('en')
        );
        setSelectedVoice(englishVoice || availableVoices[0]);
      };
      
      updateVoices();
      speechSynthesis.onvoiceschanged = updateVoices;
    }
  };

  const toggleListening = () => {
    if (!recognition) {
      alert('Speech recognition not supported in your browser');
      return;
    }
    
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
      setInputText('');
    }
  };

  const sendTextMessage = async (text) => {
    if (!user || !sessionId || !text.trim()) return;
    
    // Convert text to sign language representation (simplified)
    const signLanguageText = convertToSignLanguage(text);
    
    const message = {
      session_id: sessionId,
      sender_id: user.user_id,
      sender_role: 'hr',
      message_type: 'text_to_sign',
      content: signLanguageText
    };
    
    try {
      await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
      
      // Add to local messages
      setMessages(prev => [...prev, message]);
      
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const convertToSignLanguage = (text) => {
    // Simple text-to-sign language conversion
    // In a real application, this would be more sophisticated
    const words = text.toLowerCase().split(' ');
    const signWords = words.map(word => {
      // Basic word mapping to sign language concepts
      const signMappings = {
        'hello': 'HELLO',
        'hi': 'HELLO',
        'good': 'GOOD',
        'morning': 'MORNING',
        'afternoon': 'AFTERNOON',
        'how': 'HOW',
        'are': 'ARE',
        'you': 'YOU',
        'name': 'NAME',
        'my': 'MY',
        'is': 'IS',
        'nice': 'NICE',
        'meet': 'MEET',
        'to': 'TO',
        'thank': 'THANK',
        'thanks': 'THANK',
        'welcome': 'WELCOME',
        'please': 'PLEASE',
        'sorry': 'SORRY',
        'yes': 'YES',
        'no': 'NO',
        'ok': 'OK',
        'okay': 'OK',
        'understand': 'UNDERSTAND',
        'question': 'QUESTION',
        'answer': 'ANSWER',
        'tell': 'TELL',
        'about': 'ABOUT',
        'work': 'WORK',
        'experience': 'EXPERIENCE',
        'job': 'JOB',
        'company': 'COMPANY',
        'team': 'TEAM',
        'project': 'PROJECT',
        'skill': 'SKILL',
        'skills': 'SKILLS',
        'time': 'TIME',
        'year': 'YEAR',
        'years': 'YEARS',
        'can': 'CAN',
        'could': 'COULD',
        'would': 'WOULD',
        'will': 'WILL',
        'should': 'SHOULD',
        'help': 'HELP',
        'need': 'NEED',
        'want': 'WANT',
        'like': 'LIKE',
        'love': 'LOVE',
        'think': 'THINK',
        'know': 'KNOW',
        'see': 'SEE',
        'hear': 'HEAR',
        'feel': 'FEEL',
        'make': 'MAKE',
        'do': 'DO',
        'go': 'GO',
        'come': 'COME',
        'get': 'GET',
        'give': 'GIVE',
        'take': 'TAKE',
        'put': 'PUT',
        'find': 'FIND',
        'look': 'LOOK',
        'use': 'USE',
        'learn': 'LEARN',
        'teach': 'TEACH',
        'study': 'STUDY',
        'read': 'READ',
        'write': 'WRITE',
        'speak': 'SPEAK',
        'listen': 'LISTEN'
      };
      
      return signMappings[word] || word.toUpperCase();
    });
    
    return signWords.join(' ');
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = 0.8;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    }
  };

  const handleManualSend = () => {
    if (inputText.trim()) {
      sendTextMessage(inputText);
      setInputText('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-center text-purple-600 mb-2">
            Sign Language Interview - HR View
          </h1>
          <p className="text-center text-gray-600">
            Session ID: {sessionId} | Status: {session?.status || 'Loading...'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Voice Input */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Voice Input</h2>
            
            <div className="mb-4">
              <button
                onClick={toggleListening}
                className={`w-full py-4 rounded-lg font-semibold text-lg ${
                  isListening
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isListening ? '🎤 Stop Listening' : '🎤 Start Voice Input'}
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or type your message:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleManualSend()}
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Type your message here..."
                />
                <button
                  onClick={handleManualSend}
                  className="px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold"
                >
                  Send
                </button>
              </div>
            </div>
            
            {isListening && (
              <div className="text-center text-blue-600 font-medium">
                🎵 Listening... Speak now
              </div>
            )}
            
            <div className="text-xs text-gray-500 mt-4">
              <p>Your voice will be converted to text and then to sign language for the candidate.</p>
            </div>
          </div>

          {/* Messages from Candidate */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Candidate's Messages</h2>
            
            <div className="h-96 border border-gray-300 rounded-lg p-4 overflow-y-auto mb-4">
              {messages.filter(msg => msg.sender_role === 'candidate').map((message, index) => (
                <div key={index} className="mb-3 p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">
                    Candidate - {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="text-lg">
                    {message.content}
                  </div>
                  {message.message_type === 'sign_to_text' && (
                    <div className="text-xs text-green-600 mt-1">
                      Translated from Sign Language
                    </div>
                  )}
                </div>
              ))}
              
              {messages.filter(msg => msg.sender_role === 'candidate').length === 0 && (
                <div className="text-gray-500 text-center py-8">
                  Waiting for candidate messages...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Your Messages */}
        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Your Messages (Converted to Sign Language)</h2>
          
          <div className="h-40 border border-gray-300 rounded-lg p-4 overflow-y-auto">
            {messages.filter(msg => msg.sender_role === 'hr').map((message, index) => (
              <div key={index} className="mb-3 p-3 bg-purple-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">
                  You - {new Date(message.timestamp).toLocaleTimeString()}
                </div>
                <div className="text-lg font-mono">
                  {message.content}
                </div>
                <div className="text-xs text-purple-600 mt-1">
                  Sign Language Format
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Voice Settings */}
        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Voice Settings</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Text-to-Speech Voice:
              </label>
              <select
                value={selectedVoice?.name || ''}
                onChange={(e) => {
                  const voice = voices.find(v => v.name === e.target.value);
                  setSelectedVoice(voice);
                }}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                {voices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => speakText('This is a test of the text to speech system')}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold"
              >
                Test Voice
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HRView;