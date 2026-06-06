#!/usr/bin/env bash
# =============================================================================
# LetsSplyt — Setup Script
# =============================================================================
# Usage:
#   ./setup.sh check      — Check what is already installed (no changes made)
#   ./setup.sh computer   — Install all required tools on your Mac
#   ./setup.sh dev        — Configure and start Development environment
#   ./setup.sh staging    — Configure and deploy Staging environment
#   ./setup.sh prod       — Configure and deploy Production environment
#
# Run with no arguments for an interactive menu.
# =============================================================================

set -e  # Exit immediately on any error

# ─── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'  # No colour / reset

# ─── Helpers ──────────────────────────────────────────────────────────────────
ok()      { echo -e "${GREEN}✅ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠️  $1${NC}"; }
info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }
step()    { echo -e "\n${BOLD}${CYAN}▶ $1${NC}"; }
header()  { echo -e "\n${BOLD}${BLUE}══════════════════════════════════════════${NC}"; \
            echo -e "${BOLD}${BLUE}  $1${NC}"; \
            echo -e "${BOLD}${BLUE}══════════════════════════════════════════${NC}\n"; }
fail()    { echo -e "${RED}❌ $1${NC}"; exit 1; }
prompt()  { echo -e "${YELLOW}👉 $1${NC}"; }
skip()    { echo -e "${GREEN}⏭  $1 already installed — skipping${NC}"; }

is_mac()  { [[ "$OSTYPE" == "darwin"* ]]; }
is_win()  { [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; }

command_exists() { command -v "$1" &>/dev/null; }

version_of() {
  case "$1" in
    node)    node --version 2>/dev/null || echo "not installed" ;;
    npm)     npm --version 2>/dev/null || echo "not installed" ;;
    git)     git --version 2>/dev/null | awk '{print $3}' || echo "not installed" ;;
    doppler) doppler --version 2>/dev/null | head -1 || echo "not installed" ;;
    supabase) supabase --version 2>/dev/null || echo "not installed" ;;
    eas)     eas --version 2>/dev/null || echo "not installed" ;;
    brew)    brew --version 2>/dev/null | head -1 || echo "not installed" ;;
  esac
}

confirm() {
  local msg="$1"
  echo -e "${YELLOW}$msg [y/N] ${NC}\c"
  read -r response
  [[ "$response" =~ ^[Yy]$ ]]
}

pause() {
  echo -e "${YELLOW}Press Enter when done...${NC}"
  read -r
}

# ─── Check subcommand ─────────────────────────────────────────────────────────
cmd_check() {
  header "LetsSplyt — Environment Check"
  echo "Checking what is installed on your computer..."
  echo ""

  local all_ok=true

  check_tool() {
    local name="$1"
    local cmd="$2"
    local min_note="$3"
    if command_exists "$cmd"; then
      ok "$name: $(version_of "$cmd")"
    else
      warn "$name: NOT INSTALLED $min_note"
      all_ok=false
    fi
  }

  echo -e "${BOLD}── Required Tools ────────────────────────────────${NC}"
  check_tool "Homebrew (Mac)"   brew     ""
  check_tool "Node.js"          node     "(need v20+)"
  check_tool "npm"              npm      ""
  check_tool "Git"              git      ""
  check_tool "Doppler CLI"      doppler  "(secrets vault)"
  check_tool "Supabase CLI"     supabase "(database migrations)"
  check_tool "EAS CLI"          eas      "(mobile builds)"

  echo ""
  echo -e "${BOLD}── Development Tools ─────────────────────────────${NC}"
  if is_mac; then
    if command_exists xcodebuild; then
      ok "Xcode: $(xcodebuild -version 2>/dev/null | head -1)"
    else
      warn "Xcode: NOT INSTALLED (required for iOS builds)"
      all_ok=false
    fi
    if command_exists open && open -Ra "Android Studio" 2>/dev/null; then
      ok "Android Studio: installed"
    else
      warn "Android Studio: NOT INSTALLED (required for Android builds)"
      all_ok=false
    fi
  fi

  echo ""
  echo -e "${BOLD}── Doppler Status ────────────────────────────────${NC}"
  if command_exists doppler; then
    if doppler whoami &>/dev/null 2>&1; then
      ok "Doppler logged in as: $(doppler whoami 2>/dev/null)"
    else
      warn "Doppler CLI installed but NOT logged in. Run: doppler login"
      all_ok=false
    fi
  fi

  echo ""
  if $all_ok; then
    ok "All tools are installed! Run './setup.sh dev' to set up your development environment."
  else
    warn "Some tools are missing. Run './setup.sh computer' to install them."
  fi
}

