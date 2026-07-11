/**
 * ESC/POS Thermal Printer Module for 58mm Bluetooth Printers
 * Works via Windows COM port (Bluetooth Serial Port Profile)
 *
 * Supports: Scangle SGT-B58V and any ESC/POS-compatible thermal printer
 * Paper width: 58mm (32 chars/line at normal size, 48 at small)
 */

export interface PrinterConfig {
  comPort: string;       // e.g. 'COM3' on Windows, '/dev/ttyUSB0' on Linux
  baudRate: number;      // Default: 9600
  autoDetect: boolean;   // Auto-detect COM port
}

export interface PrintResult {
  success: boolean;
  message: string;
}

// ESC/POS command constants
const ESC = '\x1B';
const GS = '\x1D';
const LF = '\x0A';
const HT = '\x09';

const CMD = {
  INIT: `${ESC}@`,                    // Initialize printer
  FEED_1: '\n',                        // Line feed
  FEED_3: '\n\n\n',                   // 3 line feeds
  FEED_5: '\n\n\n\n\n',              // 5 line feeds
  CUT: `${GS}V\x41\x03`,             // Partial cut
  BOLD_ON: `${ESC}E\x01`,            // Bold on
  BOLD_OFF: `${ESC}E\x00`,           // Bold off
  UNDERLINE_ON: `${ESC}-\x01`,       // Underline on
  UNDERLINE_OFF: `${ESC}-\x00`,      // Underline off
  DOUBLE_ON: `${GS}!\x11`,           // Double height + width
  DOUBLE_OFF: `${GS}!\x00`,          // Normal size
  CENTER: `${ESC}a\x01`,             // Center align
  LEFT: `${ESC}a\x00`,               // Left align
  RIGHT: `${ESC}a\x02`,              // Right align
  CHAR_SIZE_NORMAL: `${GS}!\x00`,    // Normal
  CHAR_SIZE_DOUBLE_H: `${GS}!\x10`,  // Double height
  CHAR_SIZE_DOUBLE_W: `${GS}!\x01`,  // Double width
  CHAR_SIZE_DOUBLE_HW: `${GS}!\x11`, // Double both
};

/**
 * Pad or truncate text to exact width for 58mm (32 chars)
 */
function padLine(text: string, width: number = 32): string {
  // Remove any newlines
  const clean = text.replace(/[\r\n]/g, '');
  if (clean.length >= width) return clean.slice(0, width);
  return clean + ' '.repeat(width - clean.length);
}

function padLeft(text: string, width: number = 32): string {
  const clean = text.replace(/[\r\n]/g, '');
  if (clean.length >= width) return clean.slice(0, width);
  return ' '.repeat(width - clean.length) + clean;
}

function centerText(text: string, width: number = 32): string {
  const clean = text.replace(/[\r\n]/g, '');
  if (clean.length >= width) return clean.slice(0, width);
  const totalPad = width - clean.length;
  const leftPad = Math.floor(totalPad / 2);
  const rightPad = totalPad - leftPad;
  return ' '.repeat(leftPad) + clean + ' '.repeat(rightPad);
}

/**
 * Build a sale receipt as ESC/POS bytes
 */
export function buildSaleReceipt(options: {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  invoiceNo: string;
  date: string;
  customerName?: string;
  saleType: string;
  items: Array<{ name: string; qty: number; price: number; total: number }>;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  balance: number;
}): string {
  const W = 32; // 58mm paper width
  let buf = '';

  // Initialize
  buf += CMD.INIT;

  // Store name - centered, double size
  buf += CMD.CENTER + CMD.DOUBLE_ON;
  buf += options.storeName + CMD.FEED_1;
  buf += CMD.DOUBLE_OFF;

  // Store info
  if (options.storeAddress) buf += centerText(options.storeAddress, W) + CMD.FEED_1;
  if (options.storePhone) buf += centerText('Tel: ' + options.storePhone, W) + CMD.FEED_1;

  buf += CMD.FEED_1;

  // Invoice info
  buf += 'Invoice: ' + options.invoiceNo + CMD.FEED_1;
  buf += 'Date: ' + options.date + CMD.FEED_1;
  buf += 'Type: ' + options.saleType + CMD.FEED_1;
  if (options.customerName) buf += 'Customer: ' + options.customerName + CMD.FEED_1;

  // Separator line
  buf += '-'.repeat(W) + CMD.FEED_1;

  // Table header
  buf += padLine('Item', 16) + padLeft('Qty', 4) + padLeft('Amt', W - 20) + CMD.FEED_1;
  buf += '-'.repeat(W) + CMD.FEED_1;

  // Items
  for (const item of options.items) {
    const nameLines = item.name.length > 16 ? [item.name.slice(0, 16), item.name.slice(16)] : [item.name];
    for (let i = 0; i < nameLines.length; i++) {
      if (i === 0) {
        buf += padLine(nameLines[i], 16) + padLeft(String(item.qty), 4) + padLeft(item.total.toFixed(0), W - 20);
      } else {
        buf += padLine(nameLines[i], 16);
      }
      buf += CMD.FEED_1;
    }
  }

  // Separator
  buf += '-'.repeat(W) + CMD.FEED_1;

  // Totals
  const formatMoney = (n: number) => 'Rs ' + n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  buf += padLine('Subtotal:', W - 12) + padLeft(formatMoney(options.subtotal), 12) + CMD.FEED_1;

  if (options.discount > 0) {
    buf += padLine('Discount:', W - 12) + padLeft('-' + formatMoney(options.discount), 12) + CMD.FEED_1;
  }

  buf += CMD.BOLD_ON;
  buf += padLine('TOTAL:', W - 12) + padLeft(formatMoney(options.total), 12) + CMD.FEED_1;
  buf += CMD.BOLD_OFF;

  buf += padLine('Paid:', W - 12) + padLeft(formatMoney(options.paid), 12) + CMD.FEED_1;

  if (options.balance > 0) {
    buf += padLine('Balance:', W - 12) + padLeft(formatMoney(options.balance), 12) + CMD.FEED_1;
  }

  // Footer
  buf += '-'.repeat(W) + CMD.FEED_1;
  buf += CMD.CENTER;
  buf += 'Thank you for shopping!' + CMD.FEED_1;
  buf += 'Tariq Karyana Store' + CMD.FEED_1;

  // Cut paper
  buf += CMD.FEED_3;
  buf += CMD.CUT;

  return buf;
}

