# Setup Instructions

## Quick Setup Guide

### 1. Install Rust

Rust is required for Tauri development. If you see an error like "cargo: command not found", follow these steps:

**On macOS:**
```bash
# Install rustup (Rust toolchain installer)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add Rust to your PATH (for zsh)
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Verify installation
cargo --version
rustc --version
```

**Alternative: Using Homebrew (macOS):**
```bash
brew install rust
```

### 2. Install Node.js Dependencies

```bash
pnpm install
```

### 3. First Run

The first time you run `pnpm tauri dev`, it will:
- Download and compile Rust dependencies (this may take 5-10 minutes)
- Build the Tauri backend
- Start the Next.js dev server
- Launch the desktop app

```bash
pnpm tauri dev
```

### Troubleshooting

**Issue: "cargo: command not found"**
- Solution: Install Rust using the instructions above, then restart your terminal

**Issue: "failed to run 'cargo metadata'"**
- Solution: Make sure Rust is installed and `cargo` is in your PATH
- Verify with: `which cargo` (should show `/Users/elvis/.cargo/bin/cargo` or similar)

**Issue: Rust installation fails with permission errors**
- Solution: Run the rustup installer manually and add cargo to PATH:
  ```bash
  export PATH="$HOME/.cargo/bin:$PATH"
  ```

**Issue: "No such file or directory" when running cargo**
- Solution: The Rust installation may be incomplete. Try:
  ```bash
  ~/.cargo/bin/rustup self update
  ~/.cargo/bin/rustup default stable
  ```

### Verify Your Setup

Run these commands to verify everything is installed:

```bash
# Check Node.js
node --version  # Should be 18+

# Check pnpm
pnpm --version

# Check Rust
cargo --version
rustc --version

# Check Tauri CLI
pnpm tauri --version
```

Once all commands work, you're ready to develop!
