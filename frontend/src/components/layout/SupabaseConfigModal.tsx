import React from 'react';

// SupabaseConfigModal has been deprecated and removed.
// Supabase credentials are now managed securely via environment variables and automatic direct connection.
export const SupabaseConfigModal: React.FC<{ isOpen?: boolean; onClose?: () => void; onSyncSuccess?: () => void }> = () => null;
export default SupabaseConfigModal;
