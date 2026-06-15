import qrcode from "./qrcode.js";

/**
 * QR Code Manager Module
 * Handles generation, preview, download, and link copying.
 */

// DOM Elements
const generateBtn = document.getElementById("generate-qr-btn");
const downloadBtn = document.getElementById("download-qr-btn");
const copyLinkBtn = document.getElementById("copy-link-btn");
const qrPreviewContainer = document.getElementById("qr-preview-container");
const qrDetails = document.getElementById("qr-details");
const qrBizNameEl = document.getElementById("qr-biz-name");
const qrPublicUrlEl = document.getElementById("qr-public-url");
const qrDownloadActions = document.getElementById("qr-download-actions");
const qrMessage = document.getElementById("qr-message");
const qrError = document.getElementById("qr-error");

let currentUid = null;
let currentBizName = "restaurant";
let currentLogoUrl = null;
let publicMenuUrl = "";

/**
 * Initialize the QR Manager
 * @param {string} uid - Authenticated user UID
 * @param {string} businessName - Restaurant business name
 * @param {string} logoUrl - Restaurant logo URL
 */
export function initQRManager(uid, businessName, logoUrl) {
    if (!uid) return;

    currentUid = uid;
    currentBizName = businessName || "Restaurant";
    currentLogoUrl = logoUrl || null;
    publicMenuUrl = `https://www.scanmenu.africa/menu.html?id=${uid}`;

    if (generateBtn) {
        generateBtn.addEventListener("click", handleGenerateQR);
    }

    if (downloadBtn) {
        downloadBtn.addEventListener("click", handleDownloadPNG);
    }

    if (copyLinkBtn) {
        copyLinkBtn.addEventListener("click", handleCopyLink);
    }
}

/**
 * Handle QR Code Generation
 */
async function handleGenerateQR() {
    try {
        hideFeedback();

        // Generate QR code data
        const qr = qrcode(0, 'H'); // Type 0 (auto), Error Correction Level H (High)
        qr.addData(publicMenuUrl);
        qr.make();

        // Create Canvas for better control and download
        const cellSize = 8;
        const margin = 20;
        const qrSize = qr.getModuleCount();

        const canvas = document.createElement('canvas');
        canvas.width = 300; // Force 300x300 as per requirements
        canvas.height = 300;
        const ctx = canvas.getContext('2d');

        // Fill background
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw QR code scaled to fit 300x300 with margin
        const scale = (300 - margin * 2) / (qrSize * cellSize);

        ctx.save();
        ctx.translate(margin, margin);
        ctx.scale(scale * cellSize, scale * cellSize);

        for (let row = 0; row < qrSize; row++) {
            for (let col = 0; col < qrSize; col++) {
                if (qr.isDark(row, col)) {
                    ctx.fillStyle = "black";
                    ctx.fillRect(col, row, 1, 1);
                }
            }
        }
        ctx.restore();

        // Embed Logo if exists
        if (currentLogoUrl) {
            await embedLogoInCanvas(canvas, currentLogoUrl);
        }

        // Update UI
        qrPreviewContainer.innerHTML = "";
        qrPreviewContainer.appendChild(canvas);

        qrBizNameEl.textContent = currentBizName;
        qrPublicUrlEl.textContent = publicMenuUrl;

        qrDetails.classList.remove("hidden");
        qrDownloadActions.classList.remove("hidden");

    } catch (error) {
        console.error("QR Generation Error:", error);
        showError("Unable to generate QR code. Please try again.");
    }
}

/**
 * Embed logo in the center of the QR canvas
 * @param {HTMLCanvasElement} canvas
 * @param {string} logoUrl
 */
function embedLogoInCanvas(canvas, logoUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const ctx = canvas.getContext('2d');
            const qrWidth = canvas.width;
            const qrHeight = canvas.height;

            // Logo size: max 20% of QR width
            const logoSize = qrWidth * 0.2;
            const x = (qrWidth - logoSize) / 2;
            const y = (qrHeight - logoSize) / 2;

            // White circular background
            ctx.save();
            ctx.beginPath();
            ctx.arc(qrWidth / 2, qrHeight / 2, (logoSize / 2) + 2, 0, Math.PI * 2);
            ctx.fillStyle = "white";
            ctx.fill();

            // Circular clip for logo
            ctx.beginPath();
            ctx.arc(qrWidth / 2, qrHeight / 2, logoSize / 2, 0, Math.PI * 2);
            ctx.clip();

            ctx.drawImage(img, x, y, logoSize, logoSize);
            ctx.restore();
            resolve();
        };
        img.onerror = () => {
            console.warn("Could not load logo for QR embedding");
            resolve(); // Still resolve to show QR without logo
        };
        img.src = logoUrl;
    });
}

