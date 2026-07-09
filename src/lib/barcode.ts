export function generateBarcode(text: string): string {
  // Generate Code 128 barcode encoding
  const CODE128_START_B = 104;
  const CODE128_STOP = 106;

  const values: number[] = [CODE128_START_B];

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    if (charCode >= 32 && charCode <= 127) {
      values.push(charCode - 32);
    } else {
      values.push(32); // space for unsupported
    }
  }

  values.push(CODE128_STOP);

  // Calculate checksum
  let checksum = values[0];
  for (let i = 1; i < values.length - 1; i++) {
    checksum += i * values[i];
  }
  values[values.length - 1] = checksum % 103;

  // Convert to SVG path
  const patterns = getCode128Patterns();
  let binary = '';
  for (const v of values) {
    binary += patterns[v] || '11010010000';
  }

  return binaryToSVG(binary, text);
}

function getCode128Patterns(): Record<number, string> {
  const p: Record<number, string> = {};
  // Code 128 Set B patterns (simplified)
  const codes = [
    '11011001100','11001101100','11001100110','10010011000','10010001100',
    '10001001100','10011001000','10011000100','10001100100','11001001000',
    '11001000100','11000100100','10110011100','10011011100','10011001110',
    '10111001100','10011101100','10011100110','11001110010','11001011100',
    '11001001110','11011100100','11001110100','11101101110','11101001100',
    '11100101100','11100100110','11101100100','11100110100','11100110010',
    '11011011000','11011000110','11000110110','10100011000','10001011000',
    '10001000110','10110001000','10001101000','10001100010','11010001000',
    '11000101000','11000100010','10110111000','10110001110','10001101110',
    '10111011000','10111000110','10001110110','11101110110','11010001110',
    '11000101110','11011101000','11011100010','11011101110','11101011000',
    '11101000110','11100010110','11101101000','11101100010','11100011010',
    '11101111010','11001000010','11110001010','10100110000','10100001100',
    '10010110000','10010000110','10000101100','10000100110','10110010000',
    '10110000100','10011010000','10011000010','10000110100','10000110010',
    '11000010010','11001010000','11110111010','11000010100','10001111010',
    '10100111100','10010111100','10010011110','10111100100','10011110100',
    '10011110010','11110100100','11110010100','11110010010','11011011110',
    '11011110110','11110110110','10101111000','10100011110','10001011110',
    '10111101000','10111100010','11110101000','11110100010','10111011110',
    '10111101110','11101011110','11110101110','11010000100','11010010000',
    '11010011100','1100011101011'
  ];
  for (let i = 0; i < codes.length; i++) {
    p[i] = codes[i];
  }
  return p;
}

function binaryToSVG(binary: string, text: string): string {
  const barWidth = 2;
  const height = 50;
  const textHeight = 16;
  const totalWidth = binary.length * barWidth;
  const textY = height + textHeight;

  let rects = '';
  let x = 0;
  for (const bit of binary) {
    if (bit === '1') {
      rects += `<rect x="${x}" y="0" width="${barWidth}" height="${height}" fill="#000"/>`;
    }
    x += barWidth;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height + textHeight + 4}" viewBox="0 0 ${totalWidth} ${height + textHeight + 4}">${rects}<text x="${totalWidth / 2}" y="${textY}" text-anchor="middle" font-family="monospace" font-size="12" fill="#000">${text}</text></svg>`;
}

export function generateProductBarcode(): string {
  const prefix = 'P';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return prefix + timestamp + random;
}

export function generateCustomerBarcode(): string {
  const prefix = 'C';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return prefix + timestamp + random;
}

export function generateInvoiceNo(prefix: string, num: number): string {
  return `${prefix}-${String(num).padStart(6, '0')}`;
}