// Debug/Development Component: Domain input for chatbot creation
import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, CheckCircle, AlertTriangle } from "lucide-react";

interface DomainInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  planSupportsCustomDomain?: boolean;
}

const DomainInput: React.FC<DomainInputProps> = ({
  value,
  onChange,
  error,
  planSupportsCustomDomain = false
}) => {
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  const validateDomain = (domain: string) => {
    if (!domain) {
      setValidationStatus('idle');
      return;
    }

    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    const isValid = domainRegex.test(domain) && domain.length <= 253;
    setValidationStatus(isValid ? 'valid' : 'invalid');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toLowerCase().trim();
    onChange(newValue);
    validateDomain(newValue);
  };

  if (!planSupportsCustomDomain) {
    return (
      <div className="space-y-2">
        <Label htmlFor="domain">Custom Domain</Label>
        <div className="relative">
          <Input
            id="domain"
            type="text" 
            value={value}
            onChange={handleChange}
            placeholder="chat.yourcompany.com"
            disabled
          />
        </div>
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            Custom domains are available on Pro and Enterprise plans. 
            <a href="/pricing" className="text-blue-600 hover:underline ml-1">
              Upgrade your plan
            </a>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="domain">
        Custom Domain <span className="text-sm text-gray-500">(Optional)</span>
      </Label>
      <div className="relative">
        <Input
          id="domain"
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="chat.yourcompany.com"
          className={`pr-8 ${
            validationStatus === 'valid' ? 'border-green-500' : 
            validationStatus === 'invalid' ? 'border-red-500' : ''
          }`}
        />
        {validationStatus === 'valid' && (
          <CheckCircle className="absolute right-2 top-2.5 h-4 w-4 text-green-500" />
        )}
        {validationStatus === 'invalid' && (
          <AlertTriangle className="absolute right-2 top-2.5 h-4 w-4 text-red-500" />
        )}
      </div>
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      
      {validationStatus === 'invalid' && (
        <p className="text-sm text-red-600">
          Please enter a valid domain (e.g., chat.yourcompany.com)
        </p>
      )}
      
      <div className="text-sm text-gray-600">
        <p>• Enter your domain without https:// (e.g., chat.yourcompany.com)</p>
        <p>• You'll need to configure DNS after deployment</p>
        <p>• Leave empty to use the default Vercel domain</p>
      </div>
    </div>
  );
};

export default DomainInput;