import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { QRCodeDisplay } from './QRCodeDisplay';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock qrcode.react
vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, size }: { value: string; size: number }) => (
    <svg data-testid="qr-code" data-value={value} data-size={size} />
  ),
}));

// Mock createPortal to render children directly for testing
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (children: React.ReactNode) => children,
  };
});

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.assign(navigator, { clipboard: mockClipboard });

// Mock window.location
const mockWindowLocation = {
  port: '8788',
  hostname: 'localhost',
  protocol: 'http:',
};

Object.defineProperty(window, 'location', {
  value: mockWindowLocation,
  writable: true,
});

describe('QRCodeDisplay', () => {
  const mockLocalIpResponse = {
    data: {
      success: true,
      data: {
        ip: '192.168.1.100',
        port: 8787,
        url: 'http://192.168.1.100:8787',
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.get.mockResolvedValue(mockLocalIpResponse);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Button Rendering', () => {
    it('should render QR code button when collapsed', () => {
      render(<QRCodeDisplay isCollapsed={true} />);

      const button = screen.getByRole('button', { name: /open qr code for mobile access/i });
      expect(button).toBeInTheDocument();
      // Should not show text when collapsed
      expect(screen.queryByText('Mobile Access')).not.toBeInTheDocument();
    });

    it('should render QR code button with text when expanded', () => {
      render(<QRCodeDisplay isCollapsed={false} />);

      const button = screen.getByRole('button', { name: /open qr code for mobile access/i });
      expect(button).toBeInTheDocument();
      expect(screen.getByText('Mobile Access')).toBeInTheDocument();
    });

    it('should have correct title attribute', () => {
      render(<QRCodeDisplay isCollapsed={false} />);

      const button = screen.getByRole('button', { name: /open qr code for mobile access/i });
      expect(button).toHaveAttribute('title', 'Scan QR code for mobile access');
    });
  });

  describe('Modal Behavior', () => {
    it('should open modal when button is clicked', async () => {
      render(<QRCodeDisplay isCollapsed={false} />);

      const button = screen.getByRole('button', { name: /open qr code for mobile access/i });
      fireEvent.click(button);

      await waitFor(() => {
        // Check for modal-specific text (not the button text)
        expect(screen.getByText('Scan with your phone')).toBeInTheDocument();
        // Modal header has h3 element
        expect(screen.getByRole('heading', { name: 'Mobile Access' })).toBeInTheDocument();
      });
    });

    it('should close modal when X button is clicked', async () => {
      render(<QRCodeDisplay isCollapsed={false} />);

      // Open modal
      const openButton = screen.getByRole('button', { name: /open qr code for mobile access/i });
      fireEvent.click(openButton);

      await waitFor(() => {
        expect(screen.getByText('Scan with your phone')).toBeInTheDocument();
      });

      // Close modal
      const closeButton = screen.getByRole('button', { name: /close modal/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Scan with your phone')).not.toBeInTheDocument();
      });
    });

    it('should close modal when clicking backdrop', async () => {
      render(<QRCodeDisplay isCollapsed={false} />);

      // Open modal
      const openButton = screen.getByRole('button', { name: /open qr code for mobile access/i });
      fireEvent.click(openButton);

      await waitFor(() => {
        expect(screen.getByText('Scan with your phone')).toBeInTheDocument();
      });

      // Click backdrop
      const backdrop = screen.getByText('Scan with your phone').closest('.fixed');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      await waitFor(() => {
        expect(screen.queryByText('Scan with your phone')).not.toBeInTheDocument();
      });
    });

    it('should close modal on Escape key', async () => {
      render(<QRCodeDisplay isCollapsed={false} />);

      // Open modal
      const openButton = screen.getByRole('button', { name: /open qr code for mobile access/i });
      fireEvent.click(openButton);

      await waitFor(() => {
        expect(screen.getByText('Scan with your phone')).toBeInTheDocument();
      });

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText('Scan with your phone')).not.toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('should fetch local IP when modal opens', async () => {
      render(<QRCodeDisplay isCollapsed={false} />);

      const button = screen.getByRole('button', { name: /open qr code for mobile access/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith('/api/system/local-ip');
      });
    });

    it('should display QR code after successful fetch', async () => {
      render(<QRCodeDisplay isCollapsed={false} />);

      const button = screen.getByRole('button', { name: /open qr code for mobile access/i });
      fireEvent.click(button);

      await waitFor(() => {
        const qrCode = screen.getByTestId('qr-code');
        expect(qrCode).toBeInTheDocument();
        // Uses window.location.port (8788) instead of backend port
        expect(qrCode).toHaveAttribute('data-value', 'http://192.168.1.100:8788');
      });
    });

    it('should display URL after successful fetch', async () => {
      render(<QRCodeDisplay isCollapsed={false} />);

      const button = screen.getByRole('button', { name: /open qr code for mobile access/i });
      fireEvent.click(button);

      await waitFor(() => {
        // Uses window.location.port (8788) instead of backend port
        expect(screen.getByText('http://192.168.1.100:8788')).toBeInTheDocument();
      });
    });

    it('should display error message on fetch failure', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      render(<QRCodeDisplay isCollapsed={false} />);

      const button = screen.getByRole('button', { name: /open qr code for mobile access/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Failed to connect to server')).toBeInTheDocument();
      });
    });

    it('should display retry button on error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      render(<QRCodeDisplay isCollapsed={false} />);

      const button = screen.getByRole('button', { name: /open qr code for mobile access/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should retry fetch when retry button is clicked', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
      mockedAxios.get.mockResolvedValueOnce(mockLocalIpResponse);

      render(<QRCodeDisplay isCollapsed={false} />);

      const button = screen.getByRole('button', { name: /open qr code for mobile access/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getByTestId('qr-code')).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching', async () => {
      let resolvePromise: (value: typeof mockLocalIpResponse) => void;
      const pendingPromise = new Promise<typeof mockLocalIpResponse>((resolve) => {
        resolvePromise = resolve;
      });
      mockedAxios.get.mockReturnValueOnce(pendingPromise);

      render(<QRCodeDisplay isCollapsed={false} />);

      const button = screen.getByRole('button', { name: /open qr code for mobile access/i });
      fireEvent.click(button);

      expect(screen.getByText('Getting network address...')).toBeInTheDocument();

      resolvePromise!(mockLocalIpResponse);

      await waitFor(() => {
        expect(screen.queryByText('Getting network address...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Copy Functionality', () => {
    it('should copy URL to clipboard when copy button is clicked', async () => {
      render(<QRCodeDisplay isCollapsed={false} />);

      const button = screen.getByRole('button', { name: /open qr code for mobile access/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('qr-code')).toBeInTheDocument();
      });

      const copyButton = screen.getByRole('button', { name: /copy url/i });
      fireEvent.click(copyButton);

      // Uses window.location.port (8788) instead of backend port
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://192.168.1.100:8788');
    });

    it('should show success state after copying', async () => {
      render(<QRCodeDisplay isCollapsed={false} />);

      const button = screen.getByRole('button', { name: /open qr code for mobile access/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('qr-code')).toBeInTheDocument();
      });

      const copyButton = screen.getByRole('button', { name: /copy url/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /url copied/i })).toBeInTheDocument();
      });
    });
  });

  describe('WiFi Indicator', () => {
    it('should display WiFi network requirement message', async () => {
      render(<QRCodeDisplay isCollapsed={false} />);

      const button = screen.getByRole('button', { name: /open qr code for mobile access/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Same WiFi network required')).toBeInTheDocument();
      });
    });

    it('should display footer message about WiFi', async () => {
      render(<QRCodeDisplay isCollapsed={false} />);

      const button = screen.getByRole('button', { name: /open qr code for mobile access/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/make sure your phone is connected to the same wifi/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button labels', () => {
      render(<QRCodeDisplay isCollapsed={false} />);

      expect(screen.getByRole('button', { name: /open qr code for mobile access/i })).toBeInTheDocument();
    });

    it('should have accessible close button in modal', async () => {
      render(<QRCodeDisplay isCollapsed={false} />);

      const button = screen.getByRole('button', { name: /open qr code for mobile access/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close modal/i })).toBeInTheDocument();
      });
    });

    it('should have accessible copy button label', async () => {
      render(<QRCodeDisplay isCollapsed={false} />);

      const button = screen.getByRole('button', { name: /open qr code for mobile access/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /copy url/i })).toBeInTheDocument();
      });
    });
  });
});
