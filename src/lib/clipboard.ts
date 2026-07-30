import { toast } from 'sonner';

/**
 * Copies text to clipboard with fallback for environments where navigator.clipboard is blocked (e.g. iframes)
 */
export async function copyToClipboard(text: string, options?: { successMessage?: string, description?: string }) {
  try {
    // Try the modern API first
    await navigator.clipboard.writeText(text);
    if (options?.successMessage) {
        toast.success(options.successMessage, {
            description: options.description
        });
    }
  } catch {
    // Fallback for iframe/blocked permissions
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      
      // Ensure it's not visible but part of the DOM
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      
      // Radix UI and other libraries might trap focus inside a dialog.
      // We try to append to the active dialog if possible, otherwise body.
      const activeContainer = document.querySelector('[role="dialog"][data-state="open"]') || document.body;
      activeContainer.appendChild(textArea);
      
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      activeContainer.removeChild(textArea);
      
      if (successful) {
        if (options?.successMessage) {
            toast.success(options.successMessage, {
                description: options.description
            });
        }
      } else {
         throw new Error('Fallback copy failed');
      }
    } catch (fallbackErr) {
      console.error('Copy failed:', fallbackErr);
      toast.error('Gagal menyalin teks', {
          description: 'Browser memblokir akses clipboard'
      });
    }
  }
}
