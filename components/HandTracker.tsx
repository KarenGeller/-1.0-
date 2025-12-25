import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const HandTracker: React.FC = () => {
  const { isCameraOpen, setCameraOpen, gestureState, setGestureState } = useStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const [loading, setLoading] = useState(true);

  // 1. Initialize HandLandmarker
  useEffect(() => {
    const initLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        setHandLandmarker(landmarker);
        setLoading(false);
      } catch (error) {
        console.error("Error initializing HandLandmarker:", error);
        setLoading(false);
      }
    };
    initLandmarker();
  }, []);

  // 2. Setup Camera Stream
  useEffect(() => {
    if (!isCameraOpen || !videoRef.current) {
        // Stop stream if camera is closed
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        return;
    }

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240 }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener('loadeddata', predictWebcam);
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
        setCameraOpen(false); // Reset state if failed
      }
    };

    startCamera();

    return () => {
      // Cleanup
      if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
      }
      cancelAnimationFrame(requestRef.current);
    };
  }, [isCameraOpen, handLandmarker]); // Re-run if camera toggles or landmarker becomes available

  // 3. Gesture Detection Loop
  const predictWebcam = () => {
    if (!handLandmarker || !videoRef.current) return;
    
    // Process frame
    const startTimeMs = performance.now();
    const results = handLandmarker.detectForVideo(videoRef.current, startTimeMs);

    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0]; // {x, y, z}[]
      detectGesture(landmarks);
    } else {
        setGestureState('waiting');
    }

    if (isCameraOpen) {
      requestRef.current = requestAnimationFrame(predictWebcam);
    }
  };

  // 4. Simple Gesture Logic
  const detectGesture = (landmarks: any[]) => {
      // 0: Wrist
      // Tips: 4 (Thumb), 8 (Index), 12 (Middle), 16 (Ring), 20 (Pinky)
      // PIPs (Knuckles/Joints closer to palm for fingers): 6, 10, 14, 18
      // MCPs (Base of fingers): 5, 9, 13, 17
      
      const wrist = landmarks[0];

      // Helper to calculate distance squared (faster than sqrt)
      const distSq = (p1: any, p2: any) => {
          return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
      };

      let extendedCount = 0;

      // Check 4 fingers (Index to Pinky)
      // If Tip is further from Wrist than PIP is, it's likely extended
      const fingerTips = [8, 12, 16, 20];
      const fingerPIPs = [6, 10, 14, 18];

      for (let i = 0; i < 4; i++) {
          const tipDist = distSq(landmarks[fingerTips[i]], wrist);
          const pipDist = distSq(landmarks[fingerPIPs[i]], wrist);
          if (tipDist > pipDist) {
              extendedCount++;
          }
      }

      // Check Thumb (4) vs Base (2)
      // Thumb is a bit different, but generally if tip is far from pinky base or wrist
      const thumbTipDist = distSq(landmarks[4], wrist);
      const thumbBaseDist = distSq(landmarks[2], wrist);
      if (thumbTipDist > thumbBaseDist) {
          extendedCount++;
      }

      if (extendedCount === 5) {
          setGestureState('open-palm');
      } else if (extendedCount === 0 || extendedCount === 1) { 
          // Allow 0 or 1 (sometimes thumb is tricky) to be fist
          setGestureState('closed-fist');
      } else {
          setGestureState('waiting');
      }
  };

  const getStatusText = () => {
      switch (gestureState) {
          case 'open-palm': return 'Open Palm (张开手掌)';
          case 'closed-fist': return 'Closed Fist (握拳)';
          default: return 'Waiting... (等待手势)';
      }
  };

  const getStatusColor = () => {
      switch (gestureState) {
          case 'open-palm': return 'text-green-400';
          case 'closed-fist': return 'text-red-400';
          default: return 'text-gray-400';
      }
  };

  return (
    <div className="absolute top-4 right-4 z-50 flex flex-col items-end pointer-events-auto">
      {/* Glassmorphism Panel */}
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 w-64 shadow-xl">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-white font-semibold text-sm">Hand Control</h2>
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-500' : 'bg-green-500'}`} />
        </div>

        {/* Camera Preview */}
        <div className="relative w-full aspect-[4/3] bg-black/50 rounded-lg overflow-hidden mb-4 border border-white/10">
            {!isCameraOpen && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                    Camera Off
                </div>
            )}
            <video 
                ref={videoRef} 
                className={`w-full h-full object-cover transform scale-x-[-1] ${!isCameraOpen ? 'hidden' : ''}`} // Mirror effect
                autoPlay 
                playsInline 
            />
        </div>

        {/* Status Display */}
        <div className="mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Gesture</p>
            <p className={`font-mono font-bold ${getStatusColor()}`}>
                {getStatusText()}
            </p>
        </div>

        {/* Toggle Button */}
        <button
            onClick={() => setCameraOpen(!isCameraOpen)}
            disabled={loading}
            className={`w-full py-2 px-4 rounded-lg text-sm font-bold transition-colors ${
                isCameraOpen 
                ? 'bg-red-500/80 hover:bg-red-600 text-white' 
                : 'bg-white/20 hover:bg-white/30 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            {loading ? 'Initializing...' : (isCameraOpen ? 'CLOSE CAMERA' : 'OPEN CAMERA')}
        </button>
      </div>
    </div>
  );
};

export default HandTracker;