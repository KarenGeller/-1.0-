import { create } from 'zustand';
import { AppState } from '../types';

export const useStore = create<AppState>((set) => ({
  phase: 'tree',
  gestureState: 'waiting',
  handPosition: { x: 0.5, y: 0.5 },
  handRotation: 0,
  isCameraOpen: false,
  currentMusic: 'Jingle Bells',
  theme: 'christmas',
  audioData: 0,
  uploadedPhotos: [],
  
  setPhase: (phase) => set({ phase }),
  setGestureState: (gestureState) => set({ gestureState }),
  setHandPosition: (handPosition) => set({ handPosition }),
  setHandRotation: (handRotation) => set({ handRotation }),
  setCameraOpen: (isCameraOpen) => set({ isCameraOpen }),
  setCurrentMusic: (currentMusic) => set({ currentMusic }),
  setTheme: (theme) => set({ theme }),
  setAudioData: (audioData) => set({ audioData }),
  addUploadedPhotos: (photos) => set((state) => ({ 
    uploadedPhotos: [...state.uploadedPhotos, ...photos] 
  })),
}));