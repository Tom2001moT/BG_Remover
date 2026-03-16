import React, { useState, useRef, useCallback } from 'react';
import { Upload, Image as ImageIcon, Download, Loader2, Sparkles, AlertCircle, X, Wand2, Tag, AlignLeft, MessageSquare } from 'lucide-react';

import imglyRemoveBackground from '@imgly/background-removal';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ""; // Modified to pick up env var

export default function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [resultBase64, setResultBase64] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Gemini API States
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmResult, setLlmResult] = useState(null);
  const [llmError, setLlmError] = useState(null);

  const fileInputRef = useRef(null);

  // Checkerboard pattern to show transparency clearly
  const checkerboardStyle = {
    backgroundImage: `linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
                      linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
                      linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
                      linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)`,
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
    backgroundColor: '#f8fafc'
  };

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    // Reset states for new file
    setFile(selectedFile);
    setResultUrl(null);
    setResultBase64(null);
    setLlmResult(null);
    setLlmError(null);
    setError(null);
    setProgressText('');

    // Create preview
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result);
    reader.readAsDataURL(selectedFile);
  };

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  }, []);

  const removeBackground = async () => {
    if (!file) {
      setError('Please upload an image first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgressText('Initializing local AI...');

    try {
      const engine = imglyRemoveBackground;

      if (typeof engine !== 'function') {
        throw new Error("Background removal engine failed to initialize correctly.");
      }

      const imageBlob = await engine(file, {
        // Use local models instead of external CDNs to avoid CORS and 500 errors
        publicPath: `${window.location.origin}/models/`,
        fetchArgs: {
          mode: 'cors'
        },
        progress: (key, current, total) => {
          if (total) {
            const percent = Math.round((current / total) * 100);
            setProgressText(`Loading AI Model (${percent}%)...`);
          } else {
            setProgressText('Extracting subject...');
          }
        }
      });

      const url = URL.createObjectURL(imageBlob);
      setResultUrl(url);

      // Convert to Base64 for the Gemini Vision API
      const reader = new FileReader();
      reader.readAsDataURL(imageBlob);
      reader.onloadend = () => {
        setResultBase64(reader.result);
      };

    } catch (err) {
      console.error("Background Removal Error:", err);
      setError('Failed to process image. Ensure your device has enough memory and you have an active internet connection for the initial AI model download (~40MB).');
    } finally {
      setIsLoading(false);
      setProgressText('');
    }
  };

  const generateMagicListing = async () => {
    if (!resultBase64) return;
    if (!apiKey) {
      setLlmError("API Key is missing. Please configure VITE_GEMINI_API_KEY in .env");
      return;
    }

    setLlmLoading(true);
    setLlmError(null);

    // Extract just the base64 data portion (remove the data:image/png;base64, prefix)
    const base64Data = resultBase64.split(',')[1];

    let retries = 5;
    let delay = 1000;
    let success = false;

    while (retries > 0 && !success) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: "You are an expert product marketer and social media manager. Analyze this image of an isolated object with a transparent background. I want you to generate a compelling product listing for it. Provide a catchy product name, an enticing marketing description, and a fun social media caption with relevant hashtags." },
                { inlineData: { mimeType: "image/png", data: base64Data } }
              ]
            }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  productName: { type: "STRING" },
                  marketingDescription: { type: "STRING" },
                  socialMediaCaption: { type: "STRING" }
                }
              }
            }
          })
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        const generatedText = data.candidates[0].content.parts[0].text;
        setLlmResult(JSON.parse(generatedText));
        success = true;

      } catch (err) {
        console.error("Gemini API Error:", err);
        retries--;
        if (retries === 0) {
          setLlmError("Failed to generate magical content. Please try again.");
        } else {
          await new Promise(res => setTimeout(res, delay));
          delay *= 2; // Exponential backoff
        }
      }
    }

    setLlmLoading(false);
  };

  const clearAll = () => {
    setFile(null);
    setPreviewUrl(null);
    setResultUrl(null);
    setResultBase64(null);
    setLlmResult(null);
    setError(null);
    setLlmError(null);
    setProgressText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadResult = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `transparent-bg-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-slate-100 p-4 md:p-8 font-sans selection:bg-purple-500/30 flex flex-col overflow-y-auto">

      <div className="max-w-6xl mx-auto space-y-8 w-full flex-1 flex flex-col">

        {/* Header */}
        <header className="text-center space-y-4 pt-8 pb-4">
          <div className="inline-flex items-center justify-center p-2 bg-white/10 rounded-2xl ring-1 ring-white/20 mb-2 backdrop-blur-md shadow-2xl overflow-hidden">
            <img src="/logo.png" alt="ClearCut Logo" className="w-16 h-16 object-cover rounded-xl" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 drop-shadow-sm">
            Local AI Background Eraser
          </h1>
          <p className="text-slate-300 max-w-2xl mx-auto text-lg">
            100% Private. Runs entirely in your browser. No data ever leaves your device.
          </p>
        </header>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 pb-12">

          {/* Left Column: Controls & Upload */}
          <div className="lg:col-span-4 space-y-6">

            {/* Upload Area */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col h-full min-h-[400px]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-purple-400" />
                  <h2 className="text-lg font-semibold text-white">Upload Image</h2>
                </div>
                {file && (
                  <button onClick={clearAll} className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg">
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>

              {!previewUrl ? (
                <div
                  className={`flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 text-center transition-all cursor-pointer ${isDragging ? 'border-purple-400 bg-purple-500/10' : 'border-white/20 hover:border-white/40 hover:bg-white/5'}`}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleFileSelect(e.target.files[0])}
                    className="hidden"
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                  />
                  <div className="p-4 bg-black/20 rounded-full mb-4">
                    <ImageIcon className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="font-medium text-slate-200 mb-1">Click to upload or drag & drop</p>
                  <p className="text-sm text-slate-400 mt-2">Supports PNG, JPG, WEBP</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="relative flex-1 rounded-2xl overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center p-2 mb-4">
                    <img
                      src={previewUrl}
                      alt="Original"
                      className="max-w-full max-h-[250px] object-contain rounded-xl"
                    />
                  </div>
                  <button
                    onClick={removeBackground}
                    disabled={isLoading}
                    className="w-full mt-auto py-4 px-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> {progressText || 'Processing...'}</>
                    ) : (
                      <><Sparkles className="w-5 h-5" /> Remove Background</>
                    )}
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Preview, Result & LLM Content */}
          <div className="lg:col-span-8 flex flex-col space-y-6">

            {/* Canvas Panel */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col min-h-[500px]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-pink-400" />
                  Result Canvas
                </h2>
                {resultUrl && (
                  <button
                    onClick={downloadResult}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-900 hover:bg-slate-100 font-bold rounded-xl transition-colors shadow-sm"
                  >
                    <Download className="w-5 h-5" /> Download HD
                  </button>
                )}
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-200">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <div
                className="flex-1 rounded-2xl overflow-hidden border border-white/10 relative flex items-center justify-center min-h-[400px]"
                style={checkerboardStyle}
              >
                {!previewUrl && !resultUrl && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                    <ImageIcon className="w-16 h-16 mb-4 opacity-30" />
                    <p className="text-xl font-medium mb-2">Workspace Empty</p>
                    <p className="text-sm max-w-sm opacity-70">
                      Upload an image on the left to begin. The AI model (~40MB) will download to your browser automatically on the first run.
                    </p>
                  </div>
                )}

                {resultUrl ? (
                  <img
                    src={resultUrl}
                    alt="Processed Result"
                    className="max-w-full max-h-[450px] object-contain drop-shadow-2xl animate-in fade-in zoom-in duration-500"
                  />
                ) : previewUrl ? (
                  <div className="absolute inset-0 flex items-center justify-center p-4">
                    <img
                      src={previewUrl}
                      alt="Original Preview"
                      className="max-w-full max-h-[450px] object-contain opacity-30 blur-sm saturate-50 transition-all duration-700"
                    />
                    {isLoading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-md rounded-2xl">
                        <Loader2 className="w-12 h-12 text-purple-400 animate-spin mb-4" />
                        <p className="text-xl font-bold text-white mb-2">{progressText || 'Processing...'}</p>
                        <p className="text-sm text-slate-300 text-center px-6 max-w-sm bg-black/40 p-3 rounded-lg border border-white/10">
                          Running 100% locally in your browser.<br />
                          <span className="text-xs opacity-70">(Initial download takes a moment depending on your internet speed)</span>
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Gemini API Section - Only visible after background is removed */}
            {resultBase64 && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-orange-400 flex items-center gap-2">
                      <Wand2 className="w-6 h-6 text-orange-400" />
                      Magic AI Listing Generator
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">Let Gemini Vision analyze your cutout and generate product marketing content.</p>
                  </div>

                  {!llmResult && (
                    <button
                      onClick={generateMagicListing}
                      disabled={llmLoading}
                      className="whitespace-nowrap py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {llmLoading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing Image...</>
                      ) : (
                        <>✨ Generate Listing</>
                      )}
                    </button>
                  )}
                </div>

                {llmError && (
                  <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-200">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm">{llmError}</p>
                  </div>
                )}

                {llmResult && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-500">
                    <div className="bg-black/20 border border-white/5 rounded-2xl p-5 space-y-3">
                      <h3 className="text-amber-300 font-semibold flex items-center gap-2 mb-2">
                        <Tag className="w-4 h-4" /> Product Name
                      </h3>
                      <p className="text-white font-medium text-lg">{llmResult.productName}</p>
                    </div>

                    <div className="bg-black/20 border border-white/5 rounded-2xl p-5 space-y-3 md:col-span-2">
                      <h3 className="text-orange-300 font-semibold flex items-center gap-2 mb-2">
                        <AlignLeft className="w-4 h-4" /> Marketing Description
                      </h3>
                      <p className="text-slate-300 leading-relaxed">{llmResult.marketingDescription}</p>
                    </div>

                    <div className="bg-black/20 border border-white/5 rounded-2xl p-5 space-y-3 md:col-span-2">
                      <h3 className="text-pink-300 font-semibold flex items-center gap-2 mb-2">
                        <MessageSquare className="w-4 h-4" /> Social Media Caption
                      </h3>
                      <p className="text-slate-300 whitespace-pre-wrap">{llmResult.socialMediaCaption}</p>
                    </div>

                    <div className="md:col-span-2 mt-2">
                      <button
                        onClick={generateMagicListing}
                        disabled={llmLoading}
                        className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {llmLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        {llmLoading ? 'Regenerating...' : '✨ Regenerate Ideas'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}
