// lien vers l'api
const API_URL = "https://can.iutrs.unistra.fr/api";


// grille des tarifs
const TARIFS = {
    GROIX: {
        PASSAGERS: { "adu26p": 18.75, "jeu1825": 13.80, "enf417": 11.25, "bebe": 0.0, "ancomp": 3.35 },
        VEHICULES: { "trot": 4.70, "velo": 8.20, "velelec": 11.00, "cartand": 16.45, "mobil": 23.10, "moto": 66.05, "cat1": 96.05, "cat2": 114.80, "cat3": 174.45, "cat4": 210.90, "camp": 330.20 }
    },
    BELLE_ILE: {
        PASSAGERS: { "adu26p": 18.80, "jeu1825": 14.10, "enf417": 11.65, "bebe": 0.0, "ancomp": 3.35 },
        VEHICULES: { "trot": 4.70, "velo": 8.20, "velelec": 11.00, "cartand": 16.45, "mobil": 23.35, "moto": 66.40, "cat1": 98.50, "cat2": 117.20, "cat3": 176.90, "cat4": 213.35, "camp": 332.70 }
    }
};


// les textes complets pour l'affichage
const LIBELLES = {
    "adu26p": "Adulte 26 ans et plus", "jeu1825": "Jeune 18 à 25 ans inclus", "enf417": "Enfant 4 à 17 ans inclus", "bebe": "Bébé moins de 4 ans", "ancomp": "Animal de compagnie",
    "trot": "Trottinette électrique", "velo": "Vélo", "velelec": "Vélo électrique", "cartand": "Vélo cargo ou tandem", "mobil": "Deux-roues motorisé", "moto": "Moto > 125cm3",
    "cat1": "Voiture < 4m", "cat2": "Voiture 4m à 4.39m", "cat3": "Voiture 4.40m à 4.79m", "cat4": "Voiture > 4.80m", "camp": "Camping-car"
};


let cartesGlobales = [];
let indexCarteActuelle = 0;
const cartesParPage = 2;


// fonction simple pour recuperer les donnees
function recupererDonnees(url) {
    return fetch(url)
        .then(function(response) {
            if (!response.ok) throw new Error("Erreur réseau");
            return response.json();
        });
}


// trouver le bon prix
function getPrix(code, liaisonId) {
    let grille = (liaisonId == 3 || liaisonId == 4) ? TARIFS.BELLE_ILE : TARIFS.GROIX;
    
    if (grille.PASSAGERS[code] !== undefined) return grille.PASSAGERS[code];
    if (grille.VEHICULES[code] !== undefined) return grille.VEHICULES[code];
    
    return 0;
}


// trouver le nom de la categorie
function getLibelle(code) {
    return LIBELLES[code] || code || "Autre";
}


// grosse fonction pour charger tout le detail d'une reservation
function getDetailsComplets(idSaisi) {
    return recupererDonnees(API_URL + '/reservation/' + idSaisi)
        .then(function(jsonRecu) {
            let infoResa = {}, passagers = [], vehicules = [], liaisonId = 1;
            let promessesP = [], promessesV = [];

            // cas 1 : si c'est le format c#
            if (Array.isArray(jsonRecu) && jsonRecu.length > 0 && jsonRecu[0].reservation) {
                const r = jsonRecu[0];
                liaisonId = r.reservation.idLiaison;

                let portDep = "";
                let portArr = "";
                
                // gestion des ports pour que ca colle au c#
                if (liaisonId == 1) { portDep = "Lorient"; portArr = "Groix"; }
                else if (liaisonId == 2) { portDep = "Groix"; portArr = "Lorient"; }
                else if (liaisonId == 3) { portDep = "Quiberon"; portArr = "Le Palais"; }
                else { portDep = "Le Palais"; portArr = "Quiberon"; }

                infoResa = {
                    nom: r.reservation.nom, 
                    date: r.reservation.date, 
                    heure: r.reservation.heure,
                    portDepart: portDep,
                    portArrivee: portArr
                };
                passagers = r.passagers || [];
                vehicules = r.vehicules || [];
                
                return { infoResa, passagers, vehicules, liaisonId };
            } 
            
            // cas 2 : si c'est l'api ecole
            else {
                infoResa = {
                    nom: jsonRecu.nom, date: jsonRecu.date, heure: jsonRecu.heure,
                    portDepart: jsonRecu.portDepart, portArrivee: jsonRecu.portArrivee
                };
                liaisonId = 1; 

                // on recupere les details passagers
                if (jsonRecu.nbPassagers > 0 && (!jsonRecu.passagers || jsonRecu.passagers.length === 0)) {
                    for (let i = 1; i <= jsonRecu.nbPassagers; i++) {
                        promessesP.push(recupererDonnees(API_URL + '/reservation/' + idSaisi + '/passager/' + i));
                    }
                } else { 
                    passagers = jsonRecu.passagers || []; 
                }

                // on recupere les details vehicules
                if (jsonRecu.nbVehicules > 0 && (!jsonRecu.vehicules || jsonRecu.vehicules.length === 0)) {
                    for (let i = 1; i <= jsonRecu.nbVehicules; i++) {
                        promessesV.push(recupererDonnees(API_URL + '/reservation/' + idSaisi + '/vehicule/' + i));
                    }
                } else { 
                    vehicules = jsonRecu.vehicules || []; 
                }

                // on attend toutes les reponses
                return Promise.all([Promise.all(promessesP), Promise.all(promessesV)])
                    .then(function(res) {
                        passagers = passagers.concat(res[0]);
                        vehicules = vehicules.concat(res[1]);
                        
                        // important : on convertit bien la quantite en chiffre
                        vehicules.forEach(function(v) { 
                            v.quantite = parseInt(v.quantite) || 1; 
                        });

                        return { infoResa, passagers, vehicules, liaisonId };
                    });
            }
        });
}


