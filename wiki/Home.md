# شفاف (Shafaf) — Wiki Home

**شفاف** (Shafaf) is a bilingual (Persian/Dari) desktop and Android finance and accounting app built with **Tauri 2**, **React 19**, **TypeScript**, **Vite 7**, **Tailwind 4**, and **SQLite** (Rust/rusqlite). It supports RTL, light/dark themes, and runs on **Windows** and **Android**.

---

## Quick Links

| Page | Description |
|------|-------------|
| [Getting Started](Getting-Started) | First run, license, and login |
| [Installation](Installation) | Install from Releases (Windows & Android) |
| [Features](Features) | Products, Purchases, Sales, and more |
| [Development](Development) | Prerequisites, setup, and project layout |
| [Building and Release](Building-and-Release) | Local build and GitHub release workflow |
| [Configuration](Configuration) | Environment variables and company settings |
| [Android Setup](Android-Setup) | JDK, SDK, NDK, signing, CI keystore |
| [Troubleshooting](Troubleshooting) | Common build and runtime issues |
| [License](License) | How license is checked and the license generator |

---

## Feature Overview

- **Inventory & Sales**: Products, Units, Purchases (with purchase invoice), Sales (with sale invoice), Suppliers, Customers  
- **Payments**: Purchase payments (supplier balances), Sales payments (customer balances)  
- **HR & Expenses**: Employees, Salary, Deductions, Expenses  
- **Finance**: Currencies (with rate), Accounts, Journal entries  
- **Admin**: Users, Profile, Company settings, License, DB backup/restore  

---

## Tech Stack

| Layer | Tech |
|-------|------|
| UI | React 19, TypeScript, Vite 7, Tailwind 4, Framer Motion |
| Backend | Tauri 2, Rust, rusqlite (SQLite) |
| Platforms | Windows (NSIS), Android (APK/AAB) |

**App identifier**: `com.sulaiman.shafaf` · **Version**: 6.3.2

---

## Adding This Wiki to GitHub

1. In your repo: **Settings → General → Features** → enable **Wikis**.
2. Open **Wiki** in the repo and create a new page.
3. Copy the contents of each `.md` file from the `wiki/` folder into the corresponding Wiki page (create pages with the same names as the filenames, without `.md`).
4. Set **Home** as the wiki’s home page in the Wiki sidebar.

You can also use the `wiki/` folder as `/docs` or as the source for a docs site (e.g. MkDocs, Docusaurus).
