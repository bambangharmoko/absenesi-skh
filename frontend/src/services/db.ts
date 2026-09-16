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
  requested_wali_kelas?: string;
  wali_kelas_status?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
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

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface ClassRoomCombination {
  id: string;
  grade_id: string;
  grade_name: string;
  room_id: string;
  room_name: string;
  display_name: string;
  time_in?: string;
  time_out?: string;
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

export interface DiscrepancyItem {
  student_id: string;
  nis: string;
  student_name: string;
  student_nickname: string;
  class_name: string;
  date: string;
  face_status: string;
  face_time_in: string | null;
  face_time_out: string | null;
  kbm_status: string;
  kbm_topic?: string;
  kbm_time?: string;
  discrepancy_type: 'BOLOS_KBM' | 'TANPA_SCAN_WAJAH' | 'KONFLIK_STATUS';
  discrepancy_title: string;
  discrepancy_description: string;
}

export interface KbmJournalRecord {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  time_slot?: string;
  subject?: string;
  class_name: string;
  teacher_id: string;
  teacher_name: string;
  meeting_topic: string;
  notes?: string;
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
    this.syncUsersFromSupabase();
    this.syncClassRoomsFromSupabase();
    this.syncKbmJournalsFromSupabase();
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
    const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

    // 1. Seed Class Grades if empty or has invalid legacy IDs
    const rawGrades = localStorage.getItem(this.classGradesKey);
    let gradesList: ClassGrade[] = [];
    if (rawGrades) {
      try {
        gradesList = JSON.parse(rawGrades);
      } catch {}
    }
    const hasInvalidGradeIds = gradesList.some(g => !isUUID(g.id));
    if (gradesList.length === 0 || hasInvalidGradeIds) {
      const defaultGrades = [
        'Kelas 1',
        'Kelas 2',
        'Kelas 3',
        'Kelas TK A',
        'Kelas TK B',
      ];
      gradesList = defaultGrades.map((name) => ({
        id: this.generateUUID(),
        name,
        created_at: new Date().toISOString(),
      }));
      localStorage.setItem(this.classGradesKey, JSON.stringify(gradesList));
    }

    // 2. Seed Rooms if empty or has invalid legacy IDs
    const rawRooms = localStorage.getItem(this.roomsKey);
    let roomsList: RoomItem[] = [];
    if (rawRooms) {
      try {
        roomsList = JSON.parse(rawRooms);
      } catch {}
    }
    const hasInvalidRoomIds = roomsList.some(r => !isUUID(r.id));
    if (roomsList.length === 0 || hasInvalidRoomIds) {
      const defaultRooms = [
        'Autis',
        'Tunarungu',
        'Tunagrahita',
        'Cemerlang',
        'Ceria',
      ];
      roomsList = defaultRooms.map((name) => ({
        id: this.generateUUID(),
        name,
        created_at: new Date().toISOString(),
      }));
      localStorage.setItem(this.roomsKey, JSON.stringify(roomsList));
    }

    // 3. Seed Combinations if empty or has invalid legacy IDs
    const rawCombinations = localStorage.getItem(this.classRoomsKey);
    let combinationsList: ClassRoomCombination[] = [];
    if (rawCombinations) {
      try {
        combinationsList = JSON.parse(rawCombinations);
      } catch {}
    }
    const hasInvalidCombIds = combinationsList.some(
      c => !isUUID(c.id) || !isUUID(c.grade_id) || !isUUID(c.room_id)
    );
    if (combinationsList.length === 0 || hasInvalidCombIds) {
      const defaultPairs = [
        { gradeName: 'Kelas 1', roomName: 'Autis' },
        { gradeName: 'Kelas 2', roomName: 'Tunarungu' },
        { gradeName: 'Kelas 3', roomName: 'Tunagrahita' },
        { gradeName: 'Kelas TK A', roomName: 'Cemerlang' },
        { gradeName: 'Kelas TK B', roomName: 'Ceria' },
      ];
      combinationsList = defaultPairs.map((p, idx) => {
        const grade = gradesList.find(g => g.name === p.gradeName) || gradesList[idx % gradesList.length];
        const room = roomsList.find(r => r.name === p.roomName) || roomsList[idx % roomsList.length];
        return {
          id: this.generateUUID(),
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
   * Helper untuk membuat UUID v4 standar yang kompatibel dengan tipe UUID Supabase
   */
  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Broadcast pembaruan akun pengguna ke semua klien yang terhubung via Supabase Realtime
   */
  private broadcastUsersUpdated() {
    try {
      const ch = supabase.channel('skh_realtime_db', { config: { broadcast: { self: false } } });
      ch.send({
        type: 'broadcast',
        event: 'users_updated',
        payload: { timestamp: Date.now() },
      });
    } catch (err) {
      console.warn('[Database] Broadcast users_updated failed:', err);
    }
  }

  /**
   * Broadcast pembaruan struktur kelas & ruangan ke semua klien via Supabase Realtime
   */
  private broadcastClassRoomsUpdated() {
    try {
      const ch = supabase.channel('skh_realtime_db', { config: { broadcast: { self: false } } });
      ch.send({
        type: 'broadcast',
        event: 'class_rooms_updated',
        payload: { timestamp: Date.now() },
      });
    } catch (err) {
      console.warn('[Database] Broadcast class_rooms_updated failed:', err);
    }
  }

  /**
   * Broadcast pembaruan Jurnal KBM ke semua klien via Supabase Realtime
   */
  private broadcastKbmUpdated() {
    try {
      const ch = supabase.channel('skh_realtime_db', { config: { broadcast: { self: false } } });
      ch.send({
        type: 'broadcast',
        event: 'kbm_updated',
        payload: { timestamp: Date.now() },
      });
    } catch (err) {
      console.warn('[Database] Broadcast kbm_updated failed:', err);
    }
  }

  /**
   * Sinkronisasi data struktur kelas & ruangan dari Supabase Cloud secara real-time
   */
  async syncClassRoomsFromSupabase(): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    try {
      // 1. Fetch class grades
      const { data: gradesData, error: gErr } = await supabase.from('class_grades').select('*').order('name');
      if (!gErr && gradesData && gradesData.length > 0) {
        const grades: ClassGrade[] = gradesData.map(g => ({
          id: g.id,
          name: g.name,
          created_at: g.created_at || new Date().toISOString(),
        }));
        localStorage.setItem(this.classGradesKey, JSON.stringify(grades));
      }

      // 2. Fetch rooms
      const { data: roomsData, error: rErr } = await supabase.from('rooms').select('*').order('name');
      if (!rErr && roomsData && roomsData.length > 0) {
        const rooms: RoomItem[] = roomsData.map(r => ({
          id: r.id,
          name: r.name,
          created_at: r.created_at || new Date().toISOString(),
        }));
        localStorage.setItem(this.roomsKey, JSON.stringify(rooms));
      }

      // 3. Fetch class_rooms (Daftar Kombinasi Terdaftar)
      const { data: classRoomsData, error: crErr } = await supabase.from('class_rooms').select('*').order('display_name');
      if (!crErr && classRoomsData) {
        const currentGrades = this.getClassGrades();
        const currentRooms = this.getRooms();

        const combinations: ClassRoomCombination[] = classRoomsData.map(cr => {
          const g = currentGrades.find(grade => grade.id === cr.grade_id);
          const r = currentRooms.find(room => room.id === cr.room_id);
          let gradeName = g ? g.name : '';
          let roomName = r ? r.name : '';
          if (!gradeName || !roomName) {
            const parts = (cr.display_name || '').split(' - ');
            if (parts.length >= 2) {
              gradeName = gradeName || parts[0];
              roomName = roomName || parts[1];
            }
          }
          return {
            id: cr.id,
            grade_id: cr.grade_id,
            grade_name: gradeName,
            room_id: cr.room_id,
            room_name: roomName,
            display_name: cr.display_name,
            time_in: cr.time_in || '07:30',
            time_out: cr.time_out || '12:00',
            is_active: cr.is_active ?? true,
            created_at: cr.created_at || new Date().toISOString(),
          };
        });
        localStorage.setItem(this.classRoomsKey, JSON.stringify(combinations));
      }

      window.dispatchEvent(new CustomEvent('skh_class_rooms_updated'));
      return true;
    } catch (e) {
      console.warn('[Database] Sync class rooms exception:', e);
      return false;
    }
  }

  /**
   * Sinkronisasi data Jurnal KBM dari Supabase Cloud secara real-time
   */
  async syncKbmJournalsFromSupabase(): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    try {
      const { data, error } = await supabase
        .from('kbm_journals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return false;

      if (data && data.length > 0) {
        const mapped: KbmJournalRecord[] = data.map(j => ({
          id: j.id,
          date: j.date,
          start_time: j.start_time || '07:30',
          end_time: j.end_time || '09:00',
          time_slot: `${j.start_time || '07:30'} - ${j.end_time || '09:00'}`,
          class_name: j.class_name,
          teacher_id: j.teacher_id,
          teacher_name: j.teacher_name,
          meeting_topic: j.meeting_topic,
          notes: j.notes || '',
          attendances: j.attendances_json ? (typeof j.attendances_json === 'string' ? JSON.parse(j.attendances_json) : j.attendances_json) : [],
          created_at: j.created_at || new Date().toISOString(),
        }));
        localStorage.setItem(this.kbmJournalsKey, JSON.stringify(mapped));
        window.dispatchEvent(new CustomEvent('skh_kbm_updated'));
        return true;
      }
    } catch (e) {
      console.warn('[Database] Sync kbm journals exception:', e);
    }
    return false;
  }

  /**
   * Sinkronisasi data akun pengguna (users) dari Supabase Cloud secara real-time
   */
  async syncUsersFromSupabase(): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    try {
      const { data: usersData, error: uErr } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: true });

      if (uErr) {
        console.warn('[Database] ⚠️ Supabase fetch users notice:', uErr.message);
        return false;
      }

      if (usersData && usersData.length > 0) {
        const mapped: UserAccount[] = usersData.map(u => {
          let password = u.hashed_password || '';
          let status: UserStatus = 'APPROVED';
          let nuptk = '';
          let email: string | undefined = undefined;
          let wali_kelas = '';
          let requested_wali_kelas: string | undefined = undefined;
          let wali_kelas_status: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' = 'NONE';

          if (typeof u.hashed_password === 'string' && u.hashed_password.startsWith('{')) {
            try {
              const parsed = JSON.parse(u.hashed_password);
              password = parsed.password || password;
              status = parsed.status || status;
              nuptk = parsed.nuptk || nuptk;
              email = parsed.email || undefined;
              wali_kelas = parsed.wali_kelas || wali_kelas;
              requested_wali_kelas = parsed.requested_wali_kelas || requested_wali_kelas;
              wali_kelas_status = parsed.wali_kelas_status || (wali_kelas ? 'APPROVED' : 'NONE');
            } catch {}
          } else if (wali_kelas) {
            wali_kelas_status = 'APPROVED';
          }

          return {
            id: u.id,
            username: u.username,
            password,
            full_name: u.full_name || '',
            nuptk: nuptk,
            role: (u.role as UserRole) || 'GURU',
            status,
            email,
            wali_kelas: wali_kelas || undefined,
            requested_wali_kelas: requested_wali_kelas || undefined,
            wali_kelas_status: wali_kelas_status,
            is_active: u.is_active ?? true,
            created_at: u.created_at || new Date().toISOString(),
          };
        });

        localStorage.setItem(this.usersKey, JSON.stringify(mapped));
        return true;
      } else if (usersData && usersData.length === 0) {
        // Jika di Supabase masih kosong, unggah akun lokal jika ada (misal pendaftaran awal)
        const localUsers = this.getUsers();
        if (localUsers.length > 0) {
          for (const lu of localUsers) {
            const cleanId = lu.id && lu.id.includes('-') && lu.id.length >= 32 ? lu.id : this.generateUUID();
            lu.id = cleanId;
            const meta = {
              password: lu.password,
              status: lu.status,
              nuptk: lu.nuptk,
              email: lu.email,
              wali_kelas: lu.wali_kelas,
              requested_wali_kelas: lu.requested_wali_kelas,
              wali_kelas_status: lu.wali_kelas_status || (lu.wali_kelas ? 'APPROVED' : 'NONE'),
            };
            await supabase.from('users').upsert({
              id: cleanId,
              username: lu.username,
              hashed_password: JSON.stringify(meta),
              full_name: lu.full_name,
              role: lu.role,
              is_active: lu.is_active,
              created_at: lu.created_at || new Date().toISOString(),
            });
          }
          localStorage.setItem(this.usersKey, JSON.stringify(localUsers));
        }
        return true;
      }
    } catch (e) {
      console.warn('[Database] Sync users exception:', e);
    }
    return false;
  }

  /**
   * Mengatur langganan Supabase Realtime (PostgreSQL Changes & Broadcast)
   * Saat ada data siswa, kelas, user, atau jurnal baru dari perangkat manapun, UI langsung sinkron real-time.
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
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'users' },
          async (payload) => {
            console.log('[Supabase Realtime] Perubahan tabel users terdeteksi:', payload.eventType);
            await this.syncUsersFromSupabase();
            window.dispatchEvent(new CustomEvent('skh_users_updated'));
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'class_grades' },
          async () => {
            await this.syncClassRoomsFromSupabase();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rooms' },
          async () => {
            await this.syncClassRoomsFromSupabase();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'class_rooms' },
          async () => {
            await this.syncClassRoomsFromSupabase();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'kbm_journals' },
          async () => {
            await this.syncKbmJournalsFromSupabase();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'homeroom_assignments' },
          async () => {
            await this.syncUsersFromSupabase();
            window.dispatchEvent(new CustomEvent('skh_users_updated'));
          }
        )
        .on(
          'broadcast',
          { event: 'users_updated' },
          async () => {
            console.log('[Supabase Realtime] Broadcast users_updated diterima');
            await this.syncUsersFromSupabase();
            window.dispatchEvent(new CustomEvent('skh_users_updated'));
          }
        )
        .on(
          'broadcast',
          { event: 'class_rooms_updated' },
          async () => {
            console.log('[Supabase Realtime] Broadcast class_rooms_updated diterima');
            await this.syncClassRoomsFromSupabase();
          }
        )
        .on(
          'broadcast',
          { event: 'kbm_updated' },
          async () => {
            console.log('[Supabase Realtime] Broadcast kbm_updated diterima');
            await this.syncKbmJournalsFromSupabase();
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
            this.syncUsersFromSupabase().then(() => {
              window.dispatchEvent(new CustomEvent('skh_users_updated'));
            });
            this.syncClassRoomsFromSupabase();
            this.syncKbmJournalsFromSupabase();
          }
        });
      }

      if (typeof window !== 'undefined') {
        window.addEventListener('focus', () => {
          this.syncFromSupabase().then(() => {
            window.dispatchEvent(new CustomEvent('skh_db_updated'));
          });
          this.syncUsersFromSupabase().then(() => {
            window.dispatchEvent(new CustomEvent('skh_users_updated'));
          });
          this.syncClassRoomsFromSupabase();
          this.syncKbmJournalsFromSupabase();
        });

        // Polling background setiap 4 detik untuk memastikan semua perangkat (laptop/HP) selalu sinkron realtime
        setInterval(() => {
          this.syncFromSupabase().then(() => {
            window.dispatchEvent(new CustomEvent('skh_db_updated'));
          });
          this.syncUsersFromSupabase().then(() => {
            window.dispatchEvent(new CustomEvent('skh_users_updated'));
          });
          this.syncClassRoomsFromSupabase();
          this.syncKbmJournalsFromSupabase();
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
            captured_photo_out: a.captured_photo_out || null,
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
      list = list.filter(a => a.date === date || a.date.startsWith(date));
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
    const todayStr = getLocalDateString(now);
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
          // 1. Coba update berdasarkan ID baris
          let { data: updatedRows, error: updateErr } = await supabase
            .from('attendances')
            .update({
              time_out: existing.time_out,
              captured_photo_out: existing.captured_photo_out,
              notes: existing.notes,
            })
            .eq('id', existing.id)
            .select();

          // Fallback jika captured_photo_out belum ada di tabel Supabase
          if (updateErr && updateErr.message?.includes('column "captured_photo_out"')) {
            const retryRes = await supabase
              .from('attendances')
              .update({
                time_out: existing.time_out,
                notes: existing.notes,
              })
              .eq('id', existing.id)
              .select();
            updatedRows = retryRes.data;
            updateErr = retryRes.error;
          }

          // 2. Jika tidak ada baris yang ter-update berdasarkan ID (misal karena ID lokal berbeda dari ID cloud),
          // lakukan fallback update berdasarkan kombinasi unik (student_id, date)
          if (!updateErr && (!updatedRows || updatedRows.length === 0)) {
            console.log('[Database] ℹ️ Mencocokkan baris presensi pulang berdasarkan (student_id, date)...');
            let fallbackRes = await supabase
              .from('attendances')
              .update({
                time_out: existing.time_out,
                captured_photo_out: existing.captured_photo_out,
                notes: existing.notes,
              })
              .eq('student_id', student.id)
              .eq('date', todayStr)
              .select();

            if (fallbackRes.error && fallbackRes.error.message?.includes('column "captured_photo_out"')) {
              fallbackRes = await supabase
                .from('attendances')
                .update({
                  time_out: existing.time_out,
                  notes: existing.notes,
                })
                .eq('student_id', student.id)
                .eq('date', todayStr)
                .select();
            }

            updatedRows = fallbackRes.data;
            updateErr = fallbackRes.error;
          }

          if (updateErr) {
            console.error('[Database] ❌ Supabase update checkout error:', updateErr);
            return {
              status: 'NOT_CHECKED_IN',
              action: 'NONE',
              message: `Gagal memperbarui data presensi pulang di server: ${updateErr.message || 'Kesalahan database'}. Silakan coba lagi.`,
            };
          }

          // Sinkronkan ID lokal dengan ID baris Supabase jika didapatkan
          if (updatedRows && updatedRows.length > 0 && updatedRows[0].id) {
            existing.id = updatedRows[0].id;
            localStorage.setItem(this.attendancesKey, JSON.stringify(allAttendances));
          }
        } catch (e: any) {
          console.error('[Database] Supabase update checkout exception:', e);
          return {
            status: 'NOT_CHECKED_IN',
            action: 'NONE',
            message: `Gagal menyimpan presensi pulang ke database: ${e?.message || 'Koneksi terputus'}. Silakan coba lagi.`,
          };
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
    const todayStr = date || getLocalDateString();
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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Presensi Biometrik');

    const filename = `Laporan_Presensi_Biometrik_SKH_${date || 'Semua'}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  exportKbmJournalExcel(date?: string, className?: string): void {
    let journals = this.getKbmJournals();
    if (className && className !== 'all') {
      journals = journals.filter(j => j.class_name === className);
    }
    if (date && date !== 'all') {
      journals = journals.filter(j => j.date.startsWith(date));
    }

    const rows: any[] = [];
    let no = 1;
    journals.forEach(j => {
      const hadirCount = j.attendances?.filter(a => a.status === 'HADIR').length || 0;
      const izinCount = j.attendances?.filter(a => a.status === 'IZIN').length || 0;
      const sakitCount = j.attendances?.filter(a => a.status === 'SAKIT').length || 0;
      const alphaCount = j.attendances?.filter(a => a.status === 'ALPHA').length || 0;
      const totalSiswa = j.attendances?.length || 0;

      rows.push({
        No: no++,
        Tanggal: j.date,
        Kelas: j.class_name,
        'Guru Pengajar': j.teacher_name,
        'Jam Mulai': j.start_time,
        'Jam Selesai': j.end_time,
        'Materi / Topik Pembelajaran': j.meeting_topic,
        'Total Siswa': totalSiswa,
        'Hadir (KBM)': hadirCount,
        'Izin (KBM)': izinCount,
        'Sakit (KBM)': sakitCount,
        'Alpha (KBM)': alphaCount,
        'Catatan Guru': j.notes || '-',
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Jurnal Pembelajaran KBM');

    const filename = `Laporan_Jurnal_KBM_SKH_${date || 'Semua'}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  /**
   * Audit Diskrepansi: Membandingkan Presensi Wajah (Gerbang) vs Presensi Jurnal KBM (Kelas)
   */
  getAttendanceDiscrepancies(className: string, date: string): DiscrepancyItem[] {
    const students = this.getStudents(className);
    if (!students || students.length === 0) return [];

    const faceRecords = this.getAttendances(date, className);
    const journals = this.getKbmJournals(className, date);

    const discrepancies: DiscrepancyItem[] = [];

    // Map KBM attendances for today in this class
    const kbmStudentMap = new Map<string, { status: string; topic: string; time: string; notes?: string }>();
    journals.forEach(j => {
      (j.attendances || []).forEach(item => {
        kbmStudentMap.set(item.student_id, {
          status: item.status,
          topic: j.meeting_topic,
          time: `${j.start_time} - ${j.end_time}`,
          notes: item.notes,
        });
      });
    });

    students.forEach(student => {
      const faceRec = faceRecords.find(a => a.student_id === student.id && a.date === date);
      const hasFaceIn = Boolean(faceRec && faceRec.time_in);
      const faceStatus = faceRec ? faceRec.status : 'BELUM_HADIR';
      const kbmData = kbmStudentMap.get(student.id);
      const kbmStatus = kbmData ? kbmData.status : 'BELUM_ADA_SESI';

      // 1. Siswa tercatat hadir di Gerbang (Face Scan), tapi di KBM ditandai ALPHA / tidak hadir
      if (hasFaceIn && kbmStatus === 'ALPHA') {
        discrepancies.push({
          student_id: student.id,
          nis: student.nis,
          student_name: student.full_name,
          student_nickname: student.nickname,
          class_name: student.class_name,
          date,
          face_status: faceStatus,
          face_time_in: faceRec?.time_in || null,
          face_time_out: faceRec?.time_out || null,
          kbm_status: 'ALPHA',
          kbm_topic: kbmData?.topic,
          kbm_time: kbmData?.time,
          discrepancy_type: 'BOLOS_KBM',
          discrepancy_title: 'Wajah Hadir di Gerbang, namun Alpha di Kelas KBM',
          discrepancy_description: `Siswa terdeteksi scan wajah masuk gerbang pukul ${faceRec?.time_in}, namun pada sesi KBM (${kbmData?.topic || 'Kelas'}) ditandai ALPHA. Harap periksa apakah siswa meninggalkan ruang kelas.`,
        });
      }
      // 2. Siswa tercatat HADIR di KBM, namun belum melakukan scan wajah di gerbang
      else if (!hasFaceIn && kbmStatus === 'HADIR') {
        discrepancies.push({
          student_id: student.id,
          nis: student.nis,
          student_name: student.full_name,
          student_nickname: student.nickname,
          class_name: student.class_name,
          date,
          face_status: 'BELUM_HADIR',
          face_time_in: null,
          face_time_out: null,
          kbm_status: 'HADIR',
          kbm_topic: kbmData?.topic,
          kbm_time: kbmData?.time,
          discrepancy_type: 'TANPA_SCAN_WAJAH',
          discrepancy_title: 'Hadir di Kelas KBM, namun Belum Scan Wajah Gerbang',
          discrepancy_description: `Siswa dicatat HADIR oleh guru kelas pada sesi KBM (${kbmData?.time || 'KBM'}), tetapi tidak ada log presensi wajah gerbang. Harap lakukan verifikasi manual atau arahkan scan di kiosk gerbang.`,
        });
      }
      // 3. Siswa scan wajah di gerbang, tapi di KBM tercatat IZIN atau SAKIT
      else if (hasFaceIn && (kbmStatus === 'IZIN' || kbmStatus === 'SAKIT')) {
        discrepancies.push({
          student_id: student.id,
          nis: student.nis,
          student_name: student.full_name,
          student_nickname: student.nickname,
          class_name: student.class_name,
          date,
          face_status: faceStatus,
          face_time_in: faceRec?.time_in || null,
          face_time_out: faceRec?.time_out || null,
          kbm_status: kbmStatus,
          kbm_topic: kbmData?.topic,
          kbm_time: kbmData?.time,
          discrepancy_type: 'KONFLIK_STATUS',
          discrepancy_title: `Konflik Status: Scan Wajah Masuk vs KBM ${kbmStatus}`,
          discrepancy_description: `Siswa scan wajah gerbang pukul ${faceRec?.time_in}, namun tercatat ${kbmStatus} di KBM. Perlu dipastikan apakah siswa izin pulang setelah sampai atau salah input.`,
        });
      }
    });

    return discrepancies;
  }

  /**
   * Export Laporan Excel Khusus Wali Kelas dengan Komparasi Dual-Data (Wajah vs KBM)
   */
  exportTeacherClassAttendanceExcel(className: string, dateRange: { startDate: string; endDate: string; label: string }): void {
    const students = this.getStudents(className);
    const allAttendances = this.getAttendances(undefined, className);
    const allJournals = this.getKbmJournals(className);

    const start = dateRange.startDate;
    const end = dateRange.endDate;

    const inRangeAttendances = allAttendances.filter(a => a.date >= start && a.date <= end);
    const inRangeJournals = allJournals.filter(j => j.date >= start && j.date <= end);

    const dateSet = new Set<string>();
    inRangeAttendances.forEach(a => dateSet.add(a.date));
    inRangeJournals.forEach(j => dateSet.add(j.date));
    if (dateSet.size === 0) {
      dateSet.add(start);
    }
    const sortedDates = Array.from(dateSet).sort();

    const mainRows: any[] = [];
    const discrepancyRows: any[] = [];
    let no = 1;
    let discNo = 1;

    sortedDates.forEach(date => {
      const dayAttendances = inRangeAttendances.filter(a => a.date === date);
      const dayJournals = inRangeJournals.filter(j => j.date === date);

      const kbmStudentMap = new Map<string, { status: string; topic: string; time: string; notes?: string }>();
      dayJournals.forEach(j => {
        (j.attendances || []).forEach(item => {
          kbmStudentMap.set(item.student_id, {
            status: item.status,
            topic: j.meeting_topic,
            time: `${j.start_time} - ${j.end_time}`,
            notes: item.notes,
          });
        });
      });

      students.forEach(student => {
        const faceRec = dayAttendances.find(a => a.student_id === student.id);
        const hasFaceIn = Boolean(faceRec && faceRec.time_in);
        const faceStatus = faceRec ? faceRec.status : 'BELUM HADIR';
        const kbmData = kbmStudentMap.get(student.id);
        const kbmStatus = kbmData ? kbmData.status : (dayJournals.length > 0 ? 'TIDAK TERCATAT' : 'BELUM ADA KBM');

        let kesesuaian = 'SESUAI';
        let detailDiskrepansi = 'Data kehadiran selaras';

        if (hasFaceIn && kbmStatus === 'ALPHA') {
          kesesuaian = 'DISKREPANSI (BOLOS KBM)';
          detailDiskrepansi = `Scan gerbang jam ${faceRec?.time_in}, namun Alpha di KBM (${kbmData?.topic || 'Kelas'})`;
        } else if (!hasFaceIn && kbmStatus === 'HADIR') {
          kesesuaian = 'DISKREPANSI (TANPA SCAN WAJAH)';
          detailDiskrepansi = `Hadir di KBM kelas, namun tidak ada rekaman scan wajah di gerbang`;
        } else if (hasFaceIn && (kbmStatus === 'IZIN' || kbmStatus === 'SAKIT')) {
          kesesuaian = `DISKREPANSI (KONFLIK ${kbmStatus})`;
          detailDiskrepansi = `Scan gerbang jam ${faceRec?.time_in}, namun di KBM tercatat ${kbmStatus}`;
        }

        const row = {
          No: no++,
          'NIS Siswa': student.nis,
          'Nama Siswa': student.full_name,
          'Nama Panggilan': student.nickname,
          Kelas: student.class_name,
          Tanggal: date,
          'Jam Masuk (Gerbang)': faceRec?.time_in || '-',
          'Jam Pulang (Gerbang)': faceRec?.time_out || '-',
          'Status Presensi Wajah': faceStatus,
          'Status Presensi KBM': kbmStatus,
          'Topik / Sesi KBM': kbmData?.topic ? `${kbmData.topic} (${kbmData.time})` : '-',
          'Status Kesesuaian': kesesuaian,
          'Keterangan Audit': detailDiskrepansi,
        };

        mainRows.push(row);

        if (kesesuaian.startsWith('DISKREPANSI')) {
          discrepancyRows.push({
            No: discNo++,
            'NIS Siswa': student.nis,
            'Nama Siswa': student.full_name,
            Kelas: student.class_name,
            Tanggal: date,
            'Jam Masuk Gerbang': faceRec?.time_in || '-',
            'Status Wajah': faceStatus,
            'Status KBM': kbmStatus,
            'Tipe Diskrepansi': kesesuaian,
            'Detail Masalah': detailDiskrepansi,
          });
        }
      });
    });

    const workbook = XLSX.utils.book_new();

    // Sheet 1: Rekap Komparasi Dual-Data
    const wsMain = XLSX.utils.json_to_sheet(mainRows);
    XLSX.utils.book_append_sheet(workbook, wsMain, 'Rekap Dual-Presensi');

    // Sheet 2: Khusus Temuan Diskrepansi
    if (discrepancyRows.length > 0) {
      const wsDisc = XLSX.utils.json_to_sheet(discrepancyRows);
      XLSX.utils.book_append_sheet(workbook, wsDisc, 'Temuan Diskrepansi');
    }

    const cleanClassName = className.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Rekap_Presensi_WaliKelas_${cleanClassName}_${dateRange.label || start}.xlsx`;
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
    const cleanId = this.generateUUID();

    const newUser: UserAccount = {
      id: cleanId,
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

    // Sync ke Supabase Cloud secara real-time
    if (isSupabaseConfigured()) {
      try {
        const meta = {
          password: newUser.password,
          status: newUser.status,
          nuptk: newUser.nuptk,
          email: newUser.email,
          wali_kelas: newUser.wali_kelas,
        };
        const { error: sbErr } = await supabase.from('users').insert({
          id: newUser.id,
          username: newUser.username,
          hashed_password: JSON.stringify(meta),
          full_name: newUser.full_name,
          role: newUser.role,
          is_active: newUser.is_active,
          created_at: newUser.created_at,
        });

        if (sbErr) {
          console.warn('[Database] Supabase user insert notice:', sbErr.message);
        } else {
          this.broadcastUsersUpdated();
          console.log('[Database] ✅ Akun user tersimpan di Supabase Cloud secara real-time:', newUser.username);
        }
      } catch (err) {
        console.warn('[Database] Gagal sinkron user baru ke Supabase:', err);
      }
    }

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

    if (isSupabaseConfigured()) {
      try {
        const u = users[idx];
        const meta = {
          password: u.password,
          status: 'APPROVED',
          nuptk: u.nuptk,
          email: u.email,
          wali_kelas: u.wali_kelas,
        };
        await supabase
          .from('users')
          .update({
            is_active: true,
            hashed_password: JSON.stringify(meta),
          })
          .eq('id', id);
        this.broadcastUsersUpdated();
      } catch (err) {
        console.warn('[Database] Supabase approveUser update failed:', err);
      }
    }

    return users[idx];
  }

  async rejectUser(id: string): Promise<UserAccount> {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('Pengguna tidak ditemukan.');

    users[idx].status = 'REJECTED';
    localStorage.setItem(this.usersKey, JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('skh_users_updated'));

    if (isSupabaseConfigured()) {
      try {
        const u = users[idx];
        const meta = {
          password: u.password,
          status: 'REJECTED',
          nuptk: u.nuptk,
          email: u.email,
          wali_kelas: u.wali_kelas,
        };
        await supabase
          .from('users')
          .update({
            hashed_password: JSON.stringify(meta),
          })
          .eq('id', id);
        this.broadcastUsersUpdated();
      } catch (err) {
        console.warn('[Database] Supabase rejectUser update failed:', err);
      }
    }

    return users[idx];
  }

  async toggleUserActive(id: string): Promise<UserAccount> {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('Pengguna tidak ditemukan.');

    users[idx].is_active = !users[idx].is_active;
    localStorage.setItem(this.usersKey, JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('skh_users_updated'));

    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('users')
          .update({ is_active: users[idx].is_active })
          .eq('id', id);
        this.broadcastUsersUpdated();
      } catch (err) {
        console.warn('[Database] Supabase toggleUserActive failed:', err);
      }
    }

    return users[idx];
  }

  async deleteUser(id: string): Promise<void> {
    let users = this.getUsers();
    users = users.filter(u => u.id !== id);
    localStorage.setItem(this.usersKey, JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('skh_users_updated'));

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('users').delete().eq('id', id);
        this.broadcastUsersUpdated();
      } catch (err) {
        console.warn('[Database] Supabase deleteUser failed:', err);
      }
    }
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

  async authenticateUserAsync(username: string, password: string): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    const local = this.authenticateUser(username, password);
    if (local.success) return local;

    // Jika gagal di lokal, coba sinkronisasi cepat dengan Supabase Cloud untuk memastikan akun termutakhir
    await this.syncUsersFromSupabase();
    return this.authenticateUser(username, password);
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
    const journals = this.getKbmJournals();
    // Tanggal Pelaksanaan strictly locked to current date
    const todayStr = new Date().toISOString().split('T')[0];
    const journalId = this.generateUUID();

    const newJournal: KbmJournalRecord = {
      id: journalId,
      date: todayStr,
      start_time: data.start_time,
      end_time: data.end_time,
      time_slot: `${data.start_time} - ${data.end_time}`,
      subject: '', // Dropped as per PRD
      class_name: data.class_name,
      teacher_id: data.teacher_id,
      teacher_name: data.teacher_name,
      meeting_topic: data.meeting_topic.trim(),
      notes: data.notes?.trim() || '',
      attendances: data.attendances,
      created_at: new Date().toISOString(),
    };

    journals.unshift(newJournal);
    localStorage.setItem(this.kbmJournalsKey, JSON.stringify(journals));

    // Sinkronkan absensi harian siswa dari jurnal ini
    for (const item of newJournal.attendances) {
      const student = this.getStudentById(item.student_id);
      if (!student) continue;

      const existing = this.getAttendances(todayStr).find(a => a.student_id === item.student_id);
      const noteStr = `Jurnal KBM (${newJournal.teacher_name} [${newJournal.start_time}-${newJournal.end_time}]): ${item.status}${item.notes ? ' - ' + item.notes : ''}`;

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

    // Simpan ke Supabase Cloud
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('kbm_journals').insert({
          id: newJournal.id,
          teacher_id: newJournal.teacher_id,
          teacher_name: newJournal.teacher_name,
          class_name: newJournal.class_name,
          date: newJournal.date,
          start_time: newJournal.start_time,
          end_time: newJournal.end_time,
          meeting_topic: newJournal.meeting_topic,
          notes: newJournal.notes,
          attendances_json: JSON.stringify(newJournal.attendances),
          created_at: newJournal.created_at,
        });
        this.broadcastKbmUpdated();
      } catch (err) {
        console.warn('[Database] Supabase saveKbmJournal notice:', err);
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

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('kbm_journals').delete().eq('id', id);
        this.broadcastKbmUpdated();
      } catch (err) {
        console.warn('[Database] Supabase deleteKbmJournal notice:', err);
      }
    }

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
    if (data.password) users[idx].password = data.password;

    localStorage.setItem(this.usersKey, JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('skh_users_updated'));

    if (isSupabaseConfigured()) {
      try {
        const u = users[idx];
        const meta = {
          password: u.password,
          status: u.status,
          nuptk: u.nuptk,
          email: u.email,
          wali_kelas: u.wali_kelas,
          requested_wali_kelas: u.requested_wali_kelas,
          wali_kelas_status: u.wali_kelas_status,
        };
        await supabase
          .from('users')
          .update({
            full_name: u.full_name,
            hashed_password: JSON.stringify(meta),
          })
          .eq('id', userId);
        this.broadcastUsersUpdated();
      } catch (err) {
        console.warn('[Database] Supabase updateUserProfile failed:', err);
      }
    }

    return users[idx];
  }

  /**
   * Guru mengajukan penugasan Wali Kelas (Status: PENDING_APPROVAL)
   */
  async requestWaliKelas(userId: string, className: string): Promise<UserAccount> {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('Pengguna tidak ditemukan.');

    const cleanClass = className.trim();
    users[idx].requested_wali_kelas = cleanClass;
    users[idx].wali_kelas_status = cleanClass ? 'PENDING' : 'NONE';
    if (!cleanClass) {
      users[idx].wali_kelas = '';
    }

    localStorage.setItem(this.usersKey, JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('skh_users_updated'));

    if (isSupabaseConfigured()) {
      try {
        const u = users[idx];
        const meta = {
          password: u.password,
          status: u.status,
          nuptk: u.nuptk,
          email: u.email,
          wali_kelas: u.wali_kelas,
          requested_wali_kelas: u.requested_wali_kelas,
          wali_kelas_status: u.wali_kelas_status,
        };
        await supabase
          .from('users')
          .update({
            hashed_password: JSON.stringify(meta),
          })
          .eq('id', userId);

        if (cleanClass) {
          await supabase.from('homeroom_assignments').insert({
            id: this.generateUUID(),
            user_id: u.id,
            teacher_name: u.full_name,
            class_name: cleanClass,
            status: 'PENDING',
            requested_at: new Date().toISOString(),
          });
        }

        this.broadcastUsersUpdated();
      } catch (err) {
        console.warn('[Database] Supabase requestWaliKelas notice:', err);
      }
    }

    return users[idx];
  }

  /**
   * Kepala Sekolah menyetujui penugasan Wali Kelas (Status: APPROVED)
   */
  async approveWaliKelas(userId: string, className: string): Promise<UserAccount> {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('Pengguna tidak ditemukan.');

    const cleanClass = className.trim();
    users[idx].wali_kelas = cleanClass;
    users[idx].requested_wali_kelas = cleanClass;
    users[idx].wali_kelas_status = 'APPROVED';

    localStorage.setItem(this.usersKey, JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('skh_users_updated'));

    if (isSupabaseConfigured()) {
      try {
        const u = users[idx];
        const meta = {
          password: u.password,
          status: u.status,
          nuptk: u.nuptk,
          email: u.email,
          wali_kelas: u.wali_kelas,
          requested_wali_kelas: u.requested_wali_kelas,
          wali_kelas_status: 'APPROVED',
        };
        await supabase
          .from('users')
          .update({
            hashed_password: JSON.stringify(meta),
          })
          .eq('id', userId);

        await supabase
          .from('homeroom_assignments')
          .update({
            status: 'APPROVED',
            approved_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        this.broadcastUsersUpdated();
      } catch (err) {
        console.warn('[Database] Supabase approveWaliKelas notice:', err);
      }
    }

    return users[idx];
  }

  /**
   * Kepala Sekolah menolak penugasan Wali Kelas (Status: REJECTED)
   */
  async rejectWaliKelas(userId: string): Promise<UserAccount> {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('Pengguna tidak ditemukan.');

    users[idx].wali_kelas_status = 'REJECTED';
    localStorage.setItem(this.usersKey, JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('skh_users_updated'));

    if (isSupabaseConfigured()) {
      try {
        const u = users[idx];
        const meta = {
          password: u.password,
          status: u.status,
          nuptk: u.nuptk,
          email: u.email,
          wali_kelas: u.wali_kelas,
          requested_wali_kelas: u.requested_wali_kelas,
          wali_kelas_status: 'REJECTED',
        };
        await supabase
          .from('users')
          .update({
            hashed_password: JSON.stringify(meta),
          })
          .eq('id', userId);

        await supabase
          .from('homeroom_assignments')
          .update({
            status: 'REJECTED',
          })
          .eq('user_id', userId);

        this.broadcastUsersUpdated();
      } catch (err) {
        console.warn('[Database] Supabase rejectWaliKelas notice:', err);
      }
    }

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
    if (!cleanName) throw new Error('Nama Kelas tidak boleh kosong.');

    const grades = this.getClassGrades();
    const duplicate = grades.find(g => g.name.trim().toLowerCase() === cleanName.toLowerCase());
    if (duplicate) {
      throw new Error(`Gagal Menyimpan: Nama Kelas '${cleanName}' sudah pernah dibuat. Harap gunakan nama kelas yang berbeda.`);
    }

    const newGrade: ClassGrade = {
      id: this.generateUUID(),
      name: cleanName,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('class_grades').insert({
        id: newGrade.id,
        name: newGrade.name,
      });

      if (error) {
        if (error.code === '23505') {
          throw new Error(`Gagal Menyimpan: Nama Kelas '${cleanName}' sudah pernah dibuat. Harap gunakan nama kelas yang berbeda.`);
        }
        throw new Error(error.message || 'Gagal menyimpan ke database Supabase.');
      }
      this.broadcastClassRoomsUpdated();
    }

    grades.push(newGrade);
    localStorage.setItem(this.classGradesKey, JSON.stringify(grades));

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
        this.broadcastClassRoomsUpdated();
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
    const duplicate = rooms.find(r => r.name.trim().toLowerCase() === cleanName.toLowerCase());
    if (duplicate) {
      throw new Error(`Gagal Menyimpan: Nama Ruangan '${cleanName}' sudah pernah dibuat. Harap gunakan nama ruangan yang berbeda.`);
    }

    const newRoom: RoomItem = {
      id: this.generateUUID(),
      name: cleanName,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('rooms').insert({
        id: newRoom.id,
        name: newRoom.name,
      });

      if (error) {
        if (error.code === '23505') {
          throw new Error(`Gagal Menyimpan: Nama Ruangan '${cleanName}' sudah pernah dibuat. Harap gunakan nama ruangan yang berbeda.`);
        }
        throw new Error(error.message || 'Gagal menyimpan ke database Supabase.');
      }
      this.broadcastClassRoomsUpdated();
    }

    rooms.push(newRoom);
    localStorage.setItem(this.roomsKey, JSON.stringify(rooms));

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
        this.broadcastClassRoomsUpdated();
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

    // Frontend State Check: Strict validation: Pair must be unique OR display_name unique
    const pairExists = combinations.find(
      c => (c.grade_id === gradeId && c.room_id === roomId) ||
           (c.display_name.trim().toLowerCase() === displayName.trim().toLowerCase())
    );
    if (pairExists) {
      throw new Error(`Gagal Menghubungkan: Kombinasi '${grade.name}' dan '${room.name}' sudah digunakan dalam sistem.`);
    }

    const newCombination: ClassRoomCombination = {
      id: this.generateUUID(),
      grade_id: grade.id,
      grade_name: grade.name,
      room_id: room.id,
      room_name: room.name,
      display_name: displayName,
      time_in: '07:30',
      time_out: '12:00',
      is_active: true,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('class_rooms').insert({
        id: newCombination.id,
        grade_id: newCombination.grade_id,
        room_id: newCombination.room_id,
        display_name: newCombination.display_name,
        time_in: newCombination.time_in,
        time_out: newCombination.time_out,
        is_active: true,
      });

      if (error) {
        if (error.code === '23505') {
          throw new Error(`Gagal Menghubungkan: Kombinasi '${grade.name}' dan '${room.name}' sudah digunakan dalam sistem.`);
        }
        throw new Error(error.message || 'Gagal menyimpan kombinasi ke database Supabase.');
      }
      this.broadcastClassRoomsUpdated();
    }

    combinations.push(newCombination);
    localStorage.setItem(this.classRoomsKey, JSON.stringify(combinations));

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
        this.broadcastClassRoomsUpdated();
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
        this.broadcastClassRoomsUpdated();
      } catch (e) {
        console.warn('[Database] Supabase delete class_room notice:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('skh_class_rooms_updated'));
  }

  async updateClassOperationalHours(
    classRoomIds: string[],
    timeIn: string,
    timeOut: string
  ): Promise<void> {
    if (!classRoomIds || classRoomIds.length === 0) {
      throw new Error('Pilih setidaknya satu kelas untuk diperbarui jadwalnya.');
    }
    if (!timeIn || !timeOut) {
      throw new Error('Jam Masuk dan Jam Pulang wajib diisi.');
    }
    if (timeOut <= timeIn) {
      throw new Error('Jam Pulang harus lebih besar dari Jam Masuk.');
    }

    const list = this.getClassRooms();
    const updatedIdsSet = new Set(classRoomIds);
    list.forEach(item => {
      if (updatedIdsSet.has(item.id)) {
        item.time_in = timeIn;
        item.time_out = timeOut;
      }
    });

    localStorage.setItem(this.classRoomsKey, JSON.stringify(list));

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('class_rooms')
          .update({ time_in: timeIn, time_out: timeOut })
          .in('id', classRoomIds);

        if (error) {
          console.warn('[Database] Supabase update operational hours warning:', error);
        } else {
          this.broadcastClassRoomsUpdated();
        }
      } catch (err) {
        console.warn('[Database] Supabase update operational hours notice:', err);
      }
    }

    window.dispatchEvent(new CustomEvent('skh_class_rooms_updated'));
  }
}


export const db = new DatabaseService();
