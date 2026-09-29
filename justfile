# Project commands (`just --list` shows everything). The standard verbs come
# from the template-managed template.just; add project recipes below the
# import, and override a recipe by redefining it here (the setting below is
# what lets a redefinition win instead of being an error).
set allow-duplicate-recipes := true

import 'template.just'

# No unit tests in this project (PROJECT.md): the Playwright suite is the test gate.
test:
    @echo "test: no unit tests in this project (PROJECT.md); run just e2e"
