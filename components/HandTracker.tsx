import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const HandTracker: React.FC = () => {
  const { isCameraOpen, setCameraOpen, gestureState, setGestureState, setHandPosition, setHandRotation } = useStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Smoothing Refs
  const prevHandPos = useRef({ x: 0.5, y: 0.5 });
  const prevHandRot = useRef(0);

  // 1. Initialize HandLandmarker
  useEffect(() => {
    const initLandmarker = async () => {
      try {
        setLoading(true);
        // Use a specific, newer version of tasks-vision (0.10.14)
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        const params = {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
              delegate: "GPU" as "GPU" | "CPU"
            },
            runningMode: "VIDEO" as const,
            numHands: 2
        };

        try {
            // Try initializing with GPU first
            const landmarker = await HandLandmarker.createFromOptions(vision, params);
            setHandLandmarker(landmarker);
            setLoading(false);
        } catch (gpuError) {
            console.warn("GPU Initialization failed, falling back to CPU...", gpuError);
            // Fallback to CPU
            params.baseOptions.delegate = "CPU";
            const landmarker = await HandLandmarker.createFromOptions(vision, params);
            setHandLandmarker(landmarker);
            setLoading(false);
        }

      } catch (error) {
        console.error("Error initializing HandLandmarker:", error);
        setErrorMsg("AI Init Failed");
        setLoading(false);
      }
    };
    initLandmarker();
  }, []);

  // 2. Setup Camera Stream
  useEffect(() => {
    if (!isCameraOpen || !videoRef.current) {
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
        setCameraOpen(false);
      }
    };

    startCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
      }
      cancelAnimationFrame(requestRef.current);
    };
  }, [isCameraOpen, handLandmarker]);

  // 3. Gesture Detection Loop
  const predictWebcam = () => {
    if (!handLandmarker || !videoRef.current) return;
    
    // Safety check if video is actually ready
    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        requestRef.current = requestAnimationFrame(predictWebcam);
        return;
    }
    
    const startTimeMs = performance.now();
    let results;
    try {
        results = handLandmarker.detectForVideo(videoRef.current, startTimeMs);
    } catch (e) {
        console.warn("Detection error:", e);
        requestRef.current = requestAnimationFrame(predictWebcam);
        return;
    }

    // Default state
    let newGestureState = 'waiting';

    if (results.landmarks && results.landmarks.length > 0) {
      
      let rightHandDetected = false;
      let leftHandDetected = false;
      
      // Temporary states to aggregate logic from both hands
      let rightHandState = 'waiting';
      let leftHandState = 'waiting';

      // Iterate through detected hands
      for (let i = 0; i < results.handedness.length; i++) {
        // MediaPipe "Left" = User's Right Hand (Selfie Mode)
        // MediaPipe "Right" = User's Left Hand (Selfie Mode)
        const label = results.handedness[i][0].categoryName; 
        const landmarks = results.landmarks[i];

        if (label === 'Left') { 
          // --- USER'S RIGHT HAND (Control: Tree/Spread + Rotation) ---
          rightHandDetected = true;
          
          // 1. Position & Rotation
          const wrist = landmarks[0];
          const middleTip = landmarks[9]; // Middle finger MCP/Tip usually stable for orientation
          
          // Position Smoothing
          const smoothX = prevHandPos.current.x + (wrist.x - prevHandPos.current.x) * 0.15;
          const smoothY = prevHandPos.current.y + (wrist.y - prevHandPos.current.y) * 0.15;
          prevHandPos.current = { x: smoothX, y: smoothY };
          setHandPosition({ x: smoothX, y: smoothY });

          // Rotation Calculation (Roll)
          // Calculate angle between wrist and middle finger.
          // Upright hand: wrist.y > middle.y. atan2(middle.y - wrist.y, middle.x - wrist.x) ~= -PI/2
          const dx = middleTip.x - wrist.x;
          const dy = middleTip.y - wrist.y;
          const angle = Math.atan2(dy, dx);
          
          // Normalize so 0 is upright.
          // -PI/2 is upright. 
          // Rotate right (clockwise): angle increases towards 0.
          // Rotate left (counter-clockwise): angle decreases towards -PI.
          let rotation = angle + Math.PI / 2;
          
          // Clamp/Normalize to approx -1 (left tilt) to 1 (right tilt)
          // Deadzone for stability
          if (Math.abs(rotation) < 0.2) rotation = 0;
          
          // Smoothing Rotation
          const smoothRot = prevHandRot.current + (rotation - prevHandRot.current) * 0.1;
          prevHandRot.current = smoothRot;
          setHandRotation(smoothRot);

          // 2. Detect Open/Fist
          rightHandState = detectOpenClosed(landmarks);

        } else if (label === 'Right') {
          // --- USER'S LEFT HAND (Control: Grab Photo) ---
          leftHandDetected = true;
          
          // "Left hand grabbing action" -> Pinch or Fist
          const state = detectOpenClosed(landmarks);
          if (state === 'closed-fist' || isPinch(landmarks)) {
            leftHandState = 'pinch'; // 'pinch' internally means 'grab interaction'
          }
        }
      }

      // --- COMBINE LOGIC / PRIORITY ---
      // Priority: 
      // 1. Right Hand Fist (Emergency Stop/Collapse)
      // 2. Left Hand Grab (Interaction)
      // 3. Right Hand Open (Spread)
      
      if (rightHandState === 'closed-fist') {
          newGestureState = 'closed-fist';
      } else if (leftHandState === 'pinch') {
          newGestureState = 'pinch';
      } else if (rightHandState === 'open-palm') {
          newGestureState = 'open-palm';
      } else {
          newGestureState = 'waiting';
      }

    } else {
        setGestureState('waiting');
    }

    setGestureState(newGestureState as any);

    if (isCameraOpen) {
      requestRef.current = requestAnimationFrame(predictWebcam);
    }
  };

  // Helper: Detect Open Palm vs Closed Fist
  const detectOpenClosed = (landmarks: any[]) => {
      const wrist = landmarks[0];
      const distSq = (p1: any, p2: any) => (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;

      let extendedCount = 0;
      const fingerTips = [8, 12, 16, 20];
      const fingerPIPs = [6, 10, 14, 18];

      for (let i = 0; i < 4; i++) {
          // If tip is further from wrist than PIP joint, it's extended
          if (distSq(landmarks[fingerTips[i]], wrist) > distSq(landmarks[fingerPIPs[i]], wrist)) {
              extendedCount++;
          }
      }
      // Thumb Extension check
      if (distSq(landmarks[4], wrist) > distSq(landmarks[2], wrist)) extendedCount++;

      if (extendedCount >= 5) return 'open-palm'; // Strict 5 fingers for spread
      if (extendedCount <= 1) return 'closed-fist';
      return 'waiting';
  };

  // Helper: Detect Pinch (Thumb + Index)
  const isPinch = (landmarks: any[]) => {
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const distSq = (p1: any, p2: any) => (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
      const pinchDist = Math.sqrt(distSq(thumbTip, indexTip));
      return pinchDist < 0.05; // Threshold
  };

  const getStatusText = () => {
      if (errorMsg) return errorMsg;
      switch (gestureState) {
          case 'open-palm': return 'R-Hand: Spread';
          case 'closed-fist': return 'R-Hand: Gather';
          case 'pinch': return 'L-Hand: Grab';
          default: return 'Tracking...';
      }
  };

  const getStatusColor = () => {
      if (errorMsg) return 'text-red-500';
      switch (gestureState) {
          case 'open-palm': return 'text-red-400';
          case 'closed-fist': return 'text-green-400';
          case 'pinch': return 'text-blue-400';
          default: return 'text-gray-400';
      }
  };

  return (
    <div className="absolute top-4 right-4 z-50 flex flex-col items-end pointer-events-auto">
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 w-64 shadow-xl">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-white font-semibold text-sm">Vision Control (2 Hands)</h2>
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-500' : (errorMsg ? 'bg-red-500' : 'bg-green-500')}`} />
        </div>

        <div className="relative w-full aspect-[4/3] bg-black/50 rounded-lg overflow-hidden mb-4 border border-white/10">
            {!isCameraOpen && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                    Camera Off
                </div>
            )}
            <video 
                ref={videoRef} 
                className={`w-full h-full object-cover transform scale-x-[-1] ${!isCameraOpen ? 'hidden' : ''}`} 
                autoPlay 
                playsInline 
            />
        </div>

        <div className="mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Detected Action</p>
            <p className={`font-mono font-bold ${getStatusColor()}`}>
                {getStatusText()}
            </p>
        </div>

        <button
            onClick={() => setCameraOpen(!isCameraOpen)}
            disabled={loading || !!errorMsg}
            className={`w-full py-2 px-4 rounded-lg text-sm font-bold transition-colors ${
                isCameraOpen 
                ? 'bg-red-500/80 hover:bg-red-600 text-white' 
                : 'bg-white/20 hover:bg-white/30 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            {loading ? 'Init AI...' : (errorMsg ? 'Init Failed' : (isCameraOpen ? 'STOP VISION' : 'START VISION'))}
        </button>
      </div>
    </div>
  );
};

export default HandTracker;