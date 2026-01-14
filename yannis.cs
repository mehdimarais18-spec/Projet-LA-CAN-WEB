using System;
using System.Text; 
using System.IO; 
using System.Collections.Generic;




class Phase1Projet
{
    
    
    // 1. Structure Passager
    public struct Passager//toutes les informations nécessaires à l'enregistrement d'une personne qui voyage
    {
        public string nom;
        public string prenom;
        public string codeCategorie; // Ex: "adu26p", "enf417"
    }

    // 2. Structure Vehicule
    public struct Vehicule
    {
        public string codeCategorie;
        public int quantite;
    }

    // 3. Structure Reservation 
    public struct Reservation//Cette structure est pour être la structure finale du projet, prête à être convertie en fichier JSON
    {
        public string nomClient;
        public string date;       // Format "2025-11-01"
        public string heure;      // Format "09:45"
        
        // Listes d'objets (Passager et Vehicule sont des types définis plus haut)
        public List<Passager> lesPassagers;
        public List<Vehicule> lesVehicules;
    }

    


    
}