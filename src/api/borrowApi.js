import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getBorrowRecords = async () => {
  const response = await axios.get(`${API_URL}/borrow-records`, { headers: getAuthHeader() });
  return response.data.data.records;
};

export const borrowBook = async (data) => {
  const response = await axios.post(`${API_URL}/borrow-records/borrow`, data, { headers: getAuthHeader() });
  return response.data.data.record;
};

export const returnBook = async (id, data) => {
  const response = await axios.patch(`${API_URL}/borrow-records/${id}/return`, data, { headers: getAuthHeader() });
  return response.data.data.record;
};

export const updateBorrowRecord = async (id, data) => {
  const response = await axios.patch(`${API_URL}/borrow-records/${id}`, data, { headers: getAuthHeader() });
  return response.data.data.record;
};

export const sendReminder = async (id) => {
  const response = await axios.post(`${API_URL}/borrow-records/${id}/reminder`, {}, { headers: getAuthHeader() });
  return response.data;
};

export const markFinePaid = async (id, paymentMethod) => {
  const response = await axios.patch(`${API_URL}/borrow-records/${id}/fine/paid`, { paymentMethod }, { headers: getAuthHeader() });
  return response.data.data.record;
};

export const waiveFine = async (id) => {
  const response = await axios.patch(`${API_URL}/borrow-records/${id}/fine/waived`, {}, { headers: getAuthHeader() });
  return response.data.data.record;
};

export const getBooks = async () => {
  const response = await axios.get(`${API_URL}/books`, { headers: getAuthHeader() });
  return response.data.data.books; // Adjust based on your bookRoutes response
};