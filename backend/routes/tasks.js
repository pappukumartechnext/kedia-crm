const express = require('express');
const Task = require('../models/Task');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all tasks with filters
router.get('/', auth, async (req, res) => {
  try {
    const { status, priority, search, givenBy } = req.query;
    let filter = {};

    if (req.user.type === 'staff') {
      filter.givenTo = req.user.id;
    }

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (givenBy) filter.givenBy = givenBy;
    if (search) {
      filter.$or = [
        { task: { $regex: search, $options: 'i' } },
        { givenBy: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(filter)
      .populate('givenTo', 'name email')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create task (Admin only)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const taskData = {
      ...req.body,
      givenBy: req.user.name,
      createdBy: req.user.id
    };

    const task = new Task(taskData);
    await task.save();
    
    const populatedTask = await Task.findById(task._id).populate('givenTo', 'name email');
    res.status(201).json(populatedTask);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update task
router.put('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Staff can only update steps and status
    if (req.user.type === 'staff') {
      if (task.givenTo.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const allowedUpdates = ['stepsTaken', 'status', 'lastUpdated'];
      const updates = Object.keys(req.body).filter(key => allowedUpdates.includes(key));
      updates.forEach(update => task[update] = req.body[update]);
    } else {
      // Admin can update all fields
      Object.keys(req.body).forEach(key => {
        if (key !== 'givenBy' && key !== 'createdBy') {
          task[key] = req.body[key];
        }
      });
    }

    await task.save();
    const updatedTask = await Task.findById(task._id).populate('givenTo', 'name email');
    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete task (Admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get dashboard stats
router.get('/dashboard/stats', auth, async (req, res) => {
  try {
    let filter = {};
    if (req.user.type === 'staff') {
      filter.givenTo = req.user.id;
    }

    const totalTasks = await Task.countDocuments(filter);
    const pendingTasks = await Task.countDocuments({ ...filter, status: 'Pending' });
    const completedTasks = await Task.countDocuments({ ...filter, status: 'Completed' });
    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.json({
      totalTasks,
      pendingTasks,
      completedTasks,
      completionPercent
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;