export const __typesModule = true;

export interface Camera {
  id: string;
  name: string;
  location: string;
  type: 'general' | 'door' | 'parking' | 'lobby' | 'restricted';
  status: 'online' | 'offline' | 'maintenance';
  gridPosition: { row: number; col: number };
  facesDetected: number;
  lastMotion: string;
  streamUrl?: string;
  /** Admin-controlled enable/disable — a disabled camera stays detected but stops streaming & recognizing */
  enabled?: boolean;
  /** When the camera was last disabled (ISO timestamp) */
  disabledAt?: string | null;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  faceEnrolled: boolean;
  enrollmentDate?: string;
  enrollmentToken?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  timestamp: string;
  cameraId: string;
  cameraName: string;
  confidence: number;
  type: 'entry' | 'exit';
}

export interface EnrollmentLink {
  id: string;
  token: string;
  email: string;
  name: string;
  department: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  /** Number of times this link has been consumed (enrollment completed) */
  useCount: number;
  /** Max allowed uses before the link is permanently locked */
  maxUses: number;
}

export interface SecurityAlert {
  id: string;
  type: 'unauthorized' | 'motion' | 'camera_offline' | 'face_detected';
  message: string;
  timestamp: string;
  cameraId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface FaceDetection {
  box: { x: number; y: number; width: number; height: number };
  descriptor: Float32Array;
  score: number;
  employeeId?: string;    // matched employee, if any
  employeeName?: string;
}
