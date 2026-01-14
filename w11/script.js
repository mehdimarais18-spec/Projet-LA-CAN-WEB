const API_URL = "https://can.iutrs.unistra.fr/api";
const ID_LIAISON = 1;

// Variables globales
let toutesLesCartes = [];
let pageActuelle = 0;
const cartesParPage = 2;

// Fonction pour appeler l'API
async function appelerAPI(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Donnée introuvable");
    return await response.json();
}

// Gestion de la page Cartes d'embarquement
const formCartes = document.getElementById('form-recherche');

if (formCartes) {
    formCartes.addEventListener('submit', function(e) {
        e.preventDefault(); 
        const num = document.getElementById('num-resa').value;
        const zone = document.getElementById('zone-cartes');
        const pagination = document.getElementById('pagination-controles');
        
        zone.innerHTML = '<p>Recherche...</p>';
        if(pagination) pagination.style.display = 'none';

        appelerAPI(API_URL + '/reservation/' + num)
            .then(data => {
                toutesLesCartes = [];
                pageActuelle = 0;

                // Ajout des passagers
                if (data.nbPassagers > 0) {
                    for (let i = 1; i <= data.nbPassagers; i++) {
                        toutesLesCartes.push({
                            type: 'PASSAGER',
                            dataResa: data,
                            detail: {
                                nom: "Addams", 
                                prenom: "Mercredi",
                                categorie: "Jeune 18-25 ans",
                                prix: "13,80 €"
                            }
                        });
                    }
                }
                // Ajout des véhicules
                if (data.nbVehicules > 0) {
                    toutesLesCartes.push({
                        type: 'VEHICULE',
                        dataResa: data,
                        detail: {
                            categorie: "Catégorie 4",
                            nombre: "1",
                            prix: "210,90 €"
                        }
                    });
                }

                // Affichage
                if (toutesLesCartes.length > 0) {
                    afficherPage();
                    if(pagination) pagination.style.display = 'block';
                } else {
                    zone.innerHTML = '<p>Réservation vide.</p>';
                }
            })
            .catch(err => {
                zone.innerHTML = '<p style="color:red; font-weight:bold;">Erreur : Réservation introuvable</p>';
            });
    });

    // Pagination
    const btnPrev = document.getElementById('btn-precedent');
    const btnNext = document.getElementById('btn-suivant');

    if(btnPrev) {
        btnPrev.addEventListener('click', function() {
            if (pageActuelle > 0) {
                pageActuelle--;
                afficherPage();
            }
        });
    }

    if(btnNext) {
        btnNext.addEventListener('click', function() {
            if ((pageActuelle + 1) * cartesParPage < toutesLesCartes.length) {
                pageActuelle++;
                afficherPage();
            }
        });
    }
}

// Fonction d'affichage page par page
function afficherPage() {
    const zone = document.getElementById('zone-cartes');
    zone.innerHTML = '';

    const debut = pageActuelle * cartesParPage;
    const fin = debut + cartesParPage;
    const cartesAffichees = toutesLesCartes.slice(debut, fin);

    cartesAffichees.forEach(element => {
        genererCarteHTML(element.dataResa, element.type, element.detail, zone);
    });

    const infoPage = document.getElementById('info-page');
    if(infoPage) infoPage.textContent = "Page " + (pageActuelle + 1);
}

// Gestion de la page Facture
const formFacture = document.getElementById('form-recherche-facture');

if (formFacture) {
    formFacture.addEventListener('submit', function(e) {
        e.preventDefault();
        const num = document.getElementById('num-resa-facture').value;
        const zone = document.getElementById('zone-facture');

        zone.innerHTML = '<p>Chargement...</p>';

        appelerAPI(API_URL + '/reservation/' + num)
            .then(data => {
                genererFactureHTML(data, zone);
            })
            .catch(err => {
                zone.innerHTML = '<p style="color:red; font-weight:bold;">Erreur : Réservation introuvable</p>';
            });
    });
}

// Gestion du Tableau de bord
const btnActualiser = document.getElementById('btn-actualiser');

if (btnActualiser) {
    // Date de fin de mois pour éviter les bugs serveur du début de mois
    const inputDate = document.getElementById('date-selection');
    inputDate.value = "2025-11-24"; 

    btnActualiser.addEventListener('click', function() {
        const date = inputDate.value;
        const tbody = document.getElementById('corps-tableau');

        tbody.innerHTML = '<tr><td colspan="5">Chargement...</td></tr>';

        appelerAPI(API_URL + '/liaison/' + ID_LIAISON + '/remplissage/' + date)
            .then(data => {
                tbody.innerHTML = '';
                
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5">Aucun trajet pour cette date.</td></tr>';
                    return;
                }
                
                data.forEach(t => {
                    const ratio = t.capacitePassagers > 0 ? (t.nbReservationPassagers / t.capacitePassagers) : 0;
                    
                    let classeEtat = "vert";
                    let texteEtat = "Disponible";

                    // Règles de couleur strictes du sujet
                    if (t.nbReservationPassagers > t.capacitePassagers) {
                        classeEtat = "jaune";
                        texteEtat = "Surbooking";
                    } else if (ratio >= 0.75) {
                        classeEtat = "rouge";
                        texteEtat = "Complet";
                    } else if (ratio >= 0.50) {
                        classeEtat = "orange";
                        texteEtat = "Chargé";
                    }

                    tbody.innerHTML += `
                        <tr>
                            <td>${t.heure}</td>
                            <td>Breizh Nevez</td>
                            <td>${t.nbReservationPassagers} / ${t.capacitePassagers}</td>
                            <td>${t.nbReservationVoitures} / ${t.capaciteVoitures}</td>
                            <td class="${classeEtat}">${texteEtat}</td>
                        </tr>`;
                });
            })
            .catch(err => {
                tbody.innerHTML = '<tr><td colspan="5" style="color:red">Erreur de chargement</td></tr>';
            });
    });
}

