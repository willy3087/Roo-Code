#!/bin/bash

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Only macOS is currently supported."
  exit 1
fi

options=("nodejs" "python" "golang" "rust")
binaries=("node" "python" "go" "rustc")
choices[0]="*"

menu() {
  echo -e "\nWhich eval types would you like to support?\n"

  for i in ${!options[@]}; do
    printf "%d %6s [%s]" $((i + 1)) "${options[i]}" "${choices[i]:- }"

    if [[ $i == 0 ]]; then
      printf " (required)"
    fi

    printf "\n"
  done

  echo
}

prompt="Type 🔢 to select, 'a' for all, 'q' to quit, ⏎ to continue: "

while menu && read -rp "$prompt" num && [[ "$num" ]]; do
  [[ "$num" == "q" ]] && exit 0

  [[ "$num" == "a" ]] && {
    for i in ${!options[@]}; do
      choices[i]="*"
    done

    continue
  }

  [[ "$num" != *[![:digit:]]* ]] &&
    ((num > 1 && num <= ${#options[@]})) ||
    {
      continue
    }

  ((num--))
  [[ "${choices[num]}" ]] && choices[num]="" || choices[num]="*"
done

empty=true

for i in ${!options[@]}; do
  [[ "${choices[i]}" ]] && {
    empty=false
    break
  }
done

[[ "$empty" == true ]] && exit 0

echo -e "\nInstalling dependencies..."

if ! command -v brew &>/dev/null; then
  if [[ -f "/opt/homebrew/bin/brew" ]]; then
    echo "Homebrew is installed but not in your PATH"
    exit 1
  fi

  read -p "Homebrew (https://brew.sh) is required. Install it? (Y/n): " install_brew

  if [[ "$install_brew" =~ ^[Yy]|^$ ]]; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Can be undone with:
    # /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh)" && sudo rm -rvf /opt/homebrew

    if [[ "$SHELL" == "/bin/zsh" ]] && ! grep -q 'eval "$(/opt/homebrew/bin/brew shellenv)"' ~/.zprofile; then
      echo '[[ -s "/opt/homebrew/bin/brew" ]] && eval "$(/opt/homebrew/bin/brew shellenv)"' >>~/.zprofile
    elif [[ "$SHELL" == "/bin/bash" ]] && ! grep -q 'eval "$(/opt/homebrew/bin/brew shellenv)"' ~/.bash_profile; then
      echo '[[ -s "/opt/homebrew/bin/brew" ]] && eval "$(/opt/homebrew/bin/brew shellenv)"' >>~/.bash_profile
    fi

    if [[ "$SHELL" == "/bin/zsh" ]]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [[ "$SHELL" == "/bin/bash" ]]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    fi

    echo "✅ Homebrew is installed"
  else
    exit 1
  fi
else
  BREW_VERSION=$(brew --version)
  echo "✅ Homebrew is installed ($BREW_VERSION)"
fi

ASDF_PATH="$(brew --prefix asdf)/libexec/asdf.sh"

if ! command -v asdf &>/dev/null; then
  if [[ -f "$ASDF_PATH" ]]; then
    echo "asdf is installed but not in your PATH"
    exit 1
  fi

  read -p "asdf (https://asdf-vm.com) is required. Install it? (Y/n): " install_asdf
  # Can be undone with:
  # rm -rvf ~/.asdf

  if [[ "$install_asdf" =~ ^[Yy]|^$ ]]; then
    echo "Installing asdf..."
    brew install asdf

    . "$ASDF_PATH"

    if [[ "$SHELL" == "/bin/zsh" ]] && ! grep -q 'source "$(brew --prefix asdf)/libexec/asdf.sh"' ~/.zshrc; then
      echo '[[ -s "/opt/homebrew/bin/brew" ]] && [[ -s "$(brew --prefix asdf)/libexec/asdf.sh" ]] && source "$(brew --prefix asdf)/libexec/asdf.sh"' >>~/.zprofile
    elif [[ "$SHELL" == "/bin/bash" ]] && ! grep -q 'source "$(brew --prefix asdf)/libexec/asdf.sh"' ~/.bash_profile; then
      echo '[[ -s "/opt/homebrew/bin/brew" ]] && [[ -s "$(brew --prefix asdf)/libexec/asdf.sh" ]] && source "$(brew --prefix asdf)/libexec/asdf.sh"' >>~/.bash_profile
    fi

    echo "✅ asdf is installed"
  else
    exit 1
  fi
else
  ASDF_VERSION=$(asdf --version)
  echo "✅ asdf is installed ($ASDF_VERSION)"
fi

for i in "${!options[@]}"; do
  [[ "${choices[i]}" ]] || continue

  plugin="${options[$i]}"
  binary="${binaries[$i]}"

  if ! asdf plugin list | grep -q "^${plugin}$" && ! command -v "${binary[$i]}" &>/dev/null; then
    asdf plugin add "${plugin}"

    if ! asdf plugin list | grep -q "^${plugin}$"; then
      echo "Failed to install ${plugin} asdf plugin. Please install it manually."
      exit 1
    else
      echo "✅ asdf ${plugin} plugin installed"
    fi
  fi

  if [[ "${plugin}" == "nodejs" ]] && ! command -v node &>/dev/null; then
    asdf install nodejs v20.18.1
    asdf set nodejs v20.18.1
    NODE_VERSION=$(node --version)
    echo "✅ Node.js is installed ($NODE_VERSION)"
  elif [[ "${plugin}" == "nodejs" ]]; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js is installed ($NODE_VERSION)"
  fi

  if [[ "${plugin}" == "python" ]] && ! command -v python &>/dev/null; then
    asdf install python 3.13.2
    asdf set python 3.13.2
    PYTHON_VERSION=$(python --version)
    echo "✅ Python is installed ($PYTHON_VERSION)"
  elif [[ "${plugin}" == "python" ]]; then
    PYTHON_VERSION=$(python --version)
    echo "✅ Python is installed ($PYTHON_VERSION)"
  fi

  if [[ "${plugin}" == "golang" ]] && ! command -v go &>/dev/null; then
    asdf install golang 1.24.2
    asdf set golang 1.24.2
    GO_VERSION=$(go version)
    echo "✅ Go is installed ($GO_VERSION)"
  elif [[ "${plugin}" == "golang" ]]; then
    GO_VERSION=$(go version)
    echo "✅ Go is installed ($GO_VERSION)"
  fi

  if [[ "${plugin}" == "rust" ]] && ! command -v rustc &>/dev/null; then
    asdf install rust 1.85.1
    asdf set rust 1.85.1
    RUST_VERSION=$(rustc --version)
    echo "✅ Rust is installed ($RUST_VERSION)"
  elif [[ "${plugin}" == "rust" ]]; then
    RUST_VERSION=$(rustc --version)
    echo "✅ Rust is installed ($RUST_VERSION)"
  fi
done

if ! command -v pnpm &>/dev/null; then
  brew install pnpm
  PNPM_VERSION=$(pnpm --version)
  echo "✅ pnpm is installed ($PNPM_VERSION)"
else
  PNPM_VERSION=$(pnpm --version)
  echo "✅ pnpm is installed ($PNPM_VERSION)"
fi

pnpm install
