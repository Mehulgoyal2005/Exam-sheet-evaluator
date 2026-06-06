// server/config/cloudinary.js

const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configure Cloudinary SDK with credentials from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a local file to Cloudinary and returns its permanent URL.
 *
 * Key fix: we pass type: 'upload' explicitly to force public delivery type.
 * Without this, some Cloudinary accounts default to 'private' which causes
 * 401 errors when trying to download the file later.
 *
 * @param {string} localFilePath - Absolute path to the file on disk
 * @param {string} folder - Cloudinary folder (e.g. 'evalai/question-papers')
 * @returns {Promise<string>} - The secure public Cloudinary URL
 */
const uploadToCloudinary = async (localFilePath, folder) => {
  try {
    const result = await cloudinary.uploader.upload(localFilePath, {
      folder: folder,
      resource_type: 'raw',  // Required for PDFs and non-image files
      type: 'upload',        // Forces public delivery — fixes 401 on download
      use_filename: true,    // Use original filename instead of random string
      unique_filename: true, // Still adds unique suffix to avoid collisions
    });

    // Delete the local temp file after successful upload
    try {
      await fs.promises.unlink(localFilePath);
    } catch (unlinkError) {
      console.warn(`⚠️  Could not delete temp file ${localFilePath}: ${unlinkError.message}`);
    }

    return result.secure_url;
  } catch (error) {
    throw new Error(
      `Cloudinary upload failed for "${localFilePath}" in folder "${folder}": ${error.message}`
    );
  }
};

/**
 * Downloads a file from Cloudinary to a local path using the Cloudinary SDK.
 *
 * Why we use the Cloudinary SDK instead of plain axios:
 * The SDK automatically generates signed URLs and handles authentication,
 * so it works regardless of whether the file is public or private.
 * Plain axios with the public URL gets 401 on private files.
 *
 * @param {string} cloudinaryUrl - The Cloudinary URL stored in MongoDB
 * @param {string} localDestinationPath - Where to save the file locally
 * @returns {Promise<string>} - The localDestinationPath once written
 */
const downloadFromCloudinary = async (cloudinaryUrl, localDestinationPath) => {
  try {
    // Extract the public_id and resource_type from the Cloudinary URL
    // A Cloudinary raw URL looks like:
    // https://res.cloudinary.com/CLOUD/raw/upload/v123456/folder/filename.pdf
    // We need to extract: folder/filename.pdf (without extension for the SDK)
    const urlParts = cloudinaryUrl.split('/');

    // Find the 'upload' segment index to locate everything after it
    const uploadIndex = urlParts.indexOf('upload');

    if (uploadIndex === -1) {
      throw new Error(`Cannot parse Cloudinary URL: ${cloudinaryUrl}`);
    }

    // Everything after 'upload/vXXXXXX/' is the public_id (skip the version segment)
    // Version segment looks like 'v1780782742' — starts with 'v' followed by digits
    const afterUpload = urlParts.slice(uploadIndex + 1);
    const versionSegment = afterUpload[0];
    const isVersion = /^v\d+$/.test(versionSegment);
    const publicIdParts = isVersion ? afterUpload.slice(1) : afterUpload;
    const publicIdWithExtension = publicIdParts.join('/');

    // For raw files, Cloudinary needs the full public_id including extension
    // Generate a signed download URL using the SDK — this bypasses any auth restrictions
    const signedUrl = cloudinary.url(publicIdWithExtension, {
      resource_type: 'raw',
      type: 'upload',
      sign_url: true,        // Generate a signed URL — works even for private files
      secure: true,
    });

    // Now download using the signed URL with axios
    const axios = require('axios');
    const response = await axios.get(signedUrl, {
      responseType: 'arraybuffer', // Required for binary files like PDFs
      timeout: 60000,
    });

    await fs.promises.writeFile(localDestinationPath, response.data);

    console.log(`⬇️  Downloaded to: ${localDestinationPath}`);
    return localDestinationPath;

  } catch (error) {
    throw new Error(
      `Failed to download from Cloudinary URL "${cloudinaryUrl}" ` +
      `to "${localDestinationPath}": ${error.message}`
    );
  }
};

module.exports = { cloudinary, uploadToCloudinary, downloadFromCloudinary };