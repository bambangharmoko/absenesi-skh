-- =========================================================================
-- SKH SANTO FRANSISKUS ASISI - SUPABASE DATABASE SCHEMA
-- Jalankan query SQL ini di Supabase SQL Editor (https://supabase.com/dashboard)
-- =========================================================================

-- 1. Table: students (Data Master Siswa)
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

-- 2. Table: face_embeddings (Vektor Fitur Wajah 128-Dimensi & Foto)
CREATE TABLE IF NOT EXISTS public.face_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    pose_label VARCHAR(50),
    photo_path TEXT,
    embedding_vector TEXT NOT NULL, -- JSON Stringified Array of 128-d Float
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table: attendances (Catatan Presensi Masuk & Pulang)
CREATE TABLE IF NOT EXISTS public.attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time_in VARCHAR(20),
    time_out VARCHAR(20),
    status VARCHAR(50) DEFAULT 'HADIR', -- HADIR, TERLAMBAT, PULANG, IZIN, SAKIT
    confidence_score FLOAT DEFAULT 1.0,
    verification_method VARCHAR(50) DEFAULT 'FACE_RECOGNITION',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for Lightning Fast Face Matching & Dashboard Queries
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_name);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_student ON public.face_embeddings(student_id);
CREATE INDEX IF NOT EXISTS idx_attendances_date ON public.attendances(date);
CREATE INDEX IF NOT EXISTS idx_attendances_student_date ON public.attendances(student_id, date);

-- Enable Row Level Security (RLS) with Public Access for Kiosk Application
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

-- Allow Public Read/Write for Kiosk & Web App
CREATE POLICY "Allow public read students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Allow public insert students" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update students" ON public.students FOR UPDATE USING (true);
CREATE POLICY "Allow public delete students" ON public.students FOR DELETE USING (true);

CREATE POLICY "Allow public read face_embeddings" ON public.face_embeddings FOR SELECT USING (true);
CREATE POLICY "Allow public insert face_embeddings" ON public.face_embeddings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete face_embeddings" ON public.face_embeddings FOR DELETE USING (true);

CREATE POLICY "Allow public read attendances" ON public.attendances FOR SELECT USING (true);
CREATE POLICY "Allow public insert attendances" ON public.attendances FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update attendances" ON public.attendances FOR UPDATE USING (true);
CREATE POLICY "Allow public delete attendances" ON public.attendances FOR DELETE USING (true);

-- =========================================================================
-- STRUKTUR KELOLA KELAS & RUANGAN (ROLE: KEPALA SEKOLAH)
-- =========================================================================

-- 4. Table: class_grades (Tingkat Kelas - Contoh: "Kelas TK A", "Kelas TK B")
CREATE TABLE IF NOT EXISTS public.class_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Table: rooms (Nama Ruangan - Contoh: "Kelas Cemerlang", "Kelas Ceria")
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Table: class_rooms (Kombinasi Tingkat Kelas + Ruangan - Contoh: "Kelas TK A - Kelas Cemerlang")
CREATE TABLE IF NOT EXISTS public.class_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_id UUID NOT NULL REFERENCES public.class_grades(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    display_name VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_grade_room UNIQUE (grade_id, room_id)
);

-- Case-insensitive Uniqueness Constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_class_grades_unique_lower_name ON public.class_grades (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_unique_lower_name ON public.rooms (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_class_rooms_unique_lower_display_name ON public.class_rooms (LOWER(display_name));

-- Enable RLS & Policies for Class & Room Tables
ALTER TABLE public.class_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read class_grades" ON public.class_grades FOR SELECT USING (true);
CREATE POLICY "Allow public insert class_grades" ON public.class_grades FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update class_grades" ON public.class_grades FOR UPDATE USING (true);
CREATE POLICY "Allow public delete class_grades" ON public.class_grades FOR DELETE USING (true);

CREATE POLICY "Allow public read rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Allow public insert rooms" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update rooms" ON public.rooms FOR UPDATE USING (true);
CREATE POLICY "Allow public delete rooms" ON public.rooms FOR DELETE USING (true);

CREATE POLICY "Allow public read class_rooms" ON public.class_rooms FOR SELECT USING (true);
CREATE POLICY "Allow public insert class_rooms" ON public.class_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update class_rooms" ON public.class_rooms FOR UPDATE USING (true);
CREATE POLICY "Allow public delete class_rooms" ON public.class_rooms FOR DELETE USING (true);

-- =========================================================================
-- STRUKTUR PERSETUJUAN PENUGASAN WALI KELAS (ROLE: GURU & KEPALA SEKOLAH)
-- =========================================================================

-- 7. Table: homeroom_assignments (Pengajuan & Persetujuan Penugasan Wali Kelas)
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
CREATE POLICY "Allow public read homeroom_assignments" ON public.homeroom_assignments FOR SELECT USING (true);
CREATE POLICY "Allow public insert homeroom_assignments" ON public.homeroom_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update homeroom_assignments" ON public.homeroom_assignments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete homeroom_assignments" ON public.homeroom_assignments FOR DELETE USING (true);

-- =========================================================================
-- STRUKTUR JURNAL KBM & PRESENSI KELAS (TEACHING JOURNAL)
-- =========================================================================

-- 8. Table: kbm_journals (Catatan Pembelajaran & Presensi Harian Siswa oleh Wali Kelas)
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

ALTER TABLE public.kbm_journals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read kbm_journals" ON public.kbm_journals FOR SELECT USING (true);
CREATE POLICY "Allow public insert kbm_journals" ON public.kbm_journals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update kbm_journals" ON public.kbm_journals FOR UPDATE USING (true);
CREATE POLICY "Allow public delete kbm_journals" ON public.kbm_journals FOR DELETE USING (true);

