const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

const HEADER = [
  { id: 'company', title: 'Company' },
  { id: 'title', title: 'Title' },
  { id: 'url', title: 'URL' },
  { id: 'source', title: 'Source' },
  { id: 'timeFound', title: 'Time Found' },
  { id: 'status', title: 'Status' },
  { id: 'notes', title: 'Notes' },
];

/**
 * Appends rows to a CSV file, writing the header only once.
 */
class CsvLogger {
  constructor(filePath) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.fileExisted = fs.existsSync(filePath);
    this.writer = createObjectCsvWriter({
      path: filePath,
      header: HEADER,
      append: this.fileExisted,
    });
  }

  async append(record) {
    await this.writer.writeRecords([
      {
        company: record.company || '',
        title: record.title || '',
        url: record.url || '',
        source: record.source || '',
        timeFound: record.timeFound || new Date().toISOString(),
        status: record.status || '',
        notes: record.notes || '',
      },
    ]);
    this.fileExisted = true;
  }
}

module.exports = CsvLogger;
