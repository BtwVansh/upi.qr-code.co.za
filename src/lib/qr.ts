import QRCode from "qrcode";

/**
 * Renders the UPI URI to a PNG buffer. Error correction level M keeps the code
 * scannable while allowing moderate print/screen imperfections.
 */
export async function generateQrPng(
  payload: string,
  width = 640,
): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width,
    color: {
      dark: "#0B0B0F",
      light: "#FFFFFF",
    },
  });
}
