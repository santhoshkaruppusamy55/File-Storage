const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { 
  generateUploadUrl, 
  generateDownloadUrl, 
  deleteFile,
  startMultipartUpload,
  generatePresignedUrlForPart,
  completeMultipartUpload,
  abortMultipartUpload
} = require('../services/s3Service');
const { Queue } = require('bullmq');
const redisClient = require('../config/redis');
const fileQueue = new Queue('file-queue', { connection: redisClient });

const uploadReq = async (req, res) => {
  const { fileName, contentType, fileSize } = req.body;
  const s3Key = `uploads/${req.user.id}/${uuidv4()}-${fileName}`;
  
  try {
    // Check storage limit
    const [rows] = await pool.query('SELECT SUM(file_size) as total_used FROM files WHERE user_id = ?', [req.user.id]);
    const totalUsed = Number(rows[0].total_used || 0);
    const maxStorage = 10 * 1024 * 1024 * 1024; // 10GB
    
    if (totalUsed + Number(fileSize || 0) > maxStorage) {
      return res.status(403).json({ message: 'Storage limit exceeded. Upgrade your plan or delete files.' });
    }

    const uploadUrl = await generateUploadUrl(s3Key, contentType);
    res.status(200).json({ uploadUrl, s3Key });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error generating upload URL' });
  }
};

const createFileRecord = async (req, res) => {
  const { fileName, description, extension, s3Key, fileSize, folderId } = req.body;
  const fileId = uuidv4();

  try {
    await pool.query(
      'INSERT INTO files (id, user_id, folder_id, file_name, description, extension, s3_key, file_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [fileId, req.user.id, folderId || null, fileName, description, extension, s3Key, fileSize]
    );

    // Queue background jobs
    await fileQueue.add('log-upload', { fileId, userId: req.user.id, fileName });
    if (extension?.match(/(jpg|jpeg|png|gif|webp)$/i)) {
        await fileQueue.add('generate-thumbnail', { fileId, s3Key });
    }

    res.status(201).json({ message: 'File record created', fileId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating file record' });
  }
};

const listFiles = async (req, res) => {
  const { folderId, page = 1, limit = 50, search = '' } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = 'SELECT * FROM files WHERE user_id = ?';
    const params = [req.user.id];

    if (search) {
      query += ' AND (file_name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    } else if (folderId) {
      query += ' AND folder_id = ?';
      params.push(folderId);
    } else {
      query += ' AND folder_id IS NULL';
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [files] = await pool.query(query, params);
    
    // Add pre-signed URLs
    const filesWithUrls = await Promise.all(files.map(async file => ({
      ...file,
      downloadUrl: await generateDownloadUrl(file.s3_key)
    })));

    res.status(200).json(filesWithUrls);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error listing files' });
  }
};

const getFile = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM files WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'File not found' });
    
    const file = rows[0];
    file.downloadUrl = await generateDownloadUrl(file.s3_key);
    res.status(200).json(file);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching file' });
  }
};

const updateFile = async (req, res) => {
  const { fileName, description } = req.body;
  try {
    await pool.query(
      'UPDATE files SET file_name = ?, description = ? WHERE id = ? AND user_id = ?',
      [fileName, description, req.params.id, req.user.id]
    );
    res.status(200).json({ message: 'File updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating file' });
  }
};

const deleteFileRecord = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT s3_key FROM files WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'File not found' });

    // Delete from S3
    await deleteFile(rows[0].s3_key);

    // Delete from DB
    await pool.query('DELETE FROM files WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting file' });
  }
};

const initiateMultipartUpload = async (req, res) => {
  const { fileName, contentType, fileSize } = req.body;
  const s3Key = `uploads/${req.user.id}/${uuidv4()}-${fileName}`;
  
  try {
    const [rows] = await pool.query('SELECT SUM(file_size) as total_used FROM files WHERE user_id = ?', [req.user.id]);
    const maxStorage = 10 * 1024 * 1024 * 1024; // 10GB
    if (Number(rows[0].total_used || 0) + Number(fileSize || 0) > maxStorage) {
      return res.status(403).json({ message: 'Storage limit exceeded' });
    }

    const uploadId = await startMultipartUpload(s3Key, contentType);
    res.status(200).json({ uploadId, s3Key });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error initiating multipart upload' });
  }
};

const getPresignedUrlPart = async (req, res) => {
  const { s3Key, uploadId, partNumber } = req.body;
  try {
    const url = await generatePresignedUrlForPart(s3Key, uploadId, partNumber);
    res.status(200).json({ url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error generating part URL' });
  }
};

const completeUpload = async (req, res) => {
  const { s3Key, uploadId, parts } = req.body;
  try {
    await completeMultipartUpload(s3Key, uploadId, parts);
    res.status(200).json({ message: 'Upload completed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error completing upload' });
  }
};

const abortUpload = async (req, res) => {
  const { s3Key, uploadId } = req.body;
  try {
    await abortMultipartUpload(s3Key, uploadId);
    res.status(200).json({ message: 'Upload aborted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error aborting upload' });
  }
};

module.exports = {
  uploadReq,
  createFileRecord,
  listFiles,
  getFile,
  updateFile,
  deleteFileRecord,
  initiateMultipartUpload,
  getPresignedUrlPart,
  completeUpload,
  abortUpload
};
