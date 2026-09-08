import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserCheck,
  UserX,
  Clock,
  Check,
  X,
  Search,
  Trash2,
  Power,
  Shield,
  GraduationCap,
  Users,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, UserAccount, UserRole } from '../services/api';

export const UserManagementPage: React.FC = () => {
  const { currentUser, refreshUser } = useAuth();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchUsers = () => {
    const list = api.getUsers();
    setUsers(list);
  };

  useEffect(() => {
    fetchUsers();
    const handleUpdate = () => {
      fetchUsers();
      refreshUser();
    };
    window.addEventListener('skh_users_updated', handleUpdate);
    return () => window.removeEventListener('skh_users_updated', handleUpdate);
  }, []);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setActionNotice({ type, message });
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleApprove = async (user: UserAccount) => {
    try {
      await api.approveUser(user.id);
      showNotice('success', `Akun ${user.full_name} (@${user.username}) berhasil disetujui!`);
      fetchUsers();
    } catch (err: any) {
      showNotice('error', err.message || 'Gagal menyetujui akun.');
    }
  };

  const handleReject = async (user: UserAccount) => {
    if (confirm(`Apakah Anda yakin ingin menolak permohonan akun ${user.full_name}?`)) {
      try {
        await api.rejectUser(user.id);
        showNotice('success', `Permohonan akun @${user.username} telah ditolak.`);
        fetchUsers();
      } catch (err: any) {
        showNotice('error', err.message || 'Gagal menolak akun.');
      }
    }
  };

  const handleToggleActive = async (user: UserAccount) => {
    if (user.id === currentUser?.id) {
      alert('Anda tidak dapat menonaktifkan akun Kepala Sekolah yang sedang digunakan.');
      return;
    }

    try {
      const updated = await api.toggleUserActive(user.id);
      showNotice(
        'success',
        `Akun @${user.username} ${updated.is_active ? 'diaktifkan kembali' : 'berhasil dinonaktifkan'}.`
      );
      fetchUsers();
    } catch (err: any) {
      showNotice('error', err.message || 'Gagal mengubah status aktif akun.');
    }
  };

  const handleDelete = async (user: UserAccount) => {
    if (user.id === currentUser?.id) {
      alert('Anda tidak dapat menghapus akun Kepala Sekolah yang sedang digunakan.');
      return;
    }

    if (confirm(`Hapus permanen akun ${user.full_name} (@${user.username}) dari sistem?`)) {
      try {
        await api.deleteUser(user.id);
        showNotice('success', `Akun @${user.username} telah dihapus.`);
        fetchUsers();
      } catch (err: any) {
        showNotice('error', err.message || 'Gagal menghapus akun.');
      }
    }
  };

  const pendingUsers = users.filter(u => u.status === 'PENDING');
  const nonPendingUsers = users.filter(u => u.status !== 'PENDING');

  const filteredUsers = nonPendingUsers.filter(u => {
    const matchSearch =
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.nuptk.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const countGuru = users.filter(u => u.role === 'GURU' && u.status === 'APPROVED').length;
  const countAdmin = users.filter(u => u.role === 'ADMIN' && u.status === 'APPROVED').length;
  const countActive = users.filter(u => u.is_active && u.status === 'APPROVED').length;

  return (
    <div className="flex flex-col max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Manajemen Pengguna & Otorisasi
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Khusus Kepala Sekolah
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Kelola hak akses role Admin & Guru, verifikasi permohonan akun baru, dan kontrol status akun
          </p>
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 text-xs border ${
            actionNotice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
          }`}
        >
          {actionNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{actionNotice.message}</span>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Akun</span>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{users.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Semua status</div>
        </div>

        <div className="p-4 rounded-lg bg-amber-950/20 border border-amber-500/30">
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Perlu Approval</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">{pendingUsers.length}</div>
          <div className="text-[11px] text-amber-300/70 mt-1">Menunggu persetujuan</div>
        </div>

        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Guru Disetujui</span>
            <GraduationCap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono">{countGuru}</div>
          <div className="text-[11px] text-slate-400 mt-1">Wali & Pengajar</div>
        </div>

        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Admin Aktif</span>
            <Shield className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 font-mono">{countAdmin}</div>
          <div className="text-[11px] text-slate-400 mt-1">{countActive} akun aktif total</div>
        </div>
      </div>

      {/* SECTION 1: PENDING APPROVALS QUEUE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Permohonan Pendaftaran Baru ({pendingUsers.length})
            </h3>
          </div>
          <span className="text-xs text-amber-400 font-medium">Memerlukan Tindakan Kepala Sekolah</span>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="p-6 rounded-lg bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
            Tidak ada antrean permohonan akun baru saat ini. Seluruh permohonan telah diproses.
          </div>
        ) : (
          <div className="overflow-x-auto border border-amber-500/30 rounded-lg bg-slate-900/80">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Calon Pengguna</th>
                  <th className="py-3 px-4">NUPTK / NIP</th>
                  <th className="py-3 px-4">Role Dimohon</th>
                  <th className="py-3 px-4">Wali Kelas</th>
                  <th className="py-3 px-4">Waktu Daftar</th>
                  <th className="py-3 px-4 text-right">Keputusan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {pendingUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{u.full_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">@{u.username}</div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-300">{u.nuptk}</td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          u.role === 'ADMIN'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-400">{u.wali_kelas || '-'}</td>

                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(u.created_at).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApprove(u)}
                          className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 shadow-xs transition"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Setujui</span>
                        </button>
                        <button
                          onClick={() => handleReject(u)}
                          className="px-3 py-1.5 rounded-md bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/50 font-medium text-xs flex items-center gap-1 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Tolak</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: REGISTERED USERS MANAGEMENT */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Daftar Akun Pengguna Terdaftar</h3>
            <p className="text-xs text-slate-400">Kontrol status aktif, peran otorisasi, dan akun petugas sekolah</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Cari user / NUPTK..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
            >
              <option value="all">Semua Peran</option>
              <option value="KEPALA_SEKOLAH">Kepala Sekolah</option>
              <option value="ADMIN">Admin</option>
              <option value="GURU">Guru</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-lg bg-slate-900/60">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-4">Pengguna</th>
                <th className="py-2.5 px-4">NUPTK</th>
                <th className="py-2.5 px-4">Role & Hak Akses</th>
                <th className="py-2.5 px-4">Wali Kelas</th>
                <th className="py-2.5 px-4">Status Akun</th>
                <th className="py-2.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Tidak ada akun pengguna yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const isCurrent = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-blue-400 text-xs shrink-0">
                            {u.full_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{u.full_name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono">
                                  Anda
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">@{u.username}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-300">{u.nuptk || '-'}</td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            u.role === 'KEPALA_SEKOLAH'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : u.role === 'ADMIN'
                              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-400">{u.wali_kelas || '-'}</td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              !u.is_active
                                ? 'bg-slate-500'
                                : u.status === 'APPROVED'
                                ? 'bg-emerald-400'
                                : 'bg-rose-400'
                            }`}
                          />
                          <span
                            className={`text-xs font-medium ${
                              !u.is_active
                                ? 'text-slate-400'
                                : u.status === 'APPROVED'
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {!u.is_active ? 'Non-aktif' : u.status === 'APPROVED' ? 'Aktif' : 'Ditolak'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {u.role !== 'KEPALA_SEKOLAH' && (
                            <>
                              <button
                                onClick={() => handleToggleActive(u)}
                                title={u.is_active ? 'Nonaktifkan akun' : 'Aktifkan kembali'}
                                className={`px-2.5 py-1 rounded text-xs font-medium border flex items-center gap-1 transition ${
                                  u.is_active
                                    ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50 hover:bg-emerald-900/50'
                                }`}
                              >
                                <Power className="w-3 h-3" />
                                <span>{u.is_active ? 'Nonaktifkan' : 'Aktifkan'}</span>
                              </button>

                              <button
                                onClick={() => handleDelete(u)}
                                title="Hapus akun permanen"
                                className="p-1 rounded bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border border-rose-900/50 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
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
