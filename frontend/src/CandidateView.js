import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { HAND_CONNECTIONS } from '@mediapipe/hands';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CandidateView = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentSign, setCurrentSign] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [socket, setSocket] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);

  // Sign language recognition mappings (simplified for demo)
  const signMappings = {
    'thumbs_up': 'Hello',
    'peace_sign': 'Yes',
    'fist': 'No',
    'open_palm': 'Thank you',
    'pointing': 'I',
    'wave': 'Goodbye'
  };

  useEffect(() => {
    initializeUser();
    initializeWebSocket();
    setupCamera();
    
    return () => {
      if (socket) {
        socket.disconnect();
      }
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
    };
  }, [sessionId]);

  const initializeUser = async () => {
    try {
      // Create or get user
      const userData = {
        name: `Candidate_${Date.now()}`,
        role: 'candidate'
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
      const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/join?user_id=${userId}&role=candidate`, {
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
      });
      
      setSocket(newSocket);
    }
  };

  const setupCamera = async () => {
    try {
      // Initialize MediaPipe Hands
      const hands = new Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      hands.onResults(onResults);
      handsRef.current = hands;

      // Setup camera
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          const camera = new Camera(videoRef.current, {
            onFrame: async () => {
              if (handsRef.current) {
                await handsRef.current.send({ image: videoRef.current });
              }
            },
            width: 640,
            height: 480
          });
          
          camera.start();
          cameraRef.current = camera;
        }
      }
    } catch (error) {
      console.error('Error setting up camera:', error);
    }
  };

  const onResults = (results) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = 640;
    canvas.height = 480;
    
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the video frame
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    
    if (results.multiHandLandmarks) {
      for (const landmarks of results.multiHandLandmarks) {
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
        drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 2 });
      }
      
      // Simple gesture recognition (this is a simplified version)
      const recognizedSign = recognizeGesture(results.multiHandLandmarks);
      if (recognizedSign && recognizedSign !== currentSign) {
        setCurrentSign(recognizedSign);
        if (isRecognizing) {
          sendSignMessage(recognizedSign);
        }
      }
    }
    
    ctx.restore();
  };

  const recognizeGesture = (landmarks) => {
    if (!landmarks || landmarks.length === 0) return null;
    
    const hand = landmarks[0];
    
    // Simple gesture recognition based on finger positions
    // This is a very basic implementation - in real application, you'd use ML models
    
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const pinkyTip = hand[20];
    
    const thumbUp = thumbTip.y < hand[3].y;
    const indexUp = indexTip.y < hand[6].y;
    const middleUp = middleTip.y < hand[10].y;
    const ringUp = ringTip.y < hand[14].y;
    const pinkyUp = pinkyTip.y < hand[18].y;
    
    // Basic gesture patterns
    if (thumbUp && !indexUp && !middleUp && !ringUp && !pinkyUp) {
      return 'thumbs_up';
    } else if (!thumbUp && indexUp && middleUp && !ringUp && !pinkyUp) {
      return 'peace_sign';
    } else if (!thumbUp && !indexUp && !middleUp && !ringUp && !pinkyUp) {
      return 'fist';
    } else if (thumbUp && indexUp && middleUp && ringUp && pinkyUp) {
      return 'open_palm';
    } else if (!thumbUp && indexUp && !middleUp && !ringUp && !pinkyUp) {
      return 'pointing';
    }
    
    return null;
  };

  const sendSignMessage = async (sign) => {
    if (!user || !sessionId) return;
    
    const translatedText = signMappings[sign] || sign;
    
    const message = {
      session_id: sessionId,
      sender_id: user.user_id,
      sender_role: 'candidate',
      message_type: 'sign_to_text',
      content: translatedText
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

  const toggleRecognition = () => {
    setIsRecognizing(!isRecognizing);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-center text-blue-600 mb-2">
            Sign Language Interview - Candidate View
          </h1>
          <p className="text-center text-gray-600">
            Session ID: {sessionId} | Status: {session?.status || 'Loading...'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Camera and Sign Recognition */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Sign Language Input</h2>
            
            <div className="relative mb-4">
              <video
                ref={videoRef}
                className="hidden"
                autoPlay
                muted
                playsInline
              />
              <canvas
                ref={canvasRef}
                className="w-full border-2 border-gray-300 rounded-lg"
                width="640"
                height="480"
              />
            </div>
            
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600">
                Current Sign: <span className="font-semibold text-blue-600">
                  {currentSign ? signMappings[currentSign] || currentSign : 'None detected'}
                </span>
              </div>
              
              <button
                onClick={toggleRecognition}
                className={`px-4 py-2 rounded-lg font-semibold ${
                  isRecognizing
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {isRecognizing ? 'Stop Recognition' : 'Start Recognition'}
              </button>
            </div>
            
            <div className="text-xs text-gray-500">
              <p>Supported signs: Hello (👍), Yes (✌️), No (👊), Thank you (🖐️), I (👆), Goodbye (👋)</p>
            </div>
          </div>

          {/* Messages from HR */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Messages from HR</h2>
            
            <div className="h-96 border border-gray-300 rounded-lg p-4 overflow-y-auto mb-4">
              {messages.filter(msg => msg.sender_role === 'hr').map((message, index) => (
                <div key={index} className="mb-3 p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">
                    HR - {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="text-lg font-mono">
                    {message.content}
                  </div>
                  {message.message_type === 'text_to_sign' && (
                    <div className="text-xs text-blue-600 mt-1">
                      Sign Language Text
                    </div>
                  )}
                </div>
              ))}
              
              {messages.filter(msg => msg.sender_role === 'hr').length === 0 && (
                <div className="text-gray-500 text-center py-8">
                  Waiting for HR messages...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Your Messages */}
        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Your Messages</h2>
          
          <div className="h-32 border border-gray-300 rounded-lg p-4 overflow-y-auto">
            {messages.filter(msg => msg.sender_role === 'candidate').map((message, index) => (
              <div key={index} className="mb-2 p-2 bg-green-50 rounded">
                <span className="text-xs text-gray-600">
                  {new Date(message.timestamp).toLocaleTimeString()}:
                </span>
                <span className="ml-2">{message.content}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateView;