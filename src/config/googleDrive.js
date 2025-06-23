const { google } = require('googleapis');
require('dotenv').config();

// Parse the base64 encoded credentials
const credentials = JSON.parse(
  Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, 'base64').toString('utf-8')
);

// Initialize the Google Drive API client
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });

// The folder ID where files will be stored
const FOLDER_ID = '1eNzHigzp8I1cYQi1FZ03MUeoXb4myCXn';

module.exports = {
  drive,
  FOLDER_ID
}; 