/**
 * Handle PNG Download
 * Generates a professionally designed QR card.
 */
async function handleDownloadPNG() {
    try {
        const qrCanvas = qrPreviewContainer.querySelector("canvas");
        if (!qrCanvas) {
            showError("Please generate a QR code first.");
            return;
        }

        // Create a higher resolution canvas for the card
        const cardWidth = 800;
        const cardHeight = 1200;
        const canvas = document.createElement("canvas");
        canvas.width = cardWidth;
        canvas.height = cardHeight;
        const ctx = canvas.getContext("2d");

        // Fill background
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, cardWidth, cardHeight);

        let currentY = 100;

        // 1. Restaurant Logo
        if (currentLogoUrl) {
            await new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    const logoSize = 180;
                    const x = (cardWidth - logoSize) / 2;
                    ctx.drawImage(img, x, currentY, logoSize, logoSize);
                    currentY += logoSize + 40;
                    resolve();
                };
                img.onerror = () => {
                    console.warn("Could not load logo for QR card");
                    resolve();
                };
                img.src = currentLogoUrl;
            });
        } else {
            // Placeholder if no logo
            ctx.fillStyle = "#008751";
            ctx.beginPath();
            ctx.arc(cardWidth / 2, currentY + 90, 90, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "white";
            ctx.font = "bold 80px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(currentBizName.charAt(0).toUpperCase(), cardWidth / 2, currentY + 90);
            currentY += 180 + 40;
        }

        // 2. Restaurant Name
        ctx.fillStyle = "#111827";
        ctx.font = "bold 56px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(currentBizName, cardWidth / 2, currentY);
        currentY += 100;

        // 3. QR Code
        const qrDisplaySize = 500;
        const qrX = (cardWidth - qrDisplaySize) / 2;
        ctx.drawImage(qrCanvas, qrX, currentY, qrDisplaySize, qrDisplaySize);
        currentY += qrDisplaySize + 60;

        // 4. Instruction text
        ctx.fillStyle = "#6B7280";
        ctx.font = "500 36px Inter, sans-serif";
        ctx.fillText("Scan to view our menu", cardWidth / 2, currentY);
        currentY += 120;

        // 5. Powered by attribution
        ctx.fillStyle = "#9CA3AF";
        ctx.font = "400 24px Inter, sans-serif";
        ctx.fillText("Powered by ScanMenu.Africa", cardWidth / 2, cardHeight - 60);

        // Sanitize business name for filename
        const sanitizedName = currentBizName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        const filename = `scanmenuqr-${sanitizedName || 'menu'}.png`;

        // Create download link
        const link = document.createElement("a");
        link.download = filename;
        link.href = canvas.toDataURL("image/png", 1.0);
        link.click();
    } catch (error) {
        console.error("Download Error:", error);
        showError("Download failure. Please try again.");
    }
}

/**
 * Handle Copy Link to Clipboard
 */
async function handleCopyLink() {
    try {
        if (!publicMenuUrl) return;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(publicMenuUrl);
            showMessage("Menu link copied successfully.");
        } else {
            throw new Error("Clipboard unavailable");
        }
    } catch (error) {
        console.error("Clipboard Error:", error);
        showError("Clipboard unavailable or permission denied.");
    }
}

/**
 * Show error message
 */
function showError(msg) {
    if (qrError) {
        qrError.textContent = msg;
        qrError.classList.remove("hidden");
        setTimeout(() => qrError.classList.add("hidden"), 5000);
    }
}

/**
 * Show success message
 */
function showMessage(msg) {
    if (qrMessage) {
        qrMessage.textContent = msg;
        qrMessage.classList.remove("hidden");
        setTimeout(() => qrMessage.classList.add("hidden"), 3000);
    }
}

/**
 * Hide all feedback boxes
 */
function hideFeedback() {
    if (qrError) qrError.classList.add("hidden");
    if (qrMessage) qrMessage.classList.add("hidden");
}
