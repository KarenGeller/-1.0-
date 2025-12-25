export type AppPhase = 'tree' | 'nebula';
export type GestureState = 'waiting' | 'open-palm' | 'closed-fist';

export interface AppState {
  phase: AppPhase;
  gestureState: GestureState;
  isCameraOpen: boolean;
  currentMusic: string;
  uploadedPhotos: string[];
  setPhase: (phase: AppPhase) => void;
  setGestureState: (state: GestureState) => void;
  setCameraOpen: (isOpen: boolean) => void;
  setCurrentMusic: (music: string) => void;
  addUploadedPhotos: (photos: string[]) => void;
}