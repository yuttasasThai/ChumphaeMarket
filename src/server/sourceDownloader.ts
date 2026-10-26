import fs from 'fs';
import path from 'path';

export function streamSourceZip(res: any, rootDir: string = process.cwd()) {
  const zipPath = path.join(rootDir, 'public', 'chumphae-store-source.zip');

  if (!fs.existsSync(zipPath)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Zip file not ready' }));
    return;
  }

  const stat = fs.statSync(zipPath);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', 'attachment; filename="chumphae-store-source.zip"');

  const fileStream = fs.createReadStream(zipPath);
  fileStream.pipe(res);
}
