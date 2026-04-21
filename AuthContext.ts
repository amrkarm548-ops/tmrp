import { createContext } from 'react';
import { User as FirebaseUser } from 'firebase/auth';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user' | 'banned';
  settings: {
    defaultStudyMode: string;
    preferredLanguage: string;
    fontSize?: string;
    highContrast?: boolean;
    dyslexiaFont?: boolean;
    aiPersona?: string;
    mcqDifficulty?: string;
    summaryLength?: string;
    medicalTermTranslation?: string;
    soundEffects?: boolean;
    pushNotifications?: boolean;
    focusTimerLength?: number;
    animationSpeed?: string;
    dataSaver?: boolean;
    [key: string]: any;
  };
  feedback: string[];
  createdAt: string;
}

export interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