/**
 * Build a simple test receipt
 */
export function buildTestReceipt(): string {
  let buf = '';
  buf += CMD.INIT;
  buf += CMD.CENTER + CMD.DOUBLE_ON;
  buf += 'Tariq Karyana Store' + CMD.FEED_1;
  buf += CMD.DOUBLE_OFF;
  buf += CMD.FEED_1;
  buf += 'Test Print OK!' + CMD.FEED_1;
  buf += new Date().toLocaleString() + CMD.FEED_1;
  buf += '-'.repeat(32) + CMD.FEED_1;
  buf += 'Printer is working.' + CMD.FEED_1;
  buf += '58mm ESC/POS Compatible.' + CMD.FEED_1;
  buf += CMD.FEED_3;
  buf += CMD.CUT;
  return buf;
}

/**
 * Send raw ESC/POS data to a COM port.
 * This runs in Electron main process (Node.js).
 */
export async function sendToPrinter(comPort: string, data: string, baudRate: number = 9600): Promise<PrintResult> {
  try {
    const { SerialPort } = await import('serialport');
    const port = new SerialPort({
      path: comPort,
      baudRate,
      autoOpen: false,
    });

    return new Promise((resolve) => {
      port.open(async (err) => {
        if (err) {
          resolve({ success: false, message: `Cannot open ${comPort}: ${err.message}` });
          return;
        }

        try {
          const buffer = Buffer.from(data, 'binary');
          port.write(buffer, async (writeErr) => {
            if (writeErr) {
              port.close();
              resolve({ success: false, message: `Write error: ${writeErr.message}` });
              return;
            }

            // Wait for data to be sent
            port.drain(async (drainErr) => {
              port.close();
              if (drainErr) {
                resolve({ success: false, message: `Drain error: ${drainErr.message}` });
              } else {
                resolve({ success: true, message: 'Print sent successfully' });
              }
            });
          });
        } catch (e: any) {
          port.close();
          resolve({ success: false, message: `Error: ${e.message}` });
        }
      });
    });
  } catch (e: any) {
    return { success: false, message: `serialport not available: ${e.message}` };
  }
}

/**
 * List available serial/COM ports
 */
export async function listPorts(): Promise<Array<{ path: string; manufacturer?: string; vendorId?: string; productId?: string }>> {
  try {
    const { SerialPort } = await import('serialport');
    const ports = await SerialPort.list();
    return ports.map(p => ({
      path: p.path,
      manufacturer: p.manufacturer || undefined,
      vendorId: p.vendorId || undefined,
      productId: p.productId || undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Auto-detect Bluetooth thermal printer (commonly COM3-COM10 on Windows)
 * Looks for ports with common Bluetooth/thermal printer identifiers
 */
export async function autoDetectPrinter(): Promise<string | null> {
  const ports = await listPorts();
  if (ports.length === 0) return null;

  // Common COM ports for Bluetooth printers
  const btPatterns = ['COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'COM10'];
  const printerKeywords = ['printer', 'thermal', 'pos', 'bluetooth', 'spp', 'serial', 'usb'];

  // First try: match by manufacturer/description keywords
  for (const port of ports) {
    const info = `${port.manufacturer || ''} ${port.vendorId || ''}`.toLowerCase();
    if (printerKeywords.some(kw => info.includes(kw))) {
      return port.path;
    }
  }

  // Second try: return highest COM port (Bluetooth printers usually get higher numbers)
  const comPorts = ports.filter(p => p.path.startsWith('COM')).sort((a, b) => {
    const aNum = parseInt(a.path.replace('COM', ''));
    const bNum = parseInt(b.path.replace('COM', ''));
    return bNum - aNum; // Highest first
  });

  if (comPorts.length > 0) return comPorts[0].path;

  // Last resort: return first available port
  return ports[0]?.path || null;
}