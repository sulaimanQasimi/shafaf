-- SurrealDB Schema for Shafaf Finance App
-- Converted from SQLite schema

-- Users table
DEFINE TABLE users SCHEMAFULL;
DEFINE FIELD id ON users TYPE record<users>;
DEFINE FIELD username ON users TYPE string ASSERT $value != NONE;
DEFINE FIELD email ON users TYPE string ASSERT $value != NONE;
DEFINE FIELD password_hash ON users TYPE string ASSERT $value != NONE;
DEFINE FIELD full_name ON users TYPE option<string>;
DEFINE FIELD phone ON users TYPE option<string>;
DEFINE FIELD role ON users TYPE string DEFAULT "user";
DEFINE FIELD is_active ON users TYPE int DEFAULT 1;
DEFINE FIELD created_at ON users TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON users TYPE datetime DEFAULT time::now();
DEFINE INDEX username_unique ON users FIELDS username UNIQUE;
DEFINE INDEX email_unique ON users FIELDS email UNIQUE;

-- Currencies table
DEFINE TABLE currencies SCHEMAFULL;
DEFINE FIELD id ON currencies TYPE record<currencies>;
DEFINE FIELD name ON currencies TYPE string ASSERT $value != NONE;
DEFINE FIELD base ON currencies TYPE int DEFAULT 0;
DEFINE FIELD rate ON currencies TYPE float;
DEFINE FIELD created_at ON currencies TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON currencies TYPE datetime DEFAULT time::now();
DEFINE INDEX name_unique ON currencies FIELDS name UNIQUE;

-- Suppliers table
DEFINE TABLE suppliers SCHEMAFULL;
DEFINE FIELD id ON suppliers TYPE record<suppliers>;
DEFINE FIELD full_name ON suppliers TYPE string ASSERT $value != NONE;
DEFINE FIELD phone ON suppliers TYPE string ASSERT $value != NONE;
DEFINE FIELD address ON suppliers TYPE string ASSERT $value != NONE;
DEFINE FIELD email ON suppliers TYPE option<string>;
DEFINE FIELD notes ON suppliers TYPE option<string>;
DEFINE FIELD created_at ON suppliers TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON suppliers TYPE datetime DEFAULT time::now();

-- Customers table
DEFINE TABLE customers SCHEMAFULL;
DEFINE FIELD id ON customers TYPE record<customers>;
DEFINE FIELD full_name ON customers TYPE string ASSERT $value != NONE;
DEFINE FIELD phone ON customers TYPE string ASSERT $value != NONE;
DEFINE FIELD address ON customers TYPE string ASSERT $value != NONE;
DEFINE FIELD email ON customers TYPE option<string>;
DEFINE FIELD notes ON customers TYPE option<string>;
DEFINE FIELD created_at ON customers TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON customers TYPE datetime DEFAULT time::now();

-- Unit groups table
DEFINE TABLE unit_groups SCHEMAFULL;
DEFINE FIELD id ON unit_groups TYPE record<unit_groups>;
DEFINE FIELD name ON unit_groups TYPE string ASSERT $value != NONE;
DEFINE FIELD created_at ON unit_groups TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON unit_groups TYPE datetime DEFAULT time::now();
DEFINE INDEX name_unique ON unit_groups FIELDS name UNIQUE;

-- Units table
DEFINE TABLE units SCHEMAFULL;
DEFINE FIELD id ON units TYPE record<units>;
DEFINE FIELD name ON units TYPE string ASSERT $value != NONE;
DEFINE FIELD group_id ON units TYPE option<record<unit_groups>>;
DEFINE FIELD ratio ON units TYPE float;
DEFINE FIELD is_base ON units TYPE int;
DEFINE FIELD created_at ON units TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON units TYPE datetime DEFAULT time::now();
DEFINE INDEX name_unique ON units FIELDS name UNIQUE;

