import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Toaster } from "react-hot-toast";
import { playNotificationSound } from "./utils/sound";

function ToastListener() {
  useEffect(() => {
    // Listen for toast notifications by observing the toast container
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          // Check if a toast was added
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement && node.classList.contains('react-hot-toast')) {
              playNotificationSound();
            }
          });
        }
      });
    });

    // Start observing after a short delay to ensure the toast container exists
    const timer = setTimeout(() => {
      const toastContainer = document.querySelector('[data-react-hot-toast]') || document.body;
      observer.observe(toastContainer, {
        childList: true,
        subtree: true,
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return null;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
    <ToastListener />
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#363636',
          color: '#fff',
        },
        success: {
          duration: 3000,
          iconTheme: {
            primary: '#10b981',
            secondary: '#fff',
          },
        },
        error: {
          duration: 4000,
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
        },
      }}
    />
  </React.StrictMode>,
);
