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
    const fonts: FontInfo[] = [
        { name: "system", file: "", displayName: "سیستم پیش‌فرض" },
        { name: "Arial", file: "", displayName: "Arial" },
        { name: "Times New Roman", file: "", displayName: "Times New Roman" },
        { name: "Courier New", file: "", displayName: "Courier New" },
    ];

    // IRANSans fonts (loaded via CSS)
    fonts.push(
        { name: "IRANSans", file: "/fonts/index.css", displayName: "IRANSans (پیش‌فرض)" },
        { name: "IRANSans", file: "/fonts/200.css", displayName: "IRANSans (UltraLight - 200)" },
        { name: "IRANSans", file: "/fonts/300.css", displayName: "IRANSans (Light - 300)" },
        { name: "IRANSans", file: "/fonts/400.css", displayName: "IRANSans (Normal - 400)" },
        { name: "IRANSans", file: "/fonts/500.css", displayName: "IRANSans (Medium - 500)" },
        { name: "IRANSans", file: "/fonts/700.css", displayName: "IRANSans (Bold - 700)" },
        { name: "IRANSans", file: "/fonts/900.css", displayName: "IRANSans (Black - 900)" }
    );

    // IRANSans with Persian Numerals
    fonts.push(
        { name: "IRANSans", file: "/fonts/200-pn.css", displayName: "IRANSans (UltraLight - 200) با اعداد فارسی" },
        { name: "IRANSans", file: "/fonts/300-pn.css", displayName: "IRANSans (Light - 300) با اعداد فارسی" },
        { name: "IRANSans", file: "/fonts/400-pn.css", displayName: "IRANSans (Normal - 400) با اعداد فارسی" },
        { name: "IRANSans", file: "/fonts/500-pn.css", displayName: "IRANSans (Medium - 500) با اعداد فارسی" },
        { name: "IRANSans", file: "/fonts/700-pn.css", displayName: "IRANSans (Bold - 700) با اعداد فارسی" },
        { name: "IRANSans", file: "/fonts/900-pn.css", displayName: "IRANSans (Black - 900) با اعداد فارسی" }
    );

    // Direct font files from files directory
    const directFonts: FontInfo[] = [
        { name: "IRANSansWeb", file: "/fonts/files/IRANSansWeb.woff2", displayName: "IRANSansWeb (Regular)" },
        { name: "IRANSansWeb_Light", file: "/fonts/files/IRANSansWeb_Light.woff2", displayName: "IRANSansWeb Light" },
        { name: "IRANSansWeb_Medium", file: "/fonts/files/IRANSansWeb_Medium.woff2", displayName: "IRANSansWeb Medium" },
        { name: "IRANSansWeb_Bold", file: "/fonts/files/IRANSansWeb_Bold.woff2", displayName: "IRANSansWeb Bold" },
        { name: "IRANSansWeb_Black", file: "/fonts/files/IRANSansWeb_Black.woff2", displayName: "IRANSansWeb Black" },
        { name: "IRANSansWeb_UltraLight", file: "/fonts/files/IRANSansWeb_UltraLight.woff2", displayName: "IRANSansWeb UltraLight" },
        { name: "IRANSansWeb_FaNum", file: "/fonts/files/IRANSansWeb_FaNum.woff2", displayName: "IRANSansWeb (با اعداد فارسی)" },
        { name: "IRANSansWeb_Light_FaNum", file: "/fonts/files/IRANSansWeb_Light_FaNum.woff2", displayName: "IRANSansWeb Light (با اعداد فارسی)" },
        { name: "IRANSansWeb_Medium_FaNum", file: "/fonts/files/IRANSansWeb_Medium_FaNum.woff2", displayName: "IRANSansWeb Medium (با اعداد فارسی)" },
        { name: "IRANSansWeb_Bold_FaNum", file: "/fonts/files/IRANSansWeb_Bold_FaNum.woff2", displayName: "IRANSansWeb Bold (با اعداد فارسی)" },
        { name: "IRANSansWeb_Black_FaNum", file: "/fonts/files/IRANSansWeb_Black_FaNum.woff2", displayName: "IRANSansWeb Black (با اعداد فارسی)" },
        { name: "IRANSansWeb_UltraLight_FaNum", file: "/fonts/files/IRANSansWeb_UltraLight_FaNum.woff2", displayName: "IRANSansWeb UltraLight (با اعداد فارسی)" },
    ];

    fonts.push(...directFonts);
    
    return fonts;
}