-- Products table
DEFINE TABLE products SCHEMAFULL;
DEFINE FIELD id ON products TYPE record<products>;
DEFINE FIELD name ON products TYPE string ASSERT $value != NONE;
DEFINE FIELD description ON products TYPE option<string>;
DEFINE FIELD price ON products TYPE float;
DEFINE FIELD currency_id ON products TYPE option<record<currencies>>;
DEFINE FIELD supplier_id ON products TYPE option<record<suppliers>>;
DEFINE FIELD stock_quantity ON products TYPE float;
DEFINE FIELD unit ON products TYPE option<string>;
DEFINE FIELD image_path ON products TYPE option<string>;
DEFINE FIELD bar_code ON products TYPE option<string>;
DEFINE FIELD created_at ON products TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON products TYPE datetime DEFAULT time::now();

-- Purchases table
DEFINE TABLE purchases SCHEMAFULL;
DEFINE FIELD id ON purchases TYPE record<purchases>;
DEFINE FIELD supplier_id ON purchases TYPE option<record<suppliers>>;
DEFINE FIELD date ON purchases TYPE string;
DEFINE FIELD notes ON purchases TYPE option<string>;
DEFINE FIELD currency_id ON purchases TYPE option<record<currencies>>;
DEFINE FIELD total_amount ON purchases TYPE float;
DEFINE FIELD additional_cost ON purchases TYPE float DEFAULT 0.0;
DEFINE FIELD created_at ON purchases TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON purchases TYPE datetime DEFAULT time::now();

-- Purchase items table
DEFINE TABLE purchase_items SCHEMAFULL;
DEFINE FIELD id ON purchase_items TYPE record<purchase_items>;
DEFINE FIELD purchase_id ON purchase_items TYPE record<purchases>;
DEFINE FIELD product_id ON purchase_items TYPE option<record<products>>;
DEFINE FIELD unit_id ON purchase_items TYPE option<record<units>>;
DEFINE FIELD per_price ON purchase_items TYPE float;
DEFINE FIELD amount ON purchase_items TYPE float;
DEFINE FIELD total ON purchase_items TYPE float;
DEFINE FIELD per_unit ON purchase_items TYPE option<float>;
DEFINE FIELD cost_price ON purchase_items TYPE option<float>;
DEFINE FIELD wholesale_price ON purchase_items TYPE option<float>;
DEFINE FIELD retail_price ON purchase_items TYPE option<float>;
DEFINE FIELD expiry_date ON purchase_items TYPE option<string>;
DEFINE FIELD created_at ON purchase_items TYPE datetime DEFAULT time::now();

-- Purchase additional costs table
DEFINE TABLE purchase_additional_costs SCHEMAFULL;
DEFINE FIELD id ON purchase_additional_costs TYPE record<purchase_additional_costs>;
DEFINE FIELD purchase_id ON purchase_additional_costs TYPE record<purchases>;
DEFINE FIELD name ON purchase_additional_costs TYPE string;
DEFINE FIELD amount ON purchase_additional_costs TYPE float;
DEFINE FIELD created_at ON purchase_additional_costs TYPE datetime DEFAULT time::now();

-- Purchase payments table
DEFINE TABLE purchase_payments SCHEMAFULL;
DEFINE FIELD id ON purchase_payments TYPE record<purchase_payments>;
DEFINE FIELD purchase_id ON purchase_payments TYPE record<purchases>;
DEFINE FIELD account_id ON purchase_payments TYPE option<record<accounts>>;
DEFINE FIELD amount ON purchase_payments TYPE float;
DEFINE FIELD currency ON purchase_payments TYPE string;
DEFINE FIELD rate ON purchase_payments TYPE float;
DEFINE FIELD total ON purchase_payments TYPE float;
DEFINE FIELD date ON purchase_payments TYPE string;
DEFINE FIELD notes ON purchase_payments TYPE option<string>;
DEFINE FIELD created_at ON purchase_payments TYPE datetime DEFAULT time::now();

