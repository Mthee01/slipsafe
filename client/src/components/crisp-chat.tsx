import { useEffect } from 'react';

declare global {
  interface Window {
    $crisp: unknown[];
    CRISP_WEBSITE_ID: string;
  }
}

interface CrispChatProps {
  websiteId?: string;
}

export function CrispChat({ websiteId }: CrispChatProps) {
  useEffect(() => {
    // Use placeholder ID if not provided - will be configured later
    const crispId = websiteId || import.meta.env.VITE_CRISP_WEBSITE_ID || 'PLACEHOLDER_CRISP_ID';
    
    // Don't load if it's the placeholder
    if (crispId === 'PLACEHOLDER_CRISP_ID') {
      console.log('[Crisp] Chat widget disabled - configure VITE_CRISP_WEBSITE_ID to enable');
      return;
    }

    // Initialize Crisp
    window.$crisp = [];
    window.CRISP_WEBSITE_ID = crispId;

    // Load Crisp script
    const script = document.createElement('script');
    script.src = 'https://client.crisp.chat/l.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup on unmount
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [websiteId]);

  return null;
}
