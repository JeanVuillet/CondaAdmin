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
Toute nouvelle connection doit commencer par la fenêtre d'authentification
Admins : Créer/Modifier(bouton edit)/zoom( bouton loupe)/Supprimer (bouton x) un Admin (Nom, Prénom, Email,Password ).l'ensemble Prénom + Nom doit être une clé unique. Les password doivent faire l'objet de hashage ( bcryptjs).
Classes : Créer/Modifier(bouton edit)/zoom( bouton loupe)/Supprimer (bouton x)/lister les èlèves(bouton élèves) une classe (ex: 6A) . Le nom de la classe doit être une clé unique. Dans une classe voir la liste des élèves.
Groupe : Créer/Modifier(bouton edit)/zoom( bouton loupe)/Supprimer (bouton x) un groupe (ex: 3C LVA Anglais).Dans un groupe voir la liste des élèves.Le nom du groupe doit être une clé unique
Professeur : Créer/Modifier(bouton edit)/zoom( bouton loupe)/Supprimer (bouton x)un Professeur :  Email, nom = première partie du mail, prénom = deuxième partie du mail,password qui doit faire l'objet de hashage ( bcryptjs).Lui assigner ses Matières et ses Classes et ses Groupes (ex: 2A, 1D BFI).l'ensemble Prénom + Nom doit être une clé unique.
Elèves :  Créer/Modifier(bouton edit)/zoom( bouton loupe)/Supprimer (bouton x) un Élève : Définir son Nomcomplet, Email, nom = première partie du mail, prénom = deuxième partie du mail,Email Parents, Classe principale et ses Groupes (Options). l'ensemble Prénom + Nom doit être une clé unique.
Importation Massive : Je peux importer des listes d'élèves a partir d'un fichier CSV dont le nom doit être Classe.cvs ( exemple "1D.csv"). Il faut vérifier que le nom du fichier correspond à la classe choisie. L'IA doit parser les colonnes automatiquement de la manière suivante :
EMAIL à partir de la colonne Email
LASTNAME à partir de la première partie de l'Email ( avant le .)
FIRSTNAME à partir de la deuxième partie de l'Email
FULLNAME à partir de la colonne élève
GENDER à partir de la première lettre de la colonne sexe
BIRTHDATE à partir de la colonne "Né(e) le"
PASSWORD initialiser avec BIRTHDATE au format jjmmaaaa
CURRENTCLASS à partir de la classe choisie
ASSIGNEDGROUPS : les groupes de l'élève sont à prendre dans les colonnes M (option 1), N (option 2), O (option 3), P seulement si le titre est "Autres options". Les groupes sont séparés par des virgules et le code groupe se construit de la manière suivante : classe + " "+ groupe,  exemple "1D ANGLAIS". Si un groupe n'existe pas dans CLASSROOMS, il faut le créer.
A la fin de l'import, il faut un compte rendu pour signaler les erreurs.


