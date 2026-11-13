import React, { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle2, UserX } from 'lucide-react';
import { ReportRecord, User } from '../types';
import { api } from '../services/api';
import { formatRelativeTime } from '../utils/formatters';

interface SafetyViewProps {
  currentUser: User;
  onUserUpdated: (user: User) => void;
}

export const SafetyView: React.FC<SafetyViewProps> = ({ currentUser, onUserUpdated }) => {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getMyReports()
      .then((res) => setReports(res.reports))
      .finally(() => setLoading(false));
  }, []);

  const handleUnblock = async (targetUserId: string) => {
    const res = await api.toggleBlockUser(targetUserId);
    onUserUpdated({
      ...currentUser,
      blockedUserIds: res.blockedUserIds,
    });
  };

  return (
    <div className="pilgrim-stack">
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pilgrim-card-pad transition-colors">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-zinc-950 dark:text-zinc-50">
              Safety & Bad Actor Reports
            </h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl">
              Pilgrim helps keep servers and profiles welcoming. You can report any post, comment, message, or user using the flag icon, and review your submitted reports or blocked accounts here.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Submitted Reports */}
        <section className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden transition-colors">
          <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-zinc-950 dark:text-zinc-50">
              Your Submitted Reports
            </h2>
            <span className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
              {reports.length} total
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
              Loading reports...
            </div>
          ) : reports.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-zinc-400 dark:text-zinc-500 mx-auto" />
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                No reports submitted
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                When you report a bad actor from a post, comment, or server message, it will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {reports.map((r) => (
                <div key={r.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-zinc-950 dark:text-zinc-50">
                        {r.targetUserName}
                      </span>
                      <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                        ·
                      </span>
                      <span className="text-zinc-600 dark:text-zinc-400 capitalize">
                        {r.targetType}
                      </span>
                      <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                        ·
                      </span>
                      <span className="text-zinc-400 dark:text-zinc-500 font-mono">
                        {formatRelativeTime(r.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      {r.reason}
                    </p>
                    {r.details && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{r.details}</p>
                    )}
                  </div>
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 shrink-0">
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Blocked Accounts */}
        <section className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden transition-colors">
          <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-zinc-950 dark:text-zinc-50">
              Blocked Accounts
            </h2>
            <span className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
              {currentUser.blockedUserIds?.length || 0}
            </span>
          </div>

          {!currentUser.blockedUserIds || currentUser.blockedUserIds.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
              You have not blocked any accounts.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {currentUser.blockedUserIds.map((uid) => (
                <div key={uid} className="p-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 truncate">
                    <UserX className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                    <span className="font-mono truncate">{uid}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnblock(uid)}
                    className="py-1 px-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg cursor-pointer"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
