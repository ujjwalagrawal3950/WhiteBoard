import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Library from './src/models/Library.js';

dotenv.config();

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const fs = await import('fs');
    const path = await import('path');
    const demoPath = path.resolve(process.cwd(), '../temp.json');
    const demoJson = JSON.parse(fs.readFileSync(demoPath, 'utf8'));
    
    const elements = demoJson.elements.map(el => ({
      ...el,
      x1: el.x || 0,
      y1: el.y || 0,
      x2: (el.x || 0) + (el.width || 100),
      y2: (el.y || 0) + (el.height || 100),
    }));

    const template = new Library({
      name: 'Kafka Streams Topology',
      description: 'A template for designing Kafka streams architecture diagrams. Includes standard components and layout.',
      tags: ['kafka', 'streaming', 'architecture', 'data'],
      elements: elements,
      authorName: 'System',
      authorId: new mongoose.Types.ObjectId(),
      downloads: 42,
    });

    await template.save();
    console.log('Template inserted:', template._id);
    
    mongoose.disconnect();
  } catch (err) {
    console.error(err);
    mongoose.disconnect();
  }
}

seed();
