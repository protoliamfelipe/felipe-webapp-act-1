import React from 'react';
import {
  FileText,
  FileImage,
  FileArchive,
  FileCode,
  File as FileGeneric,
  Download,
  Trash2,
  Eye,
  Share2,
  FolderKanban,
  MoreVertical,
  ExternalLink,
} from 'lucide-react';
import { FileRecord } from '../types';
import { formatBytes, formatDate, getFileCategory, FileCategory } from '../utils/formatters';

interface FileListProps {
  files: FileRecord[];
  viewMode: 'table' | 'grid';
  onPreview: (file: FileRecord) => void;
  onDownload: (file: FileRecord) => void;
  onDelete: (file: FileRecord) => void;
  onShare: (file: FileRecord) => void;
}

function getFileIcon(category: FileCategory) {
  switch (category) {
    case 'image':
      return <FileImage className="w-5 h-5 text-purple-600" />;
    case 'pdf':
    case 'document':
      return <FileText className="w-5 h-5 text-blue-600" />;
    case 'archive':
      return <FileArchive className="w-5 h-5 text-amber-600" />;
    case 'code':
      return <FileCode className="w-5 h-5 text-emerald-600" />;
    default:
      return <FileGeneric className="w-5 h-5 text-slate-500" />;
  }
}

export const FileList: React.FC<FileListProps> = ({
  files,
  viewMode,
  onPreview,
  onDownload,
  onDelete,
  onShare,
}) => {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {files.map((file) => {
          const category = getFileCategory(file.mimeType, file.originalName);
          const isImage = category === 'image';

          return (
            <div
              key={file.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-all group flex flex-col justify-between"
            >
              {/* Card Thumbnail / Preview Area */}
              <div
                onClick={() => onPreview(file)}
                className="h-36 bg-slate-50 border-b border-slate-100 flex items-center justify-center cursor-pointer relative overflow-hidden group-hover:bg-slate-100/70 transition-colors"
              >
                {isImage && file.storedFileName ? (
                  <img
                    src={`/api/files/${file.id}/preview`}
                    alt={file.originalName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center">
                    {getFileIcon(category)}
                  </div>
                )}

                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-xs rounded-md shadow-xs p-1">
                  <Eye className="w-3.5 h-3.5 text-slate-700" />
                </div>
              </div>

              {/* Card Body */}
              <div className="p-3.5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4
                      title={file.originalName}
                      onClick={() => onPreview(file)}
                      className="text-xs font-semibold text-slate-900 truncate hover:text-blue-600 cursor-pointer"
                    >
                      {file.originalName}
                    </h4>
                  </div>

                  {/* Clean unboxed metadata with dot separators */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono tabular-nums mb-2">
                    <span>{formatBytes(file.size)}</span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span>{formatDate(file.uploadedAt)}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600 truncate mb-2">
                    <FolderKanban className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate text-[11px]">{file.project}</span>
                  </div>

                  {file.note && (
                    <p className="text-[11px] text-slate-500 line-clamp-2 italic mb-2">
                      "{file.note}"
                    </p>
                  )}
                </div>

                {/* Card Action Bar */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between mt-2">
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                    {file.downloadsCount} dl
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onShare(file)}
                      title="Share link"
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownload(file)}
                      title="Download file"
                      className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(file)}
                      title="Delete file"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // High-density Table View
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              <th className="py-3 px-4">File Name</th>
              <th className="py-3 px-4 hidden md:table-cell">Project / Folder</th>
              <th className="py-3 px-4">File Size</th>
              <th className="py-3 px-4 hidden sm:table-cell">Upload Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {files.map((file) => {
              const category = getFileCategory(file.mimeType, file.originalName);

              return (
                <tr
                  key={file.id}
                  className="hover:bg-slate-50/80 transition-colors group"
                >
                  {/* File Name & Icon */}
                  <td className="py-3 px-4 max-w-xs sm:max-w-md">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 p-1.5 bg-slate-100 rounded-lg">
                        {getFileIcon(category)}
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onPreview(file)}
                          className="font-medium text-slate-900 truncate block hover:text-blue-600 text-left cursor-pointer"
                          title={file.originalName}
                        >
                          {file.originalName}
                        </button>
                        {file.note && (
                          <p className="text-[11px] text-slate-400 truncate max-w-xs">
                            {file.note}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Project / Folder */}
                  <td className="py-3 px-4 hidden md:table-cell">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <FolderKanban className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{file.project}</span>
                    </div>
                  </td>

                  {/* File Size */}
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                    {formatBytes(file.size)}
                  </td>

                  {/* Upload Date */}
                  <td className="py-3 px-4 hidden sm:table-cell font-mono tabular-nums text-slate-500 whitespace-nowrap">
                    {formatDate(file.uploadedAt)}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onPreview(file)}
                        title="Quick Preview"
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDownload(file)}
                        title="Download file"
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onShare(file)}
                        title="Share link"
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(file)}
                        title="Delete file"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
