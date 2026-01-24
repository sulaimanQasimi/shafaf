# Getting Started

This page covers the first run, license check, and login for **شفاف (Shafaf)**.

---

## First Run

1. **Install** the app from [Releases](https://github.com/YOUR_ORG/tauri-app/releases) (see [Installation](Installation)).
2. **Launch** the app. You will see either:
   - **License screen** — if no valid license is stored, or
   - **Login screen** — if a valid license is already stored.
3. **Enter license** (see [License](License)) when prompted, then **log in** with your user credentials.

---

## License Screen

- The app shows a **Machine ID**. The user must send this to the license provider.
- The provider uses `license-generator.html` (or equivalent) to generate a **license key** from that Machine ID.
- The user pastes the **license key** and submits. If valid, the key is stored and the app proceeds to **Login**.

---

## Login

- Use the **username** and **password** of an existing user.
- If no users exist, the database may need to be initialized (e.g. by an admin or first-time setup).
- After a successful login, you reach the **Dashboard**.

---

## After Login

- **Dashboard**: overview (products, suppliers, purchases, income, deductions).
- **Sidebar**: navigation to Products, Purchases, Sales, Suppliers, Customers, Currencies, Units, Expenses, Employees, Salary, Deductions, Users, Profile, Company Settings, Accounts, Purchase Payments, Sales Payments.
- **Theme**: use the theme toggle for light/dark mode.
- **Backup/Restore**: available from the app for database backup and restore.

---

## Next Steps

- [Installation](Installation) — how to install on Windows and Android  
- [Features](Features) — modules and main workflows  
- [License](License) — how license validation and the generator work  
