import { create } from 'zustand';
import type { Camera, Employee, AttendanceRecord, EnrollmentLink, SecurityAlert } from '../types';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../lib/db';

interface AppState {
  cameras: Camera[];
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  enrollmentLinks: EnrollmentLink[];
  alerts: SecurityAlert[];
  selectedCamera: string | null;
  activeView: 'dashboard' | 'cameras' | 'enrollment' | 'attendance' | 'admin' | 'settings';
  hydrated: boolean;

  setActiveView: (view: AppState['activeView']) => void;
  setSelectedCamera: (id: string | null) => void;

  hydrate: () => Promise<void>;
  hydrateCameras: () => Promise<void>;

  addCamera: (camera: Omit<Camera, 'id'>) => void;
  removeCamera: (id: string) => void;
  updateCamera: (id: string, updates: Partial<Camera>) => void;
  setCameraEnabled: (id: string, enabled: boolean) => void;

  addEmployee: (employee: Omit<Employee, 'id'>) => Promise<Employee>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>;
  enrollEmployeeFace: (id: string, descriptors: number[][]) => Promise<void>;

  createEnrollmentLink: (
    email: string,
    name: string,
    department: string
  ) => Promise<EnrollmentLink>;
  consumeEnrollmentLink: (token: string, subjectId: string) => Promise<Employee | null>;

  addAttendanceRecord: (record: Omit<AttendanceRecord, 'id'>) => Promise<void>;
  clearAttendance: () => Promise<void>;

  addAlert: (alert: Omit<SecurityAlert, 'id'>) => void;
  dismissAlert: (id: string) => void;
}

// Cameras are populated dynamically from detected devices on app boot.
// See hydrateCameras() below.
const initialCameras: Camera[] = [];

const initialAlerts: SecurityAlert[] = [];

