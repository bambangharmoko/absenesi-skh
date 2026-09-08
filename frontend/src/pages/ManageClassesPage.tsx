import React, { useState, useEffect } from 'react';
import {
  Layers,
  School,
  DoorOpen,
  Plus,
  Trash2,
  Power,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  Search,
  Filter,
} from 'lucide-react';
import { api, ClassGrade, RoomItem, ClassRoomCombination } from '../services/api';

export const ManageClassesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'COMBINATIONS' | 'GRADES' | 'ROOMS'>('COMBINATIONS');

  const [grades, setGrades] = useState<ClassGrade[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [combinations, setCombinations] = useState<ClassRoomCombination[]>([]);

  // Forms state
  const [newGradeName, setNewGradeName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchData = () => {
    const g = api.getClassGrades();
    const r = api.getRooms();
    const c = api.getClassRooms();
    setGrades(g);
    setRooms(r);
    setCombinations(c);

    if (g.length > 0 && !selectedGradeId) setSelectedGradeId(g[0].id);
    if (r.length > 0 && !selectedRoomId) setSelectedRoomId(r[0].id);
  };

  useEffect(() => {
    fetchData();
    const handleUpdate = () => fetchData();
    window.addEventListener('skh_class_rooms_updated', handleUpdate);
    return () => window.removeEventListener('skh_class_rooms_updated', handleUpdate);
  }, []);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 4000);
  };

  // Add Grade Handler
  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGradeName.trim()) return;

    try {
      const created = await api.addClassGrade(newGradeName.trim());
      showNotice('success', `Tingkat Kelas "${created.name}" berhasil ditambahkan!`);
      setNewGradeName('');
      fetchData();
    } catch (err: any) {
      showNotice('error', err.message || 'Gagal menambahkan Tingkat Kelas.');
    }
  };

  // Delete Grade Handler
  const handleDeleteGrade = async (grade: ClassGrade) => {
    if (confirm(`Hapus Tingkat Kelas "${grade.name}"?`)) {
      try {
        await api.deleteClassGrade(grade.id);
        showNotice('success', `Tingkat Kelas "${grade.name}" berhasil dihapus.`);
        fetchData();
      } catch (err: any) {
        showNotice('error', err.message || 'Gagal menghapus Tingkat Kelas.');
      }
    }
  };

  // Add Room Handler
  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    try {
      const created = await api.addRoom(newRoomName.trim());
      showNotice('success', `Nama Ruangan "${created.name}" berhasil ditambahkan!`);
      setNewRoomName('');
      fetchData();
    } catch (err: any) {
      showNotice('error', err.message || 'Gagal menambahkan Nama Ruangan.');
    }
  };

  // Delete Room Handler
  const handleDeleteRoom = async (room: RoomItem) => {
    if (confirm(`Hapus Nama Ruangan "${room.name}"?`)) {
      try {
        await api.deleteRoom(room.id);
        showNotice('success', `Nama Ruangan "${room.name}" berhasil dihapus.`);
        fetchData();
      } catch (err: any) {
        showNotice('error', err.message || 'Gagal menghapus Nama Ruangan.');
      }
    }
  };

  // Add Combination Handler
  const handleAddCombination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGradeId || !selectedRoomId) {
      showNotice('error', 'Pilih Tingkat Kelas dan Nama Ruangan terlebih dahulu.');
      return;
    }

    try {
      const created = await api.addClassRoom(selectedGradeId, selectedRoomId);
      showNotice('success', `Kombinasi "${created.display_name}" berhasil dipetakan!`);
      fetchData();
    } catch (err: any) {
      showNotice('error', err.message || 'Gagal memetakan kombinasi kelas.');
    }
  };

  // Toggle Combination Active
  const handleToggleActive = async (comb: ClassRoomCombination) => {
    try {
      const updated = await api.toggleClassRoomActive(comb.id);
      showNotice(
        'success',
        `Kombinasi "${comb.display_name}" sekarang ${updated.is_active ? 'Aktif' : 'Non-aktif'}.`
      );
      fetchData();
    } catch (err: any) {
      showNotice('error', err.message || 'Gagal mengubah status.');
    }
  };

  // Delete Combination Handler
  const handleDeleteCombination = async (comb: ClassRoomCombination) => {
    if (confirm(`Hapus kombinasi "${comb.display_name}" dari sistem?`)) {
      try {
        await api.deleteClassRoom(comb.id);
        showNotice('success', `Kombinasi "${comb.display_name}" berhasil dihapus.`);
        fetchData();
      } catch (err: any) {
        showNotice('error', err.message || 'Gagal menghapus kombinasi.');
      }
    }
  };

  const filteredCombinations = combinations.filter(c =>
    c.display_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedGradeObj = grades.find(g => g.id === selectedGradeId);
  const selectedRoomObj = rooms.find(r => r.id === selectedRoomId);
  const previewDisplayName =
    selectedGradeObj && selectedRoomObj ? `${selectedGradeObj.name} - ${selectedRoomObj.name}` : '-';

  return (
    <div className="flex flex-col max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Kelola Struktur Kelas & Ruangan
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Khusus Kepala Sekolah
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Atur pemisahan Tingkat Kelas, Nama Ruangan, dan relasi kombinasi resmi untuk presensi & penugasan wali kelas
          </p>
        </div>
      </div>

      {/* Action Notification Toast */}
      {notice && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 text-xs border ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-lg bg-blue-950/20 border border-blue-500/30">
          <div className="flex items-center justify-between text-blue-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Kombinasi Kelas & Ruang</span>
            <LinkIcon className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{combinations.length}</div>
          <div className="text-[11px] text-blue-300/70 mt-1">
            {combinations.filter(c => c.is_active).length} aktif digunakan
          </div>
        </div>

        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Master Tingkat Kelas</span>
            <School className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{grades.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Contoh: TK A, Kelas 1 Autis</div>
        </div>

        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Master Nama Ruangan</span>
            <DoorOpen className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{rooms.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Contoh: Cemerlang, Ceria</div>
        </div>
      </div>

      {/* Sub-Tabs Control */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-lg border border-slate-800 w-fit">
        <button
          onClick={() => setActiveTab('COMBINATIONS')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
            activeTab === 'COMBINATIONS'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          <span>Kombinasi Kelas & Ruangan ({combinations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('GRADES')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
            activeTab === 'GRADES'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <School className="w-3.5 h-3.5" />
          <span>Tingkat Kelas ({grades.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ROOMS')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
            activeTab === 'ROOMS'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <DoorOpen className="w-3.5 h-3.5" />
          <span>Nama Ruangan ({rooms.length})</span>
        </button>
      </div>

      {/* TAB 1: KOMBINASI KELAS & RUANGAN */}
      {activeTab === 'COMBINATIONS' && (
        <div className="space-y-6">
          {/* Pairing Creator Card */}
          <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Hubungkan Kelas dengan Ruangan</h3>
                <p className="text-xs text-slate-400">
                  Pasangkan Tingkat Kelas dan Nama Ruangan untuk membentuk identitas kelas resmi sistem
                </p>
              </div>
            </div>

            <form onSubmit={handleAddCombination} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              {/* Select Grade */}
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Pilih Tingkat Kelas <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedGradeId}
                  onChange={e => setSelectedGradeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition appearance-none"
                >
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Room */}
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Pilih Nama Ruangan <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedRoomId}
                  onChange={e => setSelectedRoomId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition appearance-none"
                >
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Output Preview & Action */}
              <div className="sm:col-span-4 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!selectedGradeId || !selectedRoomId}
                  className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>Petakan Kombinasi</span>
                </button>
              </div>
            </form>

            <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800 text-xs flex items-center gap-2">
              <span className="text-slate-400 text-[11px]">Format Output:</span>
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-semibold font-mono text-[11px]">
                {previewDisplayName}
              </span>
            </div>
          </div>

          {/* Combinations Table */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-white tracking-tight">Daftar Kombinasi Terdaftar</h3>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Cari kombinasi..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-lg bg-slate-900/60">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Tingkat Kelas</th>
                    <th className="py-2.5 px-4">Nama Ruangan</th>
                    <th className="py-2.5 px-4">Kombinasi Resmi (Sistem)</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCombinations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Belum ada kombinasi kelas dan ruangan. Silakan petakan di formulir atas.
                      </td>
                    </tr>
                  ) : (
                    filteredCombinations.map(c => (
                      <tr key={c.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-semibold text-white">{c.grade_name}</td>
                        <td className="py-3 px-4 text-slate-300">{c.room_name}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                            {c.display_name}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${
                              c.is_active
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${c.is_active ? 'bg-emerald-400' : 'bg-slate-500'}`}
                            />
                            <span>{c.is_active ? 'Aktif' : 'Non-aktif'}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggleActive(c)}
                              title={c.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                              className={`px-2.5 py-1 rounded text-xs font-medium border flex items-center gap-1 transition ${
                                c.is_active
                                  ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                  : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50 hover:bg-emerald-900/50'
                              }`}
                            >
                              <Power className="w-3 h-3" />
                              <span>{c.is_active ? 'Nonaktifkan' : 'Aktifkan'}</span>
                            </button>

                            <button
                              onClick={() => handleDeleteCombination(c)}
                              title="Hapus kombinasi"
                              className="p-1 rounded bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border border-rose-900/50 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MASTER TINGKAT KELAS */}
      {activeTab === 'GRADES' && (
        <div className="space-y-6">
          <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white tracking-tight">Tambah Master Tingkat Kelas</h3>
            <form onSubmit={handleAddGrade} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newGradeName}
                onChange={e => setNewGradeName(e.target.value)}
                placeholder="Contoh: Kelas TK A, Kelas 4 Tunagrahita..."
                className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
              <button
                type="submit"
                disabled={!newGradeName.trim()}
                className="py-2 px-5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Simpan Tingkat Kelas</span>
              </button>
            </form>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-lg bg-slate-900/60">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Nama Tingkat Kelas</th>
                  <th className="py-2.5 px-4">Tanggal Dibuat</th>
                  <th className="py-2.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {grades.map(g => (
                  <tr key={g.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-semibold text-white">{g.name}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(g.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteGrade(g)}
                        className="p-1 rounded bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border border-rose-900/50 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MASTER NAMA RUANGAN */}
      {activeTab === 'ROOMS' && (
        <div className="space-y-6">
          <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white tracking-tight">Tambah Master Nama Ruangan</h3>
            <form onSubmit={handleAddRoom} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                placeholder="Contoh: Kelas Cemerlang, Ruang Anggrek, Ruang Ceria..."
                className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
              <button
                type="submit"
                disabled={!newRoomName.trim()}
                className="py-2 px-5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Simpan Nama Ruangan</span>
              </button>
            </form>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-lg bg-slate-900/60">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Nama Ruangan</th>
                  <th className="py-2.5 px-4">Tanggal Dibuat</th>
                  <th className="py-2.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rooms.map(r => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-semibold text-white">{r.name}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(r.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteRoom(r)}
                        className="p-1 rounded bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border border-rose-900/50 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
