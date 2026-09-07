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

class DatabaseService {
  private studentsKey = 'skh_students_v3';
  private attendancesKey = 'skh_attendances_v3';
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

        // Merge cloud students with local students
        const localStudents = this.getRawStudents();
        const mergedMap = new Map<string, StudentRecord>();

        localStudents.forEach(s => mergedMap.set(s.nis, s));
        mapped.forEach(s => mergedMap.set(s.nis, s));

        const finalMerged = Array.from(mergedMap.values());
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

          const { error: embErr } = await supabase.from('face_embeddings').insert(embPayload);
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
        await supabase.from('attendances').insert({
          id: newRecord.id,
          student_id: newRecord.student_id,
          date: newRecord.date,
          time_in: newRecord.time_in,
          status: newRecord.status,
          confidence_score: newRecord.confidence_score,
          verification_method: newRecord.verification_method,
          notes: newRecord.notes,
        });
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
}

export const db = new DatabaseService();
