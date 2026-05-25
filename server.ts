import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import rateLimit from "express-rate-limit";
import Database from "better-sqlite3";

const app = express();
const PORT = 3000;

// Initialize Database
const dbPath = path.join(process.cwd(), "blast_results.db");
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    header TEXT
  );
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT,
    query_index INTEGER,
    query_name TEXT,
    content TEXT,
    FOREIGN KEY(job_id) REFERENCES jobs(id)
  );
  CREATE INDEX IF NOT EXISTS idx_results_job_query ON results(job_id, query_index);
`);

// Logging utility
const logFile = path.join(process.cwd(), "blast.log");
const logger = (message: string) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  console.log(logEntry.trim());
  fs.appendFileSync(logFile, logEntry);
};

// Rate limiter: max 5 requests per minute per IP
const blastLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5,
  message: { error: "Too many requests. Please wait a moment before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Setup multer for file uploads
const upload = multer({
  limits: { 
    fileSize: 20 * 1024 * 1024, // 20MB for file
    fieldSize: 20 * 1024 * 1024 // 20MB for text fields (e.g. sequence)
  },
  dest: 'uploads/'
});

app.use(express.json({ limit: '20mb' }));

// API Routes
  app.post("/api/blast", blastLimiter, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if ((err.code as any) === 'LIMIT_FIELD_VALUE_MAX' || err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          error: "エラー、結果ファイルサイズが大きすぎます",
          details: "入力または結果が制限（入力20MB / 結果100MB）を超えています。" 
        });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(500).json({ error: "Unknown upload error" });
    }
    next();
  });
}, (req, res) => {
  const { sequence, evalue, database, taxid, num_descriptions, num_alignments, perc_identity, sort_hits, task, line_length, download_only } = req.body;
  
  let queryPath = "";
  let isTempFile = false;

  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  logger(`BLAST Request from ${clientIp} - DB: ${database}, E-value: ${evalue}, Download Only: ${download_only === 'true'}`);

  if (req.file) {
    queryPath = req.file.path;
    logger(`- Input: File upload (${req.file.originalname}, ${req.file.size} bytes)`);
  } else if (sequence) {
    const filename = `query_${Date.now()}_${Math.random().toString(36).substring(7)}.fasta`;
    queryPath = path.join('uploads', filename);
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads');
    }
    fs.writeFileSync(queryPath, sequence);
    isTempFile = true;
    logger(`- Input: Pasted sequence (${sequence.length} chars)`);
  } else {
    logger(`- Error: No sequence or file provided`);
    return res.status(400).json({ error: "No sequence or file provided" });
  }

  // Construct BLASTn command
  let command = `blastn -num_threads 8 -query "${queryPath}" -db "${database || 'core_nt'}"`;
  
  if (evalue) command += ` -evalue ${evalue}`;
  if (num_descriptions) command += ` -num_descriptions ${num_descriptions}`;
  if (num_alignments) command += ` -num_alignments ${num_alignments}`;
  if (taxid) command += ` -taxids ${taxid}`;
  if (perc_identity) command += ` -perc_identity ${perc_identity}`;
  if (sort_hits !== undefined && sort_hits !== null) command += ` -sorthits ${sort_hits}`;
  if (task) command += ` -task ${task}`;
  if (line_length) command += ` -line_length ${line_length}`;

  logger(`- Executing command: ${command}`);

  // Use 1GB buffer if download_only is true, otherwise 100MB
  const bufferSize = (download_only === 'true' || download_only === true) 
    ? 1024 * 1024 * 1024 
    : 100 * 1024 * 1024;

  exec(command, { maxBuffer: bufferSize }, (error, stdout, stderr) => {
    // Cleanup files
    if (req.file || isTempFile) {
      try {
        fs.unlinkSync(queryPath);
      } catch (e) {
        logger(`- File Cleanup Failed: ${queryPath}`);
      }
    }

    if (error) {
      logger(`- BLAST Error: ${error.message}`);
      
      let errorMessage = "BLAST execution failed";
      if (error.message.includes("maxBuffer length exceeded")) {
        errorMessage = "エラー、結果ファイルが表示限度100MBを超えています";
      }

      return res.status(500).json({ 
        error: errorMessage, 
        details: stderr || error.message,
        command: command
      });
    }

    logger(`- Success: Results processed and stored`);

    const jobId = uuidv4();
    const rawOutput = stdout || "No results found.";

    if (download_only === 'true' || download_only === true) {
      // In download only mode, store EVERYTHING in the header table to avoid query parsing overhead
      const insertJob = db.prepare("INSERT INTO jobs (id, header) VALUES (?, ?)");
      insertJob.run(jobId, rawOutput);
      return res.json({ jobId, downloadOnly: true });
    }

    // Parse BLAST output for display mode
    const parts = rawOutput.split(/(?=Query= )/g);
    
    let header = "";
    let queryParts: string[] = [];

    if (parts.length > 0) {
      if (!parts[0].startsWith("Query=")) {
        header = parts[0];
        queryParts = parts.slice(1);
      } else {
        queryParts = parts;
      }
    }
    
    // Store Job
    const insertJob = db.prepare("INSERT INTO jobs (id, header) VALUES (?, ?)");
    insertJob.run(jobId, header);

    // Store Queries
    const insertResult = db.prepare("INSERT INTO results (job_id, query_index, query_name, content) VALUES (?, ?, ?, ?)");
    
    const queries = queryParts.map((content, index) => {
      const nameMatch = content.match(/Query= (.+)/);
      const queryName = nameMatch ? nameMatch[1].trim() : `Query ${index + 1}`;
      insertResult.run(jobId, index, queryName, content);
      return { index, name: queryName };
    });

    res.json({ jobId, header, queries, downloadOnly: false });
  });
});

app.get("/api/blast/results/:jobId/:queryIndex", (req, res) => {
  const { jobId, queryIndex } = req.params;
  const row = db.prepare("SELECT content FROM results WHERE job_id = ? AND query_index = ?").get(jobId, queryIndex) as { content: string } | undefined;

  if (row) {
    res.json({ content: row.content });
  } else {
    res.status(404).json({ error: "Result not found" });
  }
});

app.get("/api/blast/download/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = db.prepare("SELECT header FROM jobs WHERE id = ?").get(jobId) as { header: string } | undefined;
  
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  const results = db.prepare("SELECT content FROM results WHERE job_id = ? ORDER BY query_index ASC").all(jobId) as Array<{ content: string }>;
  
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", `attachment; filename="blast_results_${jobId.substring(0, 8)}.txt"`);
  
  res.write(job.header || "");
  results.forEach(row => {
    res.write(row.content);
  });
  res.end();
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