-- Sales table
DEFINE TABLE sales SCHEMAFULL;
DEFINE FIELD id ON sales TYPE record<sales>;
DEFINE FIELD customer_id ON sales TYPE option<record<customers>>;
DEFINE FIELD date ON sales TYPE string;
DEFINE FIELD notes ON sales TYPE option<string>;
DEFINE FIELD currency_id ON sales TYPE option<record<currencies>>;
DEFINE FIELD exchange_rate ON sales TYPE float;
DEFINE FIELD total_amount ON sales TYPE float;
DEFINE FIELD base_amount ON sales TYPE float;
DEFINE FIELD paid_amount ON sales TYPE float DEFAULT 0.0;
DEFINE FIELD additional_cost ON sales TYPE float DEFAULT 0.0;
DEFINE FIELD created_at ON sales TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON sales TYPE datetime DEFAULT time::now();

-- Sale items table
DEFINE TABLE sale_items SCHEMAFULL;
DEFINE FIELD id ON sale_items TYPE record<sale_items>;
DEFINE FIELD sale_id ON sale_items TYPE record<sales>;
DEFINE FIELD product_id ON sale_items TYPE option<record<products>>;
DEFINE FIELD unit_id ON sale_items TYPE option<record<units>>;
DEFINE FIELD per_price ON sale_items TYPE float;
DEFINE FIELD amount ON sale_items TYPE float;
DEFINE FIELD total ON sale_items TYPE float;
DEFINE FIELD created_at ON sale_items TYPE datetime DEFAULT time::now();

-- Sale payments table
DEFINE TABLE sale_payments SCHEMAFULL;
DEFINE FIELD id ON sale_payments TYPE record<sale_payments>;
DEFINE FIELD sale_id ON sale_payments TYPE record<sales>;
DEFINE FIELD account_id ON sale_payments TYPE option<record<accounts>>;
DEFINE FIELD currency_id ON sale_payments TYPE option<record<currencies>>;
DEFINE FIELD exchange_rate ON sale_payments TYPE float;
DEFINE FIELD amount ON sale_payments TYPE float;
DEFINE FIELD base_amount ON sale_payments TYPE float;
DEFINE FIELD date ON sale_payments TYPE string;
DEFINE FIELD created_at ON sale_payments TYPE datetime DEFAULT time::now();

-- Sale additional costs table
DEFINE TABLE sale_additional_costs SCHEMAFULL;
DEFINE FIELD id ON sale_additional_costs TYPE record<sale_additional_costs>;
DEFINE FIELD sale_id ON sale_additional_costs TYPE record<sales>;
DEFINE FIELD name ON sale_additional_costs TYPE string;
DEFINE FIELD amount ON sale_additional_costs TYPE float;
DEFINE FIELD created_at ON sale_additional_costs TYPE datetime DEFAULT time::now();

-- Expense types table
DEFINE TABLE expense_types SCHEMAFULL;
DEFINE FIELD id ON expense_types TYPE record<expense_types>;
DEFINE FIELD name ON expense_types TYPE string ASSERT $value != NONE;
DEFINE FIELD created_at ON expense_types TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON expense_types TYPE datetime DEFAULT time::now();
DEFINE INDEX name_unique ON expense_types FIELDS name UNIQUE;

-- Expenses table
DEFINE TABLE expenses SCHEMAFULL;
DEFINE FIELD id ON expenses TYPE record<expenses>;
DEFINE FIELD expense_type_id ON expenses TYPE option<record<expense_types>>;
DEFINE FIELD amount ON expenses TYPE float;
DEFINE FIELD currency ON expenses TYPE string;
DEFINE FIELD rate ON expenses TYPE float;
DEFINE FIELD total ON expenses TYPE float;
DEFINE FIELD date ON expenses TYPE string;
DEFINE FIELD bill_no ON expenses TYPE option<string>;
DEFINE FIELD description ON expenses TYPE option<string>;
DEFINE FIELD created_at ON expenses TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON expenses TYPE datetime DEFAULT time::now();

