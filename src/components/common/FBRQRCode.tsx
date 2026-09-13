import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export interface FBRQRCodeProps {
  value?: string;
  qrString?: string;
  size?: number;
  className?: string;
  level?: 'L' | 'M' | 'Q' | 'H';
  altText?: string;
}

/**
 * High-resolution vector/SVG QR Code component optimized for screen display
 * and crisp, thermal roll printing (80mm / 58mm POS receipt printers).
 * Generated 100% offline via local qrcode engine without external API dependencies.
 */
export const FBRQRCode: React.FC<FBRQRCodeProps> = ({
  value,
  qrString,
  size = 130,
  className = '',
  level = 'M',
  altText = 'FBR Tax Asaan Verification QR Code'
}) => {
  const textToEncode = qrString || value || '';
  const [svgContent, setSvgContent] = useState<string>('');
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!textToEncode) return;

    let isMounted = true;

    // Generate SVG string for crisp vector printing on thermal paper
    (QRCode as any)
      .toString(textToEncode, {
        type: 'svg',
        errorCorrectionLevel: level,
        margin: 1,
        width: size,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
      .then((svg: string) => {
        if (isMounted) setSvgContent(svg);
      })
      .catch((err: any) => console.error('Error generating SVG QR Code:', err));

    // Fallback Data URL for img tags
    (QRCode as any)
      .toDataURL(textToEncode, {
        errorCorrectionLevel: level,
        margin: 1,
        width: size * 2, // 2x density for high-DPI thermal heads (203 dpi / 300 dpi)
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
      .then((url: string) => {
        if (isMounted) setDataUrl(url);
      })
      .catch((err: any) => console.error('Error generating DataURL QR Code:', err));

    return () => {
      isMounted = false;
    };
  }, [textToEncode, size, level]);

  if (!textToEncode) return null;

  return (
    <div
      className={`inline-flex items-center justify-center bg-white p-1 rounded ${className}`}
      style={{ width: size, height: size }}
    >
      {svgContent ? (
        <div
          dangerouslySetInnerHTML={{ __html: svgContent }}
          className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
        />
      ) : dataUrl ? (
        <img
          src={dataUrl}
          alt={altText}
          width={size}
          height={size}
          className="object-contain"
        />
      ) : (
        <div className="w-full h-full border border-dashed border-slate-300 flex items-center justify-center text-[9px] text-slate-400 font-mono text-center">
          Generating FBR QR...
        </div>
      )}
    </div>
  );
};
