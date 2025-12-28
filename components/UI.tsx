import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';

// Reliable Audio Sources
// 1. Free Music Archive (Kevin MacLeod - Jingle Bells) - MP3
const PRIMARY_MUSIC_URL = "https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/Kevin_MacLeod/Jazz_Sampler/Kevin_MacLeod_-_Jingle_Bells.mp3";
// 2. Archive.org (Standard MP3) - Fallback
const BACKUP_MUSIC_URL = "https://ia800508.us.archive.org/15/items/JingleBells_205/Jingle%20Bells.mp3";
// 3. Wikimedia (Instrumental OGG) - Good fallback for Chrome/Firefox
const TERTIARY_MUSIC_URL = "https://upload.wikimedia.org/wikipedia/commons/e/e9/Jingle_Bells_%28Instrumental%29.ogg";

const UI: React.FC = () => {
  const { currentMusic, phase, gestureState, theme, setTheme, setAudioData, addUploadedPhotos } = useStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Audio Analysis Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const audio = new Audio();
    // Default to anonymous to allow analysis if possible
    audio.crossOrigin = "anonymous"; 
    audio.loop = true;
    audio.src = PRIMARY_MUSIC_URL;
    audio.preload = "auto";
    audio.volume = 0.5;
    
    // State to track fallback attempts
    let attempt = 0;

    const handleError = (e: Event) => {
        const target = e.target as HTMLAudioElement;
        const err = target.error;
        console.warn(`Audio load error (Attempt ${attempt}):`, err?.code, err?.message);
        attempt++;

        if (attempt === 1) {
            // Fallback 1: Backup Source (Archive.org)
            console.log("Switching to backup source (Archive.org)...");
            audio.src = BACKUP_MUSIC_URL;
            audio.load();
        } else if (attempt === 2) {
            // Fallback 2: Tertiary (Wikimedia OGG)
            console.log("Switching to tertiary source (Wikimedia OGG)...");
            audio.src = TERTIARY_MUSIC_URL;
            audio.load();
        } else if (attempt === 3) {
            // Fallback 3: Try Primary again WITHOUT CORS (Visualizer unavailable)
            console.log("Disabling CORS and retrying Primary...");
            audio.removeAttribute('crossOrigin');
            audio.src = PRIMARY_MUSIC_URL;
            audio.load();
        } else if (attempt === 4) {
             // Fallback 4: Try Backup WITHOUT CORS
             console.log("Disabling CORS and retrying Backup...");
             audio.removeAttribute('crossOrigin');
             audio.src = BACKUP_MUSIC_URL;
             audio.load();
        } else {
             console.error("All audio fallbacks failed. Please check your network connection.");
        }
    };

    audio.addEventListener('error', handleError);
    audioRef.current = audio;

    return () => {
        audio.removeEventListener('error', handleError);
        audio.pause();
        audioRef.current = null;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
    };
  }, []);

  const setupAudioContext = () => {
      if (!audioRef.current || audioContextRef.current) return;
      
      // If CORS was disabled during fallback, we cannot use AudioContext on the element
      if (!audioRef.current.crossOrigin) {
          console.warn("CORS is disabled for this audio source. Visualization unavailable.");
          return;
      }

      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      try {
        const source = ctx.createMediaElementSource(audioRef.current);
        sourceRef.current = source;
        source.connect(analyser);
        analyser.connect(ctx.destination);
      } catch (err) {
        console.warn("Visualizer setup failed (likely CORS). Audio will still play.", err);
      }
  };

  const analyzeAudio = () => {
      if (!analyserRef.current) {
          // Fallback simulation if visualizer failed
          if (isPlaying) {
             // Simple simulated beat
             const time = Date.now() / 1000;
             const beat = (Math.sin(time * 10) + 1) / 2 * 0.5;
             setAudioData(beat);
             rafRef.current = requestAnimationFrame(analyzeAudio);
          }
          return;
      }

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average bass (lower frequencies)
      let sum = 0;
      const bassBinCount = 10; 
      for (let i = 0; i < bassBinCount; i++) {
          sum += dataArray[i];
      }
      const avg = sum / bassBinCount; // 0 to 255
      
      // Normalize to 0-1 range roughly, but keep it punchy
      setAudioData(avg / 255.0);
      
      rafRef.current = requestAnimationFrame(analyzeAudio);
  };

  const toggleMusic = async () => {
      if (!audioRef.current) return;
      
      if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
      } else {
          try {
            // Setup context on first play
            if (!audioContextRef.current && audioRef.current.crossOrigin) {
                setupAudioContext();
            }
            if (audioContextRef.current?.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            await audioRef.current.play();
            setIsPlaying(true);
            analyzeAudio();
          } catch (err) {
              console.error("Audio play failed", err);
              // Force retry logic or alert user if play failed but load didn't
              // Sometimes load is lazy, so error triggers here.
          }
      }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newPhotos = Array.from(files).map((file: File) => URL.createObjectURL(file));
      addUploadedPhotos(newPhotos);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-10 text-white overflow-hidden font-sans">
      
      {/* Top Left: Dashboard */}
      <div className="flex flex-col gap-4 items-start pointer-events-auto">
        <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 min-w-[240px] shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">Interactive Mode</span>
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${gestureState !== 'waiting' ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-gray-400'}`}>
               {gestureState === 'pinch' ? 'GRAB PHOTO' : gestureState.toUpperCase()}
            </div>
          </div>
          
          <h2 className="text-xl font-bold mb-2">
              {theme === 'christmas' ? '🎄 Christmas' : '🏮 Spring Festival'}
          </h2>
          <div className="text-xs text-blue-200 mb-4">
              {theme === 'christmas' ? 'Luxurious Gold & Red' : 'Lantern Red & Gold'}
          </div>

          <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setTheme('christmas')}
                className={`py-2 rounded-lg text-xs font-bold transition-all ${theme === 'christmas' ? 'bg-amber-500 text-black' : 'bg-white/10 hover:bg-white/20'}`}
              >
                  Christmas
              </button>
              <button 
                onClick={() => setTheme('spring')}
                className={`py-2 rounded-lg text-xs font-bold transition-all ${theme === 'spring' ? 'bg-red-600 text-white' : 'bg-white/10 hover:bg-white/20'}`}
              >
                  Festival
              </button>
          </div>

          <div className="h-px w-full bg-white/10 my-4" />

          <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold text-white transition-all flex items-center justify-center gap-2"
          >
              <span>📷</span> Upload Photos
          </button>
          <input type="file" multiple accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
        </div>
      </div>

      {/* Center Title */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none mix-blend-screen">
        <h1 className="text-6xl md:text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-amber-200 to-amber-600 drop-shadow-[0_0_30px_rgba(251,191,36,0.6)] animate-pulse" style={{ fontFamily: '"Brush Script MT", "cursive", serif' }}>
          {theme === 'christmas' ? 'Merry Christmas' : 'Happy New Year'}
        </h1>
      </div>

      {/* Bottom: Music & Status */}
      <div className="w-full flex justify-center pointer-events-auto pb-8">
        <button 
            onClick={toggleMusic}
            className={`
                flex items-center gap-4 px-6 py-3 rounded-full border transition-all duration-500
                ${isPlaying ? 'bg-amber-500/20 border-amber-500/50 shadow-[0_0_40px_rgba(245,158,11,0.3)]' : 'bg-black/40 border-white/10 hover:bg-white/10'}
            `}
        >
            <div className={`text-2xl ${isPlaying ? 'animate-spin-slow' : ''}`}>
                {theme === 'christmas' ? '💿' : '🥁'}
            </div>
            <div className="flex flex-col items-start">
                <span className="text-[10px] uppercase tracking-widest opacity-60">Background Music</span>
                <span className="font-bold text-sm">{isPlaying ? 'Playing... (Audio Reactive)' : 'Click to Play'}</span>
            </div>
        </button>
      </div>

      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
      `}</style>
    </div>
  );
};

export default UI;