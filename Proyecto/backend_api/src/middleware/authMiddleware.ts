import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User from '../models/User.js';

export interface AuthRequest extends Request {
  user?: any;
}

const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123');
      req.user = await User.findById(decoded.id).select('-password');
      next();
      return;
    } catch (error) {
      res.status(401).json({ message: 'No autorizado, token fallido' });
      return;
    }
  }

  if (!token) {
    res.status(401).json({ message: 'No autorizado, sin token' });
    return;
  }
};

const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123');
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      req.user = undefined;
    }
  }
  next();
};

const adminOnly = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ message: 'Acceso denegado: solo administradores' });
    return;
  }
  next();
};

export { protect, optionalAuth, adminOnly };
