import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, X, Smartphone, Wifi, Copy, Check } from 'lucide-react';
import clsx from 'clsx';
import axios from 'axios';

interface LocalIpResponse {
  success: boolean;
  data: {
    ip: string;
    port: number;
    url: string;
    timestamp: string;
  };
}

interface QRCodeDisplayProps {
  isCollapsed: boolean;
}

/**
 * QRCodeDisplay component shows a QR code for mobile access.
 * When the sidebar is collapsed, shows a small QR icon button.
 * When expanded, shows a more detailed button with text.
 * Clicking opens a modal with the QR code and URL information.
 *
 * @param isCollapsed - Whether the sidebar is in collapsed state
 * @returns React component for QR code display
 */
export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ isCollapsed }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /**
   * Fetches the local IP address from the backend API.
   * Uses the current window port (frontend port) instead of backend port.
   */
  const fetchLocalIp = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get<LocalIpResponse>('/api/system/local-ip');
      if (response.data.success && response.data.data.ip) {
        // Use the current window port (frontend) instead of backend port
        const currentPort = window.location.port || '80';
        const ip = response.data.data.ip;
        const url = `http://${ip}:${currentPort}`;
        setLocalUrl(url);
      } else {
        setError('Failed to get local IP address');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Opens the modal and fetches the local IP if not already loaded.
   */
  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
    if (!localUrl) {
      fetchLocalIp();
    }
  }, [localUrl, fetchLocalIp]);

  /**
   * Closes the modal.
   */
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setCopied(false);
  }, []);

  /**
   * Copies the URL to clipboard.
   */
  const handleCopyUrl = useCallback(async () => {
    if (localUrl) {
      try {
        await navigator.clipboard.writeText(localUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = localUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }, [localUrl]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isModalOpen, handleCloseModal]);

  return (
    <>
      {/* QR Code Button */}
      <button
        onClick={handleOpenModal}
        className={clsx(
          'flex items-center w-full p-2 text-text-secondary-dark hover:bg-background-dark/60 hover:text-text-primary-dark rounded-lg transition-colors',
          isCollapsed ? 'justify-center' : ''
        )}
        title="Scan QR code for mobile access"
        aria-label="Open QR code for mobile access"
      >
        <QrCode className="h-5 w-5 flex-shrink-0" />
        {!isCollapsed && (
          <span className="ml-3 text-sm">Mobile Access</span>
        )}
      </button>

      {/* Modal - rendered via portal to ensure proper centering */}
      {isModalOpen && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={handleCloseModal}
        >
          <div
            className="bg-surface-dark border border-border-dark rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-dark">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Smartphone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary-dark">
                    Mobile Access
                  </h3>
                  <p className="text-sm text-text-secondary-dark">
                    Scan with your phone
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1 text-text-secondary-dark hover:text-text-primary-dark hover:bg-background-dark rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="mt-3 text-sm text-text-secondary-dark">
                    Getting network address...
                  </p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="p-3 bg-red-500/10 rounded-full mb-3">
                    <X className="h-6 w-6 text-red-500" />
                  </div>
                  <p className="text-sm text-red-400">{error}</p>
                  <button
                    onClick={fetchLocalIp}
                    className="mt-4 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm"
                  >
                    Retry
                  </button>
                </div>
              ) : localUrl ? (
                <div className="flex flex-col items-center">
                  {/* QR Code */}
                  <div className="bg-white p-4 rounded-xl">
                    <QRCodeSVG
                      value={localUrl}
                      size={200}
                      level="M"
                      includeMargin={false}
                    />
                  </div>

                  {/* WiFi Indicator */}
                  <div className="flex items-center gap-2 mt-4 text-sm text-text-secondary-dark">
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span>Same WiFi network required</span>
                  </div>

                  {/* URL with Copy Button */}
                  <div className="mt-4 w-full">
                    <div className="flex items-center gap-2 bg-background-dark rounded-lg p-3">
                      <code className="flex-1 text-sm text-primary truncate">
                        {localUrl}
                      </code>
                      <button
                        onClick={handleCopyUrl}
                        className={clsx(
                          'p-2 rounded-md transition-colors',
                          copied
                            ? 'bg-green-500/10 text-green-500'
                            : 'hover:bg-surface-dark text-text-secondary-dark hover:text-text-primary-dark'
                        )}
                        title={copied ? 'Copied!' : 'Copy URL'}
                        aria-label={copied ? 'URL copied' : 'Copy URL to clipboard'}
                      >
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 bg-background-dark border-t border-border-dark">
              <p className="text-xs text-text-secondary-dark text-center">
                Make sure your phone is connected to the same WiFi network as this computer
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default QRCodeDisplay;
