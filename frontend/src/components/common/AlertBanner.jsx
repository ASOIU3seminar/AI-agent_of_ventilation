import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

export function AlertBanner({ error, successMsg }) {
  if (!error && !successMsg) return null;

  return (
    <div className="px-6 pt-3">
      {error && (
        <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {successMsg && (
        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" /> {successMsg}
        </div>
      )}
    </div>
  );
}
