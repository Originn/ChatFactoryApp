import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Upload, X } from 'lucide-react';
import Image from 'next/image';

interface FaviconConfig {
  enabled: boolean;
  themeColor?: string;
  backgroundColor?: string;
}

interface FaviconUploaderProps {
  value: FaviconConfig;
  onChange: (config: FaviconConfig) => void;
  faviconFile: File | null;
  onFileChange: (file: File | null) => void;
  faviconPreview: string | null;
  faviconError: string | null;
}

export function FaviconUploader({ 
  value, 
  onChange, 
  faviconFile, 
  onFileChange, 
  faviconPreview, 
  faviconError 
}: FaviconUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type and size
      if (!['image/png', 'image/x-icon', 'image/svg+xml'].includes(file.type)) {
        onFileChange(null);
        return;
      }
      if (file.size > 1024 * 1024) {
        onFileChange(null);
        return;
      }
      onFileChange(file);
    }
  };

  const removeFavicon = () => {
    onFileChange(null);
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Favicon Settings
          <Switch
            checked={value.enabled}
            onCheckedChange={(enabled) => onChange({ ...value, enabled })}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {value.enabled && (
          <>
            <div className="space-y-2">
              <Label>Favicon Upload</Label>
              <div className="flex items-center gap-4">
                {faviconPreview ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 border rounded flex items-center justify-center bg-white">
                      <Image
                        src={faviconPreview}
                        alt="Favicon preview"
                        width={16}
                        height={16}
                        className="w-4 h-4"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={removeFavicon}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Favicon
                  </Button>
                )}
              </div>
              {faviconError && (
                <p className="text-sm text-red-600">{faviconError}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Upload PNG, ICO, or SVG (max 1MB). We'll generate all required sizes after creation.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="themeColor">Theme Color</Label>
                <Input
                  id="themeColor"
                  type="color"
                  value={value.themeColor || '#000000'}
                  onChange={(e) => onChange({ ...value, themeColor: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="backgroundColor">Background Color</Label>
                <Input
                  id="backgroundColor"
                  type="color"
                  value={value.backgroundColor || '#ffffff'}
                  onChange={(e) => onChange({ ...value, backgroundColor: e.target.value })}
                />
              </div>
            </div>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.ico,.svg"
          onChange={handleFileChange}
          className="hidden"
        />
      </CardContent>
    </Card>
  );
}