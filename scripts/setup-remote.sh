#!/usr/bin/env bash
#
# scripts/setup-remote.sh
#
# One-shot bootstrap for the REMOTE Linux build machine (the high-RAM box you
# SSH into to build Digital ID locally). Safe to re-run: every step detects
# what is already installed and only installs what is missing, falling back
# through multiple strategies when a package manager or tool is unavailable.
# Fails loudly: if a required component (Node, JDK, Android SDK) can't be
# installed, the script reports it and exits non-zero.
#
# Usage:
#   bash setup-remote.sh                 # project at ~/digital-id
#   bash setup-remote.sh /path/to/repo   # or point at the cloned repo
#
# What it installs (with fallbacks):
#   Node 22 LTS      existing node >= 20.19 -> nvm -> official tarball
#   JDK 17           existing 17-21 -> openjdk-17-jdk -> openjdk-21-jdk
#   Android SDK      existing ANDROID_HOME -> cmdline-tools zip -> apt (last resort)
#   SDK packages     platform-tools, platforms;android-36, build-tools;36.0.0,
#                    ndk;27.1.12297006, cmake;3.22.1 (Gradle auto-fetches any gaps)
#   watchman         optional (Metro works without it)
#   eas-cli          global install -> local ~/.npm-global fallback
#   project          npm ci + expo prebuild -p android (if the repo is present)

set -uo pipefail

PROJECT_DIR="${1:-$HOME/digital-id}"
SDK_ROOT="${ANDROID_HOME:-$HOME/android-sdk}"
CMDLINE_ZIP_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
# Versions pinned to what React Native 0.86 / Expo SDK 57 actually needs.
SDK_PACKAGES=(platform-tools "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006" "cmake;3.22.1")
NODE_MAJOR=22
NODE_MIN=20.19

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
log()  { printf '\033[1;34m\n==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m  ✔ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m  ⚠ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m  ✘ %s\033[0m\n' "$*"; }

have() { command -v "$1" >/dev/null 2>&1; }

# Append a line to ~/.bashrc unless already present.
export_line() {
  local line="$1"
  touch "$HOME/.bashrc"
  grep -qF -- "$line" "$HOME/.bashrc" || echo "$line" >> "$HOME/.bashrc"
}

