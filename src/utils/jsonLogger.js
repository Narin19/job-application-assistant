const fs = require('fs');
const path = require('path');

/**
 * Minimal JSON-array log store. Each file holds a single JSON array of
 * records. Not built for high concurrency — this project runs as a single
 * process, which keeps things simple and dependency-free.
 */
class JsonLogger {
  constructor(filePath) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]', 'utf-8');
    }
  }

  readAll() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(raw || '[]');
    } catch (err) {
      return [];
    }
  }

  append(record) {
    const all = this.readAll();
    all.push(record);
    fs.writeFileSync(this.filePath, JSON.stringify(all, null, 2), 'utf-8');
    return record;
  }

  /**
   * True if a record with the same URL already exists — used to avoid
   * re-processing or re-applying to the same job posting.
   */
  exists(url) {
    return this.readAll().some((r) => r.url === url);
  }
}

module.exports = JsonLogger;
