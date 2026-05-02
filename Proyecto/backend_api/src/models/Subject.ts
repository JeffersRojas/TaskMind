import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  colors: {
    card: { type: String, required: true },
    light: { type: String, required: true },
  },
}, {
  timestamps: true,
});

const Subject = mongoose.model('Subject', subjectSchema);

export default Subject;
