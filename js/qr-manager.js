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
let publicMenuUrl = "";

/**
 * Initialize the QR Manager
 * @param {string} uid - Authenticated user UID
 * @param {string} businessName - Restaurant business name
 */
export function initQRManager(uid, businessName) {
    if (!uid) return;

    currentUid = uid;
    currentBizName = businessName || "Restaurant";
    publicMenuUrl = `https://blacksurvivalgear.github.io/menuqr/menu.html?id=${uid}`;

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
function handleGenerateQR() {
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
 * Handle PNG Download
 */
function handleDownloadPNG() {
    try {
        const canvas = qrPreviewContainer.querySelector("canvas");
        if (!canvas) {
            showError("Please generate a QR code first.");
            return;
        }

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
        link.href = canvas.toDataURL("image/png");
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
