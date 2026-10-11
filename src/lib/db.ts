import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { Employee, AttendanceRecord, EnrollmentLink } from '../types';

const DB_NAME = 'securevision-db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('employees')) {
          const s = db.createObjectStore('employees', { keyPath: 'id' });
          s.createIndex('by-email', 'email', { unique: false });
        }
        if (!db.objectStoreNames.contains('attendance')) {
          const s = db.createObjectStore('attendance', { keyPath: 'id' });
          s.createIndex('by-timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains('links')) {
          const s = db.createObjectStore('links', { keyPath: 'id' });
          s.createIndex('by-token', 'token', { unique: true });
        }
        if (!db.objectStoreNames.contains('auth')) {
          db.createObjectStore('auth', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// ── Employees ─────────────────────────────────────────────
export async function saveEmployee(emp: Employee) {
  const db = await getDB();
  await db.put('employees', emp);
}
export async function getAllEmployees(): Promise<Employee[]> {
  const db = await getDB();
  return db.getAll('employees');
}
export async function deleteEmployee(id: string) {
  const db = await getDB();
  await db.delete('employees', id);
}
export async function findEmployeeByEmail(email: string): Promise<Employee | undefined> {
  const db = await getDB();
  return db.getFromIndex('employees', 'by-email', email);
}

// ── Attendance ────────────────────────────────────────────
export async function saveAttendance(rec: AttendanceRecord) {
  const db = await getDB();
  await db.put('attendance', rec);
}
export async function getAllAttendance(): Promise<AttendanceRecord[]> {
  const db = await getDB();
  const all = await db.getAll('attendance');
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
export async function clearAttendance() {
  const db = await getDB();
  await db.clear('attendance');
}

// ── Enrollment links ──────────────────────────────────────
export async function saveLink(link: EnrollmentLink) {
  const db = await getDB();
  await db.put('links', link);
}
export async function getLinkByToken(token: string): Promise<EnrollmentLink | undefined> {
  const db = await getDB();
  return db.getFromIndex('links', 'by-token', token);
}
export async function getAllLinks(): Promise<EnrollmentLink[]> {
  const db = await getDB();
  return db.getAll('links');
}
export async function updateLink(link: EnrollmentLink) {
  const db = await getDB();
  await db.put('links', link);
}

// ── Wipe everything (dev helper) ──────────────────────────
export async function wipeAll() {
  const db = await getDB();
  await db.clear('employees');
  await db.clear('attendance');
  await db.clear('links');
}