export const useStore = create<AppState>((set, get) => ({
  cameras: initialCameras,
  employees: [],
  attendanceRecords: [],
  enrollmentLinks: [],
  alerts: initialAlerts,
  selectedCamera: null,
  activeView: 'dashboard',
  hydrated: false,

  setActiveView: (view) => set({ activeView: view }),
  setSelectedCamera: (id) => set({ selectedCamera: id }),

  hydrate: async () => {
    const [employees, attendanceRecords, enrollmentLinks] = await Promise.all([
      db.getAllEmployees(),
      db.getAllAttendance(),
      db.getAllLinks(),
    ]);
    set({ employees, attendanceRecords, enrollmentLinks, hydrated: true });
  },

  hydrateCameras: async () => {
    // Ask the browser for video input devices
    let devices: MediaDeviceInfo[] = [];
    try {
      // Request permission once to unlock device labels
      const temp = await navigator.mediaDevices.getUserMedia({ video: true });
      temp.getTracks().forEach((t) => t.stop());
      const all = await navigator.mediaDevices.enumerateDevices();
      devices = all.filter((d) => d.kind === 'videoinput');
    } catch {
      // no camera access
    }

    const existing = get().cameras;
    // Reuse user-customized names/locations by matching device index
    // Load admin disable state
    let disabled: string[] = [];
    try {
      disabled = JSON.parse(localStorage.getItem('sv-disabled-cameras') || '[]');
    } catch { /* ignore */ }

    const built: Camera[] = devices.map((d, i) => {
      const prev = existing[i];
      const id = `cam-${i + 1}`;
      const isEnabled = !disabled.includes(id);
      return {
        id,
        name: prev?.name ?? `Camera ${i + 1}`,
        location: prev?.location ?? (d.label || `Device ${i + 1}`),
        type: prev?.type ?? 'general',
        status: isEnabled ? 'online' : 'offline',
        gridPosition: { row: Math.floor(i / 3), col: i % 3 },
        facesDetected: 0,
        lastMotion: 'Just now',
        enabled: isEnabled,
        disabledAt: isEnabled ? null : prev?.disabledAt ?? null,
      };
    });

    set({ cameras: built });
  },

  addCamera: (camera) =>
    set((state) => ({ cameras: [...state.cameras, { ...camera, id: uuidv4() }] })),
  removeCamera: (id) =>
    set((state) => ({ cameras: state.cameras.filter((c) => c.id !== id) })),
  updateCamera: (id, updates) =>
    set((state) => ({
      cameras: state.cameras.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  setCameraEnabled: (id, enabled) =>
    set((state) => {
      // Persist the toggle in localStorage so it survives reloads
      const disabledKey = 'sv-disabled-cameras';
      let disabled: string[] = [];
      try {
        disabled = JSON.parse(localStorage.getItem(disabledKey) || '[]');
      } catch { /* ignore */ }
      if (enabled) {
        disabled = disabled.filter((x) => x !== id);
      } else {
        if (!disabled.includes(id)) disabled.push(id);
      }
      localStorage.setItem(disabledKey, JSON.stringify(disabled));

      return {
        cameras: state.cameras.map((c) =>
          c.id === id
            ? { ...c, enabled, disabledAt: enabled ? null : new Date().toISOString() }
            : c
        ),
      };
    }),

  addEmployee: async (employee) => {
    const full: Employee = { ...employee, id: uuidv4() };
    await db.saveEmployee(full);
    set((state) => ({ employees: [...state.employees, full] }));
    return full;
  },

  updateEmployee: async (id, updates) => {
    const emp = get().employees.find((e) => e.id === id);
    if (!emp) return;
    const updated = { ...emp, ...updates };
    await db.saveEmployee(updated);
    set((state) => ({
      employees: state.employees.map((e) => (e.id === id ? updated : e)),
    }));
  },

  enrollEmployeeFace: async (id, descriptors) => {
    const emp = get().employees.find((e) => e.id === id);
    if (!emp) return;
    const updated: Employee = {
      ...emp,
      faceEnrolled: true,
      faceDescriptors: descriptors,
      enrollmentDate: new Date().toISOString(),
    };
    await db.saveEmployee(updated);
    set((state) => ({
      employees: state.employees.map((e) => (e.id === id ? updated : e)),
    }));
  },

  createEnrollmentLink: async (email, name, department) => {
    const token = uuidv4().replace(/-/g, '').slice(0, 16);
    const link: EnrollmentLink = {
      id: uuidv4(),
      token,
      email,
      name,
      department,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      used: false,
      useCount: 0,
      maxUses: 1,
    };
    await db.saveLink(link);
    set((state) => ({ enrollmentLinks: [...state.enrollmentLinks, link] }));
    return link;
  },

  consumeEnrollmentLink: async (token, subjectId) => {
    const link = await db.getLinkByToken(token);
    if (!link) {
      console.warn('[store] consumeEnrollmentLink: link not found');
      return null;
    }
    if (new Date(link.expiresAt) < new Date()) {
      console.warn('[store] consumeEnrollmentLink: link expired');
      return null;
    }

    const maxAllowed = link.maxUses ?? 1;
    const currentCount = link.useCount ?? 0;

    // Reject if already at cap OR explicitly marked used
    if (link.used || currentCount >= maxAllowed) {
      // Ensure DB reflects the terminal state
      if (!link.used) {
        await db.updateLink({ ...link, used: true });
      }
      console.warn('[store] consumeEnrollmentLink: max uses reached');
      return null;
    }

    const newCount = currentCount + 1;
    const hitCap = newCount >= maxAllowed;

    // Save the employee
    const employee: Employee = {
      id: subjectId,
      name: link.name,
      email: link.email,
      department: link.department,
      faceEnrolled: true,
      enrollmentDate: new Date().toISOString(),
      enrollmentToken: token,
    };
    await db.saveEmployee(employee);

    // Update the link atomically
    const updatedLink: EnrollmentLink = {
      ...link,
      useCount: newCount,
      used: hitCap,
    };
    await db.updateLink(updatedLink);

    set((state) => ({
      employees: [...state.employees, employee],
      enrollmentLinks: state.enrollmentLinks.map((l) =>
        l.id === link.id ? updatedLink : l
      ),
    }));
    return employee;
  },

  addAttendanceRecord: async (record) => {
    const full: AttendanceRecord = { ...record, id: uuidv4() };
    await db.saveAttendance(full);
    set((state) => ({
      attendanceRecords: [full, ...state.attendanceRecords],
    }));
  },

  clearAttendance: async () => {
    await db.clearAttendance();
    set({ attendanceRecords: [] });
  },

  addAlert: (alert) =>
    set((state) => ({
      alerts: [{ ...alert, id: uuidv4() }, ...state.alerts],
    })),
  dismissAlert: (id) =>
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),
}));
