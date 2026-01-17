// Import the sound file
import clickSoundFile from '../computer-mouse-click.mp3';

// Utility function to play click sound
let clickSound: HTMLAudioElement | null = null;

/**
 * Initialize the click sound
 */
export function initClickSound(): HTMLAudioElement {
    if (!clickSound) {
        clickSound = new Audio(clickSoundFile);
        clickSound.volume = 0.3; // Set volume to 30%
        clickSound.preload = 'auto';
    }
    return clickSound;
}

/**
 * Play the click sound
 */
export function playClickSound(): void {
    try {
        const sound = initClickSound();
        // Reset to start and play
        sound.currentTime = 0;
        sound.play().catch((error) => {
            // Silently fail if audio can't play (e.g., user hasn't interacted with page)
            console.debug('Could not play click sound:', error);
        });
    } catch (error) {
        console.debug('Error playing click sound:', error);
    }
}

/**
 * Custom hook to add click sound to any element
 */
export function useClickSound() {
    return () => {
        playClickSound();
    };
}
