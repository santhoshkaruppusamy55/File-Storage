const { Worker } = require('bullmq');
const redisClient = require('../config/redis');
const pool = require('../config/database');

// Worker to process background tasks
const worker = new Worker('file-queue', async job => {
  console.log(`Processing job ${job.id} of type ${job.name}`);
  
  if (job.name === 'generate-thumbnail') {
    const { fileId, s3Key } = job.data;
    // Mock logic for generating thumbnail
    console.log(`Thumbnail generated for ${s3Key}`);
    return { status: 'completed', type: 'thumbnail' };
  }

  if (job.name === 'extract-metadata') {
    const { fileId, s3Key } = job.data;
    // Mock logic for extracting metadata
    console.log(`Metadata extracted for ${s3Key}`);
    return { status: 'completed', type: 'metadata' };
  }

  if (job.name === 'log-upload') {
    const { fileId, userId, fileName } = job.data;
    console.log(`User ${userId} uploaded file ${fileName} (${fileId})`);
    return { status: 'completed', type: 'log' };
  }
}, { connection: redisClient });

worker.on('completed', job => {
  console.log(`Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.log(`Job ${job.id} has failed with ${err.message}`);
});

module.exports = worker;
