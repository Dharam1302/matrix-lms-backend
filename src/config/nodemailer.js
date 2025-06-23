const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false // Allow self-signed certificates
  }
});

// Verify transporter connection
transporter.verify(function(error, success) {
  if (error) {
    console.error('Nodemailer transporter verification failed:', error);
  } else {
    console.log('Nodemailer server is ready to send emails');
  }
});

const sendEmail = async (to, subject, html) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('Email configuration missing. Please set EMAIL_USER and EMAIL_PASSWORD in environment variables.');
    throw new Error('Email configuration missing');
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Email sending failed:', {
      error: error.message,
      stack: error.stack,
      code: error.code,
      command: error.command
    });
    throw error; // Throw the error to be handled by the controller
  }
};

module.exports = { sendEmail }; 