import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';

// Reliable MP3 source from Archive.org
const MUSIC_URL = "https://archive.org/download/JingleBells_205/Jingle%20Bells.mp3";

const UI: React.FC = () => {
  const { currentMusic, phase, gestureState, addUploadedPhotos } = useStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const audio = new Audio();
    // No crossOrigin needed for simple playback
    audio.src = MUSIC_URL;
    audio.loop = true;
    audio.volume = 0.5;
    audio.preload = 'auto';

    const handleError = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      let errorMessage = "Unknown audio error";
      const err = target.error;
      
      if (err) {
        switch (err.code) {
          case err.MEDIA_ERR_ABORTED: errorMessage = "Fetch aborted"; break;
          case err.MEDIA_ERR_NETWORK: errorMessage = "Network error"; break;
          case err.MEDIA_ERR_DECODE: errorMessage = "Decode error"; break;
          case err.MEDIA_ERR_SRC_NOT_SUPPORTED: errorMessage = "Source not supported (404 or Format)"; break;
          default: errorMessage = `Code: ${err.code}`;
        }
        if (err.message) errorMessage += ` - ${err.message}`;
      }
      
      console.error(`Audio Playback Error: ${errorMessage}`, target.src);
      setIsPlaying(false);
    };

    audio.addEventListener('error', handleError);
    audioRef.current = audio;

    return () => {
        audio.removeEventListener('error', handleError);
        audio.pause();
        audioRef.current = null;
    };
  }, []);

  const toggleMusic = () => {
      if (!audioRef.current) return;
      
      if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
      } else {
          // Attempt to reload if in error state
          if (audioRef.current.error) {
              console.log("Reloading audio due to previous error...");
              audioRef.current.load();
          }
          
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
              playPromise
                .then(() => setIsPlaying(true))
                .catch(err => {
                    console.error("Play request failed:", err);
                    setIsPlaying(false);
                });
          }
      }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // Cast to Blob explicitly to avoid 'unknown' argument type error in some TS environments
      const newPhotos = Array.from(files).map((file) => URL.createObjectURL(file as Blob));
      addUploadedPhotos(newPhotos);
    }
    // Reset input so same files can be selected again if needed
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const getGestureText = () => {
    switch (gestureState) {
      case 'open-palm': return 'Open Palm';
      case 'closed-fist': return 'Closed Fist';
      default: return 'Waiting...';
    }
  };

  const getPhaseContent = () => {
    if (phase === 'tree') {
      return {
        title: "Tree Mode",
        instruction: "张开手掌开启魔法",
        subtext: "Open palm to start magic",
        action: "OPEN"
      };
    }
    return {
      title: "Nebula Mode",
      instruction: "五指滑动翻页 · 握拳重置",
      subtext: "Swipe to browse · Fist to reset",
      action: null
    };
  };

  const content = getPhaseContent();
  const isGestureActive = gestureState !== 'waiting';

  return (
    <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-10 text-white overflow-hidden font-sans">
      
      {/* Top Left: Status & Instructions Panel */}
      <div className="flex flex-col gap-4 items-start pointer-events-auto">
        <div className="group bg-slate-900/30 backdrop-blur-md border border-white/10 rounded-2xl p-5 min-w-[240px] shadow-2xl transition-all duration-300 hover:bg-slate-900/40 hover:scale-105">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">System Status</span>
            <div className={`flex items-center gap-2 px-2 py-0.5 rounded-full ${isGestureActive ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
               <div className={`w-1.5 h-1.5 rounded-full ${isGestureActive ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
               <span className="text-[10px] font-bold">{isGestureActive ? 'ACTIVE' : 'IDLE'}</span>
            </div>
          </div>
          
          {/* Gesture Display */}
          <div className="text-xl font-bold text-white mb-2 font-mono tracking-tight">
             {getGestureText()}
          </div>
          
          <div className="h-px w-full bg-gradient-to-r from-white/20 to-transparent my-3" />
          
          {/* Instructions */}
          <div className="space-y-1">
             <p className="text-sm font-medium text-blue-200">{content.instruction}</p>
             <p className="text-xs text-slate-400">{content.subtext}</p>
          </div>

          {/* Action Button (Tree Phase) */}
          {content.action && (
            <button className="mt-4 w-full py-2 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 rounded-lg text-xs font-bold text-white shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 group-hover:shadow-amber-500/30">
              <span>✨</span>
              {content.action}
            </button>
          )}

          {/* Upload Button */}
          <div className="mt-3 pt-3 border-t border-white/10">
              <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleFileUpload} 
              />
              <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 rounded-lg text-xs font-bold text-white shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                  <span>📷</span>
                  Upload Photos
              </button>
          </div>
        </div>
      </div>

      {/* Center: Main Title */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
        <h1 className="text-7xl md:text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-yellow-300 to-amber-600 drop-shadow-[0_0_30px_rgba(251,191,36,0.4)] animate-pulse-slow" style={{ fontFamily: '"Brush Script MT", "cursive", serif' }}>
          Merry Christmas
        </h1>
      </div>

      {/* Bottom Center: Music Player */}
      <div className="w-full flex justify-center pointer-events-auto pb-4">
        <div className={`
          relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-full px-5 py-3 
          flex items-center gap-5 shadow-[0_0_20px_rgba(100,100,255,0.1)] 
          transition-all duration-500 hover:shadow-[0_0_30px_rgba(100,100,255,0.2)] hover:bg-black/50
          ${isPlaying ? 'animate-breathing-border' : ''}
        `}>
          
          {/* Rotating Icon */}
          <div className={`
            relative w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10
            ${isPlaying ? 'animate-spin-slow' : ''}
          `}>
             <span className="text-xl filter drop-shadow-md">❄️</span>
          </div>

          {/* Track Info */}
          <div className="flex flex-col w-40 md:w-56 overflow-hidden">
             <div className="text-[10px] text-blue-300 uppercase tracking-widest font-bold mb-0.5">Now Playing</div>
             <div className="relative overflow-hidden h-6 w-full mask-linear-fade">
               <div className={`whitespace-nowrap font-medium text-white/90 ${isPlaying ? 'animate-marquee' : ''}`}>
                  {currentMusic} &nbsp;&nbsp; • &nbsp;&nbsp; Archive.org &nbsp;&nbsp; • &nbsp;&nbsp;
               </div>
             </div>
          </div>

          {/* Controls */}
          <button 
            onClick={toggleMusic}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all active:scale-90 border border-white/5 group"
          >
             {isPlaying ? (
                <div className="flex gap-1 items-end h-4">
                   <div className="w-1 bg-green-400 rounded-full animate-[music-bar_0.6s_ease-in-out_infinite] h-full" />
                   <div className="w-1 bg-green-400 rounded-full animate-[music-bar_0.8s_ease-in-out_infinite] h-2/3" />
                   <div className="w-1 bg-green-400 rounded-full animate-[music-bar_0.7s_ease-in-out_infinite] h-full" />
                </div>
             ) : (
                <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-1 opacity-80 group-hover:opacity-100" />
             )}
          </button>
        </div>
      </div>
      
      {/* Styles for specific animations */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 10s linear infinite;
        }
        @keyframes music-bar {
           0%, 100% { height: 100%; opacity: 1; }
           50% { height: 40%; opacity: 0.7; }
        }
        @keyframes spin-slow {
           from { transform: rotate(0deg); }
           to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
           animation: spin-slow 8s linear infinite;
        }
        @keyframes pulse-slow {
           0%, 100% { opacity: 1; transform: scale(1); }
           50% { opacity: 0.9; transform: scale(0.98); }
        }
        .animate-pulse-slow {
           animation: pulse-slow 4s ease-in-out infinite;
        }
        @keyframes breathing-border {
           0%, 100% { border-color: rgba(255,255,255,0.1); box-shadow: 0 0 20px rgba(100,100,255,0.1); }
           50% { border-color: rgba(255,255,255,0.3); box-shadow: 0 0 30px rgba(100,100,255,0.25); }
        }
        .animate-breathing-border {
           animation: breathing-border 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default UI;