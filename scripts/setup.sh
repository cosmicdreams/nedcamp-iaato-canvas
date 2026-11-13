#!/usr/bin/env bash
# Builds the IAATO Canvas demo from a fresh checkout. Safe to re-run except
# for site:install, which wipes the database (it asks first).
set -euo pipefail
cd "$(dirname "$0")/.."

ddev start
ddev composer install
# No --account-pass: Drush generates a random admin password; use the login link below.
ddev drush site:install standard --site-name=IAATO --account-name=admin
ddev drush pm:enable canvas -y
ddev drush theme:enable iaato -y
ddev drush config:set system.theme default iaato -y
# Canvas registers the theme's components as Canvas components on cache rebuild.
ddev drush cache:rebuild
ddev drush php:script scripts/configure-site.php
ddev drush php:script scripts/build-homepage.php
ddev drush php:script scripts/build-whales-page.php
ddev drush php:script scripts/build-whale-concept-pages.php
ddev drush cache:rebuild
echo "One-time admin login:"
ddev drush user:login
