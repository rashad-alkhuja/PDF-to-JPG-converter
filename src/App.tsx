import { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { saveAs } from 'file-saver';
import { UploadCloud, FileType, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function App() {
  const [appState, setAppState] = useState<'upload' | 'config' | 'processing' | 'done'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [pageSelectionMode, setPageSelectionMode] = useState<'all' | 'custom'>('all');
  const [customPagesStr, setCustomPagesStr] = useState('');
  const [quality, setQuality] = useState<number>(1.0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPDF = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdfFile(file);
      setTotalPages(pdf.numPages);
      setPageSelectionMode('all');
      setCustomPagesStr('');
      setAppState('config');
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load PDF. Ensure it's a valid, uncorrupted file.");
    }
  };

  const parsePages = (str: string, total: number) => {
    if (!str.trim()) return Array.from({length: total}, (_, i) => i + 1);
    const pages = new Set<number>();
    const parts = str.split(',');
    for (const part of parts) {
      const range = part.trim().split('-');
      if (range.length === 1) {
        const p = parseInt(range[0], 10);
        if (!isNaN(p) && p >= 1 && p <= total) pages.add(p);
      } else if (range.length === 2) {
        let start = parseInt(range[0], 10);
        let end = parseInt(range[1], 10);
        if (!isNaN(start) && !isNaN(end)) {
          start = Math.max(1, start);
          end = Math.min(total, end);
          if (start <= end) {
            for (let i = start; i <= end; i++) pages.add(i);
          }
        }
      }
    }
    return Array.from(pages).sort((a,b) => a-b);
  };

  const startConversion = async () => {
    if (!pdfFile) return;
    
    let selectedPages: number[] = [];
    if (pageSelectionMode === 'all') {
      selectedPages = Array.from({length: totalPages}, (_, i) => i + 1);
    } else {
      selectedPages = parsePages(customPagesStr, totalPages);
      if (selectedPages.length === 0) {
        setError("Invalid page selection. Please check your input.");
        return;
      }
    }

    setAppState('processing');
    setError(null);
    setProgress({ current: 0, total: selectedPages.length }); 
    
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let count = 0;
      for (const i of selectedPages) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 3.5 });
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        const renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
        });
        
        if (blob) {
           const pageNum = i.toString().padStart(totalPages.toString().length, '0');
           saveAs(blob, `${pdfFile.name.replace(/\.[^/.]+$/, "")}_page_${pageNum}.jpg`);
        }
        
        count++;
        setProgress({ current: count, total: selectedPages.length });
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      setAppState('done');
    } catch (err) {
      console.error(err);
      setError("Failed to process the PDF. Ensure it's a valid, uncorrupted PDF file.");
      setAppState('config');
    }
  };

  const resetApp = () => {
    setAppState('upload');
    setPdfFile(null);
    setTotalPages(0);
    setProgress({ current: 0, total: 0 });
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (appState !== 'upload') return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf" || droppedFile.name.toLowerCase().endsWith('.pdf')) {
        loadPDF(droppedFile);
      } else {
        setError("Please drop a valid .pdf file.");
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith('.pdf')) {
        loadPDF(file);
      } else {
        setError("Please select a valid .pdf file.");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F4F4F5] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 font-sans overflow-x-hidden relative">
      <div className="grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-10 gap-4 w-full max-w-[1024px] lg:h-[768px]">
        
        {/* Header/Logo Card - Col 1-3, Row 1-2 */}
        <div className="bg-white border border-[#E4E4E7] rounded-3xl p-5 md:p-6 flex flex-row items-center gap-3 shadow-sm lg:col-span-3 lg:row-span-2">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-zinc-900 tracking-tight leading-none mb-1">PixelPress</span>
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold leading-none">PDF to JPG v2.0</span>
          </div>
        </div>

        {/* Main Dropzone Container - Col 4-9, Row 1-8 */}
        <motion.div 
          layout
          className={cn(
            "bg-zinc-50/50 border-2 border-dashed border-zinc-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-sm transition-colors duration-200 overflow-hidden lg:col-span-6 lg:row-span-8 min-h-[350px] relative",
            isDragging && appState === 'upload' ? "border-orange-500 bg-orange-50/50 scale-[1.01]" : "hover:bg-zinc-50",
            appState !== 'upload' && "border-solid border-zinc-200 bg-white shadow-md scale-100 p-6 md:p-10"
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={handleDrop}
        >
          <AnimatePresence mode="wait">
            {appState === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-2 w-full"
              >
                <div className="w-20 h-20 bg-white shadow-sm rounded-full flex items-center justify-center mb-4">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-zinc-800">Drop PDF to Convert</h2>
                <p className="text-zinc-500 text-sm max-w-[240px] leading-relaxed mt-1">
                  Pages will be extracted as individual high-quality JPGs.
                </p>
                
                <input 
                  type="file" 
                  accept=".pdf,application/pdf" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-8 px-8 py-3 bg-zinc-900 text-white rounded-full font-medium text-sm hover:bg-black transition-all shadow-lg active:scale-95"
                >
                  Select Document
                </button>
              </motion.div>
            )}

            {appState === 'config' && (
              <motion.div
                key="config"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-start w-full text-left max-w-sm mx-auto"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                    <FileType className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-zinc-900 truncate" title={pdfFile?.name}>
                      {pdfFile?.name}
                    </h3>
                    <p className="text-xs text-zinc-500">{totalPages} Pages</p>
                  </div>
                </div>

                <div className="w-full space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Pages to Convert</h4>
                  
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input 
                        type="radio" 
                        name="pageSelection" 
                        value="all" 
                        checked={pageSelectionMode === 'all'}
                        onChange={() => setPageSelectionMode('all')}
                        className="peer sr-only"
                      />
                      <div className="w-4 h-4 rounded-full border-2 border-zinc-300 peer-checked:border-orange-500 peer-checked:bg-orange-500 transition-colors"></div>
                      <div className="absolute w-1.5 h-1.5 bg-white rounded-full opacity-0 peer-checked:opacity-100 transition-opacity"></div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-zinc-800">All Pages</span>
                      <span className="text-xs text-zinc-500">Extracts 1 - {totalPages}</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input 
                        type="radio" 
                        name="pageSelection" 
                        value="custom" 
                        checked={pageSelectionMode === 'custom'}
                        onChange={() => setPageSelectionMode('custom')}
                        className="peer sr-only"
                      />
                      <div className="w-4 h-4 rounded-full border-2 border-zinc-300 peer-checked:border-orange-500 peer-checked:bg-orange-500 transition-colors"></div>
                      <div className="absolute w-1.5 h-1.5 bg-white rounded-full opacity-0 peer-checked:opacity-100 transition-opacity"></div>
                    </div>
                    <div className="flex flex-col w-full">
                      <span className="text-sm font-semibold text-zinc-800 mb-2">Custom Range</span>
                      <input 
                        type="text" 
                        placeholder="e.g. 1-5, 8, 11-13" 
                        disabled={pageSelectionMode !== 'custom'}
                        value={customPagesStr}
                        onChange={(e) => setCustomPagesStr(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500/50 disabled:opacity-50 transition-all font-mono"
                      />
                    </div>
                  </label>

                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 pt-4">Image Quality</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'High', value: 1.0, sub: '100%' },
                      { label: 'Medium', value: 0.7, sub: '70%' },
                      { label: 'Low', value: 0.35, sub: '35%' }
                    ].map(q => (
                      <button
                        key={q.value}
                        onClick={() => setQuality(q.value)}
                        className={cn(
                          "py-3 px-3 rounded-xl border flex flex-col items-center justify-center transition-all",
                          quality === q.value 
                            ? "bg-orange-50 border-orange-500 text-orange-700 shadow-sm" 
                            : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                        )}
                      >
                        <span className="text-sm font-bold">{q.label}</span>
                        <span className="text-[10px] font-semibold opacity-70">{q.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full mt-8">
                  <button 
                    onClick={resetApp}
                    className="flex-1 py-3 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 rounded-full font-medium text-sm transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={startConversion}
                    className="flex-1 py-3 bg-orange-500 text-white hover:bg-orange-600 rounded-full font-medium text-sm transition-all shadow-lg shadow-orange-500/30"
                  >
                    Convert
                  </button>
                </div>
              </motion.div>
            )}

            {appState === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center w-full py-8"
              >
                <div className="w-20 h-20 bg-white border border-zinc-100 shadow-sm rounded-full flex items-center justify-center relative mb-6">
                  <Loader2 className="w-10 h-10 text-orange-500 animate-spin absolute" />
                  <FileType className="w-5 h-5 text-orange-500 absolute" />
                </div>
                
                <div className="text-center w-full max-w-sm space-y-4">
                  <h3 className="text-lg font-semibold text-zinc-800">
                    Converting to JPG...
                  </h3>
                  
                  <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden shadow-inner">
                    <motion.div 
                      className="bg-orange-500 h-full rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ 
                        width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` 
                      }}
                      transition={{ ease: "easeInOut", duration: 0.2 }}
                    />
                  </div>
                  
                  <p className="text-sm font-medium text-zinc-500 flex justify-between">
                    <span>
                      File {progress.current} of {progress.total}
                    </span>
                    <span className="text-zinc-900 font-semibold">
                      {Math.round(progress.total > 0 ? (progress.current / progress.total) * 100 : 0)}%
                    </span>
                  </p>
                </div>
              </motion.div>
            )}

            {appState === 'done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center text-center py-6"
              >
                <div className="w-20 h-20 bg-green-50 shadow-sm rounded-full flex items-center justify-center text-green-500 mb-6">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-zinc-800 mb-2">Conversion Complete!</h3>
                <p className="text-zinc-500 text-sm mb-8 max-w-[240px] leading-relaxed">
                  Your PDF pages were successfully converted. Downloads should have completed.
                </p>
                <button
                  onClick={resetApp}
                  className="px-6 py-3 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-900 rounded-full font-medium text-sm transition-all shadow-sm active:scale-95 flex items-center gap-2"
                >
                  <UploadCloud className="w-4 h-4" />
                  Convert Another
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Dynamic settings container - Col 10-12, Row 1-5 */}
        <div className="bg-white border border-[#E4E4E7] rounded-3xl p-6 flex-col justify-start shadow-sm lg:col-span-3 lg:row-span-5 hidden lg:flex">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-6">Optimization Settings</h3>
          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-semibold text-zinc-600">JPG QUALITY</label>
              <select 
                value={quality}
                onChange={(e) => setQuality(parseFloat(e.target.value))}
                className="bg-zinc-50 border border-zinc-200 text-sm p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/50 font-medium text-zinc-700 cursor-pointer"
              >
                <option value={1.0}>High (100%)</option>
                <option value={0.7}>Medium (70%)</option>
                <option value={0.35}>Low (35%)</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-semibold text-zinc-600">RESOLUTION (DPI)</label>
              <select className="bg-zinc-50 border border-zinc-100 text-sm p-3 rounded-xl outline-none ring-0 appearance-none pointer-events-none font-medium text-zinc-700" readOnly>
                <option>300 DPI (Print)</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100">
              <span className="text-xs text-zinc-600 font-medium">Preserve ICC Profiles</span>
              <div className="w-8 h-4 bg-orange-500 rounded-full relative shadow-inner">
                <div className="absolute right-1 top-[2px] w-3 h-3 bg-white rounded-full shadow-sm"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Card - Col 1-3, Row 3-6 */}
        <div className="bg-orange-500 rounded-3xl p-6 flex-col justify-center text-white shadow-md lg:col-span-3 lg:row-span-4 hidden lg:flex relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
            </svg>
          </div>
          <span className="text-[10px] uppercase font-bold opacity-80 mb-2">Efficiency Stats</span>
          <div className="text-4xl font-bold mb-1 tracking-tight">HQ<span className="text-xl opacity-60 ml-0.5">+</span></div>
          <p className="text-xs opacity-90 leading-relaxed max-w-[140px]">Maximum quality local processing speed</p>
          <div className="mt-5 h-1.5 bg-white/20 rounded-full w-full overflow-hidden shadow-inner">
            <div className="h-full bg-white w-full"></div>
          </div>
        </div>

        {/* Engine Status - Col 1-3, Row 7-10 */}
        <div className="bg-white border border-[#E4E4E7] rounded-3xl overflow-hidden shadow-sm lg:col-span-3 lg:row-span-4 hidden lg:flex flex-col justify-start p-6">
           <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">Formats Included</h3>
           <div className="space-y-3 mt-1">
             <div className="flex items-center gap-3 p-2 bg-zinc-50 rounded-lg border border-zinc-100">
               <div className="w-8 h-8 flex items-center justify-center text-[10px] font-bold text-zinc-400">IN</div>
               <div className="flex flex-col overflow-hidden">
                 <span className="text-xs font-medium text-zinc-800">Portable Document</span>
                 <span className="text-[10px] text-zinc-400 uppercase font-semibold">.PDF</span>
               </div>
             </div>
             
             <div className="flex items-center gap-3 p-2 bg-zinc-50 rounded-lg border border-zinc-100">
               <div className="w-8 h-8 flex items-center justify-center text-[10px] font-bold text-orange-500">OUT</div>
               <div className="flex flex-col overflow-hidden">
                 <span className="text-xs font-medium text-zinc-800">JPEG Images</span>
                 <span className="text-[10px] text-zinc-400 uppercase font-semibold">Multiple .JPGs</span>
               </div>
             </div>
           </div>
           
           <div className="mt-auto pt-4 flex items-center justify-center gap-2 border-t border-zinc-100">
             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
             <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Engine: Ultra-High-Res</span>
           </div>
        </div>

        {/* Aesthetic Recent Conversions / Instructions - Col 10-12, Row 6-10 */}
        <div className="bg-white border border-[#E4E4E7] rounded-3xl p-6 flex-col justify-start shadow-sm lg:col-span-3 lg:row-span-5 hidden lg:flex">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">Secure & Private</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-7 h-7 bg-zinc-100 rounded flex items-center justify-center mt-0.5 text-zinc-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-zinc-800">100% Local</span>
                <span className="text-xs text-zinc-500 mt-1 leading-relaxed">Processing happens directly in your browser.</span>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-7 h-7 bg-zinc-100 rounded flex items-center justify-center mt-0.5 text-zinc-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-zinc-800">No Uploads</span>
                <span className="text-xs text-zinc-500 mt-1 leading-relaxed">Your files never leave your device. Complete privacy.</span>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-7 h-7 bg-zinc-100 rounded flex items-center justify-center mt-0.5 text-zinc-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-zinc-800">No Watermarks</span>
                <span className="text-xs text-zinc-500 mt-1 leading-relaxed">Exported images are clean and watermark-free.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Aesthetic ZIP Export Config - Col 4-9, Row 9-10 */}
        <div className="bg-zinc-900 border-none rounded-3xl p-6 lg:p-8 flex-col lg:flex-row items-start lg:items-center justify-between gap-4 text-white shadow-xl lg:col-span-6 lg:row-span-2 hidden sm:flex border border-zinc-800">
          <div className="flex flex-col">
            <span className="text-[10px] opacity-60 uppercase font-bold tracking-widest mb-1.5">Delivery System</span>
            <span className="text-lg font-semibold tracking-tight">Extract individual image files</span>
          </div>
          <button className="px-5 py-2.5 border border-white/20 hover:bg-white hover:text-zinc-900 rounded-full text-[11px] font-bold tracking-wider transition-all duration-300 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full shadow-[0_0_6px_rgba(74,222,128,0.5)]"></div>
            INDIVIDUAL FILES
          </button>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white text-red-600 p-4 rounded-2xl flex items-center gap-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-red-100 border-b-4 border-b-red-500 z-50 min-w-[300px]"
          >
            <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold pr-4">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
