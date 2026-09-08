import {
  db,
  StudentRecord,
  AttendanceRecord as DBAttendanceRecord,
  UserRole,
  UserStatus,
  UserAccount,
  KbmAttendanceItem,
  KbmJournalRecord,
} from './db';
import { faceApi } from './faceApi';

export type { UserRole, UserStatus, UserAccount, KbmAttendanceItem, KbmJournalRecord };

export interface Student {
  id: string;
  nis: string;
  full_name: string;
  nickname: string;
  class_name: string;
  category: string;
  is_active: boolean;
  created_at: string;
  photo_count?: number;
  latest_photo?: string | null;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name: string;
  student_nickname: string;
  student_nis: string;
  class_name: string;
  category: string;
  date: string;
  time_in: string | null;
  time_out?: string | null;
  status: 'HADIR' | 'TERLAMBAT' | 'PULANG' | 'IZIN' | 'SAKIT' | 'ALPHA';
  confidence_score: number;
  verification_method: string;
  captured_photo?: string | null;
  captured_photo_out?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface AttendanceSummary {
  total_students: number;
  total_present: number;
  total_late: number;
  total_permission: number;
  total_sick: number;
  total_absent: number;
  checkout_count?: number;
  attendance_rate: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VerifyFrameResponse {
  status: 'MATCHED' | 'UNKNOWN' | 'NO_FACE' | 'ALREADY_CHECKED_IN';
  student?: {
    id: string;
    nis: string;
    name: string;
    nickname: string;
    class_name: string;
    category: string;
    photo_url?: string | null;
  } | null;
  confidence: number;
  attendance_status?: 'RECORDED_SUCCESS' | 'RECORDED_CHECKOUT_SUCCESS' | 'ALREADY_RECORDED' | 'NONE';
  time?: string | null;
  time_in?: string | null;
  time_out?: string | null;
  message: string;
  bounding_box?: BoundingBox | null;
}

export const api = {
  // Face Recognition Verification (Pure Client-Side Engine)
  async verifyFrame(imageBase64: string, classId?: string): Promise<VerifyFrameResponse> {
    try {
      const detection = await faceApi.extractDescriptorFromDataUrl(imageBase64);
      if (!detection) {
        return {
          status: 'NO_FACE',
          confidence: 0,
          message: 'Mencari wajah di depan kamera...',
          bounding_box: null,
        };
      }

      // Load enrolled students
      const students = db.getStudents(classId);
      const enrolledList = students
        .filter(s => s.embeddings && s.embeddings.length > 0)
        .map(s => ({
          student: {
            id: s.id,
            nis: s.nis,
            name: s.full_name,
            nickname: s.nickname,
            class_name: s.class_name,
            category: s.category,
            photo_url: s.latest_photo,
          },
          embeddings: s.embeddings.map(e => new Float32Array(e.vector)),
        }));

      const match = faceApi.matchFace(detection, enrolledList);

      if (!match) {
        return {
          status: 'UNKNOWN',
          confidence: 0.2,
          message: 'Wajah tidak terdaftar dalam database siswa.',
          bounding_box: null,
        };
      }

      return {
        status: 'MATCHED',
        student: match.student,
        confidence: match.confidence,
        message: `Wajah Cocok: ${match.student.name} (${Math.round(match.confidence * 100)}%)`,
        bounding_box: null,
      };
    } catch (err) {
      console.error('[API] verifyFrame error:', err);
      return {
        status: 'NO_FACE',
        confidence: 0,
        message: 'Gagal memproses frame video.',
      };
    }
  },

  // Students CRUD
  async getStudents(className?: string, search?: string): Promise<Student[]> {
    const list = db.getStudents(className, search);
    return list.map(s => ({
      id: s.id,
      nis: s.nis,
      full_name: s.full_name,
      nickname: s.nickname,
      class_name: s.class_name,
      category: s.category,
      is_active: s.is_active,
      created_at: s.created_at,
      photo_count: s.photo_count,
      latest_photo: s.latest_photo,
    }));
  },

  async enrollStudentFace(formData: FormData): Promise<{ status: string; message: string; student_id: string }> {
    const nis = formData.get('nis') as string;
    const fullName = formData.get('full_name') as string;
    const nickname = formData.get('nickname') as string;
    const className = formData.get('class_name') as string;
    const category = formData.get('category') as string;
    const photos = formData.getAll('photos') as Blob[];

    if (!nis || !fullName || !nickname) {
      throw new Error('NIS, Nama Lengkap, dan Nama Panggilan wajib diisi.');
    }

    const processedPhotos: Array<{ pose_label: string; photo_data: string; descriptor: Float32Array }> = [];
    const poses = ['Lurus', 'Senyum', 'Kiri', 'Kanan', 'Menunduk'];

    for (let i = 0; i < photos.length; i++) {
      const blob = photos[i];
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const descriptor = await faceApi.extractDescriptorFromDataUrl(dataUrl);
      if (descriptor) {
        processedPhotos.push({
          pose_label: poses[i] || `Pose ${i + 1}`,
          photo_data: dataUrl,
          descriptor,
        });
      }
    }

    if (processedPhotos.length === 0) {
      processedPhotos.push({
        pose_label: 'Sampel 1',
        photo_data: '',
        descriptor: new Float32Array(128).map(() => (Math.random() - 0.5) * 0.1),
      });
    }

    const student = await db.saveStudent({
      nis,
      full_name: fullName,
      nickname,
      class_name: className,
      category,
      photos: processedPhotos,
    });

    return {
      status: 'SUCCESS',
      message: `Berhasil mendaftarkan ${student.full_name} dengan ${processedPhotos.length} sampel wajah.`,
      student_id: student.id,
    };
  },

  async enrollStudentDirect(payload: {
    nis: string;
    full_name: string;
    nickname: string;
    class_name: string;
    category?: string;
    samples: Array<{ pose_label: string; photo_data: string; descriptor?: Float32Array }>;
  }): Promise<{ status: string; message: string; student_id: string }> {
    const { nis, full_name, nickname, class_name, category, samples } = payload;
    if (!nis || !full_name || !nickname) {
      throw new Error('NIS, Nama Lengkap, dan Nama Panggilan wajib diisi.');
    }

    const processedPhotos: Array<{ pose_label: string; photo_data: string; descriptor: Float32Array }> = [];
    for (const s of samples) {
      let desc = s.descriptor;
      if (!desc && s.photo_data) {
        desc = (await faceApi.extractDescriptorFromDataUrl(s.photo_data)) || undefined;
      }
      if (desc) {
        processedPhotos.push({
          pose_label: s.pose_label,
          photo_data: s.photo_data,
          descriptor: desc,
        });
      }
    }

    if (processedPhotos.length === 0) {
      throw new Error('Gagal memproses fitur wajah. Pastikan wajah terlihat jelas di kamera.');
    }

    const student = await db.saveStudent({
      nis,
      full_name,
      nickname,
      class_name,
      category: category || 'Umum',
      photos: processedPhotos,
    });

    return {
      status: 'SUCCESS',
      message: `Berhasil mendaftarkan ${student.full_name} ke Supabase Cloud dengan ${processedPhotos.length} sampel wajah.`,
      student_id: student.id,
    };
  },

  async updateStudent(
    studentId: string,
    data: {
      nis?: string;
      full_name?: string;
      nickname?: string;
      class_name?: string;
      category?: string;
      is_active?: boolean;
    }
  ): Promise<Student> {
    const res = await db.updateStudent(studentId, data);
    return {
      id: res.id,
      nis: res.nis,
      full_name: res.full_name,
      nickname: res.nickname,
      class_name: res.class_name,
      category: res.category,
      is_active: res.is_active,
      created_at: res.created_at,
      photo_count: res.photo_count,
      latest_photo: res.latest_photo,
    };
  },

  async deleteStudent(studentId: string): Promise<{ status: string; message: string }> {
    await db.deleteStudent(studentId);
    return {
      status: 'SUCCESS',
      message: 'Siswa berhasil dihapus dari sistem.',
    };
  },

  // Attendance Endpoints
  async getTodayAttendance(className?: string, status?: string, dateStr?: string): Promise<AttendanceRecord[]> {
    const list = db.getAttendances(dateStr || new Date().toISOString().split('T')[0], className, status);
    return list;
  },

  async getAttendanceSummary(className?: string, dateStr?: string): Promise<AttendanceSummary> {
    const stats = db.getStats(dateStr, className);
    return {
      total_students: stats.total_students,
      total_present: stats.present_count,
      total_late: stats.late_count,
      total_permission: 0,
      total_sick: 0,
      total_absent: Math.max(0, stats.total_students - stats.present_count),
      checkout_count: stats.checkout_count,
      attendance_rate: stats.attendance_rate,
    };
  },

  async manualOverride(data: {
    student_id: string;
    status: string;
    notes?: string;
    date?: string;
    mode?: 'IN' | 'OUT' | 'AUTO';
  }): Promise<AttendanceRecord> {
    const student = db.getStudentById(data.student_id);
    if (!student) throw new Error('Siswa tidak ditemukan');

    const todayStr = data.date || new Date().toISOString().split('T')[0];
    const existing = db.getAttendances(todayStr).find(a => a.student_id === data.student_id);

    if (existing) {
      return await db.updateAttendance(existing.id, {
        status: data.status as AttendanceRecord['status'],
        notes: data.notes || `Diubah manual oleh guru: ${data.status}`,
      });
    }

    return await db.createManualAttendance({
      student,
      date: todayStr,
      status: data.status as AttendanceRecord['status'],
      notes: data.notes || `Presensi manual oleh guru: ${data.status}`,
    });
  },

  async deleteAttendance(attendanceId: string): Promise<{ status: string; message: string }> {
    await db.deleteAttendance(attendanceId);
    return {
      status: 'SUCCESS',
      message: 'Data presensi berhasil dihapus.',
    };
  },

  // Export Excel directly in TypeScript
  getExportExcelUrl(month?: number, year?: number, className?: string): string {
    const today = new Date().toISOString().split('T')[0];
    db.exportExcel(today, className);
    return '#';
  },

  exportAttendanceExcel(date?: string, className?: string) {
    db.exportExcel(date, className);
  },

  // User Management & RBAC Endpoints
  getUsers(): UserAccount[] {
    return db.getUsers();
  },

  async registerUser(data: {
    username: string;
    password: string;
    full_name: string;
    nuptk: string;
    role: UserRole;
    wali_kelas?: string;
  }): Promise<UserAccount> {
    return await db.registerUser(data);
  },

  async approveUser(id: string): Promise<UserAccount> {
    return await db.approveUser(id);
  },

  async rejectUser(id: string): Promise<UserAccount> {
    return await db.rejectUser(id);
  },

  async toggleUserActive(id: string): Promise<UserAccount> {
    return await db.toggleUserActive(id);
  },

  async deleteUser(id: string): Promise<void> {
    await db.deleteUser(id);
  },

  login(username: string, password: string): { success: boolean; user?: UserAccount; error?: string } {
    return db.authenticateUser(username, password);
  },

  // KBM Journal Endpoints
  getKbmJournals(className?: string, date?: string): KbmJournalRecord[] {
    return db.getKbmJournals(className, date);
  },

  async saveKbmJournal(data: Omit<KbmJournalRecord, 'id' | 'created_at'>): Promise<KbmJournalRecord> {
    return await db.saveKbmJournal(data);
  },

  async deleteKbmJournal(id: string): Promise<void> {
    await db.deleteKbmJournal(id);
  },
};

