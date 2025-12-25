import { create } from 'zustand';
import { AppState } from '../types';

export const useStore = create<AppState>((set) => ({
  phase: 'tree',
  gestureState: 'waiting',
  isCameraOpen: false,
  currentMusic: 'Jingle Bells',
  uploadedPhotos: [],
  
  setPhase: (phase) => set({ phase }),
  setGestureState: (gestureState) => set({ gestureState }),
  setCameraOpen: (isCameraOpen) => set({ isCameraOpen }),
  setCurrentMusic: (currentMusic) => set({ currentMusic }),
  addUploadedPhotos: (photos) => set((state) => ({ 
    uploadedPhotos: [...state.uploadedPhotos, ...photos] 
  })),
}));