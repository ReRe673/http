import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'src', 'data', 'portfolio-content.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const journalScenes = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'journal-scenes.json'), 'utf8'));
const journalAudit = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'journal-scenes-audit.json'), 'utf8'));
const failures = [];

if (manifest.slideCount !== 36 || manifest.slides.length !== 36) {
  failures.push(`Expected 36 slides, found ${manifest.slides.length}`);
}
if (manifest.mediaCount !== 107 || manifest.media.length !== 107) {
  failures.push(`Expected 107 media files, found ${manifest.media.length}`);
}

for (let number = 1; number <= 36; number += 1) {
  const slide = manifest.slides.find(item => item.number === number);
  if (!slide) failures.push(`Slide ${number} is not mapped`);
  if (slide && slide.textBlocks.length === 0) failures.push(`Slide ${number} has no extracted text`);
  const render = path.join(root, 'public', 'slides', `slide-${number}.png`);
  if (!fs.existsSync(render)) failures.push(`Missing render for slide ${number}`);
}

for (const item of manifest.media) {
  const mediaPath = path.join(root, 'public', 'source-media', item.filename);
  if (!fs.existsSync(mediaPath)) failures.push(`Missing media ${item.filename}`);
  if (!item.status) failures.push(`Missing status for ${item.filename}`);
}

for (let number = 4; number <= 12; number += 1) {
  const scene = journalScenes.slides.find(item => item.number === number);
  if (!scene) {
    failures.push(`Missing journal scene ${number}`);
    continue;
  }
  const audited = journalAudit.nodes.filter(item => item.slide === number);
  if (scene.elements.length !== scene.sourceNodeCount || audited.length !== scene.sourceNodeCount) {
    failures.push(`Journal scene ${number} node audit mismatch`);
  }
  if (!scene.elements.some(item => item.kind === 'text')) failures.push(`Journal scene ${number} has no selectable text`);
  for (const element of scene.elements.filter(item => item.kind === 'image')) {
    const mediaPath = path.join(root, 'public', element.fill.src.replace(/^\//, ''));
    if (!fs.existsSync(mediaPath)) failures.push(`Journal scene ${number} missing image ${element.fill.src}`);
  }
}

if (journalScenes.slides.length !== 9) failures.push(`Expected 9 journal scenes, found ${journalScenes.slides.length}`);
if (journalAudit.nodes.some(item => !['text', 'image', 'shape'].includes(item.status))) failures.push('Journal scene has unaudited nodes');

const searchable = [
  ...fs.readdirSync(path.join(root, 'src'), { recursive: true })
    .filter(name => /\.(jsx|js|css|json)$/.test(name))
    .map(name => fs.readFileSync(path.join(root, 'src', name), 'utf8')),
].join('\n');

if (/\b1[3-9]\d{9}\b/.test(searchable)) failures.push('Phone number leaked into source content');

if (failures.length) {
  console.error(JSON.stringify({ status: 'fail', failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'pass',
  slides: manifest.slides.length,
  media: manifest.media.length,
  textBlocks: manifest.slides.reduce((sum, slide) => sum + slide.textBlocks.length, 0),
  journalScenes: journalScenes.slides.length,
  journalNodes: journalAudit.nodes.length,
}, null, 2));
