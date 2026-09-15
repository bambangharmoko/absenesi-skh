import {
  db,
  StudentRecord,
  AttendanceRecord as DBAttendanceRecord,
  UserRole,
  UserStatus,
  UserAccount,
  KbmAttendanceItem,
  KbmJournalRecord,
  ClassGrade,
  RoomItem,
  ClassRoomCombination,
} from './db';
import { faceApi } from './faceApi';

export type {
  UserRole,
  UserStatus,
  UserAccount,
  KbmAttendanceItem,
  KbmJournalRecord,
  ClassGrade,
  RoomItem,
  ClassRoomCombination,
};

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
  // Face Recognition Verification (Pure Client-Side Engine with Advanced Biometrics)
  async verifyFrame(imageBase64: string, classId?: string): Promise<VerifyFrameResponse> {
    try {
      const extractResult = await faceApi.extractDescriptorFromDataUrl(imageBase64, {
        checkQuality: true,
      });

      if (!extractResult) {
        return {
          status: 'NO_FACE',
          confidence: 0,
          message: 'Mencari wajah di depan kamera...',
          bounding_box: null,
        };
      }

      // If face quality is compromised (too blurry, too dark, or too small), reject early
      if (extractResult.quality && !extractResult.quality.isValid) {
        return {
          status: 'UNKNOWN',
          confidence: 0.15,
          message: extractResult.quality.reason || 'Kualitas gambar wajah kurang tajam / kurang pencahayaan.',
          bounding_box: null,
        };
      }

      const detection = extractResult.descriptor;

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
          centroid: s.embeddings.length > 1
            ? faceApi.computeCentroid(s.embeddings.map(e => new Float32Array(e.vector)))
            : undefined,
        }));

      // Advanced matching with strict thresholds (maxDistance: 0.42, minSimilarity: 0.88, minMargin: 0.10)
      const matchRes = faceApi.matchFaceAdvanced(detection, enrolledList, {
        maxDistance: 0.42,
        minSimilarity: 0.88,
        minMargin: 0.10,
        grayAreaDistance: 0.48,
      });

      if (matchRes.status !== 'MATCHED' || !matchRes.student) {
        return {
          status: 'UNKNOWN',
          confidence: matchRes.confidence,
          message: matchRes.message,
          bounding_box: null,
        };
      }

      return {
        status: 'MATCHED',
        student: matchRes.student,
        confidence: matchRes.confidence,
        message: matchRes.message,
        bounding_box: null,
      };
    } catch (err) {
      console.error('[API] verifyFrame error:', err);
      return {
        status: 'NO_FACE',
        confidence: 0,
        message: 'Gagal menganalisis frame kamera.',
        bounding_box: null,
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

    if (photos.length < 3) {
      throw new Error('Pendaftaran biometrik memerlukan minimal 3 foto wajah dari sudut berbeda (Depan, Kiri, Kanan).');
    }

    const processedPhotos: Array<{ pose_label: string; photo_data: string; descriptor: Float32Array }> = [];
    const poses = ['Tampak Depan', 'Miring Kiri', 'Miring Kanan', 'Senyum/Netral', 'Menunduk/Mendongak'];

    for (let i = 0; i < photos.length; i++) {
      const blob = photos[i];
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const extracted = await faceApi.extractDescriptorFromDataUrl(dataUrl, { checkQuality: true });
      if (extracted) {
        if (extracted.quality && !extracted.quality.isValid) {
          throw new Error(`Foto ke-${i + 1} (${poses[i] || 'Pose'}): ${extracted.quality.reason}`);
        }
        processedPhotos.push({
          pose_label: poses[i] || `Pose ${i + 1}`,
          photo_data: dataUrl,
          descriptor: faceApi.normalizeDescriptor(extracted.descriptor),
        });
      }
    }

    if (processedPhotos.length < 3) {
      throw new Error(`Hanya ${processedPhotos.length} foto valid yang terdeteksi. Minimal 3 foto wajah berkualitas tinggi diperlukan.`);
    }

    // Compute centroid vector from all valid samples
    const centroidDesc = new Float32Array(128);
    for (const p of processedPhotos) {
      for (let j = 0; j < 128; j++) {
        centroidDesc[j] += p.descriptor[j];
      }
    }
    const normalizedCentroid = faceApi.normalizeDescriptor(
      centroidDesc.map((v) => v / processedPhotos.length)
    );

    processedPhotos.push({
      pose_label: 'Centroid (Rata-rata Multi-Sample)',
      photo_data: processedPhotos[0].photo_data,
      descriptor: normalizedCentroid,
    });

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
      message: `Berhasil mendaftarkan ${student.full_name} dengan ${processedPhotos.length - 1} pose + 1 centroid vector.`,
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

    if (!samples || samples.length < 3) {
      throw new Error('Pendaftaran biometrik memerlukan minimal 3 sampel pose wajah (Tampak Depan, Miring Kiri, Miring Kanan) untuk akurasi tinggi.');
    }

    const processedPhotos: Array<{ pose_label: string; photo_data: string; descriptor: Float32Array }> = [];
    for (const s of samples) {
      let desc = s.descriptor;
      if (!desc && s.photo_data) {
        const extracted = await faceApi.extractDescriptorFromDataUrl(s.photo_data, { checkQuality: true });
        if (extracted) {
          if (extracted.quality && !extracted.quality.isValid) {
            throw new Error(`Sampel pose ${s.pose_label} ditolak: ${extracted.quality.reason}`);
          }
          desc = extracted.descriptor;
        }
      }
      if (desc) {
        processedPhotos.push({
          pose_label: s.pose_label,
          photo_data: s.photo_data,
          descriptor: faceApi.normalizeDescriptor(desc),
        });
      }
    }

    if (processedPhotos.length < 3) {
      throw new Error(`Hanya ${processedPhotos.length} sampel wajah valid yang berhasil diekstraksi. Minimal 3 pose wajah berkualitas tinggi diperlukan.`);
    }

    // Compute normalized centroid vector across all multi-angle samples
    const centroidDesc = new Float32Array(128);
    for (const p of processedPhotos) {
      for (let j = 0; j < 128; j++) {
        centroidDesc[j] += p.descriptor[j];
      }
    }
    const normalizedCentroid = faceApi.normalizeDescriptor(
      centroidDesc.map((v) => v / processedPhotos.length)
    );

    processedPhotos.push({
      pose_label: 'Centroid (Rata-rata Multi-Sample)',
      photo_data: processedPhotos[0].photo_data,
      descriptor: normalizedCentroid,
    });

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
      message: `Berhasil mendaftarkan ${student.full_name} ke Supabase Cloud dengan ${processedPhotos.length - 1} pose + 1 centroid biometrik.`,
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
  getAttendances(date?: string, className?: string, status?: string): AttendanceRecord[] {
    return db.getAttendances(date, className, status);
  },

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

  exportKbmJournalExcel(date?: string, className?: string) {
    db.exportKbmJournalExcel(date, className);
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
    email?: string;
    wali_kelas?: string;
    is_verified_otp?: boolean;
  }): Promise<UserAccount> {
    return await db.registerUser(data);
  },

  async updateUserProfile(
    userId: string,
    data: {
      full_name?: string;
      nuptk?: string;
      wali_kelas?: string;
      password?: string;
    }
  ): Promise<UserAccount> {
    return await db.updateUserProfile(userId, data);
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

  async login(username: string, password: string): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    return await db.authenticateUserAsync(username, password);
  },

  async requestWaliKelas(userId: string, className: string): Promise<UserAccount> {
    return await db.requestWaliKelas(userId, className);
  },

  async approveWaliKelas(userId: string, className: string): Promise<UserAccount> {
    return await db.approveWaliKelas(userId, className);
  },

  async rejectWaliKelas(userId: string): Promise<UserAccount> {
    return await db.rejectWaliKelas(userId);
  },

  async syncUsers(): Promise<boolean> {
    return await db.syncUsersFromSupabase();
  },

  async syncClassRooms(): Promise<boolean> {
    return await db.syncClassRoomsFromSupabase();
  },

  async syncKbmJournals(): Promise<boolean> {
    return await db.syncKbmJournalsFromSupabase();
  },

  // KBM Journal Endpoints
  getKbmJournals(className?: string, date?: string): KbmJournalRecord[] {
    return db.getKbmJournals(className, date);
  },

  async saveKbmJournal(data: {
    class_name: string;
    teacher_id: string;
    teacher_name: string;
    start_time: string;
    end_time: string;
    meeting_topic: string;
    notes?: string;
    attendances: KbmAttendanceItem[];
  }): Promise<KbmJournalRecord> {
    return await db.saveKbmJournal(data);
  },

  async deleteKbmJournal(id: string): Promise<void> {
    await db.deleteKbmJournal(id);
  },

  // Kelola Kelas & Ruangan Endpoints
  getClassGrades(): ClassGrade[] {
    return db.getClassGrades();
  },

  async addClassGrade(name: string): Promise<ClassGrade> {
    return await db.addClassGrade(name);
  },

  async deleteClassGrade(id: string): Promise<void> {
    await db.deleteClassGrade(id);
  },

  getRooms(): RoomItem[] {
    return db.getRooms();
  },

  async addRoom(name: string): Promise<RoomItem> {
    return await db.addRoom(name);
  },

  async deleteRoom(id: string): Promise<void> {
    await db.deleteRoom(id);
  },

  getClassRooms(activeOnly?: boolean): ClassRoomCombination[] {
    return db.getClassRooms(activeOnly);
  },

  async addClassRoom(gradeId: string, roomId: string): Promise<ClassRoomCombination> {
    return await db.addClassRoom(gradeId, roomId);
  },

  async toggleClassRoomActive(id: string): Promise<ClassRoomCombination> {
    return await db.toggleClassRoomActive(id);
  },

  async deleteClassRoom(id: string): Promise<void> {
    await db.deleteClassRoom(id);
  },

  async updateClassOperationalHours(classRoomIds: string[], timeIn: string, timeOut: string): Promise<void> {
    await db.updateClassOperationalHours(classRoomIds, timeIn, timeOut);
  },
};


