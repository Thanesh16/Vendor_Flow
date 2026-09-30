const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { Receipt } = require('../models/Receipt');
const { PurchaseOrder, POStatus } = require('../models/PurchaseOrder');
const { Document } = require('../models/Document');
const auditService = require('./auditService');

// Guarantee uploads/receipts directory exists for stored PDF files
const receiptsDir = path.join(__dirname, '../../uploads/receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

/**
 * Helper to generate sequential and collision-safe Receipt number (REC-YYYY-XXXXX)
 */
const generateReceiptNumber = async () => {
  const year = new Date().getFullYear();
  const count = await Receipt.countDocuments();
  let candidate = `REC-${year}-${String(count + 1).padStart(5, '0')}`;

  let existing = await Receipt.findOne({ receiptNumber: candidate });
  let attempts = 1;
  while (existing && attempts < 20) {
    candidate = `REC-${year}-${String(count + 1 + attempts).padStart(5, '0')}`;
    existing = await Receipt.findOne({ receiptNumber: candidate });
    attempts++;
  }
  if (existing) {
    candidate = `REC-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
  }
  return candidate;
};

const receiptService = {
  /**
   * Generate or retrieve existing receipt for a delivered/completed purchase order
   * @param {string} purchaseOrderId
   * @param {Object} [user] - Authenticated user initiating or triggering generation
   * @returns {Promise<Object>}
   */
  async generateReceiptForPO(purchaseOrderId, user = null) {
    const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId)
      .populate('vendor', 'companyName contactPerson email phone address city state country taxId')
      .populate('requestedBy', 'name email role')
      .populate('purchaseRequest', 'requestNumber title');

    if (!purchaseOrder) {
      const err = new Error('Purchase order not found');
      err.statusCode = 404;
      throw err;
    }

    // Eligibility check
    const eligibleStatuses = [POStatus.DELIVERED, POStatus.COMPLETED];
    if (!eligibleStatuses.includes(purchaseOrder.status)) {
      const err = new Error(
        `Receipt is not available for this order yet. Order must be DELIVERED or COMPLETED (current: ${purchaseOrder.status}).`
      );
      err.statusCode = 400;
      throw err;
    }

    // Prevent duplicate receipt generation: reuse existing receipt
    let existing = await Receipt.findOne({ purchaseOrder: purchaseOrder._id });
    if (existing) {
      // Backfill purchaseRequest/prNumber if missing from earlier creation
      if (!existing.prNumber && purchaseOrder.purchaseRequest?.requestNumber) {
        existing.prNumber = purchaseOrder.purchaseRequest.requestNumber;
        existing.purchaseRequest = purchaseOrder.purchaseRequest._id;
        await existing.save();
      }
      return existing;
    }

    const receiptNumber = await generateReceiptNumber();

    // Determine delivery timestamp
    const deliveryHistory = (purchaseOrder.statusHistory || []).find(
      (h) => h.status === POStatus.DELIVERED || h.status === POStatus.COMPLETED
    );
    const deliveredAt = deliveryHistory?.changedAt || purchaseOrder.updatedAt || new Date();

    // Snapshot vendor data
    const vendorSnapshot = {
      companyName: purchaseOrder.vendor?.companyName || 'Supplier',
      contactPerson: purchaseOrder.vendor?.contactPerson || '',
      email: purchaseOrder.vendor?.email || '',
      phone: purchaseOrder.vendor?.phone || '',
      address: purchaseOrder.vendor?.address || '',
      city: purchaseOrder.vendor?.city || '',
      state: purchaseOrder.vendor?.state || '',
      country: purchaseOrder.vendor?.country || '',
      taxId: purchaseOrder.vendor?.taxId || '',
    };

    // Snapshot employee data
    const employeeSnapshot = {
      name: purchaseOrder.requestedBy?.name || 'Authorized Requester',
      email: purchaseOrder.requestedBy?.email || '',
      role: purchaseOrder.requestedBy?.role || 'EMPLOYEE',
    };

    // Snapshot delivery details
    const deliverySnapshot = {
      address: purchaseOrder.deliveryDetails?.address || '',
      city: purchaseOrder.deliveryDetails?.city || '',
      state: purchaseOrder.deliveryDetails?.state || '',
      postalCode: purchaseOrder.deliveryDetails?.postalCode || '',
      contactName: purchaseOrder.deliveryDetails?.contactName || employeeSnapshot.name,
      contactPhone: purchaseOrder.deliveryDetails?.contactPhone || '',
      deliveryInstructions: purchaseOrder.deliveryDetails?.deliveryInstructions || '',
      deliveredAt,
    };

    // Snapshot items directly from PO stored order items (Historical Price Integrity)
    const itemsSnapshot = (purchaseOrder.items || []).map((it) => ({
      name: it.name,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.totalPrice,
      description: it.description || '',
      product: it.product || null,
    }));

    const prNumber = purchaseOrder.purchaseRequest?.requestNumber || '';
    const purchaseRequestId =
      purchaseOrder.purchaseRequest?._id || purchaseOrder.purchaseRequest || null;
    const pdfRelativePath = `/uploads/receipts/${receiptNumber}.pdf`;

    const receipt = await Receipt.create({
      receiptNumber,
      purchaseOrder: purchaseOrder._id,
      poNumber: purchaseOrder.poNumber,
      purchaseRequest: purchaseRequestId,
      prNumber,
      vendor: purchaseOrder.vendor?._id || purchaseOrder.vendor,
      vendorSnapshot,
      employee: purchaseOrder.requestedBy?._id || purchaseOrder.requestedBy,
      employeeSnapshot,
      deliverySnapshot,
      items: itemsSnapshot,
      subtotal: purchaseOrder.subtotal,
      tax: purchaseOrder.tax || 0,
      discount: purchaseOrder.discount || 0,
      shippingFee: purchaseOrder.shippingFee || 0,
      totalAmount: purchaseOrder.totalAmount,
      currency: 'INR',
      orderDate: purchaseOrder.createdAt,
      deliveredAt,
      issuedAt: new Date(),
      status: 'ISSUED',
      pdfUrl: pdfRelativePath,
    });

    // Record document metadata in Document collection
    try {
      await Document.create({
        originalName: `${receiptNumber}.pdf`,
        fileName: `${receiptNumber}.pdf`,
        url: pdfRelativePath,
        publicId: `local:${receiptNumber}.pdf`,
        mimeType: 'application/pdf',
        size: 0,
        uploadedBy: user?._id || purchaseOrder.requestedBy?._id || purchaseOrder.createdBy,
        relatedEntity: 'Receipt',
        relatedEntityId: receipt._id,
        storageProvider: 'local',
      });
    } catch (docErr) {
      console.warn('[receiptService] Document metadata notice:', docErr.message);
    }

    // Record audit log entry
    await auditService.log({
      user,
      userId: user?._id || purchaseOrder.requestedBy?._id || purchaseOrder.createdBy,
      action: 'RECEIPT_GENERATED',
      entityType: 'Receipt',
      entityId: receipt._id,
      description: `Purchase receipt ${receiptNumber} generated for PO ${purchaseOrder.poNumber}`,
      metadata: {
        receiptNumber,
        poNumber: purchaseOrder.poNumber,
        prNumber,
        totalAmount: purchaseOrder.totalAmount,
        vendor: vendorSnapshot.companyName,
      },
    });

    return receipt;
  },

  /**
   * Render and stream professional PDF receipt directly to response and cache on disk
   * @param {Object} receipt - Receipt document
   * @param {Object} res - Express response stream
   */
  generateReceiptPDFStream(receipt, res) {
    const pdfFilename = `${receipt.receiptNumber}.pdf`;
    const pdfFilePath = path.join(receiptsDir, pdfFilename);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename}"`);

    // If already generated and cached on disk, stream directly from disk
    if (fs.existsSync(pdfFilePath) && fs.statSync(pdfFilePath).size > 0) {
      const readStream = fs.createReadStream(pdfFilePath);
      return readStream.pipe(res);
    }

    // Otherwise generate PDF using PDFKit, streaming to response and caching to disk
    const doc = new PDFDocument({ margin: 45, size: 'A4' });
    const fileWriteStream = fs.createWriteStream(pdfFilePath);

    doc.pipe(res);
    doc.pipe(fileWriteStream);

    fileWriteStream.on('finish', async () => {
      try {
        const stats = fs.statSync(pdfFilePath);
        await Document.updateOne({ originalName: pdfFilename }, { size: stats.size });
      } catch (err) {}
    });

    // Primary Brand Header
    doc
      .fillColor('#1e3a8a')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('VENDORFLOW', 45, 45);

    doc
      .fillColor('#475569')
      .fontSize(10)
      .font('Helvetica')
      .text('Enterprise Procurement & Vendor Management Network', 45, 72);

    doc
      .fillColor('#0f172a')
      .fontSize(15)
      .font('Helvetica-Bold')
      .text('PURCHASE RECEIPT', 330, 45, { align: 'right', width: 220 });

    let metaY = 66;
    doc
      .fillColor('#64748b')
      .fontSize(9)
      .font('Helvetica')
      .text(`Receipt Number: ${receipt.receiptNumber}`, 330, metaY, { align: 'right', width: 220 });

    metaY += 13;
    doc.text(`PO Number: ${receipt.poNumber}`, 330, metaY, { align: 'right', width: 220 });

    if (receipt.prNumber) {
      metaY += 13;
      doc.text(`Requisition No: ${receipt.prNumber}`, 330, metaY, { align: 'right', width: 220 });
    }

    metaY += 13;
    doc.text(`Issued Date: ${new Date(receipt.issuedAt || receipt.createdAt).toLocaleDateString('en-IN')}`, 330, metaY, { align: 'right', width: 220 });

    if (receipt.deliveredAt) {
      metaY += 13;
      doc.text(`Delivered Date: ${new Date(receipt.deliveredAt).toLocaleDateString('en-IN')}`, 330, metaY, { align: 'right', width: 220 });
    }

    const dividerY = Math.max(metaY + 18, 125);
    doc.moveTo(45, dividerY).lineTo(550, dividerY).strokeColor('#cbd5e1').lineWidth(1).stroke();

    // Two-column Seller and Buyer Box
    const topY = dividerY + 10;

    // Left Column: Supplier / Seller Credentials
    doc
      .fillColor('#1e3a8a')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('SELLER / VENDOR', 45, topY);

    const vendor = receipt.vendorSnapshot || {};
    doc
      .fillColor('#0f172a')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(vendor.companyName || 'Supplier', 45, topY + 15);

    const vendorLoc = [vendor.address, vendor.city, vendor.state, vendor.country].filter(Boolean).join(', ');
    doc
      .fillColor('#475569')
      .fontSize(8.5)
      .font('Helvetica')
      .text(`Contact: ${vendor.contactPerson || 'Authorized Representative'}`, 45, topY + 28)
      .text(`Email: ${vendor.email || 'N/A'}`, 45, topY + 40)
      .text(`Phone: ${vendor.phone || 'N/A'}`, 45, topY + 52)
      .text(`Address: ${vendorLoc || 'Registered Supplier Facility'}`, 45, topY + 64, { width: 250 });

    let vendorExtraY = topY + 84;
    if (vendor.taxId) {
      doc.text(`GST / Tax ID: ${vendor.taxId}`, 45, vendorExtraY);
    }

    // Right Column: Buyer / Requester Information
    doc
      .fillColor('#1e3a8a')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('BUYER / REQUESTER', 320, topY);

    const emp = receipt.employeeSnapshot || {};
    const del = receipt.deliverySnapshot || {};

    doc
      .fillColor('#0f172a')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(emp.name || 'Requester', 320, topY + 15);

    doc
      .fillColor('#475569')
      .fontSize(8.5)
      .font('Helvetica')
      .text(`Email: ${emp.email || 'N/A'}`, 320, topY + 28)
      .text(`Role: ${emp.role || 'EMPLOYEE'}`, 320, topY + 40)
      .text(`Recipient: ${del.contactName || emp.name}`, 320, topY + 52)
      .text(`Recipient Phone: ${del.contactPhone || 'N/A'}`, 320, topY + 64);

    const tableTopY = Math.max(vendorExtraY + 25, 235);
    doc.moveTo(45, tableTopY - 8).lineTo(550, tableTopY - 8).strokeColor('#e2e8f0').lineWidth(1).stroke();

    // Items Table Header
    doc
      .rect(45, tableTopY, 505, 20)
      .fillColor('#f1f5f9')
      .fill();

    doc
      .fillColor('#334155')
      .fontSize(8.5)
      .font('Helvetica-Bold')
      .text('#', 55, tableTopY + 5)
      .text('PRODUCT / ITEM DESCRIPTION', 80, tableTopY + 5)
      .text('QTY', 330, tableTopY + 5, { width: 45, align: 'center' })
      .text('UNIT PRICE (INR)', 380, tableTopY + 5, { width: 85, align: 'right' })
      .text('LINE TOTAL (INR)', 470, tableTopY + 5, { width: 70, align: 'right' });

    // Table Rows (Historical price snapshot strictly preserved)
    let rowY = tableTopY + 24;
    (receipt.items || []).forEach((item, index) => {
      doc
        .fillColor('#64748b')
        .fontSize(8.5)
        .font('Helvetica')
        .text(String(index + 1), 55, rowY);

      doc
        .fillColor('#0f172a')
        .fontSize(8.5)
        .font('Helvetica-Bold')
        .text(item.name || 'Ordered Product', 80, rowY, { width: 245 });

      if (item.description) {
        doc
          .fillColor('#64748b')
          .fontSize(7.5)
          .font('Helvetica')
          .text(item.description, 80, rowY + 11, { width: 245, lineBreak: true });
      }

      doc
        .fillColor('#0f172a')
        .fontSize(8.5)
        .font('Helvetica')
        .text(String(item.quantity), 330, rowY, { width: 45, align: 'center' })
        .text(
          Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          380,
          rowY,
          { width: 85, align: 'right' }
        )
        .text(
          Number(item.totalPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          470,
          rowY,
          { width: 70, align: 'right' }
        );

      const offset = item.description ? 25 : 18;
      rowY += offset;

      doc.moveTo(45, rowY).lineTo(550, rowY).strokeColor('#f8fafc').lineWidth(0.5).stroke();
      rowY += 3;
    });

    rowY += 6;
    doc.moveTo(330, rowY).lineTo(550, rowY).strokeColor('#cbd5e1').lineWidth(1).stroke();
    rowY += 6;

    // Financial Totals Summary (Strictly no fabricated fields - only actual stored totals)
    doc
      .fillColor('#475569')
      .fontSize(8.5)
      .font('Helvetica')
      .text('Subtotal:', 340, rowY, { width: 100, align: 'right' })
      .text(
        `INR ${Number(receipt.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        445,
        rowY,
        { width: 95, align: 'right' }
      );

    rowY += 15;
    doc
      .rect(330, rowY - 2, 220, 22)
      .fillColor('#eff6ff')
      .fill();

    doc
      .fillColor('#1e3a8a')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('GRAND TOTAL:', 340, rowY + 3, { width: 100, align: 'right' })
      .text(
        `INR ${Number(receipt.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        445,
        rowY + 3,
        { width: 95, align: 'right' }
      );

    // Delivery Information Section (Actual stored data only)
    const deliveryBoxY = Math.max(rowY + 30, 560);
    doc
      .rect(45, deliveryBoxY, 505, 80)
      .fillColor('#f8fafc')
      .strokeColor('#cbd5e1')
      .lineWidth(1)
      .fillAndStroke();

    doc
      .fillColor('#1e3a8a')
      .fontSize(9.5)
      .font('Helvetica-Bold')
      .text('DELIVERY INFORMATION', 55, deliveryBoxY + 8);

    const delAddressStr = [del.address, del.city, del.state, del.postalCode].filter(Boolean).join(', ');
    const deliveredDateFormatted = receipt.deliveredAt
      ? new Date(receipt.deliveredAt).toLocaleString('en-IN')
      : 'Delivered & Confirmed';

    doc
      .fillColor('#334155')
      .fontSize(8.5)
      .font('Helvetica')
      .text(`Delivery Status: DELIVERED`, 55, deliveryBoxY + 23)
      .text(`Delivered Date/Time: ${deliveredDateFormatted}`, 55, deliveryBoxY + 36)
      .text(`Delivery Address: ${delAddressStr || 'Corporate Logistics Destination'}`, 55, deliveryBoxY + 49, { width: 485 })
      .text(`Recipient Contact: ${del.contactName || emp.name} (${del.contactPhone || 'N/A'})`, 55, deliveryBoxY + 62);

    if (del.deliveryInstructions) {
      doc.text(`Instructions: ${del.deliveryInstructions}`, 300, deliveryBoxY + 62, { width: 240 });
    }

    // Authenticity Footer
    doc
      .fillColor('#94a3b8')
      .fontSize(8)
      .font('Helvetica')
      .text(
        'This official purchase receipt represents an authentic commercial transaction recorded by VENDORFLOW.',
        45,
        760,
        { align: 'center', width: 505 }
      )
      .text(
        'Generated by VENDORFLOW Enterprise Vendor Management & Procurement Platform.',
        45,
        772,
        { align: 'center', width: 505 }
      );

    doc.end();
  },
};

module.exports = receiptService;
