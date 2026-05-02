import express from 'express';
import { authUser, registerUser, getUsers, updateUser, deleteUser } from '../controllers/userController.js';
import { protect, adminOnly, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', optionalAuth, registerUser);
router.post('/login', authUser);
router.get('/', protect, adminOnly, getUsers);
router.put('/:id', protect, adminOnly, updateUser);
router.delete('/:id', protect, adminOnly, deleteUser);

export default router;
