import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware.js';
import Task from '../models/Task.js';

// @desc    Obtener todas las tareas del usuario
// @route   GET /api/tasks
export const getTasks = async (req: AuthRequest, res: Response) => {
  const tasks = await Task.find({ user: req.user._id });
  res.json(tasks);
};

// @desc    Crear una nueva tarea
// @route   POST /api/tasks
export const createTask = async (req: AuthRequest, res: Response) => {
  const { title, subject, dueDate, priority } = req.body;

  const task = new Task({
    user: req.user._id,
    title,
    subject,
    dueDate,
    priority,
    completed: false,
  });

  const createdTask = await task.save();
  res.status(201).json(createdTask);
};

// @desc    Actualizar una tarea
// @route   PUT /api/tasks/:id
export const updateTask = async (req: AuthRequest, res: Response) => {
  const { title, subject, dueDate, priority, completed } = req.body;

  const task = await Task.findById(req.params.id);

  if (task) {
    if (task.user.toString() !== req.user._id.toString()) {
      res.status(401).json({ message: 'No autorizado' });
      return;
    }

    task.title = title || task.title;
    task.subject = subject || task.subject;
    task.dueDate = dueDate || task.dueDate;
    task.priority = priority || task.priority;
    task.completed = completed !== undefined ? completed : task.completed;

    const updatedTask = await task.save();
    res.json(updatedTask);
  } else {
    res.status(404).json({ message: 'Tarea no encontrada' });
  }
};

// @desc    Eliminar una tarea
// @route   DELETE /api/tasks/:id
export const deleteTask = async (req: AuthRequest, res: Response) => {
  const task = await Task.findById(req.params.id);

  if (task) {
    if (task.user.toString() !== req.user._id.toString()) {
      res.status(401).json({ message: 'No autorizado' });
      return;
    }

    await Task.deleteOne({ _id: task._id });
    res.json({ message: 'Tarea eliminada' });
  } else {
    res.status(404).json({ message: 'Tarea no encontrada' });
  }
};