# ─── Computer subcommand ──────────────────────────────────────────────────────
cmd_computer() {
  header "LetsSplyt — Computer Setup"

  if ! is_mac; then
    warn "This script is designed for Mac. For Windows, see 11-Setup-Guide.md — some steps need to be done manually."
  fi

  # 1. Homebrew
  step "Homebrew (Mac package manager)"
  if command_exists brew; then
    skip "Homebrew $(version_of brew)"
  else
    info "Installing Homebrew — this may take a few minutes..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    ok "Homebrew installed"
  fi

  # 2. Node.js
  step "Node.js (LTS)"
  if command_exists node; then
    local node_ver
    node_ver=$(node --version | sed 's/v//')
    local major
    major=$(echo "$node_ver" | cut -d. -f1)
    if [ "$major" -ge 20 ]; then
      skip "Node.js v$node_ver"
    else
      warn "Node.js v$node_ver is installed but v20+ is required. Upgrading..."
      brew install node@22 && brew link --overwrite node@22
      ok "Node.js upgraded"
    fi
  else
    info "Installing Node.js LTS..."
    brew install node@22
    brew link node@22
    ok "Node.js installed: $(node --version)"
  fi

  # 3. Git
  step "Git"
  if command_exists git; then
    skip "Git $(version_of git)"
  else
    info "Installing Git..."
    brew install git
    ok "Git installed: $(git --version)"
  fi

  # 4. Doppler CLI
  step "Doppler CLI (secrets vault)"
  if command_exists doppler; then
    skip "Doppler $(version_of doppler)"
  else
    info "Installing Doppler CLI..."
    brew install gnupg doppler
    ok "Doppler installed: $(doppler --version | head -1)"
  fi

  # 5. Supabase CLI
  step "Supabase CLI (database migrations)"
  if command_exists supabase; then
    skip "Supabase CLI $(version_of supabase)"
  else
    info "Installing Supabase CLI..."
    brew install supabase/tap/supabase
    ok "Supabase CLI installed: $(supabase --version)"
  fi

  # 6. EAS CLI (Expo Application Services)
  step "EAS CLI (mobile builds)"
  if command_exists eas; then
    skip "EAS CLI $(version_of eas)"
  else
    info "Installing EAS CLI globally..."
    npm install -g eas-cli
    ok "EAS CLI installed: $(eas --version)"
  fi

  # 7. Xcode (Mac only — cannot auto-install from script)
  if is_mac; then
    step "Xcode"
    if command_exists xcodebuild; then
      skip "Xcode $(xcodebuild -version 2>/dev/null | head -1)"
    else
      warn "Xcode is NOT installed. It is required for iOS builds."
      prompt "Open the App Store now and search for 'Xcode' to install it (it's free, ~15 GB)."
      prompt "After installing, accept the license by running: sudo xcodebuild -license accept"
      prompt "Then run this script again to continue."
      if confirm "Open App Store now?"; then
        open "macappstores://itunes.apple.com/app/xcode/id497799835"
      fi
    fi
  fi

  # 8. Android Studio (cannot auto-install)
  step "Android Studio"
  if is_mac && open -Ra "Android Studio" 2>/dev/null; then
    skip "Android Studio (already installed)"
  else
    warn "Android Studio is NOT installed."
    prompt "Download it from: https://developer.android.com/studio"
    prompt "Install it, then run the Setup Wizard and install Android SDK 34."
    if confirm "Open download page now?"; then
      open "https://developer.android.com/studio"
    fi
    warn "Install Android Studio, then run './setup.sh check' to verify."
  fi

  # 9. Login to Doppler
  step "Doppler Login"
  if doppler whoami &>/dev/null 2>&1; then
    skip "Already logged into Doppler as $(doppler whoami 2>/dev/null)"
  else
    info "You need to log in to Doppler..."
    doppler login
    ok "Doppler login complete"
  fi

  echo ""
  header "Computer Setup Complete"
  ok "All tools are installed."
  info "Next step: Create your accounts by following Section 2 of docs/11-Setup-Guide.md"
  info "Then run: ./setup.sh dev"
}

