# Environment Configuration

This application uses environment variables for configuration. Create a `.env` file in the root directory based on `.env.example`.

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your configuration values.

## Configuration Variables

### Database Configuration

- `DATABASE_PATH`: Path to the SQLite database file
  - **Windows**: Use forward slashes or escaped backslashes
    - Example: `E:/db.sqlite` or `E:\\db.sqlite`
  - **Linux/Mac**: Use standard paths
    - Example: `./data/db.sqlite` or `/var/lib/app/db.sqlite`
  - **Default**: `E:\\db.sqlite` (Windows) or `./data/db.sqlite` (Linux/Mac)

### Application Configuration

- `APP_NAME`: Application name (default: "Tauri App")
- `APP_VERSION`: Application version (default: "0.1.0")
- `LOG_LEVEL`: Logging level - DEBUG, INFO, WARN, ERROR (default: "INFO")
- `DEV_MODE`: Development mode flag - true/false (default: "true")

## Usage

The environment variables are loaded automatically when the application starts. The Rust backend reads from the `.env` file using the `dotenv` crate.

## Notes

- The `.env` file is excluded from version control (see `.gitignore`)
- Always use `.env.example` as a template for creating your `.env` file
- Never commit your `.env` file to version control as it may contain sensitive information
