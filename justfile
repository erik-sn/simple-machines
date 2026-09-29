# Project commands (`just --list` shows everything). The standard verbs come
# from the template-managed template.just; add project recipes below the
# import, and override a recipe by redefining it here (the setting below is
# what lets a redefinition win instead of being an error).
set allow-duplicate-recipes := true

import 'template.just'
