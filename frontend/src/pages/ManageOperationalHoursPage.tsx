import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Search,
  CheckSquare,
  Square,
  Save,
  Layers,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import { api, ClassRoomCombination } from '../services/api';

export const ManageOperationalHoursPage: React.FC = () => {
  const [combinations, setCombinations] = useState<ClassRoomCombination[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE_ONLY'>('ACTIVE_ONLY');

  // Input state for bulk updating
  const [bulkTimeIn, setBulkTimeIn] = useState('07:30');
  const [bulkTimeOut, setBulkTimeOut] = useState('12:00');

  // Inline editing state for individual class row
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [inlineTimeIn, setInlineTimeIn] = useState('07:30');
  const [inlineTimeOut, setInlineTimeOut] = useState('12:00');

  // Feedback notifications
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 4000);
  };

  const triggerErrorAlert = (msg: string) => {
    setErrorModal(msg);
    showToast('error', msg);
  };

  const loadData = () => {
    const list = api.getClassRooms();
    setCombinations(list);
  };

  useEffect(() => {
    loadData();
    api.syncClassRooms().then(() => loadData());

    const handleUpdate = () => loadData();
    window.addEventListener('skh_class_rooms_updated', handleUpdate);
    return () => window.removeEventListener('skh_class_rooms_updated', handleUpdate);
  }, []);

  // Filtered combinations
  const filteredCombinations = useMemo(() => {
    return combinations.filter(item => {
      const matchStatus = statusFilter === 'ACTIVE_ONLY' ? item.is_active : true;
      const matchSearch =
        searchTerm.trim() === '' ||
        item.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.grade_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.room_name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [combinations, statusFilter, searchTerm]);

  // Handle Select All toggle
  const isAllSelected =
    filteredCombinations.length > 0 &&
    filteredCombinations.every(item => selectedIds.includes(item.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      // Unselect only those currently in filtered list
      const filteredIds = new Set(filteredCombinations.map(c => c.id));
      setSelectedIds(prev => prev.filter(id => !filteredIds.has(id)));
    } else {
      // Select all currently visible in filtered list
      const currentSelected = new Set(selectedIds);
      filteredCombinations.forEach(c => currentSelected.add(c.id));
      setSelectedIds(Array.from(currentSelected));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Duration helper
  const calculateDuration = (timeIn: string, timeOut: string) => {
    if (!timeIn || !timeOut) return '-';
    const [inH, inM] = timeIn.split(':').map(Number);
    const [outH, outM] = timeOut.split(':').map(Number);
    if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) return '-';
    const diffMinutes = outH * 60 + outM - (inH * 60 + inM);
    if (diffMinutes <= 0) return 'Invalid';
    const h = Math.floor(diffMinutes / 60);
    const m = diffMinutes % 60;
    return m > 0 ? `${h} jam ${m} mnt` : `${h} jam`;
  };

  // Bulk Apply Handler
  const handleBulkApply = async () => {
    if (selectedIds.length === 0) {
      triggerErrorAlert('Pilih setidaknya satu kelas pada daftar di bawah dengan memberi tanda centang.');
      return;
    }

    if (!bulkTimeIn || !bulkTimeOut) {
      triggerErrorAlert('Jam Masuk dan Jam Pulang wajib diisi.');
      return;
    }

    if (bulkTimeOut <= bulkTimeIn) {
      triggerErrorAlert(
        `Validasi Gagal: Jam Pulang (${bulkTimeOut}) harus lebih besar daripada Jam Masuk (${bulkTimeIn}).`
      );
      return;
    }

    setIsSaving(true);
    try {
      await api.updateClassOperationalHours(selectedIds, bulkTimeIn, bulkTimeOut);
      showToast(
        'success',
        `Jadwal operasional berhasil diterapkan serentak ke ${selectedIds.length} kelas terpilih!`
      );
      loadData();
    } catch (err: any) {
      triggerErrorAlert(err?.message || 'Gagal menyimpan pengaturan jam operasional.');
    } finally {
      setIsSaving(false);
    }
  };

  // Single Class Inline Save
  const handleSaveInline = async (classId: string) => {
    if (inlineTimeOut <= inlineTimeIn) {
      triggerErrorAlert(
        `Validasi Gagal: Jam Pulang (${inlineTimeOut}) harus lebih besar daripada Jam Masuk (${inlineTimeIn}).`
      );
      return;
    }

    try {
      await api.updateClassOperationalHours([classId], inlineTimeIn, inlineTimeOut);
      showToast('success', 'Jadwal jam masuk & pulang kelas berhasil diperbarui!');
      setEditingClassId(null);
      loadData();
    } catch (err: any) {
      triggerErrorAlert(err?.message || 'Gagal memperbarui jam operasional kelas.');
    }
  };

  // Presets
  const applyPreset = (inTime: string, outTime: string) => {
    setBulkTimeIn(inTime);
    setBulkTimeOut(outTime);
  };

  return (
    <div className="flex flex-col max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Banner */}
      {notice && (
        <div
          className={`fixed top-20 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-xl text-xs font-medium border transition-all animate-in fade-in slide-in-from-top-3 ${
            notice.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-800 backdrop-blur-md'
              : 'bg-rose-950/90 text-rose-300 border-rose-800 backdrop-blur-md'
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

      {/* Pop-up Error Modal */}
      {errorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md overflow-hidden rounded-xl bg-slate-900 border border-rose-500/30 p-6 shadow-2xl text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-rose-400">Validasi Jam Operasional</h3>
                <p className="text-xs text-slate-400">Kesalahan Pengaturan Waktu</p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-rose-950/20 border border-rose-900/40 text-xs text-slate-200 leading-relaxed mb-5">
              {errorModal}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setErrorModal(null)}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow transition cursor-pointer"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Pengaturan Jam Masuk & Pulang
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Role: Kepala Sekolah
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Atur jadwal operasional presensi harian per kelas, atau centang beberapa kelas sekaligus untuk bulk update.
          </p>
        </div>

        <button
          onClick={() => {
            loadData();
            showToast('success', 'Data jam operasional disinkronkan kembali dari cloud.');
          }}
          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-2 border border-slate-800 transition cursor-pointer"
          title="Segarkan data"
        >
          <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Bulk Configuration Panel (Multi-Select Action) */}
      <div className="rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-[#0f172a] border border-blue-500/30 p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          {/* Left: Input Jam & Presets */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm sm:text-base font-bold text-white">
                Terapkan Jam Operasional Massal (Bulk Update)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Jam Masuk */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Jam Masuk Siswa <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={bulkTimeIn}
                    onChange={e => setBulkTimeIn(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              {/* Jam Pulang */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Jam Pulang Siswa <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={bulkTimeOut}
                    onChange={e => setBulkTimeOut(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              {/* Estimated Duration */}
              <div className="flex flex-col justify-end">
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
                  <span className="text-slate-400 block text-[11px]">Durasi Belajar:</span>
                  <span className="font-semibold text-blue-400 font-mono text-xs">
                    {calculateDuration(bulkTimeIn, bulkTimeOut)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-400 font-medium">Preset Cepat:</span>
              <button
                type="button"
                onClick={() => applyPreset('07:30', '12:00')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 border border-slate-700 transition cursor-pointer"
              >
                Reguler (07:30 - 12:00)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('07:30', '11:00')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 border border-slate-700 transition cursor-pointer"
              >
                Jumat Pendek (07:30 - 11:00)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('08:00', '14:00')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 border border-slate-700 transition cursor-pointer"
              >
                Fullday / Terapi (08:00 - 14:00)
              </button>
            </div>
          </div>

          {/* Right: Apply Button & Selection Counter */}
          <div className="flex flex-col items-start lg:items-end justify-center gap-3 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
            <div className="text-xs text-slate-300 font-medium">
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-bold mr-1.5">
                {selectedIds.length}
              </span>
              kelas terpilih
            </div>

            <button
              onClick={handleBulkApply}
              disabled={isSaving || selectedIds.length === 0}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-lg transition select-none ${
                selectedIds.length > 0 && !isSaving
                  ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-blue-500/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Terapkan ke {selectedIds.length} Kelas Terpilih</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Selection Controls */}
      <div className="rounded-lg bg-slate-900/60 p-4 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Select All Checkbox Button */}
          <button
            onClick={handleToggleSelectAll}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            {isAllSelected ? (
              <CheckSquare className="w-4 h-4 text-blue-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>{isAllSelected ? 'Batalkan Pilih Semua' : 'Pilih Semua'}</span>
            <span className="text-[10px] text-slate-400 font-mono">
              ({filteredCombinations.length})
            </span>
          </button>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('ACTIVE_ONLY')}
              className={`px-2.5 py-1 rounded text-xs transition cursor-pointer ${
                statusFilter === 'ACTIVE_ONLY'
                  ? 'bg-slate-800 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Kelas Aktif Saja
            </button>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded text-xs transition cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-slate-800 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semua Kelas
            </button>
          </div>
        </div>

        {/* Search Filter */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari kelas atau ruangan..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* Class List Table with Checkboxes */}
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4">Kombinasi Kelas & Ruangan</th>
                <th className="py-3.5 px-4">Tingkat Kelas</th>
                <th className="py-3.5 px-4">Nama Ruangan</th>
                <th className="py-3.5 px-4 text-center">Jam Masuk</th>
                <th className="py-3.5 px-4 text-center">Jam Pulang</th>
                <th className="py-3.5 px-4 text-center">Durasi Belajar</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs text-slate-200 font-normal">
              {filteredCombinations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Tidak ada kelas yang sesuai dengan filter.</p>
                  </td>
                </tr>
              ) : (
                filteredCombinations.map((item, idx) => {
                  const isSelected = selectedIds.includes(item.id);
                  const isEditing = editingClassId === item.id;
                  const duration = calculateDuration(
                    item.time_in || '07:30',
                    item.time_out || '12:00'
                  );

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-800/40 transition ${
                        isSelected ? 'bg-blue-950/20' : idx % 2 === 0 ? 'bg-slate-900/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectItem(item.id)}
                          className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Display Name */}
                      <td className="py-3.5 px-4 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{item.display_name}</span>
                        </div>
                      </td>

                      {/* Grade */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] border border-slate-700 font-medium">
                          {item.grade_name}
                        </span>
                      </td>

                      {/* Room */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] border border-slate-700 font-medium">
                          {item.room_name}
                        </span>
                      </td>

                      {/* Jam Masuk */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        {isEditing ? (
                          <input
                            type="time"
                            value={inlineTimeIn}
                            onChange={e => setInlineTimeIn(e.target.value)}
                            className="px-2 py-1 rounded bg-slate-950 border border-blue-500 text-xs text-white font-mono text-center focus:outline-none"
                          />
                        ) : (
                          <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold text-xs">
                            {item.time_in || '07:30'}
                          </span>
                        )}
                      </td>

                      {/* Jam Pulang */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        {isEditing ? (
                          <input
                            type="time"
                            value={inlineTimeOut}
                            onChange={e => setInlineTimeOut(e.target.value)}
                            className="px-2 py-1 rounded bg-slate-950 border border-blue-500 text-xs text-white font-mono text-center focus:outline-none"
                          />
                        ) : (
                          <span className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold text-xs">
                            {item.time_out || '12:00'}
                          </span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-4 text-center font-mono text-[11px] text-slate-400">
                        {duration}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            item.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}
                        >
                          {item.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleSaveInline(item.id)}
                              className="p-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
                              title="Simpan perubahan jam kelas"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingClassId(null)}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                              title="Batal"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingClassId(item.id);
                              setInlineTimeIn(item.time_in || '07:30');
                              setInlineTimeOut(item.time_out || '12:00');
                            }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition cursor-pointer"
                          >
                            Edit Jam
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
