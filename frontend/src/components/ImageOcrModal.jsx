import { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { X, Image, UploadCloud, CheckCircle2, AlertCircle, ShoppingCart } from 'lucide-react';

export default function ImageOcrModal({ isOpen, onClose, products, onAddProduct }) {
  const [file, setFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progressStatus, setProgressStatus] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [matchedProducts, setMatchedProducts] = useState([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError('');
    setExtractedText('');
    setMatchedProducts([]);

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(selected);
  };

  const runOcr = async () => {
    if (!file && !imagePreview) return;
    setProcessing(true);
    setError('');
    setProgressStatus('Initializing OCR engine...');

    try {
      const worker = await createWorker('eng');
      setProgressStatus('Recognizing text in image...');
      
      const ret = await worker.recognize(imagePreview || file);
      const text = ret.data.text || '';
      await worker.terminate();

      setExtractedText(text);

      if (!text.trim()) {
        setError('No text could be recognized in the uploaded image.');
        setProcessing(false);
        return;
      }

      // Match products from recognized text
      const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
      const textTokens = cleanText.split(/\s+/).filter((t) => t.length >= 2);
      const matched = [];

      for (const p of products) {
        const pName = (p.name || '').toLowerCase();
        const pBarcode = (p.barcode || '').toLowerCase().trim();
        const pSku = (p.sku || '').toLowerCase().trim();

        // 1. Exact or partial barcode match
        if (pBarcode && (cleanText.includes(pBarcode) || textTokens.includes(pBarcode))) {
          matched.push({ product: p, matchReason: `Matched Barcode (${p.barcode})` });
          continue;
        }

        // 2. Exact or partial SKU match
        if (pSku && pSku.length >= 2 && (cleanText.includes(pSku) || textTokens.includes(pSku))) {
          matched.push({ product: p, matchReason: `Matched SKU (${p.sku})` });
          continue;
        }

        // 3. Name tokens & fuzzy match
        if (pName && pName.length >= 2) {
          const cleanPName = pName.replace(/[^a-z0-9\s]/g, ' ').trim();
          if (cleanText.includes(cleanPName)) {
            matched.push({ product: p, matchReason: `Exact Name: "${p.name}"` });
            continue;
          }

          // Check token overlap
          const nameWords = cleanPName.split(/\s+/).filter((w) => w.length >= 3);
          if (nameWords.length > 0) {
            const matches = nameWords.filter((w) => textTokens.some((t) => t.includes(w) || w.includes(t)));
            if (matches.length > 0 && matches.length >= Math.min(2, nameWords.length)) {
              matched.push({
                product: p,
                matchReason: `Matched Product Name: ${matches.join(', ')}`,
              });
              continue;
            }
          }
        }

        // 4. Variant names match
        if (Array.isArray(p.variants)) {
          for (const v of p.variants) {
            const vName = (v.variant_name || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
            if (vName && vName.length >= 3 && cleanText.includes(vName)) {
              matched.push({ product: p, matchReason: `Matched Variant: "${v.variant_name}"` });
              break;
            }
          }
        }
      }

      // Deduplicate
      const uniqueMatched = Array.from(new Map(matched.map((m) => [m.product.id, m])).values());
      setMatchedProducts(uniqueMatched);

      if (uniqueMatched.length === 0) {
        setError('Extracted text recognized successfully, but no matching products found in your database.');
      }
    } catch (err) {
      setError('OCR processing failed: ' + (err?.message || err));
    } finally {
      setProcessing(false);
      setProgressStatus('');
    }
  };

  const handleAddAndClose = (product) => {
    onAddProduct(product);
    onClose();
  };

  const handleAddAll = () => {
    matchedProducts.forEach((m) => onAddProduct(m.product));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#121E2C] border border-[#DCE5EF] dark:border-[#22354B] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#DCE5EF] dark:border-[#22354B]">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
            <h3 className="font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9]">
              Image Text OCR & Auto Product Add
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#5A6B82] hover:bg-[#E2EDF8]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* File Picker Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#DCE5EF] dark:border-[#22354B] hover:border-[#0A4174] dark:hover:border-[#4A8CD2] rounded-xl p-4 text-center cursor-pointer transition-colors bg-[#F4F7FB]/50 dark:bg-[#1A2A3D]/30"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {imagePreview ? (
              <div className="space-y-2">
                <img
                  src={imagePreview}
                  alt="Uploaded receipt or product"
                  className="max-h-40 mx-auto rounded-lg object-contain shadow-xs border border-[#DCE5EF]"
                />
                <span className="text-xs text-[#5A6B82] block">Click to change image</span>
              </div>
            ) : (
              <div className="space-y-1.5 py-4">
                <UploadCloud className="w-8 h-8 mx-auto text-[#0A4174] dark:text-[#4A8CD2]" />
                <p className="text-xs font-bold text-[#1C2736] dark:text-[#F1F5F9]">
                  Click to upload a receipt, product tag, or invoice photo
                </p>
                <p className="text-[11px] text-[#5A6B82]">Supports JPG, PNG, WEBP</p>
              </div>
            )}
          </div>

          {/* Action Button */}
          {imagePreview && (
            <button
              type="button"
              onClick={runOcr}
              disabled={processing}
              className="w-full py-2 rounded-xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {processing ? (
                <span>{progressStatus || 'Analyzing Image...'}</span>
              ) : (
                <span>Extract Text & Find Matching Products</span>
              )}
            </button>
          )}

          {/* Extracted Text Display */}
          {extractedText && (
            <div className="rounded-xl bg-[#F4F7FB] dark:bg-[#1A2A3D]/50 border border-[#DCE5EF] dark:border-[#22354B] p-3 space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#5A6B82] tracking-wider block">
                Extracted Text from Image:
              </span>
              <pre className="text-xs text-[#1C2736] dark:text-[#F1F5F9] whitespace-pre-wrap font-sans max-h-24 overflow-y-auto bg-white dark:bg-[#121E2C] p-2 rounded-lg border border-[#DCE5EF]/60">
                {extractedText}
              </pre>
            </div>
          )}

          {error && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-700 dark:text-amber-400 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Matched Products List */}
          {matchedProducts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#1C2736] dark:text-[#F1F5F9] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Matched Products ({matchedProducts.length}):
                </span>
                {matchedProducts.length > 1 && (
                  <button
                    type="button"
                    onClick={handleAddAll}
                    className="text-xs font-bold text-[#0A4174] dark:text-[#4A8CD2] hover:underline flex items-center gap-1"
                  >
                    <ShoppingCart className="w-3 h-3" /> Add All to Cart
                  </button>
                )}
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {matchedProducts.map(({ product, matchReason }) => (
                  <div
                    key={product.id}
                    className="p-2.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">{product.name}</div>
                      <div className="text-[10px] text-emerald-600 font-medium">{matchReason}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddAndClose(product)}
                      className="px-2.5 py-1 rounded-lg bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] text-white text-xs font-bold"
                    >
                      + Add to Cart
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#F4F7FB] dark:bg-[#121E2C] border-t border-[#DCE5EF] dark:border-[#22354B] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] text-xs font-semibold text-[#5A6B82]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

