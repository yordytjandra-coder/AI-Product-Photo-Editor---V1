import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ImageFile, ResultState, HistoryItem } from './types';
import { generatePhotos, refineImage } from './services/geminiService';
import { UploadIcon, ModelIcon, StyleIcon, DownloadIcon, ZoomIcon, UndoIcon, RedoIcon, CloseIcon, SpinnerIcon } from './components/icons';

// --- Reusable Components (defined outside main App to prevent re-renders) ---

const Header: React.FC = () => (
  <header className="text-center py-8">
    <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
      AI PRODUCT PHOTO EDITOR
    </h1>
    <p className="text-gray-400 mt-2">Transform your product photos into professional-grade assets in seconds.</p>
  </header>
);

const Footer: React.FC = () => (
    <footer className="text-center py-4 mt-8">
        <p className="text-white text-md">
            Powered by Gemini. App created by 
            <a href="https://www.instagram.com/heyyor.ai/" target="_blank" rel="noopener noreferrer" className="underline hover:text-purple-400"> (@heyyor.ai)</a>
        </p>
    </footer>
);

interface ImageUploaderProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  onFileChange: (file: ImageFile | null) => void;
  disabled?: boolean;
  value: ImageFile | null;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ id, label, icon, onFileChange, disabled, value }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileChange({ file, previewUrl: URL.createObjectURL(file) });
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file && ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      onFileChange({ file, previewUrl: URL.createObjectURL(file) });
    }
  };
  
  const handleRemove = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onFileChange(null);
      if(inputRef.current) {
          inputRef.current.value = "";
      }
  }

  return (
    <div className={`transition-opacity ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <p className="text-sm font-medium text-gray-300 mb-2">{label}</p>
      <label
        htmlFor={id}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-[#2a2d42] hover:bg-[#323650] relative"
      >
        {value ? (
            <>
                <img src={value.previewUrl} alt="Preview" className="h-full w-full object-cover rounded-lg" />
                <button onClick={handleRemove} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 leading-none">
                    <CloseIcon />
                </button>
            </>
        ) : (
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {icon}
                <p className="mb-2 text-sm text-gray-400">
                    <span className="font-semibold text-purple-400">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">PNG, JPG, WEBP</p>
            </div>
        )}
        <input ref={inputRef} id={id} type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} disabled={disabled} />
      </label>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [productPhoto, setProductPhoto] = useState<ImageFile | null>(null);
  const [modelPhoto, setModelPhoto] = useState<ImageFile | null>(null);
  const [referencePhoto, setReferencePhoto] = useState<ImageFile | null>(null);
  const [activeTheme, setActiveTheme] = useState<string>('Studio');
  const [customTheme, setCustomTheme] = useState('');
  const [additionalCommands, setAdditionalCommands] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ResultState[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Correctly revoke object URLs on cleanup to ensure image previews are displayed.
  useEffect(() => {
    // When the component unmounts or the photo changes, the previous URL is revoked.
    return () => {
      if (productPhoto?.previewUrl) {
        URL.revokeObjectURL(productPhoto.previewUrl);
      }
    };
  }, [productPhoto]);

  useEffect(() => {
    return () => {
      if (modelPhoto?.previewUrl) {
        URL.revokeObjectURL(modelPhoto.previewUrl);
      }
    };
  }, [modelPhoto]);

  useEffect(() => {
    return () => {
      if (referencePhoto?.previewUrl) {
        URL.revokeObjectURL(referencePhoto.previewUrl);
      }
    };
  }, [referencePhoto]);


  const handleModelPhotoChange = (file: ImageFile | null) => {
    setModelPhoto(file);
    if (file) setReferencePhoto(null);
  };

  const handleReferencePhotoChange = (file: ImageFile | null) => {
    setReferencePhoto(file);
    if (file) setModelPhoto(null);
  };
  
  const handleThemeClick = (theme: string) => {
      setActiveTheme(theme);
      setCustomTheme('');
  };

  const handleGenerateClick = useCallback(async () => {
    if (!productPhoto) {
      setError('Product photo is required.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const generatedImages = await generatePhotos(
        productPhoto.file,
        modelPhoto?.file ?? null,
        referencePhoto?.file ?? null,
        activeTheme,
        customTheme,
        additionalCommands
      );

      const newResults: ResultState[] = generatedImages.map((url, index) => ({
        id: `result-${Date.now()}-${index}`,
        imageHistory: [url],
        currentIndex: 0,
        refinementPrompt: '',
      }));
      
      setResults(newResults);

      if (newResults.length > 0) {
        setHistory(prev => [{ id: `history-${Date.now()}`, results: newResults }, ...prev]);
      }
      
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [productPhoto, modelPhoto, referencePhoto, activeTheme, customTheme, additionalCommands]);

  const handleRefinement = async (resultId: string, command: string) => {
      const resultIndex = results.findIndex(r => r.id === resultId);
      if (resultIndex === -1 || !command.trim()) return;

      const currentResult = results[resultIndex];
      const currentImageUrl = currentResult.imageHistory[currentResult.currentIndex];

      setIsLoading(true);
      try {
          const newImageUrl = await refineImage(currentImageUrl, command);
          setResults(prevResults => prevResults.map((res, index) => {
              if (index !== resultIndex) return res;

              const newHistory = res.imageHistory.slice(0, res.currentIndex + 1);
              newHistory.push(newImageUrl);
              
              return {
                  ...res,
                  imageHistory: newHistory,
                  currentIndex: newHistory.length - 1,
                  refinementPrompt: ''
              };
          }));
      } catch(e) {
          console.error(e);
          setError("Failed to refine the image.");
      } finally {
          setIsLoading(false);
      }
  };
  
  const handleUndo = (resultId: string) => {
      setResults(prev => prev.map(res => res.id === resultId ? { ...res, currentIndex: Math.max(0, res.currentIndex - 1) } : res));
  };

  const handleRedo = (resultId: string) => {
      setResults(prev => prev.map(res => res.id === resultId ? { ...res, currentIndex: Math.min(res.imageHistory.length - 1, res.currentIndex + 1) } : res));
  };
  
  const handleRefinementPromptChange = (resultId: string, prompt: string) => {
      setResults(prev => prev.map(res => res.id === resultId ? { ...res, refinementPrompt: prompt } : res));
  };

  const downloadImage = (imageUrl: string, index: number) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `generated-photo-${index + 1}.jpeg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const THEMES = ['None', 'Studio', 'Luxury', 'Urban', 'Tropical', 'Beach', 'Minimalist', 'Vintage', 'Nature'];

  return (
    <div className="min-h-screen text-white p-4 lg:p-8">
      <Header />
      <main className="grid grid-cols-1 lg:grid-cols-[380px_1fr_320px] gap-8 mt-8">
        
        {/* Left Column: Controls */}
        <div className="bg-[#212437] p-6 rounded-xl space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-4">1. Upload Photos</h2>
            <div className="space-y-4">
              <ImageUploader id="product-photo" label="Product Photo (Required)" icon={<UploadIcon />} onFileChange={setProductPhoto} value={productPhoto}/>
              <ImageUploader id="model-photo" label="Model Photo (Optional)" icon={<ModelIcon />} onFileChange={handleModelPhotoChange} disabled={!!referencePhoto} value={modelPhoto}/>
              <ImageUploader id="style-photo" label="Reference Style (Optional)" icon={<StyleIcon />} onFileChange={handleReferencePhotoChange} disabled={!!modelPhoto} value={referencePhoto}/>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold mb-4">2. Customize</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-300 mb-2">Theme</p>
                <div className="flex flex-wrap gap-2">
                  {THEMES.map(theme => (
                    <button 
                      key={theme} 
                      onClick={() => handleThemeClick(theme)}
                      disabled={customTheme.length > 0}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        activeTheme === theme && customTheme.length === 0 ? 'bg-purple-600 text-white' : 'bg-[#2a2d42] hover:bg-[#323650]'
                      } ${customTheme.length > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {theme}
                    </button>
                  ))}
                </div>
              </div>
              <input 
                type="text" 
                placeholder="Or type a custom theme..." 
                value={customTheme} 
                onChange={e => { setCustomTheme(e.target.value); setActiveTheme('None'); }} 
                className="w-full bg-[#2a2d42] border border-gray-600 rounded-md p-2 placeholder-gray-500 focus:ring-purple-500 focus:border-purple-500 text-sm"
              />
              <div>
                <p className="text-sm font-medium text-gray-300 mb-2">Additional Commands</p>
                <textarea placeholder="e.g., 'Make the model smile', 'Use natural daylight'" value={additionalCommands} onChange={e => setAdditionalCommands(e.target.value)} rows={3} className="w-full bg-[#2a2d42] border border-gray-600 rounded-md p-2 placeholder-gray-500 focus:ring-purple-500 focus:border-purple-500 text-sm resize-none"></textarea>
              </div>
            </div>
          </div>
          <button onClick={handleGenerateClick} disabled={!productPhoto || isLoading} className="w-full flex items-center justify-center bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300">
             {isLoading ? <SpinnerIcon /> : 'Generate Photos'}
          </button>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>

        {/* Middle Column: Results */}
        <div className="bg-[#212437] p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">Results</h2>
          <div className="bg-[#1a1c2c] rounded-lg min-h-[60vh] flex items-center justify-center p-4">
            {isLoading && !results.length ? (
              <div className="text-center text-gray-400">
                <SpinnerIcon />
                <p>Generating images...</p>
              </div>
            ) : results.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((res, idx) => (
                  <div key={res.id} className="bg-[#2a2d42] p-3 rounded-lg flex flex-col gap-3">
                    <div className="relative group aspect-square">
                      <img src={res.imageHistory[res.currentIndex]} alt={`Generated result ${idx + 1}`} className="w-full h-full object-cover rounded-md"/>
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setZoomedImage(res.imageHistory[res.currentIndex])} className="p-2 bg-gray-700 rounded-full hover:bg-purple-600"><ZoomIcon /></button>
                        <button onClick={() => downloadImage(res.imageHistory[res.currentIndex], idx)} className="p-2 bg-gray-700 rounded-full hover:bg-purple-600"><DownloadIcon /></button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex-1 flex gap-2 min-w-[150px]">
                            <input 
                                type="text" 
                                placeholder="Refine..." 
                                value={res.refinementPrompt} 
                                onChange={e => handleRefinementPromptChange(res.id, e.target.value)} 
                                className="flex-grow min-w-0 bg-[#1a1c2c] border border-gray-600 rounded-md p-2 text-sm placeholder-gray-500 focus:ring-purple-500 focus:border-purple-500" />
                            <button 
                                onClick={() => handleRefinement(res.id, res.refinementPrompt)} 
                                disabled={!res.refinementPrompt.trim() || isLoading} 
                                className="flex-shrink-0 px-3 bg-purple-600 text-white font-semibold rounded-md text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                Refine
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleUndo(res.id)} disabled={res.currentIndex === 0 || isLoading} className="p-2 bg-[#1a1c2c] rounded-md disabled:opacity-50"><UndoIcon /></button>
                            <button onClick={() => handleRedo(res.id)} disabled={res.currentIndex === res.imageHistory.length - 1 || isLoading} className="p-2 bg-[#1a1c2c] rounded-md disabled:opacity-50"><RedoIcon /></button>
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Your generated images will appear here.</p>
            )}
          </div>
        </div>

        {/* Right Column: History */}
        <div className="bg-[#212437] p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">History</h2>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {history.length > 0 ? history.map(item => (
              <div key={item.id} className="bg-[#2a2d42] p-2 rounded-lg cursor-pointer hover:ring-2 hover:ring-purple-500" onClick={() => setResults(item.results)}>
                <div className="grid grid-cols-2 gap-1">
                  {item.results.slice(0, 4).map(res => (
                    <div key={res.id} className="aspect-square">
                      <img src={res.imageHistory[res.currentIndex]} alt="History thumbnail" className="w-full h-full object-cover rounded-sm" />
                    </div>
                  ))}
                </div>
              </div>
            )) : (
              <p className="text-gray-500 text-sm">Your past generations will be saved here.</p>
            )}
          </div>
        </div>
      </main>
      <Footer />

      {/* Zoom Modal */}
      {zoomedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} alt="Zoomed preview" className="max-w-[90vw] max-h-[90vh] object-contain" />
          <button onClick={() => setZoomedImage(null)} className="absolute top-4 right-4 text-white hover:text-purple-400">
            <CloseIcon />
          </button>
        </div>
      )}
    </div>
  );
}
