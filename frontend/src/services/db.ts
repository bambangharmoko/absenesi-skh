import { supabase, isSupabaseConfigured } from './supabase';
import * as XLSX from 'xlsx';

export interface StudentRecord {
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
  embeddings: Array<{
    id: string;
    pose_label: string;
    photo_data: string;
    vector: number[];
  }>;
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

export type UserRole = 'ADMIN' | 'GURU' | 'KEPALA_SEKOLAH';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  full_name: string;
  nuptk: string;
  role: UserRole;
  status: UserStatus;
  email?: string;
  wali_kelas?: string;
  is_active: boolean;
  created_at: string;
}

export interface ClassGrade {
  id: string;
  name: string;
  created_at: string;
}

export interface RoomItem {
  id: string;
  name: string;
  created_at: string;
}

export interface ClassRoomCombination {
  id: string;
  grade_id: string;
  grade_name: string;
  room_id: string;
  room_name: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

export interface KbmAttendanceItem {
  student_id: string;
  student_name: string;
  nis: string;
  status: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPHA';
  notes?: string;
}

export interface KbmJournalRecord {
  id: string;
  date: string;
  time_slot: string;
  subject: string;
  class_name: string;
  teacher_id: string;
  teacher_name: string;
  meeting_topic: string;
  attendances: KbmAttendanceItem[];
  created_at: string;
}

class DatabaseService {
  private studentsKey = 'skh_students_v3';
  private attendancesKey = 'skh_attendances_v3';
  private usersKey = 'skh_users_v1';
  private kbmJournalsKey = 'skh_kbm_journals_v1';
  private classGradesKey = 'skh_class_grades_v1';
  private roomsKey = 'skh_rooms_v1';
  private classRoomsKey = 'skh_class_rooms_v1';
  private isSubscribedToRealtime = false;

  constructor() {
    this.initDatabase();
    this.syncFromSupabase();
    this.setupRealtimeSubscription();
  }

