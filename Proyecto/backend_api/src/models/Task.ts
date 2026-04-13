import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  title: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
    enum: ['Matemáticas', 'Ciencias', 'Español', 'Historia'],
  },
  dueDate: {
    type: String,
    required: true,
  },
  priority: {
    type: String,
    required: true,
    enum: ['Alta', 'Media', 'Baja'],
  },
  completed: {
    type: Boolean,
    required: true,
    default: false,
  },
}, {
  timestamps: true,
});

const Task = mongoose.model('Task', taskSchema);

export default Task;
