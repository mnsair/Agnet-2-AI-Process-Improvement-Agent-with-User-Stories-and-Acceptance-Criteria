import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const r1 = dotenv.config({ path: path.resolve(__dirname, '.env.local') });
console.log('.env.local load result:', r1);
const r2 = dotenv.config({ path: path.resolve(__dirname, '.env') });
console.log('.env load result:', r2);
console.log('process.env.OPENAI_API_KEY:', !!process.env.OPENAI_API_KEY);
