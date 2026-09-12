-- =========================================================================
-- SKH SANTO FRANSISKUS ASISI - SUPABASE DATABASE SCHEMA (IDEMPOTENT & SAFE)
-- Query ini aman dijalankan berulang kali di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- =========================================================================

-- =========================================================================
-- 1. DATA MASTER SISWA & BIOMETRIK WAJAH
-- =========================================================================

-- Table: students (Data Master Siswa)
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nis VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    category VARCHAR(100) DEFAULT 'Umum',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: face_embeddings (Vektor Fitur Wajah 128-Dimensi & Foto)
CREATE TABLE IF NOT EXISTS public.face_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    pose_label VARCHAR(50),
    photo_path TEXT,
    embedding_vector TEXT NOT NULL, -- JSON Stringified Array of 128-d Float
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 2. TABEL 1: KHUSUS PRESENSI BIOMETRIK WAJAH SISWA (GERBANG/SEKOLAH)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time_in VARCHAR(20),
    time_out VARCHAR(20),
    status VARCHAR(50) DEFAULT 'HADIR', -- HADIR, TERLAMBAT, PULANG, IZIN, SAKIT
    confidence_score FLOAT DEFAULT 1.0,
    verification_method VARCHAR(50) DEFAULT 'FACE_RECOGNITION',
    captured_photo TEXT,
    captured_photo_out TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pastikan kolom baru tetap ada jika tabel sudah pernah dibuat sebelumnya
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS captured_photo TEXT;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS captured_photo_out TEXT;

-- Pastikan constraint unik (student_id, date) terpasang aman
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_student_date_attendance'
    ) THEN
        ALTER TABLE public.attendances ADD CONSTRAINT unique_student_date_attendance UNIQUE (student_id, date);
    END IF;
END $$;

-- Indeks Performa Presensi Biometrik Wajah
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_name);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_student ON public.face_embeddings(student_id);
CREATE INDEX IF NOT EXISTS idx_attendances_date ON public.attendances(date);
CREATE INDEX IF NOT EXISTS idx_attendances_student_date ON public.attendances(student_id, date);

-- Enable Row Level Security (RLS)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

-- Idempotent Policies: Drop sebelum Create agar tidak error 42710 (policy already exists)
DROP POLICY IF EXISTS "Allow public read students" ON public.students;
CREATE POLICY "Allow public read students" ON public.students FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert students" ON public.students;
CREATE POLICY "Allow public insert students" ON public.students FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update students" ON public.students;
CREATE POLICY "Allow public update students" ON public.students FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete students" ON public.students;
CREATE POLICY "Allow public delete students" ON public.students FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read face_embeddings" ON public.face_embeddings;
CREATE POLICY "Allow public read face_embeddings" ON public.face_embeddings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert face_embeddings" ON public.face_embeddings;
CREATE POLICY "Allow public insert face_embeddings" ON public.face_embeddings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete face_embeddings" ON public.face_embeddings;
CREATE POLICY "Allow public delete face_embeddings" ON public.face_embeddings FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read attendances" ON public.attendances;
CREATE POLICY "Allow public read attendances" ON public.attendances FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert attendances" ON public.attendances;
CREATE POLICY "Allow public insert attendances" ON public.attendances FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update attendances" ON public.attendances;
CREATE POLICY "Allow public update attendances" ON public.attendances FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete attendances" ON public.attendances;
CREATE POLICY "Allow public delete attendances" ON public.attendances FOR DELETE USING (true);

-- =========================================================================
-- 3. STRUKTUR KELOLA KELAS, RUANGAN & JAM OPERASIONAL (ROLE: KEPALA SEKOLAH)
-- =========================================================================

-- Table: class_grades (Tingkat Kelas - Contoh: "Kelas TK A", "Kelas TK B")
CREATE TABLE IF NOT EXISTS public.class_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: rooms (Nama Ruangan - Contoh: "Kelas Cemerlang", "Kelas Ceria")
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: class_rooms (Kombinasi Tingkat Kelas + Ruangan + Jam Operasional)
CREATE TABLE IF NOT EXISTS public.class_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_id UUID NOT NULL REFERENCES public.class_grades(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    display_name VARCHAR(255) UNIQUE NOT NULL,
    time_in VARCHAR(10) DEFAULT '07:30',
    time_out VARCHAR(10) DEFAULT '12:00',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_grade_room UNIQUE (grade_id, room_id)
);

