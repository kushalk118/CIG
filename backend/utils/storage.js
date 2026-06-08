const fs = require('fs');
const path = require('express'); // wait, import path
const pathUtil = require('path');
// Check if S3 credentials are set
const isS3Configured = () => {
  return (
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET_NAME
  );
};

// Upload file to S3 or keep local
const saveFile = async (file) => {
  if (!isS3Configured()) {
    console.log(`[Storage] S3 not configured. Storing locally: ${file.filename}`);
    // Return the relative URL path for the frontend
    return `/uploads/${file.filename}`;
  }

  // AWS S3 upload logic
  try {
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const fileStream = fs.createReadStream(file.path);
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: `${Date.now()}-${file.filename}`,
      Body: fileStream,
      ContentType: file.mimetype
    };

    console.log(`[Storage] Uploading to S3 bucket ${process.env.AWS_S3_BUCKET_NAME}...`);
    await s3.send(new PutObjectCommand(uploadParams));
    
    // Delete local temporary file
    fs.unlinkSync(file.path);

    // Construct S3 URL
    return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${uploadParams.Key}`;
  } catch (error) {
    console.error('[Storage] S3 Upload failed, falling back to local file:', error);
    return `/uploads/${file.filename}`;
  }
};

module.exports = {
  saveFile
};
