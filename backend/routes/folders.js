const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');
const { authenticate } = require('../middlewares/authMiddleware');

router.use(authenticate);

router.post('/', folderController.createFolder);
router.get('/', folderController.listFolders);
router.delete('/:id', folderController.deleteFolder);

module.exports = router;
