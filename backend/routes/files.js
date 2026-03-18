const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { authenticate } = require('../middlewares/authMiddleware');

router.use(authenticate);

router.post('/upload', fileController.uploadReq); // Gets signed URL (single part)
router.post('/multipart/start', fileController.initiateMultipartUpload);
router.post('/multipart/part', fileController.getPresignedUrlPart);
router.post('/multipart/complete', fileController.completeUpload);
router.post('/multipart/abort', fileController.abortUpload);

router.post('/', fileController.createFileRecord); // Create DB record after upload
router.get('/', fileController.listFiles);
router.get('/:id', fileController.getFile);
router.put('/:id', fileController.updateFile);
router.delete('/:id', fileController.deleteFileRecord);

module.exports = router;
