import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Reads a JSON file, returning defaultValue if it doesn't exist or is invalid.
 */
export async function readJson(filename, defaultValue = []) {
  const filePath = path.join(__dirname, filename);
  try {
    if (!existsSync(filePath)) {
      return defaultValue;
    }
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Error reading JSON file ${filename}:`, error.message);
    return defaultValue;
  }
}

/**
 * Writes data to a JSON file.
 */
export async function writeJson(filename, data) {
  const filePath = path.join(__dirname, filename);
  try {
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error writing JSON file ${filename}:`, error.message);
  }
}
