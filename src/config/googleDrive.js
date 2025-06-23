const { google } = require('googleapis');
const path = require('path');

// Initialize the Google Drive API client
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, '../../matrixlms-463805-dfc7b82802df.json'),
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });

// The folder ID where files will be stored (from the provided link)
const FOLDER_ID = '1eNzHigzp8I1cYQi1FZ03MUeoXb4myCXn';

module.exports = {
  drive,
  FOLDER_ID
}; 