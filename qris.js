// qris.js
import QRCode from 'qrcode';
import fs from 'fs-extra';
import path from 'path';

// CRC16-CCITT (poly 0x1021, init 0xFFFF)
export function crc16ccitt(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    crc ^= c << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generateDynamicQRIS(staticPayload, amountNumber) {
  let payload = String(staticPayload || '').replace(/\s+/g, '');
  payload = payload.replace(/54\d{2}\d+/g, '');
  payload = payload.replace(/6304[0-9A-Fa-f]{4}$/, '');
  const amt = Math.round(Number(amountNumber) || 0);
  const amtStr = String(amt);
  const len = amtStr.length.toString().padStart(2, '0');
  payload = payload + `54${len}${amtStr}`;
  const toCRC = payload + '6304';
  const crc = crc16ccitt(toCRC);
  return toCRC + crc;
}

export async function generateQRImageToFile(payload, filenameBase = null) {
  const publicDir = path.join(process.cwd(), 'public');
  const qrsDir = path.join(publicDir, 'qrs');
  await fs.ensureDir(qrsDir);
  const fname = filenameBase ? `${filenameBase}.png` : `qris-${Date.now()}.png`;
  const outPath = path.join(qrsDir, fname);
  await QRCode.toFile(outPath, payload, { type: 'png', width: 512, errorCorrectionLevel: 'M' });
  return `/qrs/${fname}`;
}
