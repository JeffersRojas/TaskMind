import { Request, Response } from 'express';
import Subject from '../models/Subject.js';

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (n: number) => clampByte(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '').trim();
  const full = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return { r, g, b };
}

function mix(colorA: string, colorB: string, ratio: number) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const inv = 1 - ratio;
  return rgbToHex(
    a.r * inv + b.r * ratio,
    a.g * inv + b.g * ratio,
    a.b * inv + b.b * ratio,
  );
}

function defaultColorsForName(name: string) {
  const seed = hashString(name);
  const base = rgbToHex(
    60 + (seed % 140),
    70 + ((seed >> 8) % 140),
    90 + ((seed >> 16) % 140),
  );
  return {
    card: base,
    light: mix(base, '#FFFFFF', 0.8),
  };
}

export const getSubjects = async (_req: Request, res: Response) => {
  const subjects = await Subject.find({}).sort({ name: 1 });
  res.json(subjects);
};

export const createSubject = async (req: Request, res: Response) => {
  const { name, colors } = req.body ?? {};

  if (!name || typeof name !== 'string') {
    res.status(400).json({ message: 'Nombre de materia inválido' });
    return;
  }

  const exists = await Subject.findOne({ name: name.trim() });
  if (exists) {
    res.status(400).json({ message: 'La materia ya existe' });
    return;
  }

  const resolvedColors = colors?.card && colors?.light
    ? { card: String(colors.card), light: String(colors.light) }
    : defaultColorsForName(name);

  const created = await Subject.create({
    name: name.trim(),
    colors: resolvedColors,
  });

  res.status(201).json(created);
};

export const updateSubject = async (req: Request, res: Response) => {
  const subject = await Subject.findById(req.params.id);
  if (!subject) {
    res.status(404).json({ message: 'Materia no encontrada' });
    return;
  }

  const { name, colors } = req.body ?? {};

  if (name && typeof name === 'string') {
    subject.name = name.trim();
  }

  if (colors?.card && colors?.light) {
    subject.colors = { card: String(colors.card), light: String(colors.light) };
  }

  const saved = await subject.save();
  res.json(saved);
};

export const deleteSubject = async (req: Request, res: Response) => {
  const subject = await Subject.findById(req.params.id);
  if (!subject) {
    res.status(404).json({ message: 'Materia no encontrada' });
    return;
  }

  await Subject.deleteOne({ _id: subject._id });
  res.json({ message: 'Materia eliminada' });
};
