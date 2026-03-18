const { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const dotenv = require('dotenv');

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

const generateUploadUrl = async (key, contentType) => {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  // AWS SDK V3 automatically injects checksum headers which browsers will block
  // due to CORS mismatch. We must strictly disable un ho-signed checksums.
  return await getSignedUrl(s3Client, command, { 
    expiresIn: 3600,
    signableHeaders: new Set([]) // Force AWS not to sign any headers to prevent CORS mismatch
  });
};

const generateDownloadUrl = async (key) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
};

const deleteFile = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  return await s3Client.send(command);
};

// Multipart Upload Methods

const startMultipartUpload = async (key, contentType) => {
  const command = new CreateMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  const response = await s3Client.send(command);
  return response.UploadId;
};

const generatePresignedUrlForPart = async (key, uploadId, partNumber) => {
  const command = new UploadPartCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return await getSignedUrl(s3Client, command, { 
    expiresIn: 3600,
    signableHeaders: new Set([]) 
  });
};

const completeMultipartUpload = async (key, uploadId, parts) => {
  const command = new CompleteMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  });
  return await s3Client.send(command);
};

const abortMultipartUpload = async (key, uploadId) => {
  const command = new AbortMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
  });
  return await s3Client.send(command);
};

module.exports = {
  s3Client,
  generateUploadUrl,
  generateDownloadUrl,
  deleteFile,
  startMultipartUpload,
  generatePresignedUrlForPart,
  completeMultipartUpload,
  abortMultipartUpload
};
