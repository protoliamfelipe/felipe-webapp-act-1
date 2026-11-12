import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { FileRecord } from '../types';
import { formatBytes } from '../utils/formatters';

interface DeleteConfirmModalProps {
  file: FileRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (fileId: string) => void;
  isDeleting: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  file,
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}) => {
  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-base font-semibold text-slate-900 mb-1">
          Delete File
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Are you sure you want to delete <span className="font-semibold text-slate-800">"{file.originalName}"</span> ({formatBytes(file.size)})? This action removes the file permanently from your vault storage and client download links.
        </p>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] text-slate-600 mb-6 font-mono">
          Project: {file.project}
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="py-2 px-3.5 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(file.id)}
            disabled={isDeleting}
            className="py-2 px-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {isDeleting ? (
              <span>Deleting...</span>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete File</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