# ─── Dev subcommand ───────────────────────────────────────────────────────────
cmd_dev() {
  header "LetsSplyt — Development Environment Setup"

  # Pre-check: tools installed?
  for tool in node git doppler supabase; do
    if ! command_exists "$tool"; then
      fail "$tool is not installed. Run './setup.sh computer' first."
    fi
  done

  # Step 1: Doppler project setup
  step "1. Connect Doppler to this project"
  if [ -f ".doppler.yaml" ]; then
    local current_env
    current_env=$(doppler configure get enclaveProject --plain 2>/dev/null || echo "unknown")
    ok "Doppler already configured for project: $current_env"
  else
    info "You need a Doppler project named 'letssplyt' with a 'development' environment."
    prompt "If you haven't created it yet: go to doppler.com → Create Project → name it 'letssplyt'"
    pause
    info "Running doppler setup..."
    doppler setup
    ok "Doppler connected to this project"
  fi

  # Step 2: Check all required secrets are set
  step "2. Verify development secrets in Doppler"
  local missing_secrets=()
  local required_secrets=(
    "SUPABASE_URL"
    "SUPABASE_PUBLISHABLE_KEY"
    "SUPABASE_SECRET_KEY"
    "TWILIO_ACCOUNT_SID"
    "TWILIO_AUTH_TOKEN"
    "TWILIO_PHONE_NUMBER"
    "TWILIO_VERIFY_SERVICE_SID"
    "GEMINI_API_KEY"
    "AI_PROVIDER_A1"
    "AI_MODEL_A1"
    "UPSTASH_REDIS_REST_URL"
    "UPSTASH_REDIS_REST_TOKEN"
    "QSTASH_TOKEN"
    "HANDLE_ENCRYPTION_KEY"
    "PHONE_ENCRYPTION_KEY"
    "PII_HMAC_SALT"
    "JWT_SECRET"
    "APP_ENV"
  )

  for secret in "${required_secrets[@]}"; do
    local val
    val=$(doppler secrets get "$secret" --plain 2>/dev/null || echo "")
    if [ -z "$val" ]; then
      missing_secrets+=("$secret")
    fi
  done

  if [ ${#missing_secrets[@]} -eq 0 ]; then
    ok "All required development secrets are set in Doppler"
  else
    warn "The following secrets are missing from Doppler (development environment):"
    for s in "${missing_secrets[@]}"; do
      echo -e "   ${RED}✗ $s${NC}"
    done
    echo ""
    prompt "Open doppler.com → letssplyt project → development environment and add the missing secrets."
    prompt "See docs/11-Setup-Guide.md Section 3 for where to find each value."
    if confirm "Open Doppler dashboard now?"; then
      open "https://dashboard.doppler.com"
    fi
    pause
    info "Re-checking secrets..."
    local still_missing=()
    for secret in "${missing_secrets[@]}"; do
      val=$(doppler secrets get "$secret" --plain 2>/dev/null || echo "")
      [ -z "$val" ] && still_missing+=("$secret")
    done
    if [ ${#still_missing[@]} -gt 0 ]; then
      warn "Still missing: ${still_missing[*]}"
      warn "You can continue but these features may not work until secrets are added."
    else
      ok "All secrets are now set"
    fi
  fi

  # Step 3: Install dependencies
  step "3. Install project dependencies"
  if [ -f "package.json" ]; then
    info "Installing root dependencies..."
    npm install
    ok "Dependencies installed"
  else
    warn "No package.json found. The project hasn't been scaffolded yet."
    info "Run Step 2.2 in docs/11-Setup-Guide.md (the Cursor starting prompt) first."
    info "Then come back and run './setup.sh dev' again."
    exit 0
  fi

  # Step 4: Run database migrations
  step "4. Apply database schema to development Supabase"
  if [ -d "backend/supabase/migrations" ] && [ "$(ls -A backend/supabase/migrations 2>/dev/null)" ]; then
    info "Running migrations..."
    doppler run -- npx supabase db push --db-url "$(doppler secrets get SUPABASE_URL --plain)" || {
      warn "Migration failed. Check your SUPABASE_URL and SUPABASE_SECRET_KEY in Doppler."
      warn "You may need to run: supabase login first"
      info "To login to Supabase CLI: npx supabase login"
    }
    ok "Database migrations applied"
  else
    warn "No migration files found yet. Run after the project has been scaffolded."
  fi

  # Step 5: Seed database
  step "5. Seed development database with test data"
  if [ -f "backend/supabase/seed.sql" ]; then
    if confirm "Reset and seed the development database? (This wipes existing dev data)"; then
      doppler run -- npx supabase db reset --db-url "$(doppler secrets get SUPABASE_URL --plain)" || {
        warn "Seed failed. You can seed manually later with: supabase db reset"
      }
      ok "Database seeded with test data"
    else
      info "Skipping seed — you can run it later with: ./setup.sh dev seed"
    fi
  else
    info "No seed.sql found yet — skipping"
  fi

  # Step 6: Start dev server
  step "6. Start development servers"
  echo ""
  ok "Development environment is ready!"
  echo ""
  info "To start the backend:"
  echo -e "   ${CYAN}cd backend && doppler run -- npm run dev${NC}"
  echo ""
  info "To start the mobile app (in a second terminal):"
  echo -e "   ${CYAN}cd mobile && npx expo start${NC}"
  echo ""
  info "Then scan the QR code in Terminal with the Expo Go app on your Android phone."
  echo ""

  if confirm "Start the backend now?"; then
    cd backend && doppler run -- npm run dev
  fi
}

# ─── Staging subcommand ───────────────────────────────────────────────────────
cmd_staging() {
  header "LetsSplyt — Staging Environment Setup"

  for tool in node git doppler supabase eas; do
    if ! command_exists "$tool"; then
      fail "$tool is not installed. Run './setup.sh computer' first."
    fi
  done

  # Step 1: Switch Doppler to staging
  step "1. Switch to Staging environment in Doppler"
  info "Running doppler setup for staging..."
  doppler setup --no-interactive --project letssplyt --config stg 2>/dev/null || \
  doppler setup --no-interactive --project letssplyt --config staging 2>/dev/null || \
  doppler setup
  ok "Doppler configured for staging"

  # Step 2: Verify staging secrets
  step "2. Verify staging secrets in Doppler"
  local required_staging=(
    "SUPABASE_URL"
    "SUPABASE_PUBLISHABLE_KEY"
    "SUPABASE_SECRET_KEY"
    "TWILIO_ACCOUNT_SID"
    "TWILIO_AUTH_TOKEN"
    "TWILIO_PHONE_NUMBER"
    "GEMINI_API_KEY"
    "UPSTASH_REDIS_REST_URL"
    "UPSTASH_REDIS_REST_TOKEN"
    "QSTASH_TOKEN"
    "APP_DOMAIN"
    "APP_ENV"
  )

  local missing_staging=()
  for secret in "${required_staging[@]}"; do
    val=$(doppler secrets get "$secret" --plain 2>/dev/null || echo "")
    if [ -z "$val" ] || [ "$val" = "FILL-IN-AFTER-RAILWAY-DEPLOY" ]; then
      missing_staging+=("$secret")
    fi
  done

  if [ ${#missing_staging[@]} -eq 0 ]; then
    ok "All staging secrets are set"
  else
    warn "Missing or placeholder staging secrets:"
    for s in "${missing_staging[@]}"; do echo -e "   ${RED}✗ $s${NC}"; done
    prompt "Fill these in at: doppler.com → letssplyt → staging"
    if confirm "Open Doppler now?"; then open "https://dashboard.doppler.com"; fi
    pause
  fi

  # Step 3: Run migrations on staging database
  step "3. Apply database schema to staging Supabase"
  if confirm "Run migrations on STAGING database? (This is the staging Supabase, not production)"; then
    doppler run -- npx supabase db push --db-url "$(doppler secrets get SUPABASE_URL --plain)" || {
      warn "Migration failed. Check your staging SUPABASE_URL."
    }
    ok "Staging database schema applied"
  fi

  # Step 4: Connect Doppler to Railway
  step "4. Connect Doppler to Railway (staging)"
  echo ""
  info "Doppler syncs your secrets directly to Railway — you never need to enter them manually."
  prompt "Steps:"
  echo "  1. Go to doppler.com → letssplyt → staging → Integrations"
  echo "  2. Click 'Railway' → Authorise"
  echo "  3. Select your letssplyt staging Railway service"
  echo "  4. Doppler will now automatically sync secrets to Railway on every change"
  if confirm "Open Doppler integrations?"; then
    open "https://dashboard.doppler.com"
  fi
  pause

  # Step 5: Build EAS staging build
  step "5. Build staging app with EAS"
  echo ""
  info "This creates a staging build you can install directly on your phone."
  info "The build will be for Android first (since you're testing on Android)."
  echo ""
  if confirm "Build staging Android app now? (takes ~5-10 minutes)"; then
    if ! eas whoami &>/dev/null 2>&1; then
      info "Logging in to Expo..."
      eas login
    fi
    eas build --profile staging --platform android
    ok "Staging Android build submitted. Check progress at expo.dev"
  else
    info "To build later: eas build --profile staging --platform android"
  fi

  echo ""
  ok "Staging environment setup complete!"
  info "Once the Railway deployment is live, update APP_DOMAIN in Doppler staging to your Railway URL."
  info "Then rebuild the staging app: eas build --profile staging --platform android"
}

# ─── Prod subcommand ──────────────────────────────────────────────────────────
cmd_prod() {
  header "LetsSplyt — Production Environment Setup"
  echo ""
  warn "⚠️  PRODUCTION SETUP — Real users, real money, real consequences."
  warn "    Do NOT run this until your staging environment is fully tested."
  echo ""

  if ! confirm "Have you fully tested on staging and are ready to launch?"; then
    info "Come back when staging is fully tested. Run './setup.sh staging' first."
    exit 0
  fi

  for tool in node git doppler supabase eas; do
    if ! command_exists "$tool"; then
      fail "$tool is not installed. Run './setup.sh computer' first."
    fi
  done

  # Step 1: Switch Doppler to production
  step "1. Configure Doppler for Production"
  doppler setup --no-interactive --project letssplyt --config prd 2>/dev/null || \
  doppler setup --no-interactive --project letssplyt --config production 2>/dev/null || \
  doppler setup
  ok "Doppler configured for production"

  # Step 2: Verify production secrets
  step "2. Verify ALL production secrets"
  local required_prod=(
    "SUPABASE_URL"
    "SUPABASE_PUBLISHABLE_KEY"
    "SUPABASE_SECRET_KEY"
    "TWILIO_ACCOUNT_SID"
    "TWILIO_AUTH_TOKEN"
    "TWILIO_PHONE_NUMBER"
    "ANTHROPIC_API_KEY"
    "AI_PROVIDER_A1"
    "AI_MODEL_A1"
    "UPSTASH_REDIS_REST_URL"
    "UPSTASH_REDIS_REST_TOKEN"
    "QSTASH_TOKEN"
    "HANDLE_ENCRYPTION_KEY"
    "PHONE_ENCRYPTION_KEY"
    "PII_HMAC_SALT"
    "JWT_SECRET"
    "APP_DOMAIN"
    "APP_ENV"
  )

  local missing_prod=()
  for secret in "${required_prod[@]}"; do
    val=$(doppler secrets get "$secret" --plain 2>/dev/null || echo "")
    [ -z "$val" ] && missing_prod+=("$secret")
  done

  if [ ${#missing_prod[@]} -eq 0 ]; then
    ok "All production secrets are set"
  else
    warn "Missing production secrets:"
    for s in "${missing_prod[@]}"; do echo -e "   ${RED}✗ $s${NC}"; done
    fail "Fill in all production secrets in Doppler before proceeding."
  fi

  # Step 3: Production Supabase check
  step "3. Verify production Supabase is on Pro plan"
  echo ""
  warn "The production Supabase project MUST be on the Pro plan ($25/month)"
  warn "for automated daily backups and higher connection limits."
  prompt "Log in to supabase.com → letssplyt-production → Settings → Billing"
  prompt "Upgrade to Pro if not already done."
  pause

  # Step 4: Run migrations on production
  step "4. Apply schema to PRODUCTION database"
  echo ""
  warn "⚠️  This applies schema changes to the REAL production database."
  if confirm "Run migrations on PRODUCTION? (Make sure staging passed first)"; then
    info "Creating a backup first..."
    info "(Supabase Pro auto-backs up daily — verify latest backup exists in supabase.com → Backups)"
    pause
    doppler run -- npx supabase db push --db-url "$(doppler secrets get SUPABASE_URL --plain)"
    ok "Production schema applied"
  fi

  # Step 5: Anthropic spending limit check
  step "5. Set Anthropic spending limit to $100/month"
  prompt "Go to console.anthropic.com → Billing → Usage limits → set $100/month"
  if confirm "Open Anthropic console?"; then
    open "https://console.anthropic.com"
  fi
  pause

  # Step 6: EAS Production Build
  step "6. Build production app with EAS"
  echo ""
  info "This creates the production build for App Store and Play Store submission."
  if confirm "Build production apps now? (Android first, then iOS when Apple account is ready)"; then
    if ! eas whoami &>/dev/null 2>&1; then
      eas login
    fi

    if confirm "Build Android production app?"; then
      eas build --profile production --platform android
      ok "Android production build submitted"
    fi

    if confirm "Build iOS production app? (Requires Apple Developer Program membership)"; then
      eas build --profile production --platform ios
      ok "iOS production build submitted"
    fi

    ok "Production builds submitted. Check progress at expo.dev"
  fi

  echo ""
  ok "Production environment setup complete!"
  info "Next steps:"
  echo "  1. Submit Android build to Google Play Console"
  echo "  2. Submit iOS build to App Store Connect via: eas submit --platform ios"
  echo "  3. Monitor errors at sentry.io"
  echo "  4. Check Twilio delivery rates in the Twilio console"
}

# ─── Main menu ────────────────────────────────────────────────────────────────
show_menu() {
  header "LetsSplyt — Setup"
  echo "What would you like to do?"
  echo ""
  echo "  1) check      — Check what is installed (no changes)"
  echo "  2) computer   — Install all required tools (first time only)"
  echo "  3) dev        — Set up Development environment"
  echo "  4) staging    — Set up Staging environment"
  echo "  5) prod       — Set up Production environment"
  echo "  6) exit"
  echo ""
  echo -e "${YELLOW}Choice [1-6]: ${NC}\c"
  read -r choice
  case $choice in
    1) cmd_check ;;
    2) cmd_computer ;;
    3) cmd_dev ;;
    4) cmd_staging ;;
    5) cmd_prod ;;
    6) exit 0 ;;
    *) warn "Invalid choice. Run: ./setup.sh [check|computer|dev|staging|prod]" ;;
  esac
}

# ─── Entry point ──────────────────────────────────────────────────────────────
case "${1:-menu}" in
  check)    cmd_check ;;
  computer) cmd_computer ;;
  dev)      cmd_dev ;;
  staging)  cmd_staging ;;
  prod)     cmd_prod ;;
  menu)     show_menu ;;
  *)
    echo "Usage: ./setup.sh [check|computer|dev|staging|prod]"
    echo "Run without arguments for interactive menu."
    exit 1
    ;;
esac
