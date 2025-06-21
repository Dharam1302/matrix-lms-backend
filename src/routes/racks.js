const express = require('express');
const router = express.Router();
const Rack = require('../models/Rack');

// Get all racks
router.get('/', async (req, res) => {
  try {
    const racks = await Rack.find();
    res.json(racks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching racks', error });
  }
});

// Create a new rack
router.post('/', async (req, res) => {
  try {
    const { id, capacity, used, department, library } = req.body;
    const rack = new Rack({ id, capacity, used, department, library });
    await rack.save();
    res.status(201).json(rack);
  } catch (error) {
    res.status(400).json({ message: 'Error creating rack', error });
  }
});

// Rename a rack
router.put('/:id', async (req, res) => {
  try {
    const { newId } = req.body;
    const rack = await Rack.findOneAndUpdate(
      { id: req.params.id },
      { id: newId },
      { new: true }
    );
    if (!rack) {
      return res.status(404).json({ message: 'Rack not found' });
    }
    res.json(rack);
  } catch (error) {
    res.status(400).json({ message: 'Error renaming rack', error });
  }
});

// Delete a rack
router.delete('/:id', async (req, res) => {
  try {
    const rack = await Rack.findOneAndDelete({ id: req.params.id });
    if (!rack) {
      return res.status(404).json({ message: 'Rack not found' });
    }
    res.json({ message: 'Rack deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting rack', error });
  }
});

module.exports = router;