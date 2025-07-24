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
  iconUrl?: string;
  appleTouchIcon?: string;
  manifestIcon192?: string;
  manifestIcon512?: string;
  themeColor?: string;
  backgroundColor?: string;
}

interface FaviconUploaderProps {
  value: FaviconConfig;
  onChange: (config: FaviconConfig) => void;
  chatbotId: string;
}

export function FaviconUploader({ value, onChange, chatbotId }: FaviconUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chatbotId', chatbotId);
      formData.append('type', 'favicon');

      // Upload to API endpoint
      const response = await fetch('/api/upload/favicon', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const { urls } = await response.json();
      
      // Update favicon config with generated URLs
      onChange({
        ...value,
        enabled: true,
        iconUrl: urls.icon32,
        appleTouchIcon: urls.appleTouchIcon,
        manifestIcon192: urls.icon192,
        manifestIcon512: urls.icon512,
      });
    } catch (error) {
      console.error('Favicon upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type and size
      if (!['image/png', 'image/x-icon', 'image/svg+xml'].includes(file.type)) {
        alert('Please upload a PNG, ICO, or SVG file');
        return;
      }
      if (file.size > 1024 * 1024) {
        alert('File size must be less than 1MB');
        return;
      }
      handleFileUpload(file);
    }
  };

  const removeFavicon = () => {
    onChange({
      enabled: false,
      iconUrl: undefined,
      appleTouchIcon: undefined,
      manifestIcon192: undefined,
      manifestIcon512: undefined,
      themeColor: value.themeColor,
      backgroundColor: value.backgroundColor,
    });
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
                {value.iconUrl ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 border rounded flex items-center justify-center bg-white">
                      <Image
                        src={value.iconUrl}
                        alt="Favicon"
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
                    disabled={uploading}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Upload Favicon'}
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Upload PNG, ICO, or SVG (max 1MB). We'll generate all required sizes.
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