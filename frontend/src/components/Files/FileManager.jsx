import { useState, useEffect, useRef } from 'react';
import { Folder, FileText, Image, Video, File as FileIcon, Upload, Plus, Download, Trash2, Edit2, Search, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

function FileManager({ onStorageChanged }) {
  const [items, setItems] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderPath, setFolderPath] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchItems();
  }, [currentFolder, searchQuery]);

  const fetchItems = async () => {
    try {
      const folderIdParam = currentFolder ? `parentFolderId=${currentFolder.id}` : '';
      const fileFolderParam = currentFolder ? `folderId=${currentFolder.id}` : '';
      
      let allItems = [];

      // Fetch folders
      if (!searchQuery) { // Folders don't support search in our basic backend implementation yet, simplify for demo
        const foldersRes = await api.get(`/folders?${folderIdParam}`);
        const folders = foldersRes.data.map(f => ({ ...f, type: 'folder' }));
        allItems = [...allItems, ...folders];
      }

      // Fetch files
      let filesUrl = `/files?${fileFolderParam}`;
      if (searchQuery) filesUrl += `&search=${searchQuery}`;
      
      const filesRes = await api.get(filesUrl);
      const files = filesRes.data.map(f => ({ ...f, type: 'file' }));
      
      setItems([...allItems, ...files]);
    } catch (error) {
      console.error('Error fetching items', error);
      toast.error('Failed to fetch files and folders');
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const uploadToast = toast.loading(`Uploading ${file.name}...`);
    const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // Use multipart for files > 5MB to test, generally > 100MB
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunk size to reduce HTTP overhead

    try {
      if (file.size > MULTIPART_THRESHOLD) {
        // --- MULTIPART UPLOAD ---
        const { data: startData } = await api.post('/files/multipart/start', {
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size
        });
        const { uploadId, s3Key } = startData;

        const totalParts = Math.ceil(file.size / CHUNK_SIZE);
        const uploadedParts = [];
        const maxConcurrency = 6; // Maximize browser connections (usually cap at 6 per domain)

        let currentPart = 0;
        let activeUploads = 0;

        // Create an array of tasks
        const tasks = Array.from({ length: totalParts }, (_, i) => async () => {
          const partNumber = i + 1;
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);

          // Get part URL
          const { data: partData } = await api.post('/files/multipart/part', {
            s3Key,
            uploadId,
            partNumber
          });

          // Upload chunk
          const uploadResponse = await fetch(partData.url, {
            method: 'PUT',
            body: chunk,
          });

          if (!uploadResponse.ok) throw new Error(`Part ${partNumber} upload failed`);

          const etagHeader = uploadResponse.headers.get('ETag');
          if (!etagHeader) {
            throw new Error('ETag missing from S3 response. S3 CORS ExposeHeaders must include "ETag".');
          }
          
          const etag = etagHeader.replace(/"/g, '');
          uploadedParts.push({ PartNumber: partNumber, ETag: etag });
          
          currentPart++;
          toast.loading(`Uploading ${file.name}... (Part ${currentPart}/${totalParts})`, { id: uploadToast });
        });

        // Run concurrently
        const workers = Array(maxConcurrency).fill(null).map(async () => {
          while (tasks.length > 0) {
            const task = tasks.shift();
            await task();
          }
        });
        
        await Promise.all(workers);

        // Sort parts by PartNumber as required by AWS
        uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber);

        toast.loading(`Finalizing ${file.name}...`, { id: uploadToast });
        
        // Complete upload
        await api.post('/files/multipart/complete', {
          s3Key,
          uploadId,
          parts: uploadedParts
        });

        // Create DB record
        await api.post('/files', {
          fileName: file.name,
          description: '',
          extension: file.name.split('.').pop(),
          s3Key: s3Key,
          fileSize: file.size,
          folderId: currentFolder ? currentFolder.id : null
        });

      } else {
        // --- STANDARD UPLOAD ---
        const { data } = await api.post('/files/upload', {
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size
        });

        await fetch(data.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        await api.post('/files', {
          fileName: file.name,
          description: '',
          extension: file.name.split('.').pop(),
          s3Key: data.s3Key,
          fileSize: file.size,
          folderId: currentFolder ? currentFolder.id : null
        });
      }

      toast.success('File uploaded successfully!', { id: uploadToast });
      fetchItems();
      if (onStorageChanged) onStorageChanged();
    } catch (error) {
      console.error('Upload failed', error);
      toast.error(error.response?.data?.message || 'Upload failed. Please try again.', { id: uploadToast });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api.post('/folders', {
        name: newFolderName,
        parentFolderId: currentFolder ? currentFolder.id : null
      });
      setNewFolderName('');
      setIsCreateFolderModalOpen(false);
      toast.success('Folder created successfully');
      fetchItems();
    } catch (error) {
      console.error('Failed to create folder', error);
      toast.error('Failed to create folder');
    }
  };

  const deleteItem = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete this ${item.type}?`)) return;
    
    try {
      if (item.type === 'folder') {
        await api.delete(`/folders/${item.id}`);
        toast.success('Folder deleted');
      } else {
        await api.delete(`/files/${item.id}`);
        toast.success('File deleted');
      }
      fetchItems();
      if (item.type !== 'folder' && onStorageChanged) onStorageChanged();
    } catch (error) {
      console.error('Delete failed', error);
      toast.error('Failed to delete item');
    }
  };

  const downloadFile = (e, file) => {
    e.stopPropagation();
    window.open(file.downloadUrl, '_blank');
  };

  const navigateToFolder = (folder) => {
    setFolderPath([...folderPath, folder]);
    setCurrentFolder(folder);
    setSearchQuery('');
  };

  const navigateUp = () => {
    const newPath = [...folderPath];
    newPath.pop();
    setFolderPath(newPath);
    setCurrentFolder(newPath.length > 0 ? newPath[newPath.length - 1] : null);
  };

  const getIcon = (item) => {
    if (item.type === 'folder') return <Folder className="item-icon" fill="currentColor" color="var(--primary-color)" />;
    if (item.extension?.match(/(jpg|jpeg|png|gif|webp)$/i)) return <Image className="item-icon" color="#10b981" />;
    if (item.extension?.match(/(mp4|webm|avi)$/i)) return <Video className="item-icon" color="#8b5cf6" />;
    if (item.extension?.match(/(pdf|doc|docx|txt)$/i)) return <FileText className="item-icon" color="#f59e0b" />;
    return <FileIcon className="item-icon" />;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div>
      <div className="top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {currentFolder && (
            <button className="btn-icon" onClick={navigateUp}>
              <ArrowLeft size={16} />
            </button>
          )}
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
            {currentFolder ? currentFolder.name : 'My Files'}
          </h2>
        </div>
        
        <div className="actions-group">
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search files..." 
              style={{ paddingLeft: '2.5rem' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn-secondary" onClick={() => setIsCreateFolderModalOpen(true)}>
            <Plus size={18} /> New Folder
          </button>
          <button 
            className="btn-primary" 
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: isUploading ? 0.7 : 1 }} 
            onClick={() => !isUploading && fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload size={18} /> {isUploading ? 'Uploading...' : 'Upload'}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleUpload}
            disabled={isUploading}
          />
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <Folder size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <p>This folder is empty</p>
        </div>
      ) : (
        <div className="grid-view">
          {items.map((item) => (
            <div 
              key={item.id} 
              className="item-card"
              onClick={() => item.type === 'folder' ? navigateToFolder(item) : null}
            >
              {getIcon(item)}
              <div className="item-name" title={item.name || item.file_name}>
                {item.name || item.file_name}
              </div>
              {item.type === 'file' && (
                <div className="item-meta">
                  {formatSize(item.file_size)}
                </div>
              )}
              
              <div className="item-actions" onClick={e => e.stopPropagation()}>
                {item.type === 'file' && (
                  <button className="btn-icon" title="Download" onClick={(e) => downloadFile(e, item)}>
                    <Download size={14} />
                  </button>
                )}
                <button className="btn-icon btn-danger" title="Delete" onClick={(e) => deleteItem(e, item)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isCreateFolderModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Create New Folder</h3>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Folder name" 
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn-logout" onClick={() => setIsCreateFolderModalOpen(false)}>Cancel</button>
              <button className="btn-primary" style={{ width: 'auto' }} onClick={handleCreateFolder}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileManager;
