import React, { useState, useRef } from 'react';
import { UploadCloud, X, File, AlertCircle, CheckCircle2, FolderPlus } from 'lucide-react';
import { api } from '../services/api';
import { FileRecord } from '../types';
import { formatBytes } from '../utils/formatters';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (newFiles: FileRecord[]) => void;
  existingProjects: string[];
  initialProject?: string;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  existingProjects,
  initialProject,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<globalThis.File[]>([]);
  const [project, setProject] = useState<string>(initialProject || (existingProjects[0] || 'Client Deliverables'));
  const [isCustomProject, setIsCustomProject] = useState(false);
  const [customProjectName, setCustomProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [note, setNote] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const incoming = Array.from(e.dataTransfer.files);
      setSelectedFiles((prev) => [...prev, ...incoming]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const incoming = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...incoming]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setErrorMsg('Please select at least one file to upload.');
      return;
    }

    const resolvedProject = isCustomProject ? customProjectName.trim() || 'General Files' : project;

    setErrorMsg(null);
    setIsUploading(true);

    try {
      const res = await api.uploadFiles(selectedFiles, {
        project: resolvedProject,
        clientName: clientName.trim() || undefined,
        note: note.trim() || undefined,
      });

      onUploadSuccess(res.files);
      // Reset form
      setSelectedFiles([]);
      setClientName('');
      setNote('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'File upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const totalBytesQueued = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Upload Client Files</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Securely deliver files to your client portal with end-to-end access rules.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Drag & Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50'
                : 'border-slate-200 hover:border-blue-400 bg-slate-50/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold text-slate-800">
              Click to select files, or drag and drop here
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Supports Figma exports, PDFs, ZIP archives, high-res images, and documents up to 100MB
            </p>
          </div>

          {/* Selected Files Queue */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Queued Files ({selectedFiles.length})</span>
                <span className="font-mono tabular-nums text-slate-500">
                  Total: {formatBytes(totalBytesQueued)}
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {selectedFiles.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate mr-2">
                      <File className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="font-medium text-slate-800 truncate">{f.name}</span>
                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                        ({formatBytes(f.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Project Tagging */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Client Project / Folder
              </label>
              {!isCustomProject ? (
                <div className="space-y-1.5">
                  <select
                    value={project}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsCustomProject(true);
                      } else {
                        setProject(e.target.value);
                      }
                    }}
                    className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {existingProjects.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                    <option value="Brand Identity 2026">Brand Identity 2026</option>
                    <option value="Website Redesign">Website Redesign</option>
                    <option value="Mobile App Assets">Mobile App Assets</option>
                    <option value="__NEW__">+ Create new project...</option>
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Enter project name..."
                    value={customProjectName}
                    onChange={(e) => setCustomProjectName(e.target.value)}
                    className="flex-1 py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setIsCustomProject(false)}
                    className="px-2 py-2 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Client Recipient <span className="text-slate-400 font-normal lowercase">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Sarah Jenkins"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Client Note / Deliverable Description
            </label>
            <input
              type="text"
              placeholder="e.g. Approved logo package with transparent PNGs and SVG master."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="py-2 px-4 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || selectedFiles.length === 0}
              className="py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
            >
              {isUploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Uploading files...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Upload {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