-- Pastikan kolom time_in & time_out tetap ada jika tabel class_rooms sudah ada sebelumnya
ALTER TABLE public.class_rooms ADD COLUMN IF NOT EXISTS time_in VARCHAR(10) DEFAULT '07:30';
ALTER TABLE public.class_rooms ADD COLUMN IF NOT EXISTS time_out VARCHAR(10) DEFAULT '12:00';

-- Case-insensitive Uniqueness Constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_class_grades_unique_lower_name ON public.class_grades (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_unique_lower_name ON public.rooms (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_class_rooms_unique_lower_display_name ON public.class_rooms (LOWER(display_name));

-- Enable RLS & Idempotent Policies
ALTER TABLE public.class_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read class_grades" ON public.class_grades;
CREATE POLICY "Allow public read class_grades" ON public.class_grades FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert class_grades" ON public.class_grades;
CREATE POLICY "Allow public insert class_grades" ON public.class_grades FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update class_grades" ON public.class_grades;
CREATE POLICY "Allow public update class_grades" ON public.class_grades FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete class_grades" ON public.class_grades;
CREATE POLICY "Allow public delete class_grades" ON public.class_grades FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read rooms" ON public.rooms;
CREATE POLICY "Allow public read rooms" ON public.rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert rooms" ON public.rooms;
CREATE POLICY "Allow public insert rooms" ON public.rooms FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update rooms" ON public.rooms;
CREATE POLICY "Allow public update rooms" ON public.rooms FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete rooms" ON public.rooms;
CREATE POLICY "Allow public delete rooms" ON public.rooms FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read class_rooms" ON public.class_rooms;
CREATE POLICY "Allow public read class_rooms" ON public.class_rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert class_rooms" ON public.class_rooms;
CREATE POLICY "Allow public insert class_rooms" ON public.class_rooms FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update class_rooms" ON public.class_rooms;
CREATE POLICY "Allow public update class_rooms" ON public.class_rooms FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete class_rooms" ON public.class_rooms;
CREATE POLICY "Allow public delete class_rooms" ON public.class_rooms FOR DELETE USING (true);

-- =========================================================================
-- 4. STRUKTUR PERSETUJUAN PENUGASAN WALI KELAS (ROLE: GURU & KEPALA SEKOLAH)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.homeroom_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    teacher_name VARCHAR(255) NOT NULL,
    class_name VARCHAR(255) NOT NULL,
    class_room_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.homeroom_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read homeroom_assignments" ON public.homeroom_assignments;
CREATE POLICY "Allow public read homeroom_assignments" ON public.homeroom_assignments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert homeroom_assignments" ON public.homeroom_assignments;
CREATE POLICY "Allow public insert homeroom_assignments" ON public.homeroom_assignments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update homeroom_assignments" ON public.homeroom_assignments;
CREATE POLICY "Allow public update homeroom_assignments" ON public.homeroom_assignments FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete homeroom_assignments" ON public.homeroom_assignments;
CREATE POLICY "Allow public delete homeroom_assignments" ON public.homeroom_assignments FOR DELETE USING (true);

-- =========================================================================
-- 5. TABEL 2: KHUSUS JURNAL KBM & PRESENSI KELAS (TEACHING JOURNAL)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.kbm_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id VARCHAR(100) NOT NULL,
    teacher_name VARCHAR(255) NOT NULL,
    class_name VARCHAR(255) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time VARCHAR(20) NOT NULL, -- Contoh: "07:30"
    end_time VARCHAR(20) NOT NULL,   -- Contoh: "09:00"
    meeting_topic TEXT NOT NULL,
    notes TEXT,
    attendances_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeks Performa Jurnal KBM
CREATE INDEX IF NOT EXISTS idx_kbm_journals_class_date ON public.kbm_journals(class_name, date);
CREATE INDEX IF NOT EXISTS idx_kbm_journals_teacher ON public.kbm_journals(teacher_id);

ALTER TABLE public.kbm_journals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read kbm_journals" ON public.kbm_journals;
CREATE POLICY "Allow public read kbm_journals" ON public.kbm_journals FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert kbm_journals" ON public.kbm_journals;
CREATE POLICY "Allow public insert kbm_journals" ON public.kbm_journals FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update kbm_journals" ON public.kbm_journals;
CREATE POLICY "Allow public update kbm_journals" ON public.kbm_journals FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete kbm_journals" ON public.kbm_journals;
CREATE POLICY "Allow public delete kbm_journals" ON public.kbm_journals FOR DELETE USING (true);