/**
 * Load a font from the fonts folder
 * @param fontName Name of the font or font file path
 * @returns Font face name or null if not found
 */
export async function loadFont(fontName: string): Promise<string | null> {
    if (!fontName || fontName === "system") {
        return null;
    }

    // Check if this is a CSS-based font (IRANSans)
    const availableFonts = getAvailableFonts();
    const fontInfo = availableFonts.find(f => f.name === fontName || f.file === fontName);
    
    if (fontInfo && fontInfo.file && fontInfo.file.endsWith('.css')) {
        // Load CSS-based font
        return await loadCSSFont(fontInfo.file, fontInfo.name);
    }

    // Check if font is already loaded
    if (document.fonts.check(`1em "${fontName}"`)) {
        return fontName;
    }

    // Try to load font from fonts folder (direct font files)
    const fontExtensions = ['.woff2', '.woff', '.ttf', '.otf'];
    
    // If fontName contains a path, use it directly
    if (fontName.includes('/') && !fontName.endsWith('.css')) {
        try {
            // Extract font name from path (e.g., /fonts/files/IRANSansWeb.woff2 -> IRANSansWeb)
            const fileName = fontName.split('/').pop() || '';
            const fontBaseName = fileName.replace(/\.(woff2|woff|ttf|otf|eot)$/i, '');
            // Remove _FaNum suffix for consistency
            const cleanFontName = fontBaseName.replace(/_FaNum$/, '').replace(/^IRANSansWeb_?/, 'IRANSansWeb');
            
            const fontFace = new FontFace(cleanFontName, `url(${fontName})`);
            await fontFace.load();
            document.fonts.add(fontFace);
            return cleanFontName;
        } catch (error) {
            console.error(`Error loading font from path ${fontName}:`, error);
        }
    }
    
    // Try different extensions
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

    // Try files subdirectory
    for (const ext of fontExtensions) {
        try {
            const fontUrl = `/fonts/files/${fontName}${ext}`;
            const fontFace = new FontFace(fontName, `url(${fontUrl})`);
            
            try {
                await fontFace.load();
                document.fonts.add(fontFace);
                return fontName;
            } catch (error) {
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
 * Load a CSS-based font (like IRANSans)
 * @param cssPath Path to the CSS file
 * @param fontFamilyName Name of the font family
 * @returns Font family name
 */
async function loadCSSFont(cssPath: string, fontFamilyName: string): Promise<string> {
    // Check if CSS is already loaded
    const existingLink = document.querySelector(`link[href="${cssPath}"]`);
    if (existingLink) {
        return fontFamilyName;
    }

    // Load CSS file
    return new Promise((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssPath;
        link.onload = () => {
            // Wait a bit for font to be available
            setTimeout(() => {
                resolve(fontFamilyName);
            }, 100);
        };
        link.onerror = () => {
            console.error(`Failed to load font CSS: ${cssPath}`);
            resolve(fontFamilyName); // Return anyway, might be loaded already
        };
        document.head.appendChild(link);
    });
}

/**
 * Apply font to the entire application
 * @param fontName Name of the font or font file path to apply
 */
export async function applyFont(fontName: string | null | undefined): Promise<void> {
    if (!fontName || fontName === "system") {
        // Remove custom font, use system default
        document.documentElement.style.fontFamily = '';
        return;
    }

    // Get font info to determine the actual font family name
    const availableFonts = getAvailableFonts();
    const fontInfo = availableFonts.find(f => f.name === fontName || f.file === fontName);
    
    let actualFontName = fontName;
    if (fontInfo) {
        // If it's a CSS-based font, use the font family name
        if (fontInfo.file && fontInfo.file.endsWith('.css')) {
            actualFontName = fontInfo.name;
        } else if (fontInfo.file) {
            // For direct font files, extract the name
            actualFontName = fontInfo.name;
        }
    }

    // Try to load the font
    const loadedFont = await loadFont(fontName);
    
    if (loadedFont) {
        // Apply font to root element
        document.documentElement.style.fontFamily = `"${loadedFont}", sans-serif`;
    } else {
        // Fallback to font name (might be a system font)
        document.documentElement.style.fontFamily = `"${actualFontName}", sans-serif`;
    }
}