  private initDatabase() {
    const previousKeys = ['skh_students_v2', 'skh_students_v1', 'skh_students'];
    let existingList: StudentRecord[] = [];

    for (const key of previousKeys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            existingList = parsed;
            break;
          }
        } catch (e) {}
      }
    }

    // Clean any old dummy test students
    existingList = existingList.filter(
      s =>
        s.nis !== 'SKH-TEST-001' &&
        s.nis !== 'SKH-2026-TEST-999' &&
        !s.full_name.includes('Test Student') &&
        !s.full_name.includes('Ahmad Fauzi')
    );

    const currentRaw = localStorage.getItem(this.studentsKey);
    if (!currentRaw) {
      localStorage.setItem(this.studentsKey, JSON.stringify(existingList));
    } else {
      try {
        let currentList: StudentRecord[] = JSON.parse(currentRaw);
        currentList = currentList.filter(
          s =>
            s.nis !== 'SKH-TEST-001' &&
            s.nis !== 'SKH-2026-TEST-999' &&
            !s.full_name.includes('Test Student') &&
            !s.full_name.includes('Ahmad Fauzi')
        );
        localStorage.setItem(this.studentsKey, JSON.stringify(currentList));
      } catch (e) {}
    }

    // PURGE ORPHAN ATTENDANCE RECORDS (belonging to non-existent students)
    this.purgeOrphanAttendances();

    // Initialize seed classes, rooms, and combinations
    this.initSeedClasses();

    // Purge any demo accounts to ensure clean production database
    this.purgeDemoUsers();
  }

  private initSeedClasses() {
    // 1. Seed Class Grades if empty
    const rawGrades = localStorage.getItem(this.classGradesKey);
    let gradesList: ClassGrade[] = [];
    if (rawGrades) {
      try {
        gradesList = JSON.parse(rawGrades);
      } catch {}
    }
    if (gradesList.length === 0) {
      const defaultGrades = [
        'Kelas TK A',
        'Kelas TK B',
        'Kelas 1 Autis',
        'Kelas 2 Tunarungu',
        'Kelas 3 Tunagrahita',
      ];
      gradesList = defaultGrades.map((name, i) => ({
        id: `grade-${i + 1}`,
        name,
        created_at: new Date().toISOString(),
      }));
      localStorage.setItem(this.classGradesKey, JSON.stringify(gradesList));
    }

    // 2. Seed Rooms if empty
    const rawRooms = localStorage.getItem(this.roomsKey);
    let roomsList: RoomItem[] = [];
    if (rawRooms) {
      try {
        roomsList = JSON.parse(rawRooms);
      } catch {}
    }
    if (roomsList.length === 0) {
      const defaultRooms = [
        'Kelas Cemerlang',
        'Kelas Ceria',
        'Ruang Anggrek',
        'Ruang Melati',
        'Ruang Dahlia',
      ];
      roomsList = defaultRooms.map((name, i) => ({
        id: `room-${i + 1}`,
        name,
        created_at: new Date().toISOString(),
      }));
      localStorage.setItem(this.roomsKey, JSON.stringify(roomsList));
    }

    // 3. Seed Combinations if empty
    const rawCombinations = localStorage.getItem(this.classRoomsKey);
    let combinationsList: ClassRoomCombination[] = [];
    if (rawCombinations) {
      try {
        combinationsList = JSON.parse(rawCombinations);
      } catch {}
    }
    if (combinationsList.length === 0) {
      const defaultPairs = [
        { gradeName: 'Kelas TK A', roomName: 'Kelas Cemerlang' },
        { gradeName: 'Kelas TK B', roomName: 'Kelas Ceria' },
        { gradeName: 'Kelas 1 Autis', roomName: 'Ruang Anggrek' },
        { gradeName: 'Kelas 2 Tunarungu', roomName: 'Ruang Melati' },
        { gradeName: 'Kelas 3 Tunagrahita', roomName: 'Ruang Dahlia' },
      ];
      combinationsList = defaultPairs.map((p, idx) => {
        const grade = gradesList.find(g => g.name === p.gradeName) || gradesList[idx % gradesList.length];
        const room = roomsList.find(r => r.name === p.roomName) || roomsList[idx % roomsList.length];
        return {
          id: `cr-${idx + 1}`,
          grade_id: grade.id,
          grade_name: grade.name,
          room_id: room.id,
          room_name: room.name,
          display_name: `${grade.name} - ${room.name}`,
          is_active: true,
          created_at: new Date().toISOString(),
        };
      });
      localStorage.setItem(this.classRoomsKey, JSON.stringify(combinationsList));
    }
  }

  private purgeDemoUsers() {
    const rawUsers = localStorage.getItem(this.usersKey);
    if (!rawUsers) return;
    try {
      let usersList: UserAccount[] = JSON.parse(rawUsers);
      const demoUsernames = new Set(['kepsek', 'guru1', 'admin1', 'kepsek_demo']);
      const demoIds = new Set(['user-kepsek-01', 'user-guru-01', 'user-admin-01']);
      usersList = usersList.filter(
        u => !demoUsernames.has(u.username.toLowerCase()) && !demoIds.has(u.id)
      );
      localStorage.setItem(this.usersKey, JSON.stringify(usersList));
    } catch {}
  }


  private purgeOrphanAttendances() {
    const validStudents = this.getRawStudents();
    const validIds = new Set(validStudents.map(s => s.id));

    const rawAtt = localStorage.getItem(this.attendancesKey);
    if (rawAtt) {
      try {
        const attList: AttendanceRecord[] = JSON.parse(rawAtt);
        const cleaned = attList.filter(a => validIds.has(a.student_id));
        localStorage.setItem(this.attendancesKey, JSON.stringify(cleaned));
      } catch (e) {}
    }
  }

  private getRawStudents(): StudentRecord[] {
    const raw = localStorage.getItem(this.studentsKey);
    return raw ? JSON.parse(raw) : [];
  }

  /**
   * Mengatur langganan Supabase Realtime (PostgreSQL Changes)
   * Saat ada siswa baru/absen masuk dari perangkat manapun, UI langsung terupdate secara real-time.
   */
  private setupRealtimeSubscription() {
    if (this.isSubscribedToRealtime || typeof window === 'undefined') return;

    try {
      this.isSubscribedToRealtime = true;
      supabase
        .channel('skh_realtime_db')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'students' },
          async (payload) => {
            console.log('[Supabase Realtime] Perubahan tabel students terdeteksi:', payload.eventType);
            await this.syncFromSupabase();
            window.dispatchEvent(new CustomEvent('skh_db_updated'));
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'face_embeddings' },
          async (payload) => {
            console.log('[Supabase Realtime] Perubahan face_embeddings terdeteksi:', payload.eventType);
            await this.syncFromSupabase();
            window.dispatchEvent(new CustomEvent('skh_db_updated'));
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attendances' },
          async (payload) => {
            console.log('[Supabase Realtime] Perubahan attendances terdeteksi:', payload.eventType);
            await this.syncAttendancesFromSupabase();
            window.dispatchEvent(new CustomEvent('skh_db_updated'));
          }
        )
        .subscribe((status) => {
          console.log('[Supabase Realtime] Status channel realtime:', status);
        });

      // Auto-sync saat aplikasi dibuka kembali di HP (screen on / tab switch)
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            console.log('[Database] App aktif kembali (visibility visible), sinkronisasi...');
            this.syncFromSupabase().then(() => {
              window.dispatchEvent(new CustomEvent('skh_db_updated'));
            });
          }
        });
      }

      if (typeof window !== 'undefined') {
        window.addEventListener('focus', () => {
          this.syncFromSupabase().then(() => {
            window.dispatchEvent(new CustomEvent('skh_db_updated'));
          });
        });

        // Polling background setiap 4 detik untuk memastikan semua perangkat (laptop/HP) selalu sinkron realtime
        setInterval(() => {
          this.syncFromSupabase().then(() => {
            window.dispatchEvent(new CustomEvent('skh_db_updated'));
          });
        }, 4000);
      }
    } catch (err) {
      console.warn('[Supabase Realtime] Gagal inisialisasi langganan:', err);
    }
  }

  /**
   * Sinkronisasi data kehadiran siswa dari Supabase Cloud
   */
  async syncAttendancesFromSupabase(): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    try {
      const { data: attData, error } = await supabase
        .from('attendances')
        .select('*, students(id, full_name, nickname, nis, class_name, category)')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) {
        console.error('[Database] ❌ Supabase fetch attendances error:', error);
        return false;
      }

      if (attData) {
        const mapped: AttendanceRecord[] = attData.map(a => {
          const student = a.students || {};
          return {
            id: a.id,
            student_id: a.student_id,
            student_name: student.full_name || 'Siswa',
            student_nickname: student.nickname || student.full_name || 'Siswa',
            student_nis: student.nis || '',
            class_name: student.class_name || '',
            category: student.category || 'Umum',
            date: a.date,
            time_in: a.time_in,
            time_out: a.time_out,
            status: a.status || 'HADIR',
            confidence_score: a.confidence_score ?? 1.0,
            verification_method: a.verification_method || 'FACE_RECOGNITION',
            captured_photo: a.captured_photo || null,
            captured_photo_out: null,
            notes: a.notes || null,
            created_at: a.created_at || new Date().toISOString(),
          };
        });

        localStorage.setItem(this.attendancesKey, JSON.stringify(mapped));
        return true;
      }
    } catch (e) {
      console.warn('[Database] Sync attendances exception:', e);
    }
    return false;
  }

  /**
   * Sinkronisasi otomatis data master siswa dan vektor wajah dari Supabase Cloud
   */
  async syncFromSupabase(): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return false;
    }

    try {
      // 1. Fetch cloud students
      const { data: studentsData, error: sErr } = await supabase
        .from('students')
        .select('*, face_embeddings(*)');

      if (sErr) {
        console.error('[Database] ❌ Supabase fetch students error:', sErr);
        return false;
      }

      if (studentsData) {
        const mapped: StudentRecord[] = studentsData.map(s => ({
          id: s.id,
          nis: s.nis,
          full_name: s.full_name,
          nickname: s.nickname,
          class_name: s.class_name,
          category: s.category || 'Umum',
          is_active: s.is_active ?? true,
          created_at: s.created_at || new Date().toISOString(),
          photo_count: s.face_embeddings ? s.face_embeddings.length : 0,
          latest_photo:
            s.face_embeddings && s.face_embeddings.length > 0 ? s.face_embeddings[0].photo_path : null,
          embeddings: (s.face_embeddings || []).map(
            (e: { id: string; pose_label: string; photo_path: string; embedding_vector: string }) => {
              let vec: number[] = [];
              try {
                vec = JSON.parse(e.embedding_vector);
              } catch {}
              return {
                id: e.id,
                pose_label: e.pose_label,
                photo_data: e.photo_path || '',
                vector: vec,
              };
            }
          ),
        }));

        // SUPABASE CLOUD ADALAH SINGLE SOURCE OF TRUTH (SSOT)
        // Siswa yang sudah dihapus di Supabase Cloud dari perangkat lain (misal: laptop)
        // WAJIB terhapus juga dari penyimpanan HP lokal dan TIDAK BOLEH dimunculkan kembali!
        const localStudents = this.getRawStudents();
        const localByNis = new Map(localStudents.map(s => [s.nis, s]));
        const localById = new Map(localStudents.map(s => [s.id, s]));

        const finalMerged: StudentRecord[] = mapped.map(cloudStudent => {
          // Pertahankan foto thumbnail lokal jika kolom photo_path di cloud belum TEXT / kosong
          const localStudent = localByNis.get(cloudStudent.nis) || localById.get(cloudStudent.id);
          if (localStudent && (!cloudStudent.latest_photo || cloudStudent.latest_photo.length < 10) && localStudent.latest_photo) {
            cloudStudent.latest_photo = localStudent.latest_photo;
            if (cloudStudent.embeddings && localStudent.embeddings) {
              cloudStudent.embeddings.forEach((ce, idx) => {
                if ((!ce.photo_data || ce.photo_data.length < 10) && localStudent.embeddings[idx]?.photo_data) {
                  ce.photo_data = localStudent.embeddings[idx].photo_data;
                }
              });
            }
          }
          return cloudStudent;
        });

        localStorage.setItem(this.studentsKey, JSON.stringify(finalMerged));
        this.purgeOrphanAttendances();
        console.log(`[Database] ✅ Berhasil sinkronisasi ${finalMerged.length} siswa dengan Supabase Cloud.`);

        // Sync attendances as well
        await this.syncAttendancesFromSupabase();
        return true;
      }
    } catch (e) {
      console.warn('[Database] Supabase sync exception:', e);
    }
    return false;
  }

  // ==========================================
  // STUDENTS API
  // ==========================================

  getStudents(className?: string, search?: string): StudentRecord[] {
    const raw = localStorage.getItem(this.studentsKey);
    let list: StudentRecord[] = raw ? JSON.parse(raw) : [];

    if (className && className !== 'ALL' && className !== 'all') {
      list = list.filter(s => s.class_name.toLowerCase() === className.toLowerCase());
    }

    if (search && search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        s =>
          s.full_name.toLowerCase().includes(q) ||
          s.nickname.toLowerCase().includes(q) ||
          s.nis.toLowerCase().includes(q)
      );
    }

    return list.map(s => ({
      ...s,
      photo_count: s.embeddings ? s.embeddings.length : 0,
      latest_photo: s.embeddings && s.embeddings.length > 0 ? s.embeddings[0].photo_data : null,
    }));
  }

  getStudentById(id: string): StudentRecord | null {
    const list = this.getStudents();
    return list.find(s => s.id === id) || null;
  }

  /**
   * Mendaftarkan atau memperbarui data siswa secara real-time ke Supabase Cloud
   */
  async saveStudent(studentData: {
    nis: string;
    full_name: string;
    nickname: string;
    class_name: string;
    category: string;
    photos: Array<{ pose_label: string; photo_data: string; descriptor: Float32Array }>;
  }): Promise<StudentRecord> {
    const raw = localStorage.getItem(this.studentsKey);
    let list: StudentRecord[] = raw ? JSON.parse(raw) : [];

    const existingIndex = list.findIndex(s => s.nis.trim() === studentData.nis.trim());
    let id = existingIndex >= 0 ? list[existingIndex].id : crypto.randomUUID();

    // Pastikan jika siswa sudah pernah tersimpan di Supabase Cloud, gunakan ID yang sama
    if (isSupabaseConfigured()) {
      try {
        const { data: cloudStudent } = await supabase
          .from('students')
          .select('id')
          .eq('nis', studentData.nis.trim())
          .maybeSingle();

        if (cloudStudent?.id) {
          id = cloudStudent.id;
        }
      } catch (err) {
        console.warn('[Database] Supabase NIS check notice:', err);
      }
    }

    const embeddings = studentData.photos.map((p, idx) => ({
      id: crypto.randomUUID(),
      pose_label: p.pose_label || `Pose ${idx + 1}`,
      photo_data: p.photo_data,
      vector: Array.from(p.descriptor),
    }));

    const newStudent: StudentRecord = {
      id,
      nis: studentData.nis.trim(),
      full_name: studentData.full_name.trim(),
      nickname: studentData.nickname.trim(),
      class_name: studentData.class_name,
      category: studentData.category?.trim() || 'Umum',
      is_active: true,
      created_at: existingIndex >= 0 ? list[existingIndex].created_at : new Date().toISOString(),
      photo_count: embeddings.length,
      latest_photo: embeddings.length > 0 ? embeddings[0].photo_data : null,
      embeddings,
    };

    if (existingIndex >= 0) {
      list[existingIndex] = newStudent;
    } else {
      list.unshift(newStudent);
    }

    localStorage.setItem(this.studentsKey, JSON.stringify(list));

    // Sinkronisasi Real-Time Langsung ke Database Supabase Cloud
    if (isSupabaseConfigured()) {
      try {
        const { error: sErr } = await supabase.from('students').upsert({
          id: newStudent.id,
          nis: newStudent.nis,
          full_name: newStudent.full_name,
          nickname: newStudent.nickname,
          class_name: newStudent.class_name,
          category: newStudent.category || 'Umum',
          is_active: true,
        });

        if (sErr) {
          console.error('[Database] ❌ Supabase upsert student error:', sErr);
          throw new Error(`Gagal menyimpan data siswa ke Supabase Cloud: ${sErr.message}`);
        }

        console.log('[Database] ✅ Supabase student saved:', newStudent.full_name);

        // Hapus embeddings lama siswa ini jika ada untuk mencegah duplikasi pose
        await supabase.from('face_embeddings').delete().eq('student_id', newStudent.id);

        if (embeddings.length > 0) {
          const embPayload = embeddings.map(e => ({
            id: e.id,
            student_id: newStudent.id,
            embedding_vector: JSON.stringify(e.vector),
            pose_label: e.pose_label,
            photo_path: e.photo_data,
          }));

          let { error: embErr } = await supabase.from('face_embeddings').insert(embPayload);

          // Jika kolom photo_path di Supabase berukuran varchar(255), lakukan retry dengan photo_path: null
          // agar pendaftaran siswa dan vektor pengenalan wajah AI tetap tersimpan 100% ke Cloud
          if (embErr && embErr.message?.includes('value too long')) {
            console.warn(
              '[Database] ⚠️ Kolom photo_path di Supabase adalah VARCHAR(255). Menyimpan vektor wajah AI tanpa base64 di cloud...'
            );
            const fallbackPayload = embPayload.map(e => ({
              ...e,
              photo_path: null,
            }));
            const retryRes = await supabase.from('face_embeddings').insert(fallbackPayload);
            embErr = retryRes.error;
          }

          if (embErr) {
            console.error('[Database] ❌ Supabase insert embeddings error:', embErr);
            throw new Error(`Gagal menyimpan foto & vektor wajah ke Supabase Cloud: ${embErr.message}`);
          }
          console.log('[Database] ✅ Supabase embeddings inserted count:', embPayload.length);
        }
      } catch (err) {
        console.error('[Database] ❌ Supabase push error:', err);
        throw err;
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('skh_db_updated'));
    }

    return newStudent;
  }

  async deleteStudent(id: string): Promise<boolean> {
    const raw = localStorage.getItem(this.studentsKey);
    let list: StudentRecord[] = raw ? JSON.parse(raw) : [];
    list = list.filter(s => s.id !== id);
    localStorage.setItem(this.studentsKey, JSON.stringify(list));

    // CASCADE DELETE: Remove all attendance records associated with this student
    const rawAtt = localStorage.getItem(this.attendancesKey);
    if (rawAtt) {
      try {
        let attList: AttendanceRecord[] = JSON.parse(rawAtt);
        attList = attList.filter(a => a.student_id !== id);
        localStorage.setItem(this.attendancesKey, JSON.stringify(attList));
      } catch (e) {}
    }

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('attendances').delete().eq('student_id', id);
        await supabase.from('face_embeddings').delete().eq('student_id', id);
        await supabase.from('students').delete().eq('id', id);
        console.log('[Database] ✅ Student deleted from Supabase:', id);
      } catch (e) {
        console.warn('[Database] Supabase delete notice:', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('skh_db_updated'));
    }

    return true;
  }

  /**
   * Memperbarui profil siswa dan sinkronisasi otomatis ke Supabase Cloud secara real-time
   */
  async updateStudent(
    id: string,
    data: {
      nis?: string;
      full_name?: string;
      nickname?: string;
      class_name?: string;
      category?: string;
      is_active?: boolean;
    }
  ): Promise<StudentRecord> {
    const raw = localStorage.getItem(this.studentsKey);
    let list: StudentRecord[] = raw ? JSON.parse(raw) : [];
    const index = list.findIndex(s => s.id === id);

    if (index === -1) {
      throw new Error('Data siswa tidak ditemukan.');
    }

    const current = list[index];
    const updated: StudentRecord = {
      ...current,
      nis: data.nis ? data.nis.trim() : current.nis,
      full_name: data.full_name ? data.full_name.trim() : current.full_name,
      nickname: data.nickname ? data.nickname.trim() : current.nickname,
      class_name: data.class_name ? data.class_name.trim() : current.class_name,
      category: data.category ? data.category.trim() : (current.category || 'Umum'),
      is_active: data.is_active ?? current.is_active ?? true,
    };

    list[index] = updated;
    localStorage.setItem(this.studentsKey, JSON.stringify(list));

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('students')
          .update({
            nis: updated.nis,
            full_name: updated.full_name,
            nickname: updated.nickname,
            class_name: updated.class_name,
            category: updated.category,
            is_active: updated.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) {
          console.error('[Database] ❌ Supabase update student error:', error);
          throw new Error(`Gagal memperbarui siswa di Supabase: ${error.message}`);
        }
        console.log('[Database] ✅ Supabase student updated:', updated.full_name);
      } catch (err) {
        console.error('[Database] ❌ Supabase update error:', err);
        throw err;
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('skh_db_updated'));
    }

    return updated;
  }

  // ==========================================
  // ATTENDANCES API (MASUK & PULANG)
  // ==========================================

  getAttendances(date?: string, className?: string, status?: string): AttendanceRecord[] {
    const raw = localStorage.getItem(this.attendancesKey);
    let list: AttendanceRecord[] = raw ? JSON.parse(raw) : [];

    const validStudents = this.getStudents();
    const validStudentIds = new Set(validStudents.map(s => s.id));
    list = list.filter(a => validStudentIds.has(a.student_id));

    if (date) {
      list = list.filter(a => a.date === date);
    }

    if (className && className !== 'ALL' && className !== 'all') {
      list = list.filter(a => a.class_name.toLowerCase() === className.toLowerCase());
    }

    if (status && status !== 'ALL' && status !== 'all') {
      list = list.filter(a => a.status.toUpperCase() === status.toUpperCase());
    }

    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async deleteAttendance(id: string): Promise<boolean> {
    const raw = localStorage.getItem(this.attendancesKey);
    let list: AttendanceRecord[] = raw ? JSON.parse(raw) : [];
    list = list.filter(a => a.id !== id);
    localStorage.setItem(this.attendancesKey, JSON.stringify(list));

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('attendances').delete().eq('id', id);
      } catch (e) {
        console.warn('[Database] Supabase attendance delete notice:', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('skh_db_updated'));
    }

    return true;
  }

  async updateAttendance(
    id: string,
    data: { status?: AttendanceRecord['status']; notes?: string }
  ): Promise<AttendanceRecord> {
    const raw = localStorage.getItem(this.attendancesKey);
    let list: AttendanceRecord[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(a => a.id === id);

    if (idx === -1) {
      throw new Error('Data presensi tidak ditemukan.');
    }

    if (data.status) list[idx].status = data.status;
    if (data.notes !== undefined) list[idx].notes = data.notes;

    localStorage.setItem(this.attendancesKey, JSON.stringify(list));

    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('attendances')
          .update({
            status: list[idx].status,
            notes: list[idx].notes,
          })
          .eq('id', id);
        console.log('[Database] ✅ Supabase attendance updated:', list[idx].id);
      } catch (err) {
        console.warn('[Database] Supabase update attendance error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('skh_db_updated'));
    }

    return list[idx];
  }

  async createManualAttendance(params: {
    student: { id: string; nis: string; full_name: string; nickname: string; class_name: string; category: string };
    date: string;
    status: AttendanceRecord['status'];
    notes?: string;
  }): Promise<AttendanceRecord> {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    const newRecord: AttendanceRecord = {
      id: crypto.randomUUID(),
      student_id: params.student.id,
      student_name: params.student.full_name,
      student_nickname: params.student.nickname,
      student_nis: params.student.nis,
      class_name: params.student.class_name,
      category: params.student.category || 'Umum',
      date: params.date,
      time_in: timeStr,
      time_out: null,
      status: params.status,
      confidence_score: 1.0,
      verification_method: 'MANUAL_TEACHER',
      captured_photo: null,
      notes: params.notes || `Presensi manual oleh guru: ${params.status}`,
      created_at: now.toISOString(),
    };

    const all = this.getAttendances();
    all.unshift(newRecord);
    localStorage.setItem(this.attendancesKey, JSON.stringify(all));

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('attendances').insert({
          id: newRecord.id,
          student_id: newRecord.student_id,
          date: newRecord.date,
          time_in: newRecord.time_in,
          status: newRecord.status,
          confidence_score: 1.0,
          verification_method: newRecord.verification_method,
          notes: newRecord.notes,
        });
      } catch (err) {
        console.warn('[Database] Supabase manual attendance error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('skh_db_updated'));
    }

    return newRecord;
  }

  async recordAttendance(
    student: {
      id: string;
      nis: string;
      full_name: string;
      nickname: string;
      class_name: string;
      category: string;
    },
    confidence: number,
    capturedPhoto?: string | null,
    mode: 'IN' | 'OUT' | 'AUTO' = 'AUTO'
  ): Promise<{
    status: 'RECORDED_SUCCESS' | 'RECORDED_CHECKOUT_SUCCESS' | 'ALREADY_RECORDED' | 'NOT_CHECKED_IN';
    action: 'CHECK_IN' | 'CHECK_OUT' | 'NONE';
    message: string;
    record?: AttendanceRecord;
  }> {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    const allAttendances = this.getAttendances();
    const existing = allAttendances.find(a => a.student_id === student.id && a.date === todayStr);

    // MODE CHECK-OUT / PULANG
    if (mode === 'OUT' || (mode === 'AUTO' && existing && existing.time_in && !existing.time_out)) {
      if (!existing || !existing.time_in) {
        return {
          status: 'NOT_CHECKED_IN',
          action: 'NONE',
          message: `Siswa ${student.nickname} belum ada absen masuk hari ini. Silakan klik tombol Masuk terlebih dahulu ya!`,
        };
      }

      if (existing.time_out) {
        return {
          status: 'ALREADY_RECORDED',
          action: 'NONE',
          message: `Halo ${student.nickname}, kamu sudah presensi pulang pada pukul ${existing.time_out}.`,
          record: existing,
        };
      }

      existing.time_out = timeStr;
      existing.captured_photo_out = capturedPhoto || null;
      existing.notes = (existing.notes ? existing.notes + ' • ' : '') + `Pulang: ${timeStr}`;

      localStorage.setItem(this.attendancesKey, JSON.stringify(allAttendances));

      if (isSupabaseConfigured()) {
        try {
          await supabase
            .from('attendances')
            .update({
              time_out: existing.time_out,
              notes: existing.notes,
            })
            .eq('id', existing.id);
        } catch (e) {
          console.warn('[Database] Supabase update checkout exception:', e);
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('skh_db_updated'));
      }

      return {
        status: 'RECORDED_CHECKOUT_SUCCESS',
        action: 'CHECK_OUT',
        message: `Presensi pulang berhasil! Selamat beristirahat dan hati-hati di jalan, ${student.nickname}! 👋`,
        record: existing,
      };
    }

    // MODE CHECK-IN / MASUK
    if (existing && existing.time_in) {
      return {
        status: 'ALREADY_RECORDED',
        action: 'NONE',
        message: `Halo ${student.nickname}, kamu sudah absen masuk hari ini pada pukul ${existing.time_in}.`,
        record: existing,
      };
    }

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const isLate = currentHour > 7 || (currentHour === 7 && currentMinute > 30);
    const attendanceStatus: AttendanceRecord['status'] = isLate ? 'TERLAMBAT' : 'HADIR';

    const newRecord: AttendanceRecord = {
      id: crypto.randomUUID(),
      student_id: student.id,
      student_name: student.full_name,
      student_nickname: student.nickname,
      student_nis: student.nis,
      class_name: student.class_name,
      category: student.category || 'Umum',
      date: todayStr,
      time_in: timeStr,
      time_out: null,
      status: attendanceStatus,
      confidence_score: confidence,
      verification_method: 'FACE_RECOGNITION',
      captured_photo: capturedPhoto || null,
      notes: isLate ? 'Datang terlambat' : 'Tepat waktu',
      created_at: now.toISOString(),
    };

    allAttendances.unshift(newRecord);
    localStorage.setItem(this.attendancesKey, JSON.stringify(allAttendances));

    // Sinkronisasi Real-Time ke Supabase
    if (isSupabaseConfigured()) {
      try {
        const attPayload = {
          id: newRecord.id,
          student_id: newRecord.student_id,
          date: newRecord.date,
          time_in: newRecord.time_in,
          status: newRecord.status,
          confidence_score: newRecord.confidence_score,
          verification_method: newRecord.verification_method,
          notes: newRecord.notes,
          captured_photo: newRecord.captured_photo,
        };

        let { error: attErr } = await supabase.from('attendances').insert(attPayload);

        // Fallback jika captured_photo di Supabase adalah varchar(255)
        if (attErr && attErr.message?.includes('value too long')) {
          console.warn('[Database] ⚠️ captured_photo di Supabase adalah VARCHAR(255). Menyimpan presensi tanpa snapshot...');
          const retryAtt = await supabase.from('attendances').insert({
            ...attPayload,
            captured_photo: null,
          });
          attErr = retryAtt.error;
        }

        if (attErr) {
          console.warn('[Database] Supabase attendance push notice:', attErr);
        }
      } catch (err) {
        console.warn('[Database] Supabase attendance push notice:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('skh_db_updated'));
    }

    return {
      status: 'RECORDED_SUCCESS',
      action: 'CHECK_IN',
      message: `Presensi masuk berhasil! Selamat datang di sekolah, ${student.nickname}! ☀️`,
      record: newRecord,
    };
  }

  getStats(date?: string, className?: string) {
    const todayStr = date || new Date().toISOString().split('T')[0];
    const students = this.getStudents(className);
    const attendances = this.getAttendances(todayStr, className);

    const totalStudents = students.length;
    if (totalStudents === 0) {
      return {
        total_students: 0,
        present_count: 0,
        ontime_count: 0,
        late_count: 0,
        checkout_count: 0,
        attendance_rate: 0,
        date: todayStr,
      };
    }

    const hadir = attendances.filter(a => a.time_in && a.status === 'HADIR').length;
    const terlambat = attendances.filter(a => a.status === 'TERLAMBAT').length;
    const pulang = attendances.filter(a => a.time_out !== null && a.time_out !== undefined).length;
    const totalPresent = hadir + terlambat;
    const attendanceRate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

    return {
      total_students: totalStudents,
      present_count: totalPresent,
      ontime_count: hadir,
      late_count: terlambat,
      checkout_count: pulang,
      attendance_rate: attendanceRate,
      date: todayStr,
    };
  }

  exportExcel(date?: string, className?: string): void {
    const list = this.getAttendances(date, className);
    const rows = list.map((a, idx) => ({
      No: idx + 1,
      Tanggal: a.date,
      'Jam Masuk': a.time_in || '-',
      'Jam Pulang': a.time_out || '-',
      NIS: a.student_nis,
      'Nama Siswa': a.student_name,
      Panggilan: a.student_nickname,
      Kelas: a.class_name,
      Kategori: a.category,
      Status: a.status,
      'Metode Presensi': a.verification_method,
      Confidence: `${Math.round(a.confidence_score * 100)}%`,
      Catatan: a.notes || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Presensi SKH');

    const filename = `Laporan_Absensi_SKH_${date || 'Semua'}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  // ==================== USER MANAGEMENT & RBAC ====================
  getUsers(): UserAccount[] {
    const raw = localStorage.getItem(this.usersKey);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  getUserById(id: string): UserAccount | undefined {
    return this.getUsers().find(u => u.id === id);
  }

  getUserByUsername(username: string): UserAccount | undefined {
    return this.getUsers().find(u => u.username.toLowerCase() === username.trim().toLowerCase());
  }

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
    const users = this.getUsers();
    const cleanUsername = data.username.trim();

    if (!cleanUsername) throw new Error('Username wajib diisi');
    if (!data.password) throw new Error('Password wajib diisi');
    if (!data.full_name) throw new Error('Nama Lengkap wajib diisi');
    if (!data.nuptk) throw new Error('NUPTK wajib diisi');

    const existing = users.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
    if (existing) {
      throw new Error(`Username "${cleanUsername}" sudah digunakan. Silakan gunakan username lain.`);
    }

    const isAutoApprovedKepsek = data.role === 'KEPALA_SEKOLAH' && data.is_verified_otp;

    const newUser: UserAccount = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      username: cleanUsername,
      password: data.password,
      full_name: data.full_name.trim(),
      nuptk: data.nuptk.trim(),
      role: data.role,
      email: data.email ? data.email.trim() : undefined,
      status: isAutoApprovedKepsek ? 'APPROVED' : 'PENDING',
      wali_kelas: data.wali_kelas || '',
      is_active: true,
      created_at: new Date().toISOString(),
    };

    users.push(newUser);
    localStorage.setItem(this.usersKey, JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('skh_users_updated'));
    return newUser;
  }


  async approveUser(id: string): Promise<UserAccount> {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('Pengguna tidak ditemukan.');

    users[idx].status = 'APPROVED';
    users[idx].is_active = true;
    localStorage.setItem(this.usersKey, JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('skh_users_updated'));
    return users[idx];
  }

  async rejectUser(id: string): Promise<UserAccount> {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('Pengguna tidak ditemukan.');

    users[idx].status = 'REJECTED';
    localStorage.setItem(this.usersKey, JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('skh_users_updated'));
    return users[idx];
  }

  async toggleUserActive(id: string): Promise<UserAccount> {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('Pengguna tidak ditemukan.');

    users[idx].is_active = !users[idx].is_active;
    localStorage.setItem(this.usersKey, JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('skh_users_updated'));
    return users[idx];
  }

  async deleteUser(id: string): Promise<void> {
    let users = this.getUsers();
    users = users.filter(u => u.id !== id);
    localStorage.setItem(this.usersKey, JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('skh_users_updated'));
  }

  authenticateUser(username: string, password: string): { success: boolean; user?: UserAccount; error?: string } {
    const cleanUsername = username.trim().toLowerCase();
    const user = this.getUsers().find(u => u.username.toLowerCase() === cleanUsername);

    if (!user || user.password !== password) {
      return { success: false, error: 'Username atau password tidak sesuai.' };
    }

    if (user.status === 'PENDING') {
      return {
        success: false,
        error: 'Akun Anda masih dalam status menunggu persetujuan (Pending Approval) oleh Kepala Sekolah. Silakan hubungi pimpinan sekolah.',
      };
    }

    if (user.status === 'REJECTED') {
      return {
        success: false,
        error: 'Permohonan pendaftaran akun Anda telah ditolak oleh Kepala Sekolah.',
      };
    }

    if (!user.is_active) {
      return {
        success: false,
        error: 'Akun Anda dinonaktifkan oleh administrator. Hubungi Kepala Sekolah untuk mengaktifkan kembali.',
      };
    }

    return { success: true, user };
  }

  // ==================== JURNAL KBM & ABSENSI KELAS ====================
  getKbmJournals(className?: string, date?: string): KbmJournalRecord[] {
    const raw = localStorage.getItem(this.kbmJournalsKey);
    let list: KbmJournalRecord[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {}
    }
    if (className && className !== 'all') {
      list = list.filter(j => j.class_name === className);
    }
    if (date) {
      list = list.filter(j => j.date === date);
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async saveKbmJournal(data: Omit<KbmJournalRecord, 'id' | 'created_at'>): Promise<KbmJournalRecord> {
    const journals = this.getKbmJournals();
    const newJournal: KbmJournalRecord = {
      ...data,
      id: `kbm-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      created_at: new Date().toISOString(),
    };

    journals.unshift(newJournal);
    localStorage.setItem(this.kbmJournalsKey, JSON.stringify(journals));

    // Sinkronkan absensi harian siswa dari jurnal ini
    for (const item of newJournal.attendances) {
      const student = this.getStudentById(item.student_id);
      if (!student) continue;

      const todayStr = newJournal.date;
      const existing = this.getAttendances(todayStr).find(a => a.student_id === item.student_id);
      const noteStr = `Jurnal KBM ${newJournal.subject} (${newJournal.teacher_name}): ${item.status}${item.notes ? ' - ' + item.notes : ''}`;

      if (existing) {
        await this.updateAttendance(existing.id, {
          status: item.status as AttendanceRecord['status'],
          notes: noteStr,
        });
      } else {
        await this.createManualAttendance({
          student,
          date: todayStr,
          status: item.status as AttendanceRecord['status'],
          notes: noteStr,
        });
      }
    }

    window.dispatchEvent(new CustomEvent('skh_kbm_updated'));
    window.dispatchEvent(new CustomEvent('skh_db_updated'));
    return newJournal;
  }

  async deleteKbmJournal(id: string): Promise<void> {
    let journals = this.getKbmJournals();
    journals = journals.filter(j => j.id !== id);
    localStorage.setItem(this.kbmJournalsKey, JSON.stringify(journals));
    window.dispatchEvent(new CustomEvent('skh_kbm_updated'));
  }

  // ==================== USER PROFILE & WALI KELAS ====================
  async updateUserProfile(
    userId: string,
    data: {
      full_name?: string;
      nuptk?: string;
      wali_kelas?: string;
      password?: string;
    }
  ): Promise<UserAccount> {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('Pengguna tidak ditemukan.');

    if (data.full_name) users[idx].full_name = data.full_name.trim();
    if (data.nuptk) users[idx].nuptk = data.nuptk.trim();
    if (data.wali_kelas !== undefined) users[idx].wali_kelas = data.wali_kelas.trim();
    if (data.password) users[idx].password = data.password;

    localStorage.setItem(this.usersKey, JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('skh_users_updated'));
    return users[idx];
  }

  // ==================== KELOLA KELAS & RUANGAN ====================
  getClassGrades(): ClassGrade[] {
    const raw = localStorage.getItem(this.classGradesKey);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async addClassGrade(name: string): Promise<ClassGrade> {
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Nama Tingkat Kelas tidak boleh kosong.');

    const grades = this.getClassGrades();
    const duplicate = grades.find(g => g.name.toLowerCase() === cleanName.toLowerCase());
    if (duplicate) {
      throw new Error(`Tingkat Kelas "${cleanName}" sudah ada dalam sistem.`);
    }

    const newGrade: ClassGrade = {
      id: `grade-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: cleanName,
      created_at: new Date().toISOString(),
    };

    grades.push(newGrade);
    localStorage.setItem(this.classGradesKey, JSON.stringify(grades));

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('class_grades').insert({
          id: newGrade.id,
          name: newGrade.name,
        });
      } catch (e) {
        console.warn('[Database] Supabase insert grade notice:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('skh_class_rooms_updated'));
    return newGrade;
  }

  async deleteClassGrade(id: string): Promise<void> {
    const combinations = this.getClassRooms();
    const isUsed = combinations.some(c => c.grade_id === id);
    if (isUsed) {
      throw new Error('Tingkat Kelas ini sedang digunakan dalam kombinasi Ruangan. Hapus kombinasi terkait terlebih dahulu.');
    }

    let grades = this.getClassGrades();
    grades = grades.filter(g => g.id !== id);
    localStorage.setItem(this.classGradesKey, JSON.stringify(grades));

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('class_grades').delete().eq('id', id);
      } catch (e) {
        console.warn('[Database] Supabase delete grade notice:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('skh_class_rooms_updated'));
  }

  getRooms(): RoomItem[] {
    const raw = localStorage.getItem(this.roomsKey);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async addRoom(name: string): Promise<RoomItem> {
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Nama Ruangan tidak boleh kosong.');

    const rooms = this.getRooms();
    const duplicate = rooms.find(r => r.name.toLowerCase() === cleanName.toLowerCase());
    if (duplicate) {
      throw new Error(`Nama Ruangan "${cleanName}" sudah ada dalam sistem.`);
    }

    const newRoom: RoomItem = {
      id: `room-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: cleanName,
      created_at: new Date().toISOString(),
    };

    rooms.push(newRoom);
    localStorage.setItem(this.roomsKey, JSON.stringify(rooms));

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('rooms').insert({
          id: newRoom.id,
          name: newRoom.name,
        });
      } catch (e) {
        console.warn('[Database] Supabase insert room notice:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('skh_class_rooms_updated'));
    return newRoom;
  }

  async deleteRoom(id: string): Promise<void> {
    const combinations = this.getClassRooms();
    const isUsed = combinations.some(c => c.room_id === id);
    if (isUsed) {
      throw new Error('Nama Ruangan ini sedang digunakan dalam kombinasi Kelas. Hapus kombinasi terkait terlebih dahulu.');
    }

    let rooms = this.getRooms();
    rooms = rooms.filter(r => r.id !== id);
    localStorage.setItem(this.roomsKey, JSON.stringify(rooms));

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('rooms').delete().eq('id', id);
      } catch (e) {
        console.warn('[Database] Supabase delete room notice:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('skh_class_rooms_updated'));
  }

  getClassRooms(activeOnly: boolean = false): ClassRoomCombination[] {
    const raw = localStorage.getItem(this.classRoomsKey);
    let list: ClassRoomCombination[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {
        list = [];
      }
    }
    if (activeOnly) {
      list = list.filter(c => c.is_active);
    }
    return list;
  }

  async addClassRoom(gradeId: string, roomId: string): Promise<ClassRoomCombination> {
    const grades = this.getClassGrades();
    const rooms = this.getRooms();

    const grade = grades.find(g => g.id === gradeId);
    if (!grade) throw new Error('Tingkat Kelas tidak valid.');

    const room = rooms.find(r => r.id === roomId);
    if (!room) throw new Error('Nama Ruangan tidak valid.');

    const combinations = this.getClassRooms();
    const displayName = `${grade.name} - ${room.name}`;

    // Strict validation: Pair must be unique
    const pairExists = combinations.find(
      c => c.grade_id === gradeId && c.room_id === roomId
    );
    if (pairExists) {
      throw new Error(`Kombinasi "${displayName}" sudah pernah didaftarkan.`);
    }

    // Display name unique check
    const nameExists = combinations.find(
      c => c.display_name.toLowerCase() === displayName.toLowerCase()
    );
    if (nameExists) {
      throw new Error(`Kombinasi dengan nama "${displayName}" sudah ada.`);
    }

    const newCombination: ClassRoomCombination = {
      id: `cr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      grade_id: grade.id,
      grade_name: grade.name,
      room_id: room.id,
      room_name: room.name,
      display_name: displayName,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    combinations.push(newCombination);
    localStorage.setItem(this.classRoomsKey, JSON.stringify(combinations));

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('class_rooms').insert({
          id: newCombination.id,
          grade_id: newCombination.grade_id,
          room_id: newCombination.room_id,
          display_name: newCombination.display_name,
          is_active: true,
        });
      } catch (e) {
        console.warn('[Database] Supabase insert class_room notice:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('skh_class_rooms_updated'));
    return newCombination;
  }

  async toggleClassRoomActive(id: string): Promise<ClassRoomCombination> {
    const list = this.getClassRooms();
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Kombinasi kelas tidak ditemukan.');

    list[idx].is_active = !list[idx].is_active;
    localStorage.setItem(this.classRoomsKey, JSON.stringify(list));

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('class_rooms').update({ is_active: list[idx].is_active }).eq('id', id);
      } catch (e) {
        console.warn('[Database] Supabase update class_room notice:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('skh_class_rooms_updated'));
    return list[idx];
  }

  async deleteClassRoom(id: string): Promise<void> {
    let list = this.getClassRooms();
    list = list.filter(c => c.id !== id);
    localStorage.setItem(this.classRoomsKey, JSON.stringify(list));

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('class_rooms').delete().eq('id', id);
      } catch (e) {
        console.warn('[Database] Supabase delete class_room notice:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('skh_class_rooms_updated'));
  }
}


export const db = new DatabaseService();