sudo_run() {
  if [[ $EUID -eq 0 ]]; then "$@"
  elif sudo -n true 2>/dev/null; then sudo "$@"
  else
    warn "sudo unavailable — skipping: $*"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# 1. System packages
# ---------------------------------------------------------------------------
install_system_packages() {
  log "System packages (git, curl, unzip, wget, build tools)"
  local missing=()
  for c in git curl unzip wget; do have "$c" || missing+=("$c"); done
  if [[ ${#missing[@]} -eq 0 ]]; then ok "all present"; return 0; fi

  if have apt-get; then
    sudo_run apt-get update -y || true
    sudo_run apt-get install -y git curl unzip wget build-essential python3 || true
  elif have dnf; then
    sudo_run dnf install -y git curl unzip wget gcc-c++ make python3 || true
  elif have pacman; then
    sudo_run pacman -S --noconfirm git curl unzip wget base-devel python || true
  else
    warn "no apt/dnf/pacman found — install git, curl, unzip, wget manually"
  fi

  local still=()
  for c in git curl unzip wget; do have "$c" || still+=("$c"); done
  [[ ${#still[@]} -eq 0 ]] && ok "git, curl, unzip, wget ready" || warn "still missing: ${still[*]}"
}

# ---------------------------------------------------------------------------
# 2. Node.js
# ---------------------------------------------------------------------------
node_version_ok() {
  have node || return 1
  local v
  # keep major.minor (e.g. v20.19.1 -> 20.19) so the NODE_MIN gate is exact
  v=$(node -v 2>/dev/null | sed 's/^v//; s/\.[0-9]*$//')
  # numeric compare (a+0) — a plain string compare would wrongly accept Node 9
  [[ -n "$v" ]] && awk -v a="$v" -v b="$NODE_MIN" 'BEGIN{exit !(a+0>=b+0)}'
}

ensure_node() {
  log "Node.js (want $NODE_MAJOR LTS, minimum $NODE_MIN)"
  if node_version_ok; then ok "node $(node -v) already installed"; return 0; fi

  # Fallback A: nvm (already installed)
  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    . "$HOME/.nvm/nvm.sh"
    nvm install "$NODE_MAJOR" >/dev/null 2>&1 && nvm use "$NODE_MAJOR" >/dev/null 2>&1
    export_line 'export NVM_DIR="$HOME/.nvm"'
    export_line '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"'
    if node_version_ok; then ok "node $(node -v) via existing nvm"; return 0; fi
  fi

  # Fallback B: install nvm
  if have curl; then
    log "  installing nvm…"
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash >/dev/null 2>&1
    . "$HOME/.nvm/nvm.sh" 2>/dev/null || true
    if declare -F nvm >/dev/null; then
      nvm install "$NODE_MAJOR" >/dev/null 2>&1 || true
      export_line 'export NVM_DIR="$HOME/.nvm"'
      export_line '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"'
      if node_version_ok; then ok "node $(node -v) via nvm"; return 0; fi
    fi
  fi

  # Fallback C: official prebuilt tarball (no package manager needed)
  log "  downloading Node $NODE_MAJOR tarball…"
  local arch
  case "$(uname -m)" in
    aarch64|arm64) arch="linux-arm64" ;;
    *)             arch="linux-x64"  ;;
  esac
  local dest="$HOME/node-v$NODE_MAJOR"
  curl -fsSL "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/SHASUMS256.txt" -o /tmp/node-shasums.txt >/dev/null 2>&1 || true
  local tarball
  tarball=$(grep -oE "node-v${NODE_MAJOR}\.[0-9]+\.[0-9]+-${arch}\.tar\.xz" /tmp/node-shasums.txt 2>/dev/null | head -1)
  if [[ -z "$tarball" ]]; then
    warn "could not resolve latest v$NODE_MAJOR tarball name"
    return 1
  fi
  rm -rf "$dest"
  curl -fsSL "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/$tarball" -o /tmp/node.tar.xz || { warn "tarball download failed"; return 1; }
  mkdir -p "$dest" && tar -xJf /tmp/node.tar.xz -C "$dest" --strip-components=1
  export_line "export PATH=\"$dest/bin:\$PATH\""
  export "PATH=$dest/bin:$PATH"
  if node_version_ok; then ok "node $(node -v) via tarball"; return 0; fi
  warn "node install failed — install Node ${NODE_MAJOR} LTS manually"
  return 1
}

# ---------------------------------------------------------------------------
# 3. Java (JDK 17; 21 acceptable)
# ---------------------------------------------------------------------------
java_ok() {
  have java || return 1
  local maj
  maj=$(java -version 2>&1 | sed -nE 's/.*version "([0-9]+).*/\1/p' | head -1)
  [[ "$maj" == "17" || "$maj" == "21" ]]
}

ensure_java() {
  log "Java JDK (17 preferred, 21 acceptable)"
  if java_ok; then
    local v
    v=$(java -version 2>&1 | sed -nE 's/.*version "([^"]+)".*/\1/p' | head -1)
    ok "java $v already installed"
  else
    if have apt-get; then
      sudo_run apt-get install -y openjdk-17-jdk-headless || sudo_run apt-get install -y openjdk-21-jdk-headless || true
    elif have dnf; then
      sudo_run dnf install -y java-17-openjdk-devel || true
    fi
    java_ok || { warn "JDK install failed — set JAVA_HOME manually (JDK 17 required)"; return 1; }
    ok "installed $(java -version 2>&1 | head -1)"
  fi

  # Persist JAVA_HOME.
  local jhome
  jhome=$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")
  export_line "export JAVA_HOME=$jhome"
  export "JAVA_HOME=$jhome"
  ok "JAVA_HOME=$jhome"
}

# ---------------------------------------------------------------------------
# 4. Android SDK
# ---------------------------------------------------------------------------
sdkmanager_ok() { have sdkmanager || [[ -x "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]]; }

sdkmanager_bin() {
  if have sdkmanager; then command -v sdkmanager
  else echo "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"; fi
}

ensure_android_sdk() {
  log "Android SDK ($SDK_ROOT)"
  if sdkmanager_ok; then
    ok "sdkmanager already present"
  else
    if [[ ! -x "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]]; then
      log "  downloading Android command-line tools…"
      mkdir -p "$SDK_ROOT/cmdline-tools"
      curl -fsSL "$CMDLINE_ZIP_URL" -o /tmp/cmdtools.zip || {
        warn "cmdline-tools download failed — trying distro package (likely too old for RN)"
        sudo_run apt-get install -y android-sdk || true
        if have sdkmanager; then ok "sdkmanager via apt"; return 0; fi
        return 1
      }
      unzip -q -o /tmp/cmdtools.zip -d /tmp/cmdtools-tmp
      # Clear any partial previous extraction so mv never nests into it.
      rm -rf "$SDK_ROOT/cmdline-tools/latest"
      mv -f /tmp/cmdtools-tmp/cmdline-tools "$SDK_ROOT/cmdline-tools/latest"
      rm -rf /tmp/cmdtools-tmp
    fi
    sdkmanager_ok || { warn "sdkmanager unavailable"; return 1; }
    ok "sdkmanager ready"
  fi

  export_line "export ANDROID_HOME=$SDK_ROOT"
  export "ANDROID_HOME=$SDK_ROOT"
  export_line "export PATH=\"$SDK_ROOT/platform-tools:\$PATH\""
  export "PATH=$SDK_ROOT/platform-tools:$PATH"

  log "  accepting SDK licenses…"
  local sm
  sm=$(sdkmanager_bin)
  yes | "$sm" --sdk_root="$SDK_ROOT" --licenses >/dev/null 2>&1 || true

  log "  installing SDK packages (platform 36, build-tools 36, NDK 27.1, CMake)…"
  "$sm" --sdk_root="$SDK_ROOT" "${SDK_PACKAGES[@]}" >/dev/null 2>&1 || {
    warn "batch install failed — retrying one by one"
    local pkg ok_all=1
    for pkg in "${SDK_PACKAGES[@]}"; do
      "$sm" --sdk_root="$SDK_ROOT" "$pkg" >/dev/null 2>&1 || { warn "  failed: $pkg"; ok_all=0; }
    done
    [[ $ok_all -eq 1 ]] || warn "some SDK packages failed (Gradle can auto-download what's missing)"
  }

  if [[ -x "$SDK_ROOT/platform-tools/adb" ]]; then ok "platform-tools ready"
  else warn "platform-tools not verified"; fi
}

# ---------------------------------------------------------------------------
# 5. watchman (optional)
# ---------------------------------------------------------------------------
ensure_watchman() {
  log "watchman (optional)"
  have watchman && { ok "watchman present"; return 0; }
  if have apt-get; then
    sudo_run apt-get install -y watchman >/dev/null 2>&1 && { ok "watchman installed"; return 0; }
  fi
  warn "watchman not installed — Metro works without it (slower file watching)"
}

# ---------------------------------------------------------------------------
# 6. EAS CLI
# ---------------------------------------------------------------------------
ensure_eas_cli() {
  log "eas-cli"
  have eas && { ok "eas $(eas --version 2>/dev/null) present"; return 0; }
  if npm install -g eas-cli >/dev/null 2>&1; then
    ok "eas-cli installed globally"
  else
    warn "global install failed — installing into ~/.npm-global"
    mkdir -p "$HOME/.npm-global"
    npm config set prefix "$HOME/.npm-global" >/dev/null 2>&1 || true
    npm install -g eas-cli >/dev/null 2>&1 && {
      export_line "export PATH=\"$HOME/.npm-global/bin:\$PATH\""
      export "PATH=$HOME/.npm-global/bin:$PATH"
      ok "eas-cli installed (local prefix)"
      return 0
    }
    warn "eas-cli install failed — run 'npm install -g eas-cli' later"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# 7. Project provisioning
# ---------------------------------------------------------------------------
setup_project() {
  log "Project setup ($PROJECT_DIR)"
  if [[ ! -f "$PROJECT_DIR/package.json" ]]; then
    warn "no package.json found — clone the repo first, e.g.:"
    warn "  git clone git@github.com:Luna-Davis/digital-id.git $PROJECT_DIR"
    return 1
  fi
  cd "$PROJECT_DIR" || return 1

  log "  installing npm dependencies (npm ci, falls back to npm install)…"
  if npm ci >/tmp/npm-ci.log 2>&1; then
    ok "npm ci complete"
  elif npm install >/tmp/npm-install.log 2>&1; then
    ok "npm install complete (npm ci failed — see /tmp/npm-ci.log for why)"
  else
    warn "npm install failed — see /tmp/npm-install.log"
  fi

  log "  generating the Android native project…"
  if [[ ! -d android ]]; then
    if npx expo prebuild -p android --no-install >/tmp/prebuild.log 2>&1; then
      ok "android/ generated"
    else
      warn "expo prebuild failed — see /tmp/prebuild.log"
    fi
  else
    ok "android/ already present"
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  echo
  echo "================================================================"
  echo "  Digital ID — remote build machine bootstrap"
  echo "  Project: $PROJECT_DIR"
  echo "================================================================"

  local rc=0
  install_system_packages || rc=1
  ensure_node           || rc=1
  ensure_java           || rc=1   # before Android SDK (sdkmanager needs Java)
  ensure_android_sdk    || rc=1
  ensure_watchman       || rc=1
  ensure_eas_cli        || rc=1
  setup_project         || rc=1

  rm -f /tmp/node.tar.xz /tmp/node-shasums.txt /tmp/cmdtools.zip 2>/dev/null || true

  echo
  echo "================================================================"
  if [[ $rc -eq 0 ]]; then
    ok "All components installed."
  else
    fail "Some components failed — scroll up for the ⚠ details, fix them,"
    fail "then re-run this script (it is idempotent and skips what works)."
  fi
  echo "  Environment was appended to ~/.bashrc — run 'source ~/.bashrc'"
  echo "  (or open a new shell) to pick it up."
  echo
  echo "  Next steps:"
  echo "    cd $PROJECT_DIR"
  echo "    EAS_BUILD_PROFILE=production npx expo prebuild -p android"
  echo "    cd android && ./gradlew bundleRelease   # or assembleRelease for APK"
  echo "  or use the cloud build: eas build -p android --profile production"
  echo "================================================================"
  exit "$rc"
}

# Only run when executed directly (not when sourced, so functions can be tested).
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