-- Employees table
DEFINE TABLE employees SCHEMAFULL;
DEFINE FIELD id ON employees TYPE record<employees>;
DEFINE FIELD full_name ON employees TYPE string;
DEFINE FIELD phone ON employees TYPE string;
DEFINE FIELD email ON employees TYPE option<string>;
DEFINE FIELD address ON employees TYPE option<string>;
DEFINE FIELD position ON employees TYPE option<string>;
DEFINE FIELD hire_date ON employees TYPE option<string>;
DEFINE FIELD base_salary ON employees TYPE float;
DEFINE FIELD photo_path ON employees TYPE option<string>;
DEFINE FIELD notes ON employees TYPE option<string>;
DEFINE FIELD created_at ON employees TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON employees TYPE datetime DEFAULT time::now();

-- Salaries table
DEFINE TABLE salaries SCHEMAFULL;
DEFINE FIELD id ON salaries TYPE record<salaries>;
DEFINE FIELD employee_id ON salaries TYPE record<employees>;
DEFINE FIELD year ON salaries TYPE int;
DEFINE FIELD month ON salaries TYPE string;
DEFINE FIELD amount ON salaries TYPE float;
DEFINE FIELD deductions ON salaries TYPE float DEFAULT 0.0;
DEFINE FIELD notes ON salaries TYPE option<string>;
DEFINE FIELD created_at ON salaries TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON salaries TYPE datetime DEFAULT time::now();
DEFINE INDEX employee_year_month_unique ON salaries FIELDS employee_id, year, month UNIQUE;

-- Deductions table
DEFINE TABLE deductions SCHEMAFULL;
DEFINE FIELD id ON deductions TYPE record<deductions>;
DEFINE FIELD employee_id ON deductions TYPE option<record<employees>>;
DEFINE FIELD year ON deductions TYPE int;
DEFINE FIELD month ON deductions TYPE string;
DEFINE FIELD currency ON deductions TYPE string;
DEFINE FIELD rate ON deductions TYPE float;
DEFINE FIELD amount ON deductions TYPE float;
DEFINE FIELD created_at ON deductions TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON deductions TYPE datetime DEFAULT time::now();

-- Company settings table
DEFINE TABLE company_settings SCHEMAFULL;
DEFINE FIELD id ON company_settings TYPE record<company_settings>;
DEFINE FIELD name ON company_settings TYPE option<string>;
DEFINE FIELD logo ON company_settings TYPE option<string>;
DEFINE FIELD phone ON company_settings TYPE option<string>;
DEFINE FIELD address ON company_settings TYPE option<string>;
DEFINE FIELD font ON company_settings TYPE option<string>;
DEFINE FIELD created_at ON company_settings TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON company_settings TYPE datetime DEFAULT time::now();

-- COA categories table
DEFINE TABLE coa_categories SCHEMAFULL;
DEFINE FIELD id ON coa_categories TYPE record<coa_categories>;
DEFINE FIELD parent_id ON coa_categories TYPE option<record<coa_categories>>;
DEFINE FIELD name ON coa_categories TYPE string;
DEFINE FIELD code ON coa_categories TYPE string;
DEFINE FIELD category_type ON coa_categories TYPE string;
DEFINE FIELD level ON coa_categories TYPE int;
DEFINE FIELD created_at ON coa_categories TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON coa_categories TYPE datetime DEFAULT time::now();
DEFINE INDEX code_unique ON coa_categories FIELDS code UNIQUE;

-- Accounts table
DEFINE TABLE accounts SCHEMAFULL;
DEFINE FIELD id ON accounts TYPE record<accounts>;
DEFINE FIELD name ON accounts TYPE string;
DEFINE FIELD currency_id ON accounts TYPE option<record<currencies>>;
DEFINE FIELD coa_category_id ON accounts TYPE option<record<coa_categories>>;
DEFINE FIELD account_code ON accounts TYPE string;
DEFINE FIELD account_type ON accounts TYPE string;
DEFINE FIELD initial_balance ON accounts TYPE float DEFAULT 0.0;
DEFINE FIELD current_balance ON accounts TYPE float DEFAULT 0.0;
DEFINE FIELD is_active ON accounts TYPE int DEFAULT 1;
DEFINE FIELD notes ON accounts TYPE option<string>;
DEFINE FIELD created_at ON accounts TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON accounts TYPE datetime DEFAULT time::now();
DEFINE INDEX account_code_unique ON accounts FIELDS account_code UNIQUE;

