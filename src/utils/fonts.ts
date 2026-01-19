/**
 * Font utility functions for loading and applying fonts
 */

export interface FontInfo {
    name: string;
    file: string;
    displayName: string;
}

/**
 * Get list of available fonts from the fonts folder
 * This will be populated with actual font files in the public/fonts directory
 */
export function getAvailableFonts(): FontInfo[] {
    // Default system fonts
    const defaultFonts: FontInfo[] = [
        { name: "system", file: "", displayName: "سیستم پیش‌فرض" },
        { name: "Arial", file: "", displayName: "Arial" },
        { name: "Times New Roman", file: "", displayName: "Times New Roman" },
        { name: "Courier New", file: "", displayName: "Courier New" },
    ];

    // You can add custom fonts here by placing font files in public/fonts
    // Example:
    // { name: "CustomFont", file: "/fonts/CustomFont.ttf", displayName: "Custom Font" },
    
    return defaultFonts;
}

/**
 * Load a font from the fonts folder
 * @param fontName Name of the font file (without extension)
 * @returns Font face name or null if not found
 */
export async function loadFont(fontName: string): Promise<string | null> {
    if (!fontName || fontName === "system") {
        return null;
    }

    // Check if font is already loaded
    if (document.fonts.check(`1em "${fontName}"`)) {
        return fontName;
    }

    // Try to load font from fonts folder
    const fontExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
    
    for (const ext of fontExtensions) {
        try {
            const fontUrl = `/fonts/${fontName}${ext}`;
            const fontFace = new FontFace(fontName, `url(${fontUrl})`);
            
            try {
                await fontFace.load();
                document.fonts.add(fontFace);
                return fontName;
            } catch (error) {
                // Font file not found, try next extension
                continue;
            }
        } catch (error) {
            continue;
        }
    }

    // If custom font not found, return the font name anyway (might be a system font)
    return fontName;
}

/**
 * Apply font to the entire application
 * @param fontName Name of the font to apply
 */
export async function applyFont(fontName: string | null | undefined): Promise<void> {
    if (!fontName || fontName === "system") {
        // Remove custom font, use system default
        document.documentElement.style.fontFamily = '';
        return;
    }

    // Try to load the font
    const loadedFont = await loadFont(fontName);
    
    if (loadedFont) {
        // Apply font to root element
        document.documentElement.style.fontFamily = `"${loadedFont}", sans-serif`;
    } else {
        // Fallback to font name (might be a system font)
        document.documentElement.style.fontFamily = `"${fontName}", sans-serif`;
    }
}
