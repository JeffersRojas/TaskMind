import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Subject from '../models/Subject.js';
import { AuthRequest } from '../middleware/authMiddleware.js';

const generateToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretkey123', {
    expiresIn: '30d',
  });
};

// @desc    Autenticar usuario y obtener token
// @route   POST /api/users/login
export const authUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user: any = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } else {
    res.status(401).json({ message: 'Email o contraseña inválidos' });
  }
};

// @desc    Registrar un nuevo usuario
// @route   POST /api/users
export const registerUser = async (req: AuthRequest, res: Response) => {
  const { name, email, password } = req.body;

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400).json({ message: 'El usuario ya existe' });
    return;
  }

  const totalUsers = await User.countDocuments();
  const isBootstrap = totalUsers === 0;

  if (!isBootstrap) {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ message: 'Solo un administrador puede crear usuarios' });
      return;
    }
  }

  const role = isBootstrap ? 'admin' : (req.body?.role === 'admin' ? 'admin' : 'user');

  const user = await User.create({
    name,
    email,
    password,
    role,
  });

  if (user) {
    if (isBootstrap) {
      const existingSubjects = await Subject.countDocuments();
      if (existingSubjects === 0) {
        await Subject.insertMany([
          { name: 'Matemáticas', colors: { card: '#3C7BEA', light: '#DCE7FF' } },
          { name: 'Ciencias', colors: { card: '#71B452', light: '#E3F2DA' } },
          { name: 'Español', colors: { card: '#8467D7', light: '#E7DEFF' } },
          { name: 'Historia', colors: { card: '#E29A4B', light: '#FBE8D4' } },
        ]);
      }
    }

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id.toString()),
    });
  } else {
    res.status(400).json({ message: 'Datos de usuario inválidos' });
  }
};

export const getUsers = async (_req: AuthRequest, res: Response) => {
  const users = await User.find({}).select('-password').sort({ createdAt: -1 });
  res.json(users);
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ message: 'Usuario no encontrado' });
    return;
  }

  const { name, email, password, role } = req.body ?? {};

  if (typeof name === 'string' && name.trim()) {
    user.name = name.trim();
  }

  if (typeof email === 'string' && email.trim()) {
    user.email = email.trim().toLowerCase();
  }

  if (typeof password === 'string' && password.trim()) {
    user.password = password.trim();
  }

  if (role === 'admin' || role === 'user') {
    user.role = role;
  }

  const saved = await user.save();
  const savedSafe: any = saved.toObject();
  delete savedSafe.password;
  res.json(savedSafe);
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ message: 'Usuario no encontrado' });
    return;
  }

  await User.deleteOne({ _id: user._id });
  res.json({ message: 'Usuario eliminado' });
};
