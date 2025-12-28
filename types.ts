export type AppPhase = 'tree' | 'nebula' | 'collapsing'; // tree = converged, nebula = exploded, collapsing = returning
export type GestureState = 'waiting' | 'open-palm' | 'closed-fist' | 'pinch';
export type Theme = 'christmas' | 'spring';

export interface AppState {
  phase: AppPhase;
  gestureState: GestureState;
  handPosition: { x: number; y: number }; // Normalized 0-1
  handRotation: number; // Radian offset from vertical (approx -1 to 1)
  isCameraOpen: boolean;
  currentMusic: string;
  theme: Theme;
  audioData: number; // Low frequency average (0-255)
  uploadedPhotos: string[];
  
  setPhase: (phase: AppPhase) => void;
  setGestureState: (state: GestureState) => void;
  setHandPosition: (pos: { x: number; y: number }) => void;
  setHandRotation: (rot: number) => void;
  setCameraOpen: (isOpen: boolean) => void;
  setCurrentMusic: (music: string) => void;
  setTheme: (theme: Theme) => void;
  setAudioData: (val: number) => void;
  addUploadedPhotos: (photos: string[]) => void;
}