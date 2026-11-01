export const DISCLAIMER_TITLE = "Important Notice";

export const DISCLAIMER_PARAGRAPHS = [
  "This website is an independent personal project designed to generate UPI payment QR codes and shareable payment links.",
  "We do not store your UPI ID or other submitted information in a website database.",
  "Your UPI ID will be included in the generated shareable URL so that your QR code can be reconstructed from the link for as long as this website remains available.",
  "We do not process, authorize or execute payments. All payments are handled by the selected third-party UPI application.",
  "Please verify that your UPI ID is correct before generating and sharing your QR code.",
  "We are not responsible for incorrect UPI IDs, payments sent to unintended recipients, failed transactions, or issues arising from third-party payment applications.",
] as const;

export const DISCLAIMER_LOG_NOTE =
  "Hosting providers and browsers may retain technical access logs, such as IP addresses, timestamps and requested URLs, as part of normal operation.";