// Gestion de la page Statistiques
const statPassagers = document.getElementById('stat-passagers');

if (statPassagers) {
    appelerAPI(API_URL + '/liaison/' + ID_LIAISON + '/chiffreAffaire')
        .then(data => {
            const total = data.passagers.chiffreAffaire + data.vehicules.chiffreAffaire;
            
            document.getElementById('stat-passagers').textContent = data.passagers.nombre;
            document.getElementById('stat-vehicules').textContent = data.vehicules.quantite;
            document.getElementById('stat-ca').textContent = total.toFixed(2) + " €";
        })
        .catch(err => {
            console.error(err);
            document.getElementById('stat-ca').textContent = "Erreur...";
        });
}

// Génération HTML : Carte d'embarquement
function genererCarteHTML(resa, type, detailsItem, zone) {
    let titreSection = (type === 'PASSAGER') ? "Passager" : "Véhicule";
    let lignesDetails = "";

    if (type === 'PASSAGER') {
        lignesDetails = `
            <tr>
                <td><strong>Nom</strong></td> <td><strong>${detailsItem.nom}</strong></td>
            </tr>
            <tr>
                <td><strong>Prénom</strong></td> <td><strong>${detailsItem.prenom}</strong></td>
            </tr>
            <tr>
                <td><strong>Catégorie</strong></td> <td>${detailsItem.categorie}</td>
            </tr>
            <tr>
                <td><strong>Prix</strong></td> <td><strong>${detailsItem.prix}</strong></td>
            </tr>`;
    } else {
        lignesDetails = `
            <tr>
                <td><strong>Catégorie</strong></td> <td>${detailsItem.categorie}</td>
            </tr>
            <tr>
                <td><strong>Nombre</strong></td> <td><strong>${detailsItem.nombre}</strong></td>
            </tr>
            <tr>
                <td><strong>Prix</strong></td> <td><strong>${detailsItem.prix}</strong></td>
            </tr>`;
    }

    const html = `
    <article class="carte">
        <section class="carte-gauche">
            <header class="bloc-logo">
                <img src="CAN.png" alt="Logo">
                <div style="line-height: 1.2; font-size: 0.8em; font-weight: bold; color: #005b8e;">
                    Compagnie<br>Alsacienne de<br>Navigation
                </div>
            </header>
            
            <table class="tableau-gauche">
                <tr><th><strong>Gare de départ</strong></th> <td>${resa.portDepart || "Lorient"}</td></tr>
                <tr><th><strong>Gare d'arrivée</strong></th> <td>${resa.portArrivee || "Groix"}</td></tr>
                <tr><th><strong>Date</strong></th> <td>${resa.date || "01/11/2025"}</td></tr>
                <tr><th><strong>Heure départ</strong></th> <td>${resa.heure || "09:45"}</td></tr>
                <tr><th><strong>Bateau</strong></th> <td>Breizh Nevez</td></tr>
            </table>
        </section>

        <section class="carte-droite">
            <h2>Carte d'embarquement</h2>
            
            <section class="ticket-blanc">
                <div style="margin-bottom: 10px;">
                    <div style="display:flex; justify-content:space-between;">
                        <strong style="color:#555;">Réservation</strong>
                        <strong>${resa.id}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <strong style="color:#555;">Nom</strong>
                        <strong>${resa.nom}</strong>
                    </div>
                </div>

                <hr>

                <p><strong>${titreSection}</strong></p>
                
                <table class="tableau-details">
                    ${lignesDetails}
                </table>
            </section>
        </section>
    </article>
    `;

    zone.innerHTML += html;
}

// Génération HTML : Facture
function genererFactureHTML(data, zone) {
    // Variables attendues du C# (ou valeurs par défaut)
    const prixTotal = data.prixTotal || "0.00 €"; 
    
    let lignes = '';
    
    // Passagers
    if (data.nbPassagers > 0) {
        const pu = data.prixPassager || "- €"; 
        const totalLigne = data.totalPassagers || "- €";
        lignes += `<tr><td>Passagers</td><td>${data.nbPassagers}</td><td>${pu}</td><td>${totalLigne}</td></tr>`;
    }
    
    // Véhicules
    if (data.nbVehicules > 0) {
        const pu = data.prixVehicule || "- €";
        const totalLigne = data.totalVehicules || "- €";
        lignes += `<tr><td>Véhicules</td><td>${data.nbVehicules}</td><td>${pu}</td><td>${totalLigne}</td></tr>`;
    }

    const html = `
        <article style="background: white; border: 1px solid #ccc; padding: 20px; width: 80%; margin: 20px auto;">
            <p>
                <strong>Réservation n° : </strong>${data.id}<br>
                <strong>Nom : </strong>${data.nom}<br><br>
                <strong>Traversée : </strong>${data.portDepart} - ${data.portArrivee}<br>
                <strong>Date : </strong>${data.date} à ${data.heure}<br>
            </p>
            <p><strong>Détails</strong></p>
            <table>
                <thead>
                    <tr><th>Catégorie</th> <th>Quantité</th> <th>Prix unitaire</th> <th>Prix ligne</th></tr>
                </thead>
                <tbody>
                    ${lignes}
                </tbody>
            </table>
            
            <p style="text-align:right; font-weight:bold; font-size: 1.2em;">
                Total à payer : ${prixTotal}
            </p>
        </article>`;
    zone.innerHTML = html;
}