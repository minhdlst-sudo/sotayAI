
export interface DocumentSource {
  id: string;
  name: string;
  type: 'pdf' | 'excel' | 'sheet' | 'word';
  content: string;
  status: 'processing' | 'ready' | 'error';
  origin: 'cloud' | 'local';
  size?: number;
}

export interface GroundingLink {
  uri: string;
  title: string;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  links?: GroundingLink[];
  audioData?: string; // Base64 PCM data cached
}

export interface User {
  username: string;
  role: 'user' | 'admin';
  status: 'pending' | 'approved' | 'rejected';
}

export interface ChatState {
  messages: Message[];
  isTyping: boolean;
}
