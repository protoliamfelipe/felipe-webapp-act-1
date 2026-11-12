import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  UploadCloud,
  Search,
  Filter,
  LayoutGrid,
  List,
  SortDesc,
  Plus,
  Files,
  FolderKanban,
  HardDrive,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  FileText,
  Clock,
  Sparkles,
  ArrowUpDown,
} from 'lucide-react';
import { User, FileRecord } from './types';
import { api, getStoredUser, clearStoredAuth, getStoredToken } from './services/api';
import { fbService, auth } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { formatBytes, formatDate, getFileCategory, downloadAuthenticatedFile } from './utils/formatters';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { UploadModal } from './components/UploadModal';
import { FileList } from './components/FileList';
import { FilePreviewModal } from './components/FilePreviewModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { ShareModal } from './components/ShareModal';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Dashboard Data State
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [availableProjects, setAvailableProjects] = useState<string[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filters and views
  const [activeNav, setActiveNav] = useState<string>('files');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('date_desc');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modals & Drawers
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<FileRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareCandidate, setShareCandidate] = useState<FileRecord | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Quick drag & drop in main dashboard
  const [isDraggingOverArea, setIsDraggingOverArea] = useState(false);
  const inlineFileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string) => {
    setToastMsg(message);
    setTimeout(() => {
      setToastMsg((prev) => (prev === message ? null : prev));
    }, 3500);
  };

  // Check existing session on load (both Local and Firebase Auth)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // If signed in with Firebase, sync user state
        setUser({
          id: fbUser.uid,
          email: fbUser.email || '',
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
          role: 'freelancer',
          createdAt: new Date().toISOString(),
        });
        setIsAuthChecking(false);
      } else {
        // Otherwise check local token
        const token = getStoredToken();
        if (token) {
          try {
            const res = await api.getCurrentUser();
            setUser(res.user);
          } catch {
            clearStoredAuth();
            setUser(null);
          }
        }
        setIsAuthChecking(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch files when user changes or project/sort changes
  const fetchFiles = async () => {
    if (!user) return;
    setIsLoadingFiles(true);
    setErrorMsg(null);
    try {
      const res = await api.getFiles({
        project: selectedProject === 'all' ? undefined : selectedProject,
        search: searchQuery.trim() || undefined,
        sortBy,
      });
      setFiles(res.files);
      setAvailableProjects(res.availableProjects);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load files.');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchFiles();
    }
  }, [user, selectedProject, sortBy, searchQuery]);

  const handleSignOut = async () => {
    try {
      await fbService.signOutUser();
    } catch (err) {
      console.warn('Firebase signout:', err);
    }
    api.logout();
    setUser(null);
    setFiles([]);
    showToast('You have been signed out successfully.');
  };

  const handleUploadSuccess = (newFiles: FileRecord[]) => {
    setFiles((prev) => [...newFiles, ...prev]);
    // Sync to Firestore in background
    newFiles.forEach((f) => {
      fbService.saveFileRecord(f).catch((e) => console.warn('Firestore file sync:', e));
      if (!availableProjects.includes(f.project)) {
        setAvailableProjects((prev) => [...prev, f.project]);
      }
    });
    showToast(`${newFiles.length} file(s) uploaded successfully to vault.`);
  };

  const handleDeleteFile = async (fileId: string) => {
    setIsDeleting(true);
    try {
      await api.deleteFile(fileId);
      fbService.deleteFileRecord(fileId).catch((e) => console.warn('Firestore delete sync:', e));
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (previewFile?.id === fileId) {
        setPreviewFile(null);
      }
      setDeleteCandidate(null);
      showToast('File deleted successfully.');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete file.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async (file: FileRecord) => {
    try {
      showToast(`Starting download: ${file.originalName}...`);
      await downloadAuthenticatedFile(file.id, file.originalName);
      // update file download counter locally
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, downloadsCount: (f.downloadsCount || 0) + 1 } : f))
      );
    } catch (err: any) {
      showToast(err.message || 'Download failed.');
    }
  };

  const handleInlineFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      try {
        showToast(`Uploading ${selected.length} file(s)...`);
        const res = await api.uploadFiles(selected, {
          project: selectedProject === 'all' ? 'Client Deliverables' : selectedProject,
        });
        handleUploadSuccess(res.files);
      } catch (err: any) {
        showToast(err.message || 'Upload failed.');
      }
      // reset input
      if (inlineFileInputRef.current) inlineFileInputRef.current.value = '';
    }
  };

  const handleInlineDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverArea(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selected = Array.from(e.dataTransfer.files);
      try {
        showToast(`Uploading ${selected.length} file(s)...`);
        const res = await api.uploadFiles(selected, {
          project: selectedProject === 'all' ? 'Client Deliverables' : selectedProject,
        });
        handleUploadSuccess(res.files);
      } catch (err: any) {
        showToast(err.message || 'Upload failed.');
      }
    }
  };

  // Filter by category in client side
  const filteredFiles = useMemo(() => {
    let result = files;

    if (activeNav === 'recent') {
      // files from last 7 days
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      result = result.filter((f) => new Date(f.uploadedAt).getTime() >= sevenDaysAgo);
    }

    if (selectedCategory !== 'all') {
      result = result.filter((f) => {
        const cat = getFileCategory(f.mimeType, f.originalName);
        if (selectedCategory === 'images') return cat === 'image';
        if (selectedCategory === 'documents') return cat === 'pdf' || cat === 'document';
        if (selectedCategory === 'archives') return cat === 'archive';
        if (selectedCategory === 'code') return cat === 'code';
        return true;
      });
    }

    return result;
  }, [files, selectedCategory, activeNav]);

  const totalVaultBytes = useMemo(() => {
    return files.reduce((acc, f) => acc + f.size, 0);
  }, [files]);

  // Loading Screen
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-600 tracking-wide">
            Loading FeliVault...
          </span>
        </div>
      </div>
    );
  }

  // Not signed in: Show clean, friendly Auth Screen
  if (!user) {
    return <AuthScreen onAuthSuccess={(authenticatedUser) => setUser(authenticatedUser)} />;
  }

  const activeBreadcrumbTitle =
    activeNav === 'recent'
      ? 'Recent Uploads'
      : selectedProject === 'all'
      ? 'All Files'
      : selectedProject;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#0A1128] text-white px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Dark Navy Sidebar */}
      <Sidebar
        user={user}
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        selectedProject={selectedProject}
        setSelectedProject={setSelectedProject}
        projects={availableProjects}
        totalBytes={totalVaultBytes}
        fileCount={files.length}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenShareModal={() => {
          setShareCandidate(null);
          setIsShareModalOpen(true);
        }}
        onSignOut={handleSignOut}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />

      {/* Main Content Area: White & Light Gray Canvas */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Bar Header */}
        <TopBar
          activeTitle={activeBreadcrumbTitle}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenUpload={() => setIsUploadOpen(true)}
          isMobileOpen={isMobileSidebarOpen}
          setIsMobileOpen={setIsMobileSidebarOpen}
        />

        {/* Dashboard Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Quick Upload Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOverArea(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDraggingOverArea(false);
            }}
            onDrop={handleInlineDrop}
            className={`bg-white border rounded-2xl p-6 transition-all ${
              isDraggingOverArea
                ? 'border-blue-500 bg-blue-50/40 ring-4 ring-blue-500/10'
                : 'border-slate-200 hover:border-slate-300 shadow-xs'
            }`}
          >
            <input
              ref={inlineFileInputRef}
              type="file"
              multiple
              onChange={handleInlineFileSelect}
              className="hidden"
            />
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Client File Dropzone
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Drag and drop deliverables directly here, or browse from your device.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => inlineFileInputRef.current?.click()}
                  className="flex-1 sm:flex-none py-2 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Quick Browse Files
                </button>
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(true)}
                  className="flex-1 sm:flex-none py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Upload with Details</span>
                </button>
              </div>
            </div>
          </div>

          {/* Controls & Filter Strip */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-1">
            {/* Interactive Category Segmented Controls */}
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto max-w-full">
              {[
                { id: 'all', label: 'All Files' },
                { id: 'documents', label: 'PDFs & Docs' },
                { id: 'images', label: 'Design & Images' },
                { id: 'archives', label: 'Archives (ZIP)' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    selectedCategory === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Right Controls: Sort & Layout Toggle */}
            <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
              {/* Project Filter Select */}
              <div className="relative">
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="py-1.5 pl-2.5 pr-7 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-xs"
                >
                  <option value="all">All Projects</option>
                  {availableProjects.map((proj) => (
                    <option key={proj} value={proj}>
                      {proj}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Order Select */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="py-1.5 pl-2.5 pr-7 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-xs"
                >
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="name_asc">Name (A-Z)</option>
                  <option value="size_desc">Size (Largest)</option>
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  title="Table view"
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Main Files Presentation Area */}
          {isLoadingFiles ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs">
              <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500">Loading files from secure storage...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            /* Clean Empty State */
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-4">
                <Files className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                {searchQuery
                  ? 'No matching files found'
                  : selectedProject !== 'all'
                  ? `No files in "${selectedProject}"`
                  : 'No files in your vault yet'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? 'Try clearing your search query or switching project filters.'
                  : 'Upload design deliverables, brand guides, vector assets, or invoices to share them with your clients.'}
              </p>
              <div className="mt-5 flex items-center justify-center gap-2">
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="py-2 px-3.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    Clear Search
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsUploadOpen(true)}
                    className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Upload First File</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Populated Files List or Grid */
            <FileList
              files={filteredFiles}
              viewMode={viewMode}
              onPreview={(file) => setPreviewFile(file)}
              onDownload={handleDownload}
              onDelete={(file) => setDeleteCandidate(file)}
              onShare={(file) => {
                setShareCandidate(file);
                setIsShareModalOpen(true);
              }}
            />
          )}

          {/* Quick Portal Security & Client Access Footer Strip */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 border-t border-slate-200/80">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                Protected under FeliVault strict tenant isolation rules. Each user accesses only their assigned files.
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setShareCandidate(null);
                  setIsShareModalOpen(true);
                }}
                className="text-blue-600 hover:text-blue-700 font-medium underline-offset-2 hover:underline cursor-pointer"
              >
                Get Client Invite Link
              </button>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="font-mono tabular-nums">
                {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'} ({formatBytes(totalVaultBytes)})
              </span>
            </div>
          </div>
        </main>
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
        existingProjects={availableProjects}
        initialProject={selectedProject !== 'all' ? selectedProject : undefined}
      />

      {/* File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownload}
        onDelete={(file) => {
          setDeleteCandidate(file);
        }}
        onShare={(file) => {
          setShareCandidate(file);
          setIsShareModalOpen(true);
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        file={deleteCandidate}
        isOpen={!!deleteCandidate}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={handleDeleteFile}
        isDeleting={isDeleting}
      />

      {/* Share / Client Access Modal */}
      <ShareModal
        file={shareCandidate}
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setShareCandidate(null);
        }}
        userRole={user.role}
      />
    </div>
  );
}
