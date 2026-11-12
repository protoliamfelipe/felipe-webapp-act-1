import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'felivault-super-secure-portal-secret-key-2026';
const DATA_DIR = path.resolve(__dirname, 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: 'freelancer' | 'client';
  company?: string;
  createdAt: string;
}

export interface FileRecord {
  id: string;
  userId: string;
  originalName: string;
  storedFileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  project: string;
  clientName?: string;
  note?: string;
  downloadsCount: number;
}

export interface DBData {
  users: User[];
  files: FileRecord[];
}

// Helper to read and write database
function readDB(): DBData {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading db.json:', err);
  }
  return { users: [], files: [] };
}

function writeDB(data: DBData): void {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error writing db.json:', err);
  }
}

// Seed initial demo accounts if database is empty
async function initializeDemoData() {
  const db = readDB();
  if (db.users.length === 0) {
    const salt = await bcrypt.genSalt(10);
    const demoPasswordHash = await bcrypt.hash('password123', salt);

    const demoUser1: User = {
      id: 'usr_designer_1',
      email: 'alex@designstudio.com',
      passwordHash: demoPasswordHash,
      name: 'Alex Vance',
      role: 'freelancer',
      company: 'Studio Vance',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
    };

    const demoUser2: User = {
      id: 'usr_client_1',
      email: 'sarah@acmebrand.com',
      passwordHash: demoPasswordHash,
      name: 'Sarah Jenkins',
      role: 'client',
      company: 'Acme Corp',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    };

    db.users.push(demoUser1, demoUser2);

    // Create a sample preview file for the demo user
    const sampleFileName = 'Brand_Style_Guide_v2.pdf';
    const sampleStored = `sample_guide_${Date.now()}.pdf`;
    const samplePath = path.join(UPLOADS_DIR, sampleStored);

    const sampleContent = `%PDF-1.4\n% Sample FeliVault PDF\n1 0 obj\n<< /Title (FeliVault Brand Guidelines) /Author (Alex Vance) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`;
    fs.writeFileSync(samplePath, sampleContent, 'utf-8');

    const sampleLogoName = 'Logo_Mark_Final.svg';
    const sampleLogoStored = `sample_logo_${Date.now()}.svg`;
    const sampleLogoPath = path.join(UPLOADS_DIR, sampleLogoStored);
    const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#2563eb" />
        </linearGradient>
      </defs>
      <rect width="200" height="200" rx="32" fill="url(#grad)" />
      <path d="M50 60 H150 M50 100 H120 M50 140 H90" stroke="#ffffff" stroke-width="12" stroke-linecap="round" />
    </svg>`;
    fs.writeFileSync(sampleLogoPath, sampleSvg, 'utf-8');

    db.files.push(
      {
        id: 'file_demo_1',
        userId: demoUser1.id,
        originalName: sampleFileName,
        storedFileName: sampleStored,
        mimeType: 'application/pdf',
        size: 2457600, // 2.4 MB
        uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        project: 'Brand Identity 2026',
        clientName: 'Sarah Jenkins (Acme Corp)',
        note: 'Complete typography hierarchy, primary logo assets, and color swatches.',
        downloadsCount: 4,
      },
      {
        id: 'file_demo_2',
        userId: demoUser1.id,
        originalName: sampleLogoName,
        storedFileName: sampleLogoStored,
        mimeType: 'image/svg+xml',
        size: 142800, // 142 KB
        uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        project: 'Brand Identity 2026',
        clientName: 'Sarah Jenkins (Acme Corp)',
        note: 'Vector master mark with clean geometry and scalable paths.',
        downloadsCount: 7,
      }
    );

    writeDB(db);
  }
}

initializeDemoData().catch(console.error);

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const ext = path.extname(file.originalname);
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${safeBase}_${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max per file
  },
});

// Auth Middleware
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'freelancer' | 'client';
  };
}

function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      name: string;
      role: 'freelancer' | 'client';
    };
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session expired or invalid token. Please sign in again.' });
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // --- AUTH ROUTES ---

  // Register
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { email, password, name, role = 'freelancer', company = '' } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Please provide email, password, and your name.' });
      }

      if (typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }

      const db = readDB();
      const normalizedEmail = email.toLowerCase().trim();

      const existing = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
      if (existing) {
        return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const newUser: User = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        email: normalizedEmail,
        passwordHash,
        name: name.trim(),
        role: role === 'client' ? 'client' : 'freelancer',
        company: company?.trim() || '',
        createdAt: new Date().toISOString(),
      };

      db.users.push(newUser);
      writeDB(db);

      const token = jwt.sign(
        { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.status(201).json({
        message: 'Account created successfully.',
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          company: newUser.company,
          createdAt: newUser.createdAt,
        },
      });
    } catch (err: any) {
      console.error('Registration error:', err);
      return res.status(500).json({ error: 'Failed to create account. Please try again.' });
    }
  });

  // Login
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Please enter both email and password.' });
      }

      const db = readDB();
      const normalizedEmail = email.toLowerCase().trim();
      const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, role: user.role },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.json({
        message: 'Signed in successfully.',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          company: user.company,
          createdAt: user.createdAt,
        },
      });
    } catch (err: any) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Authentication failed. Please try again.' });
    }
  });

  // Current User Session
  app.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const db = readDB();
    const user = db.users.find((u) => u.id === req.user?.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const userFiles = db.files.filter((f) => f.userId === user.id);
    const totalBytes = userFiles.reduce((acc, f) => acc + f.size, 0);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company: user.company,
        createdAt: user.createdAt,
      },
      stats: {
        fileCount: userFiles.length,
        totalBytes,
      },
    });
  });

  // --- FILE MANAGEMENT ROUTES ---

  // Get user's files with search, filtering, and sorting
  app.get('/api/files', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const db = readDB();
    const userId = req.user!.id;
    let files = db.files.filter((f) => f.userId === userId);

    const { project, search, sortBy = 'date_desc' } = req.query;

    if (project && typeof project === 'string' && project !== 'all') {
      files = files.filter((f) => f.project.toLowerCase() === project.toLowerCase());
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.toLowerCase().trim();
      files = files.filter(
        (f) =>
          f.originalName.toLowerCase().includes(q) ||
          f.project.toLowerCase().includes(q) ||
          (f.clientName && f.clientName.toLowerCase().includes(q)) ||
          (f.note && f.note.toLowerCase().includes(q))
      );
    }

    // Sorting
    files.sort((a, b) => {
      if (sortBy === 'date_asc') {
        return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      }
      if (sortBy === 'name_asc') {
        return a.originalName.localeCompare(b.originalName);
      }
      if (sortBy === 'name_desc') {
        return b.originalName.localeCompare(a.originalName);
      }
      if (sortBy === 'size_asc') {
        return a.size - b.size;
      }
      if (sortBy === 'size_desc') {
        return b.size - a.size;
      }
      // default: date_desc
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    });

    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    const projectsList = Array.from(new Set(db.files.filter((f) => f.userId === userId).map((f) => f.project))).filter(Boolean);

    return res.json({
      files,
      totalCount: files.length,
      totalBytes,
      availableProjects: projectsList,
    });
  });

  // Upload one or multiple files
  app.post(
    '/api/files/upload',
    authMiddleware,
    upload.array('files', 10),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const uploadedFiles = req.files as Express.Multer.File[];
        if (!uploadedFiles || uploadedFiles.length === 0) {
          return res.status(400).json({ error: 'No files provided for upload.' });
        }

        const db = readDB();
        const userId = req.user!.id;
        const project = (req.body.project as string)?.trim() || 'General Client Files';
        const clientName = (req.body.clientName as string)?.trim() || '';
        const note = (req.body.note as string)?.trim() || '';

        const newRecords: FileRecord[] = uploadedFiles.map((file) => ({
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          userId,
          originalName: file.originalname,
          storedFileName: file.filename,
          mimeType: file.mimetype || 'application/octet-stream',
          size: file.size,
          uploadedAt: new Date().toISOString(),
          project,
          clientName: clientName || undefined,
          note: note || undefined,
          downloadsCount: 0,
        }));

        db.files.push(...newRecords);
        writeDB(db);

        return res.status(201).json({
          message: `${newRecords.length} file(s) uploaded successfully.`,
          files: newRecords,
        });
      } catch (err: any) {
        console.error('Upload error:', err);
        return res.status(500).json({ error: 'Failed to upload files. Please try again.' });
      }
    }
  );

  // Download a file
  app.get('/api/files/:id/download', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const db = readDB();
    const userId = req.user!.id;
    const fileId = req.params.id;

    const record = db.files.find((f) => f.id === fileId);
    if (!record) {
      return res.status(404).json({ error: 'File not found.' });
    }

    // Security rule: Each user can only access their own files
    if (record.userId !== userId) {
      return res.status(403).json({ error: 'Access denied. You do not have permission to download this file.' });
    }

    const filePath = path.join(UPLOADS_DIR, record.storedFileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File binary not found on disk.' });
    }

    // Increment download counter
    record.downloadsCount = (record.downloadsCount || 0) + 1;
    writeDB(db);

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(record.originalName)}"`);
    res.setHeader('Content-Type', record.mimeType);
    return res.sendFile(filePath);
  });

  // Preview inline (for images, pdf, text)
  app.get('/api/files/:id/preview', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const db = readDB();
    const userId = req.user!.id;
    const fileId = req.params.id;

    const record = db.files.find((f) => f.id === fileId);
    if (!record) {
      return res.status(404).json({ error: 'File not found.' });
    }

    if (record.userId !== userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const filePath = path.join(UPLOADS_DIR, record.storedFileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File content not found.' });
    }

    res.setHeader('Content-Type', record.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(record.originalName)}"`);
    return res.sendFile(filePath);
  });

  // Delete a file
  app.delete('/api/files/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = readDB();
      const userId = req.user!.id;
      const fileId = req.params.id;

      const fileIndex = db.files.findIndex((f) => f.id === fileId);
      if (fileIndex === -1) {
        return res.status(404).json({ error: 'File not found.' });
      }

      const fileRecord = db.files[fileIndex];
      // Security rule: Each user can only delete their own files
      if (fileRecord.userId !== userId) {
        return res.status(403).json({ error: 'Access denied. You do not have permission to delete this file.' });
      }

      // Remove from disk
      const filePath = path.join(UPLOADS_DIR, fileRecord.storedFileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.warn('Failed to delete physical file from disk:', unlinkErr);
        }
      }

      // Remove from database
      db.files.splice(fileIndex, 1);
      writeDB(db);

      return res.json({ message: 'File deleted successfully.', fileId });
    } catch (err: any) {
      console.error('Delete error:', err);
      return res.status(500).json({ error: 'Failed to delete file.' });
    }
  });

  // Update file details (rename project or update note)
  app.patch('/api/files/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const db = readDB();
    const userId = req.user!.id;
    const fileId = req.params.id;
    const { project, clientName, note } = req.body;

    const fileRecord = db.files.find((f) => f.id === fileId);
    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found.' });
    }

    if (fileRecord.userId !== userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (project !== undefined) fileRecord.project = project.trim() || 'General';
    if (clientName !== undefined) fileRecord.clientName = clientName.trim() || undefined;
    if (note !== undefined) fileRecord.note = note.trim() || undefined;

    writeDB(db);
    return res.json({ message: 'File updated successfully.', file: fileRecord });
  });

  // App summary statistics
  app.get('/api/stats', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const db = readDB();
    const userId = req.user!.id;
    const userFiles = db.files.filter((f) => f.userId === userId);

    const totalBytes = userFiles.reduce((acc, f) => acc + f.size, 0);
    const projects = new Set(userFiles.map((f) => f.project));
    const totalDownloads = userFiles.reduce((acc, f) => acc + (f.downloadsCount || 0), 0);

    return res.json({
      totalFiles: userFiles.length,
      totalBytes,
      totalProjects: projects.size,
      totalDownloads,
    });
  });

  // Integrate Vite dev server middleware
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FeliVault server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