// --- page 1 : les cartes d'embarquement ---
const formCartes = document.getElementById('form-recherche');

if (formCartes) {
    formCartes.addEventListener('submit', function(e) {
        e.preventDefault(); 
        const idSaisi = document.getElementById('num-resa').value;
        const zoneCartes = document.getElementById('zone-cartes');
        const pagination = document.getElementById('pagination-controles');

        if (!idSaisi) { 
            zoneCartes.innerHTML = '<p>Veuillez saisir un numéro.</p>'; 
            return; 
        }
        
        zoneCartes.innerHTML = '<p>Chargement...</p>';
        if(pagination) pagination.style.display = 'none';

        getDetailsComplets(idSaisi).then(function(donnees) {
            cartesGlobales = [];
            indexCarteActuelle = 0;
            const { infoResa, passagers, vehicules, liaisonId } = donnees;

            // generation des cartes pour les passagers
            passagers.forEach(function(p) {
                let code = p.codeCategorie || p.libelleCategorie || "";
                let prix = p.price || p.prix || getPrix(code, liaisonId);
                let qte = parseInt(p.quantite) || 1;

                // si y'en a plusieurs on boucle
                for(let k=0; k < qte; k++) {
                    cartesGlobales.push({
                        type: 'PASSAGER', 
                        resa: infoResa,
                        detail: { 
                            nom: p.nom || infoResa.nom, 
                            prenom: p.prenom || "", 
                            categorie: getLibelle(code), 
                            prix: parseFloat(prix) 
                        }
                    });
                }
            });

            // generation des cartes pour les vehicules
            vehicules.forEach(function(v) {
                let code = v.codeCategorie || v.libelle || "";
                let qte = v.quantite; 
                let prix = v.prix || getPrix(code, liaisonId);
                
                for(let k=0; k < qte; k++) {
                    cartesGlobales.push({
                        type: 'VEHICULE', 
                        resa: infoResa,
                        detail: { 
                            categorie: getLibelle(code), 
                            prix: parseFloat(prix) 
                        }
                    });
                }
            });

            if (cartesGlobales.length > 0) {
                afficherPageCartes();
                if(pagination) pagination.style.display = 'block';
            } else { 
                zoneCartes.innerHTML = '<p>Aucune donnée.</p>'; 
            }

        }).catch(function() { 
            zoneCartes.innerHTML = '<p>Erreur.</p>'; 
        });
    });

    // boutons precedent et suivant
    const btnPrev = document.getElementById('btn-precedent');
    const btnNext = document.getElementById('btn-suivant');
    
    if(btnPrev) btnPrev.addEventListener('click', function() { 
        if(indexCarteActuelle > 0) { 
            indexCarteActuelle--; 
            afficherPageCartes(); 
        } 
    });
    
    if(btnNext) btnNext.addEventListener('click', function() { 
        if((indexCarteActuelle + 1) * cartesParPage < cartesGlobales.length) { 
            indexCarteActuelle++; 
            afficherPageCartes(); 
        } 
    });
}


