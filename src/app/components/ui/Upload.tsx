import React, { useState } from 'react';
import { Upload as UploadIcon, X, Image as ImageIcon } from 'lucide-react';

interface UploadProps {
  label?: string;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  onChange?: (files: File[]) => void;
  preview?: boolean;
}

export function Upload({
  label,
  accept = 'image/*',
  multiple = false,
  maxFiles = 5,
  onChange,
  preview = true,
}: UploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const incomingFiles = Array.from(e.target.files);
      
      let updatedFiles: File[] = [];
      
      if (multiple) {
        // Append new files, respecting maxFiles
        updatedFiles = [...files, ...incomingFiles].slice(0, maxFiles);
      } else {
        // Replace if single mode
        updatedFiles = incomingFiles.slice(0, 1);
      }
      
      setFiles(updatedFiles);
      onChange?.(updatedFiles);
      
      if (preview) {
        const newPreviews = updatedFiles.map(file => URL.createObjectURL(file));
        setPreviews(newPreviews);
      }
    }
  };
  
  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setFiles(newFiles);
    setPreviews(newPreviews);
    onChange?.(newFiles);
  };
  
  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      
      {/* Upload Area */}
      <div className="rounded-lg border-2 border-dashed border-border bg-card p-6 transition-colors hover:border-[#0E7490]">
        <label className="cursor-pointer block">
          <input
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-50 dark:bg-cyan-950/40">
              <UploadIcon className="w-6 h-6 text-[#0E7490]" />
            </div>
            <p className="mb-1 text-sm font-medium text-text-primary">
              Klik untuk upload atau drag & drop
            </p>
            <p className="text-xs text-text-muted">
              PNG, JPG, JPEG hingga 10MB
            </p>
          </div>
        </label>
      </div>
      
      {/* Preview */}
      {preview && previews.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {previews.map((src, index) => (
            <div key={index} className="relative group">
              <img
                src={src}
                alt={`Preview ${index + 1}`}
                className="h-24 w-full rounded-lg border border-border object-cover"
              />
              <button
                onClick={() => removeFile(index)}
                className="absolute top-1 right-1 w-6 h-6 bg-[#EF4444] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-1 left-1 right-1 bg-black/50 text-white text-xs px-2 py-1 rounded truncate">
                {files[index].name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
