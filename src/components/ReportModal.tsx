import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';

export interface ReportTarget {
  targetType: 'user' | 'post' | 'comment' | 'message';
  targetId: string;
  targetUserId: string;
  targetUserName: string;
}

interface ReportModalProps {
  target: ReportTarget | null;
  onClose: () => void;
  onReported: (blocked: boolean) => void;
}

const REPORT_REASONS = [
  'Harassment or Bullying',
  'Spam or Scam Links',
  'Inappropriate or Explicit Content',
  'Cheating, Exploits, or Account Phishing',
  'Impersonation',
];

export const ReportModal: React.FC<ReportModalProps> = ({ target, onClose, onReported }) => {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (!target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.submitReport({
        ...target,
        reason,
        details,
        alsoBlock,
      });
      setDetails('');
      onReported(alsoBlock);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-zinc-950 dark:text-zinc-50">
                Report Bad Actor
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Reporting {target.targetType} by{' '}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {target.targetUserName}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Reason for report
            </label>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                    reason === r
                      ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white font-semibold'
                      : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="sr-only"
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Additional Details{' '}
              <span className="text-zinc-400 dark:text-zinc-500 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide any context for our safety moderators..."
              className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400 resize-none"
            />
          </div>

          <label className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={alsoBlock}
              onChange={(e) => setAlsoBlock(e.target.checked)}
              className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-950 focus:ring-zinc-900"
            />
            <span>Also block {target.targetUserName} so I do not see their posts or messages</span>
          </label>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-2 px-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