function afficherPageCartes() {
    const zoneCartes = document.getElementById('zone-cartes');
    zoneCartes.innerHTML = '';
    const cartes = cartesGlobales.slice(indexCarteActuelle * cartesParPage, (indexCarteActuelle + 1) * cartesParPage);

    cartes.forEach(function(c) {
        let details = (c.type === 'PASSAGER') ? 
            `<tr><td>Nom</td><td>${c.detail.nom}</td></tr><tr><td>Prénom</td><td>${c.detail.prenom}</td></tr><tr><td>Catégorie</td><td>${c.detail.categorie}</td></tr>` : 
            `<tr><td>Catégorie</td><td>${c.detail.categorie}</td></tr>`;

        zoneCartes.innerHTML += `
        <article class="carte">
            <section class="carte-gauche">
                <header class="bloc-logo">
                    <img src="CAN.png" alt="Logo">
                    <div>Compagnie<br>Alsacienne de<br>Navigation</div>
                </header>
                <table class="tableau-gauche">
                    <tr><th>Départ</th><td>${c.resa.portDepart}</td></tr>
                    <tr><th>Arrivée</th><td>${c.resa.portArrivee}</td></tr>
                    <tr><th>Date</th><td>${c.resa.date}</td></tr>
                    <tr><th>Heure</th><td>${c.resa.heure}</td></tr>
                </table>
            </section>
            <section class="carte-droite">
                <h2>Carte d'embarquement</h2>
                <section class="ticket-blanc">
                    <div><strong>Réservation</strong> <strong>${c.resa.id || c.resa.nom}</strong></div>
                    <hr>
                    <p><strong>${c.type === 'PASSAGER' ? 'Passager' : 'Véhicule'}</strong></p>
                    <table class="tableau-details">
                        ${details}
                        <tr><td>Prix</td><td>${c.detail.prix.toFixed(2)} €</td></tr>
                    </table>
                </section>
            </section>
        </article>`;
    });
    document.getElementById('info-page').textContent = "Page " + (indexCarteActuelle + 1);
}


// --- page 2 : la facture ---
const formFacture = document.getElementById('form-recherche-facture');

if (formFacture) {
    formFacture.addEventListener('submit', function(e) {
        e.preventDefault();
        const idSaisi = document.getElementById('num-resa-facture').value;
        const msg = document.getElementById('message-statut');
        const blocFacture = document.getElementById('facture-contenu');

        blocFacture.style.display = 'none';

        if (!idSaisi) { 
            msg.textContent = "Veuillez saisir un numéro."; 
            return; 
        }
        
        msg.textContent = "Chargement...";

        getDetailsComplets(idSaisi).then(function(donnees) {
            const { infoResa, passagers, vehicules, liaisonId } = donnees;

            // on remplit les infos de la facture
            document.getElementById('fac-date-emission').textContent = new Date().toLocaleDateString('fr-FR');
            document.getElementById('fac-num-resa').textContent = idSaisi;
            document.getElementById('fac-nom').textContent = infoResa.nom;
            document.getElementById('fac-trajet').textContent = infoResa.portDepart + " - " + infoResa.portArrivee;
            document.getElementById('fac-date-depart').textContent = infoResa.date;
            document.getElementById('fac-heure-depart').textContent = infoResa.heure;

            let totalP = 0, tbodyP = document.getElementById('tbody-passagers');
            tbodyP.innerHTML = "";
            let groupesP = {};
            
            // calcul pour les passagers
            passagers.forEach(function(p) {
                let code = p.codeCategorie || p.libelleCategorie || "Autre";
                let lib = getLibelle(code);
                let qte = parseInt(p.quantite) || 1;
                
                if(!groupesP[lib]) groupesP[lib] = {nb:0, pu: parseFloat(p.price || p.prix || getPrix(code, liaisonId)), tot:0};
                
                groupesP[lib].nb += qte; 
                groupesP[lib].tot += (groupesP[lib].pu * qte);
            });

            for(let k in groupesP) {
                totalP += groupesP[k].tot;
                tbodyP.innerHTML += `<tr><td>${k}</td><td>${groupesP[k].nb}</td><td>${groupesP[k].pu.toFixed(2)} €</td><td>${groupesP[k].tot.toFixed(2)} €</td></tr>`;
            }
            document.getElementById('total-passagers').textContent = totalP.toFixed(2) + " €";


            let totalV = 0, tbodyV = document.getElementById('tbody-vehicules');
            tbodyV.innerHTML = "";
            let groupesV = {};

            // calcul pour les vehicules
            vehicules.forEach(function(v) {
                let code = v.codeCategorie || v.libelle || "Autre";
                let lib = getLibelle(code);
                let qte = v.quantite; 
                
                if(!groupesV[lib]) groupesV[lib] = {nb:0, pu: parseFloat(v.prix || getPrix(code, liaisonId)), tot:0};
                
                groupesV[lib].nb += qte;
                groupesV[lib].tot += (groupesV[lib].pu * qte);
            });

            for(let k in groupesV) {
                totalV += groupesV[k].tot;
                tbodyV.innerHTML += `<tr><td>${k}</td><td>${groupesV[k].nb}</td><td>${groupesV[k].pu.toFixed(2)} €</td><td>${groupesV[k].tot.toFixed(2)} €</td></tr>`;
            }
            document.getElementById('total-vehicules').textContent = totalV.toFixed(2) + " €";
            document.getElementById('fac-total-general').textContent = (totalP + totalV).toFixed(2) + " €";

            blocFacture.style.display = 'block';
            msg.textContent = "";

        }).catch(function() { 
            msg.textContent = "Erreur : Réservation introuvable."; 
        });
    });
}


