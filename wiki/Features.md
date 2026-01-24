# Features

Overview of **شفاف (Shafaf)** modules and main workflows.

---

## Core Modules

### Products & Units

- **Products**: name, SKU, unit, purchase/sale price, stock, currency, barcode, etc.
- **Units**: product units (e.g. piece, box, kg). Used when defining products and in purchase/sale rows.

### Purchases

- **Purchases**: purchase header (supplier, date, currency, exchange rate, notes) and **purchase items** (product, quantity, unit price, etc.).
- **Purchase Invoice**: print/export purchase as invoice.
- **Purchase Payments**: record payments to suppliers; tracks supplier balances.
- **Purchase additional costs**: extra costs on purchases.

### Sales

- **Sales**: sale header (customer, date, currency, exchange rate, notes) and **sale items** (product, quantity, unit price, etc.).
- **Sale Invoice**: print/export sale as invoice.
- **Sales Payments**: record payments from customers; tracks customer balances.
- **Sale additional costs**: extra costs on sales.

When a **currency** is selected in Purchase or Sales, the **rate/exchange rate** is auto-filled from the currency’s **rate**.

### Suppliers & Customers

- **Suppliers**: for purchases and purchase payments.
- **Customers**: for sales and sales payments.

### Currencies

- **Currencies**: name, base (Y/N), **rate** (exchange rate).  
- **Rate** is used to auto-fill exchange/rate in Purchase and Sales when a currency is selected.

### Expenses

- **Expenses**: amount, date, expense type, notes.
- **Expense types**: used to categorize expenses.

### Employees, Salary & Deductions

- **Employees**: for payroll.
- **Salary**: salary records linked to employees.
- **Deductions**: deduction types and amounts; can be linked to employees or used generally.

---

## Finance & Admin

### Accounts & Journal

- **Accounts**: chart of accounts (COA).
- **Journal entries**: debit/credit entries for accounting.

### Users & Profile

- **Users**: create and manage users (admin).
- **Profile**: current user’s profile and password.

### Company Settings

- Company name, address, logo, tax ID, etc. Used on invoices and reports.

### Backup & Restore

- **Backup**: save a copy of the SQLite database.
- **Restore**: replace the current database from a backup file.

---

## UI & Behavior

- **Language**: Persian/Dari, RTL.
- **Theme**: light/dark; choice is stored in `localStorage`.
- **Fonts**: IRANSans (or similar) for Persian text.
- **Sounds**: optional click and notification sounds.

---

## Data & Tech

- **Database**: SQLite via Rust/rusqlite. Path can be set with `DATABASE_PATH` (see [Configuration](Configuration)).
- **License**: machine-bound; checked on startup (see [License](License)).

---

## Related

- [Getting Started](Getting-Started)  
- [Configuration](Configuration)  
