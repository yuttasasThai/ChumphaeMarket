import fs from 'fs';
import path from 'path';

export function streamSourceZip(res: any, rootDir: string = process.cwd(), requestedFile?: string) {
  const targetName = requestedFile || 'chumphae-store-source-rev8.zip';
  let zipPath = path.join(rootDir, 'public', targetName);

  if (!fs.existsSync(zipPath)) {
    // Fallbacks
    const candidates = [
      'chumphae-store-source-rev8.zip',
      'chumphae-store-source-rev7.zip',
      'chumphae-store-source-rev6.zip',
      'chumphae-store-source-rev5.zip',
      'chumphae-store-source.zip',
    ];
    for (const cand of candidates) {
      const p = path.join(rootDir, 'public', cand);
      if (fs.existsSync(p)) {
        zipPath = p;
        break;
      }
    }
  }

  if (!fs.existsSync(zipPath)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Zip file not ready' }));
    return;
  }

  const filename = path.basename(zipPath);
  const stat = fs.statSync(zipPath);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Transfer-Encoding', 'binary');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const fileStream = fs.createReadStream(zipPath);
  fileStream.pipe(res);
}
