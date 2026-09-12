export const money = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-PK")}`;

export const qty = (n: number, unit?: string) => `${n.toLocaleString("en-PK")}${unit ? ` ${unit}` : ""}`;

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PK", { day: "numeric", month: "short" });

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