-- Account currency balances table
DEFINE TABLE account_currency_balances SCHEMAFULL;
DEFINE FIELD id ON account_currency_balances TYPE record<account_currency_balances>;
DEFINE FIELD account_id ON account_currency_balances TYPE record<accounts>;
DEFINE FIELD currency_id ON account_currency_balances TYPE record<currencies>;
DEFINE FIELD balance ON account_currency_balances TYPE float;
DEFINE FIELD updated_at ON account_currency_balances TYPE datetime DEFAULT time::now();
DEFINE INDEX account_currency_unique ON account_currency_balances FIELDS account_id, currency_id UNIQUE;

-- Journal entries table
DEFINE TABLE journal_entries SCHEMAFULL;
DEFINE FIELD id ON journal_entries TYPE record<journal_entries>;
DEFINE FIELD entry_number ON journal_entries TYPE string;
DEFINE FIELD entry_date ON journal_entries TYPE string;
DEFINE FIELD description ON journal_entries TYPE option<string>;
DEFINE FIELD reference_type ON journal_entries TYPE option<string>;
DEFINE FIELD reference_id ON journal_entries TYPE option<int>;
DEFINE FIELD created_at ON journal_entries TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON journal_entries TYPE datetime DEFAULT time::now();
DEFINE INDEX entry_number_unique ON journal_entries FIELDS entry_number UNIQUE;

-- Journal entry lines table
DEFINE TABLE journal_entry_lines SCHEMAFULL;
DEFINE FIELD id ON journal_entry_lines TYPE record<journal_entry_lines>;
DEFINE FIELD journal_entry_id ON journal_entry_lines TYPE record<journal_entries>;
DEFINE FIELD account_id ON journal_entry_lines TYPE option<record<accounts>>;
DEFINE FIELD currency_id ON journal_entry_lines TYPE option<record<currencies>>;
DEFINE FIELD debit_amount ON journal_entry_lines TYPE float DEFAULT 0.0;
DEFINE FIELD credit_amount ON journal_entry_lines TYPE float DEFAULT 0.0;
DEFINE FIELD exchange_rate ON journal_entry_lines TYPE float;
DEFINE FIELD base_amount ON journal_entry_lines TYPE float;
DEFINE FIELD description ON journal_entry_lines TYPE option<string>;
DEFINE FIELD created_at ON journal_entry_lines TYPE datetime DEFAULT time::now();

-- Currency exchange rates table
DEFINE TABLE currency_exchange_rates SCHEMAFULL;
DEFINE FIELD id ON currency_exchange_rates TYPE record<currency_exchange_rates>;
DEFINE FIELD from_currency_id ON currency_exchange_rates TYPE record<currencies>;
DEFINE FIELD to_currency_id ON currency_exchange_rates TYPE record<currencies>;
DEFINE FIELD rate ON currency_exchange_rates TYPE float;
DEFINE FIELD date ON currency_exchange_rates TYPE string;
DEFINE FIELD created_at ON currency_exchange_rates TYPE datetime DEFAULT time::now();

-- Account transactions table
DEFINE TABLE account_transactions SCHEMAFULL;
DEFINE FIELD id ON account_transactions TYPE record<account_transactions>;
DEFINE FIELD account_id ON account_transactions TYPE record<accounts>;
DEFINE FIELD transaction_type ON account_transactions TYPE string;
DEFINE FIELD amount ON account_transactions TYPE float;
DEFINE FIELD currency ON account_transactions TYPE string;
DEFINE FIELD rate ON account_transactions TYPE float;
DEFINE FIELD total ON account_transactions TYPE float;
DEFINE FIELD transaction_date ON account_transactions TYPE string;
DEFINE FIELD is_full ON account_transactions TYPE int DEFAULT 0;
DEFINE FIELD notes ON account_transactions TYPE option<string>;
DEFINE FIELD created_at ON account_transactions TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON account_transactions TYPE datetime DEFAULT time::now();
