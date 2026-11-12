import React, { useState } from 'react';
import { X, Copy, Check, Link, Shield, Users } from 'lucide-react';
import { FileRecord } from '../types';

interface ShareModalProps {
  file: FileRecord | null;
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  file,
  isOpen,
  onClose,
  userRole = 'freelancer',
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const origin = window.location.origin;
  const shareUrl = file
    ? `${origin}/?fileId=${file.id}&project=${encodeURIComponent(file.project)}`
    : `${origin}/?portal=client`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Link className="w-5 h-5" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-base font-semibold text-slate-900 mb-1">
          {file ? 'Share File Access' : 'Client Portal Link'}
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          {file
            ? `Share direct access link for "${file.originalName}" with your client.`
            : 'Send this secure portal link to your clients so they can sign in and retrieve deliverables.'}
        </p>

        {/* Link Box */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-50 border border-slate-200 rounded-xl mb-4">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 bg-transparent px-2.5 py-1 text-xs text-slate-800 font-mono focus:outline-none truncate"
          />
          <button
            type="button"
            onClick={handleCopy}
            className={`py-1.5 px-3 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>

        {/* Security assurance note */}
        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-2">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-slate-600">
              <strong className="text-slate-800">Security Rule Active:</strong> Users must be authenticated to download and view files stored in their account or assigned project.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