// --- page 3 : le tableau de bord ---
const btnActualiser = document.getElementById('btn-actualiser');

if (btnActualiser) {
    const inputDate = document.getElementById('date-selection');
    if(inputDate) inputDate.value = "2025-11-24";

    btnActualiser.addEventListener('click', function() {
        const date = inputDate.value;
        const selectLiaison = document.getElementById('liaison-selection');
        const idLiaisonChoisie = selectLiaison ? selectLiaison.value : 1;
        
        const tbody = document.getElementById('corps-tableau');
        const table = document.getElementById('tableau-resultats');
        
        table.style.display = 'none';
        tbody.innerHTML = '<tr><td colspan="5">Chargement...</td></tr>';

        recupererDonnees(API_URL + '/liaison/' + idLiaisonChoisie + '/remplissage/' + date).then(function(data) {
            tbody.innerHTML = '';
            table.style.display = 'table';
            
            if (data.length === 0) { 
                tbody.innerHTML = '<tr><td colspan="5">Aucun trajet ce jour-là.</td></tr>'; 
                return; 
            }

            data.forEach(function(t) {
                // calcul des pourcentages de remplissage
                let capP = t.capacitePassagers;
                let resP = t.nbReservationPassagers;
                let pctP = (capP > 0) ? Math.round((resP / capP) * 100) : 0;

                let capV = t.capaciteVoitures;
                let resV = t.nbReservationVoitures;
                let pctV = (capV > 0) ? Math.round((resV / capV) * 100) : 0;
                
                // on definit la couleur pour les vehicules
                let classeCouleur = "vert"; 
                if (resV > capV) { classeCouleur = "jaune"; } 
                else if (pctV >= 75) { classeCouleur = "rouge"; } 
                else if (pctV >= 50) { classeCouleur = "orange"; } 

                // on definit l'etat global
                let texteEtat = "Disponible";
                if (resP >= capP || (capV > 0 && resV >= capV)) {
                    texteEtat = "Complet";
                }

                let nomBateau = t.bateau || "Breizh Nevez";

                // on ajoute la ligne au tableau
                tbody.innerHTML += `
                    <tr>
                        <td>${t.heure}</td>
                        <td>${nomBateau}</td>
                        <td>${t.nbReservationPassagers} / ${t.capacitePassagers} (${pctP}%)</td>
                        <td class="${classeCouleur}">${t.nbReservationVoitures} / ${t.capaciteVoitures} (${pctV}%)</td>
                        <td>${texteEtat}</td>
                    </tr>`;
            });

        }).catch(function() { 
            tbody.innerHTML = '<tr><td colspan="5">Erreur serveur</td></tr>'; 
            table.style.display = 'table'; 
        });
    });
}


// --- page 4 : les stats ---
const statP = document.getElementById('stat-passagers');

if (statP) {
    recupererDonnees(API_URL + '/liaison/1/chiffreAffaire').then(function(data) {
        document.getElementById('stat-passagers').textContent = data.passagers.nombre;
        document.getElementById('stat-vehicules').textContent = data.vehicules.quantite;
        document.getElementById('stat-ca').textContent = (data.passagers.chiffreAffaire + data.vehicules.chiffreAffaire).toFixed(2) + " €";
    }).catch(function() { 
        if(document.getElementById('stat-ca')) document.getElementById('stat-ca').textContent = "-"; 
    });
}