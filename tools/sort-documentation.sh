#!/bin/bash

# Script de Tri et Consolidation de la Documentation
# Organise les fichiers *.md et *.sh pour une structure optimale

set -e

echo "🗂️  Tri et Consolidation de la Documentation SocketCAN"
echo "======================================================="

# Couleurs pour l'affichage
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les actions
log_action() {
    echo -e "${GREEN}✅${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

log_info() {
    echo -e "${BLUE}ℹ️${NC} $1"
}

# 1. Consolidation des rapports
echo
echo "📊 1. Consolidation des Rapports"
echo "================================="

# Créer le répertoire des rapports consolidés s'il n'existe pas
mkdir -p docs/reports/archive

# Déplacer REORGANIZATION_REPORT.md
if [ -f "REORGANIZATION_REPORT.md" ]; then
    mv "REORGANIZATION_REPORT.md" "docs/reports/"
    log_action "REORGANIZATION_REPORT.md déplacé vers docs/reports/"
fi

# Déplacer le rapport de nettoyage des tests
if [ -f "tests/CLEANUP_REPORT.md" ]; then
    mv "tests/CLEANUP_REPORT.md" "docs/reports/"
    log_action "Tests CLEANUP_REPORT.md déplacé vers docs/reports/"
fi

# 2. Archivage des fichiers obsolètes
echo
echo "🗃️  2. Archivage des Fichiers Obsolètes"
echo "======================================="

# Créer le répertoire d'archive
mkdir -p archive

# Archiver README_OLD.md
if [ -f "README_OLD.md" ]; then
    mv "README_OLD.md" "archive/"
    log_action "README_OLD.md archivé"
fi

# Archiver le script de migration TypeScript (complété)
if [ -f "scripts/migrate-to-typescript.sh" ]; then
    mv "scripts/migrate-to-typescript.sh" "archive/"
    log_action "migrate-to-typescript.sh archivé (migration complétée)"
fi

# 3. Organisation des scripts shell
echo
echo "🔧 3. Validation des Scripts Shell"
echo "=================================="

# Vérifier que tous les scripts shell sont exécutables
find . -name "*.sh" -type f | while read script; do
    if [ ! -x "$script" ]; then
        chmod +x "$script"
        log_action "Permissions d'exécution ajoutées à $script"
    else
        log_info "Script $script déjà exécutable"
    fi
done

# 4. Création d'un index de documentation
echo
echo "📚 4. Création de l'Index de Documentation"
echo "=========================================="

cat > docs/INDEX.md << 'EOF'
# Index de la Documentation SocketCAN

## 📖 Documentation Principale
- [README.md](../README.md) - Documentation principale du projet
- [STRUCTURE.md](../STRUCTURE.md) - Structure du projet
- [PROJECT_INFO.md](../PROJECT_INFO.md) - Informations détaillées
- [ROADMAP.md](../ROADMAP.md) - Feuille de route

## 🔧 APIs et Techniques
- [TYPESCRIPT_API.md](TYPESCRIPT_API.md) - Documentation de l'API TypeScript
- [EVENT_GENERATOR_API.md](EVENT_GENERATOR_API.md) - API Event Generator

## 📊 Rapports et Historique
- [reports/FINAL_CLEANUP_REPORT.md](reports/FINAL_CLEANUP_REPORT.md) - Rapport final de nettoyage
- [reports/REORGANIZATION_REPORT.md](reports/REORGANIZATION_REPORT.md) - Rapport de réorganisation
- [reports/CLEANUP_REPORT.md](reports/CLEANUP_REPORT.md) - Rapport de nettoyage des tests
- [reports/archive/](reports/archive/) - Rapports legacy archivés

## 🚀 Déploiement
- [../scripts/deployment/LINUX_DEPLOYMENT.md](../scripts/deployment/LINUX_DEPLOYMENT.md) - Guide de déploiement Linux
- [../scripts/deployment/INSTALL_SSHPASS.md](../scripts/deployment/INSTALL_SSHPASS.md) - Installation SSH

## 📁 Documentation par Répertoire
- [../tests/README.md](../tests/README.md) - Tests
- [../examples/README.md](../examples/README.md) - Exemples
- [../tools/README.md](../tools/README.md) - Outils
- [../legacy/reports/README.md](../legacy/reports/README.md) - Rapports legacy

## 🗂️  Organisation
Cette documentation est organisée pour faciliter la navigation et la maintenance du projet SocketCAN Neon Rust.
EOF

log_action "Index de documentation créé dans docs/INDEX.md"

# 5. Nettoyage des fichiers temporaires de documentation
echo
echo "🧹 5. Nettoyage des Fichiers Temporaires"
echo "========================================"

# Rechercher et supprimer les fichiers .md~ (backups de vim/emacs)
find . -name "*.md~" -type f -delete 2>/dev/null && log_action "Fichiers de sauvegarde .md~ supprimés" || log_info "Aucun fichier .md~ trouvé"

# Rechercher et supprimer les fichiers .sh~ (backups de scripts)
find . -name "*.sh~" -type f -delete 2>/dev/null && log_action "Fichiers de sauvegarde .sh~ supprimés" || log_info "Aucun fichier .sh~ trouvé"

# 6. Mise à jour de .cleanignore
echo
echo "🔧 6. Mise à Jour de la Configuration"
echo "===================================="

# Ajouter des règles pour ignorer les fichiers temporaires
cat >> .cleanignore << 'EOF'

# Fichiers temporaires de documentation
*.md~
*.sh~
.DS_Store
Thumbs.db

# Archives
archive/

EOF

log_action "Configuration .cleanignore mise à jour"

# 7. Résumé final
echo
echo "📋 7. Résumé du Tri"
echo "==================="

echo "📊 Statistiques:"
echo "   📄 Fichiers .md trouvés: $(find . -name "*.md" -type f | wc -l)"
echo "   🔧 Scripts .sh trouvés: $(find . -name "*.sh" -type f | wc -l)"
echo "   📁 Répertoires docs/: $(find docs/ -type d | wc -l)"

echo
echo "🎉 TRI ET CONSOLIDATION TERMINÉS !"
echo "================================="
echo "✅ Rapports consolidés dans docs/reports/"
echo "✅ Fichiers obsolètes archivés"
echo "✅ Scripts validés et permissions correctes"
echo "✅ Index de documentation créé"
echo "✅ Configuration de nettoyage mise à jour"
echo
echo "💡 Prochaines étapes:"
echo "   1. Vérifiez docs/INDEX.md pour naviguer dans la documentation"
echo "   2. Consultez archive/ pour les fichiers archivés"
echo "   3. Validez que tous les scripts fonctionnent correctement"
