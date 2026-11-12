import React from 'react';
import {
  X,
  Download,
  Trash2,
  Share2,
  Calendar,
  HardDrive,
  FolderKanban,
  User,
  FileText,
  FileArchive,
  FileCode,
  File,
  Check,
} from 'lucide-react';
import { FileRecord } from '../types';
import { formatBytes, formatDate, getFileCategory } from '../utils/formatters';

interface FilePreviewModalProps {
  file: FileRecord | null;
  onClose: () => void;
  onDownload: (file: FileRecord) => void;
  onDelete: (file: FileRecord) => void;
  onShare: (file: FileRecord) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  onClose,
  onDownload,
  onDelete,
  onShare,
}) => {
  if (!file) return null;

  const category = getFileCategory(file.mimeType, file.originalName);
  const isImage = category === 'image';
  const isPdf = category === 'pdf';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="min-w-0 pr-4">
            <h3 className="text-sm font-semibold text-slate-900 truncate" title={file.originalName}>
              {file.originalName}
            </h3>
            <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
              {formatBytes(file.size)} · Uploaded {formatDate(file.uploadedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview Viewport */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100/60 flex items-center justify-center min-h-[220px]">
          {isImage ? (
            <div className="max-h-[380px] w-full flex items-center justify-center bg-white rounded-xl p-2 border border-slate-200 shadow-xs">
              <img
                src={`/api/files/${file.id}/preview`}
                alt={file.originalName}
                className="max-h-[360px] max-w-full object-contain rounded-lg"
              />
            </div>
          ) : isPdf ? (
            <div className="w-full text-center py-8 px-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-3">
                <FileText className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-semibold text-slate-800">Portable Document Format (PDF)</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Full multi-page document view available via download. Click below to download and view.
              </p>
            </div>
          ) : (
            <div className="w-full text-center py-8 px-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-600 mx-auto flex items-center justify-center mb-3">
                {category === 'archive' ? (
                  <FileArchive className="w-8 h-8 text-amber-600" />
                ) : category === 'code' ? (
                  <FileCode className="w-8 h-8 text-emerald-600" />
                ) : (
                  <File className="w-8 h-8 text-slate-600" />
                )}
              </div>
              <h4 className="text-sm font-semibold text-slate-800">{file.originalName}</h4>
              <p className="text-xs text-slate-500 mt-1 font-mono">{file.mimeType}</p>
            </div>
          )}
        </div>

        {/* Metadata Details Grid */}
        <div className="p-6 border-t border-slate-200 bg-white space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Project</span>
              <span className="font-medium text-slate-800 truncate block">{file.project}</span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Recipient</span>
              <span className="font-medium text-slate-800 truncate block">
                {file.clientName || 'All Portal Clients'}
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Downloads</span>
              <span className="font-mono font-medium text-slate-800">
                {file.downloadsCount} times
              </span>
            </div>
          </div>

          {file.note && (
            <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-xs text-blue-900">
              <span className="font-semibold block mb-0.5">Deliverable Note</span>
              <p>{file.note}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                onDelete(file);
                onClose();
              }}
              className="py-2 px-3 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete File</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onShare(file)}
                className="py-2 px-3.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Share</span>
              </button>

              <button
                type="button"
                onClick={() => onDownload(file)}
                className="py-2 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download File</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
