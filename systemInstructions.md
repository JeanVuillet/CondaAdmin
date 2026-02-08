RÈGLES DE SORTIE : Utilisez Gemini 2.0 Flash. Fichiers complets. Tags [[[£ FILE: path £]]] content [[[£ END: path £]]]. Snippet unique.
relie apply.js pour bien comprendre le system.
REGLE D OR ABSOLUE: ENVOYER Une introduction
Puis LE CODE EN UN SEUL BLOC PRÉCÉDÉ DE ````ET SUIVIT DE ```` AFIN DE GÉNÉRÉ UNE SNIPETTE QUE JE POURRAIS COLLER DANS UPDATE.TXT TOUT CODE NON CONTENU DANS UNE SIPETTE UNIQUE SERA INUTILE TOKENS PERDUS
Enfin une conclusion

GOOGLE DRIVE UTILISE L INTELLIGENCE DE MON ADRESSE PERSO VUILLET.JEAN@GMAIL.COM MAIS TRAVAIL DANS LE GOOGLE PRO VUILLET.JEAN@CONDAMINE.EDU.EC


!!! EN MAJUSCULE CELLES QUI MARCHENT PAS OU LES BUGS
Liste des fonctionalités du site a ne surtout pas casser et a faire progresser
🛡️ 1. ESPACE ADMIN (Le Cœur du Système)
C'est la base de données et la structure de l'établissement.
Fonctionnalités Sanctuarisées (À ne pas casser) :

Gestion Utilisateurs admin uniquement.
Créer/Modifier/visualiser/Supprimer un Admin (Nom, Prénom, Email,Password ).
Créer/Modifier/visualiser/Supprimer une classe (ex: 6A) . Dans une classe voir la liste des élèves.
Créer/Modifier/visualiser/Supprimer un groupe (ex: 3C LVA Anglais).Dans un groupe voir la liste des élèves.
Créer/Modifier/visualiser/Supprimer un Professeur : Lui assigner ses Matières et ses Classes et ses Groupes (ex: 2A, 1D BFI).l'ensemble Prénom + Nom doit être une clé unique.
Créer/Modifier/Visualiser/Supprimer un Élève : Définir son Nomcomplet, Email, nom = première partie du mail, prénom = deuxième partie du mail,Email Parents, Classe principale et ses Groupes (Options). l'ensemble Prénom + Nom doit être une clé unique.
Importation Massive : Je peux importer des listes d'élèves via copier-coller (texte tableau) ou fichier CSV. L'IA doit parser les colonnes (Nom à partir de la premère partie de l'Email, Prénom à partir de la deuxième partie de lEmail, nomcomplet, Classe, Options, Email) automatiquement.