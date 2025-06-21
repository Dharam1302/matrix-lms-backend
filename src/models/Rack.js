const mongoose = require('mongoose');

const rackSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  capacity: { type: Number, required: true, default: 50 },
  used: { type: Number, required: true, default: 0 },
  department: { type: String, required: true },
  library: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Rack', rackSchema);