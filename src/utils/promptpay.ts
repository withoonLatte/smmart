import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

/**
 * Generate PromptPay QR Code instantaneously (0.01s) on the client side
 * with an image fallback URL.
 */
export async function generatePromptPayQR(
  mobileOrTaxId: string,
  amount?: number
): Promise<{ qrDataUrl: string; payload: string; fallbackUrl: string }> {
  const cleanId = (mobileOrTaxId || "0812345678").replace(/[^0-9]/g, "");
  const payload = generatePayload(cleanId, { amount: amount ? Number(amount) : undefined });

  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 256,
      color: {
        dark: "#0F172A",
        light: "#FFFFFF",
      },
    });
  } catch (err) {
    console.error("Local QR generation fallback", err);
  }

  // Backup fallback URL
  const fallbackUrl = `https://promptpay.io/${cleanId}/${amount || 0}.png`;

  return {
    qrDataUrl: qrDataUrl || fallbackUrl,
    payload,
    fallbackUrl,
  };
}
